from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
import re

import httpx
from core.exceptions import ExternalAPIError, ResourceNotFoundError, ValidationError
from sqlalchemy.orm import Session, joinedload

from core.config import settings as config
from models.postgres_model import (
    Contact,
    MessageDirection,
    MessageStatus,
    MessageType,
    SenderType,
    WhatsAppAccountStatus,
    WhatsAppConversation,
    WhatsAppMediaFile,
    WhatsAppMessage,
)
from schemas.whatsapp_inbox import (
    SendMediaMessageRequest,
    SendTemplateMessageRequest,
    SendTextMessageRequest,
)
from services.whatsapp_service import WhatsAppRepository
import services.socket_service as socket_svc  # noqa: F401


class MessageService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = MessageRepository(db)
        from services.conversation_service import ConversationRepository
        self.conv_repo = ConversationRepository(db)

    def send_message(self, req: SendMessageRequest, agent_id: int = 1) -> dict:
        from services.whatsapp_service import WhatsAppService
        from services.webhook_service import WebhookService
        from schemas.whatsapp_inbox import MessageType as SchemaMessageType

        wa = WhatsAppService(self.db).get_active_account()

        if req.message_type == SchemaMessageType.TEXT:
            text_req = SendTextMessageRequest(
                conversation_id=req.conversation_id,
                content=req.content or "",
                reply_to_message_id=req.reply_to_message_id,
            )
            message = self.send_text_message(text_req, agent_id, wa.phone_number_id, wa.access_token)
        elif req.message_type in (
            SchemaMessageType.IMAGE, SchemaMessageType.VIDEO,
            SchemaMessageType.AUDIO, SchemaMessageType.DOCUMENT,
        ):
            media_req = SendMediaMessageRequest(
                conversation_id=req.conversation_id,
                message_type=req.message_type,
                media_url=req.media_url,
                media_id=req.media_id,
                caption=req.caption,
                file_name=req.file_name,
                reply_to_message_id=req.reply_to_message_id,
            )
            dispatch = {
                SchemaMessageType.IMAGE: self.send_image_message,
                SchemaMessageType.VIDEO: self.send_video_message,
                SchemaMessageType.AUDIO: self.send_audio_message,
                SchemaMessageType.DOCUMENT: self.send_document_message,
            }
            message = dispatch[req.message_type](media_req, agent_id, wa.phone_number_id, wa.access_token)
        elif req.message_type == SchemaMessageType.TEMPLATE:
            template_req = SendTemplateMessageRequest(
                conversation_id=req.conversation_id,
                template_name=req.template_name or "",
                language_code=req.language_code or "en_US",
                components=req.components,
            )
            message = self.send_template_message(template_req, agent_id, wa.phone_number_id, wa.access_token)
        else:
            raise ValidationError("Unsupported message type")

        ws = WebhookService(self.db)
        socket_svc.emit_new_message(message.conversation_id, ws._build_message_response(message))

        return self.serialize_message(message)

    def serialize_message(self, message: WhatsAppMessage) -> dict:
        """Serialize a WhatsAppMessage ORM object to API response dictionary."""
        mf_list = []
        for mf in (getattr(message, "media_files", None) or []):
            mf_list.append({
                "id": str(mf.id),
                "meta_media_id": mf.meta_media_id,
                "media_id": mf.meta_media_id,
                "file_name": mf.file_name,
                "file_url": mf.file_url,
                "file_size": mf.file_size,
                "mime_type": None,
            })

        def _enum(v):
            return v.value if hasattr(v, "value") else str(v) if v else None

        tmpl = None
        if not mf_list:
            tmpl = getattr(message, "template", None)
            if not tmpl and getattr(message, "template_id", None):
                from models.postgres_model import Template
                tmpl = self.db.query(Template).filter(Template.id == message.template_id).first()
            if not tmpl and getattr(message, "campaign_id", None):
                from models.postgres_model import Campaign
                camp = self.db.query(Campaign).filter(Campaign.id == message.campaign_id).first()
                if camp and camp.template_id:
                    from models.postgres_model import Template
                    tmpl = self.db.query(Template).filter(Template.id == camp.template_id).first()
            if not tmpl and message.content and message.content.startswith("Template: "):
                t_name = message.content.replace("Template: ", "").strip()
                from sqlalchemy import func
                from models.postgres_model import Template
                tmpl = self.db.query(Template).filter(func.lower(Template.template_name) == t_name.lower()).first()

        display_content = message.content
        if tmpl:
            tmpl_body = None
            if tmpl.components and isinstance(tmpl.components, list):
                for comp in tmpl.components:
                    if isinstance(comp, dict) and comp.get("type", "").upper() == "BODY":
                        tmpl_body = comp.get("text")
                        break
            if tmpl_body and (not display_content or display_content.startswith("Template: ")):
                display_content = tmpl_body

            h_type_str = (tmpl.header_type.value if hasattr(tmpl.header_type, "value") else str(tmpl.header_type or "")).upper()
            if h_type_str in ("IMAGE", "VIDEO", "DOCUMENT"):
                media_link = tmpl.header_media_url
                if not media_link and tmpl.components and isinstance(tmpl.components, list):
                    for comp in tmpl.components:
                        if isinstance(comp, dict) and comp.get("type", "").upper() == "HEADER":
                            ex = comp.get("example", {})
                            if isinstance(ex, dict):
                                handles = ex.get("header_handle") or ex.get("header_url")
                                if handles and isinstance(handles, list) and len(handles) > 0 and handles[0]:
                                    media_link = handles[0]

                if media_link:
                    mf_list.append({
                        "id": f"tmpl_{message.id}",
                        "meta_media_id": None,
                        "media_id": None,
                        "file_name": f"{tmpl.template_name}",
                        "file_url": media_link,
                        "file_size": 0,
                        "mime_type": f"{h_type_str.lower()}/png" if h_type_str == "IMAGE" else "application/pdf",
                    })


        rx_list = []
        for r in (getattr(message, "reactions", None) or []):
            contact = getattr(r, "contact", None)
            rx_list.append({
                "id": str(r.id),
                "message_id": str(r.message_id),
                "emoji": r.emoji,
                "customer_phone": contact.phone_number if contact else None,
                "created_at": r.created_at.isoformat() + "Z" if r.created_at else None,
            })

        return {
            "id": str(message.id),
            "conversation_id": str(message.conversation_id),
            "meta_message_id": message.meta_message_id,
            "direction": _enum(message.direction),
            "sender_type": _enum(message.sender_type),
            "sender_id": str(message.sender_id) if message.sender_id else None,
            "message_type": _enum(message.message_type),
            "content": display_content,
            "caption": message.caption,
            "status": _enum(message.status) or "SENT",
            "is_deleted": bool(message.is_deleted),
            "reply_to_message_id": str(message.reply_to_message_id) if message.reply_to_message_id else None,
            "media_files": mf_list,
            "reactions": rx_list,
            "created_at": (
                message.created_at.isoformat()
                if message.created_at and ("+" in message.created_at.isoformat()[10:] or message.created_at.isoformat().endswith("Z"))
                else (message.created_at.isoformat() + "Z" if message.created_at else None)
            ),
        }

    def _meta_url(self, phone_number_id: str) -> str:

        meta_base_url = getattr(config, "META_BASE_URL", "https://graph.facebook.com")
        meta_api_version = getattr(config, "META_API_VERSION", "v23.0")
        return f"{meta_base_url}/{meta_api_version}/{phone_number_id}/messages"

    @staticmethod
    def _normalize_phone(phone: str) -> str:
        if not phone:
            return ""
        digits = re.sub(r"\D", "", phone)
        return digits.strip()

    def _get_conv_phone(self, conv: WhatsAppConversation) -> str:
        """Return the customer phone from the contact FK (new schema)."""
        if conv.contact:
            return self._normalize_phone(conv.contact.phone_number)
        return ""

    def _post_to_meta(self, phone_number_id: str, access_token: str, payload: dict) -> dict:
        url = self._meta_url(phone_number_id)
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=30.0) as client:
            try:
                resp = client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                response = e.response
                status_code = response.status_code if response is not None else None
                try:
                    body = response.json() if response is not None else {}
                except ValueError:
                    body = {"error": response.text if response is not None else str(e)}

                error_data = None
                error_message = None
                if isinstance(body, dict):
                    error_data = body.get("error")
                    if isinstance(error_data, dict):
                        error_message = error_data.get("message")
                if not error_message:
                    error_message = body.get("error") if isinstance(body, dict) else None
                if not error_message:
                    error_message = response.text if response is not None else str(e)

                if status_code == 401 and isinstance(error_data, dict):
                    if error_data.get("code") == 190:
                        self._deactivate_invalid_account(phone_number_id)
                        raise ExternalAPIError(
                            "WhatsApp access token is invalid or expired. Please reconnect your WhatsApp account."
                        )

                raise ExternalAPIError(
                    f"Meta API error ({status_code}): {error_message}"
                )
            except httpx.RequestError as e:
                raise ExternalAPIError(
                    f"Meta request error: {str(e)}"
                )

    def _deactivate_invalid_account(self, phone_number_id: str) -> None:
        wa_repo = WhatsAppRepository(self.db)
        account = wa_repo.get_by_phone_number_id(phone_number_id)
        if account:
            wa_repo.update(account.id, status=WhatsAppAccountStatus.DISCONNECTED)

    def _base_create_kwargs(self, conv: WhatsAppConversation, agent_id: int) -> dict:
        """Common fields for any outbound agent message."""
        return {
            "organization_id": conv.organization_id,
            "whatsapp_account_id": conv.whatsapp_account_id,
            "conversation_id": conv.id,
            "contact_id": conv.contact_id,
            "direction": MessageDirection.OUTBOUND,
            "sender_type": SenderType.AGENT,
            "sender_id": agent_id,
            "created_at": datetime.now(),
        }


    # ------------------------------------------------------------------
    # Send methods
    # ------------------------------------------------------------------

    def send_text_message(
        self,
        request: SendTextMessageRequest,
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppMessage:
        conv = self.conv_repo.get_by_id(uuid.UUID(request.conversation_id))
        if not conv:
            raise ResourceNotFoundError("Conversation not found")

        message = self.repo.create(
            **self._base_create_kwargs(conv, agent_id),
            message_type=MessageType.TEXT,
            content=request.content,
            status=MessageStatus.PENDING,
            reply_to_message_id=(
                uuid.UUID(request.reply_to_message_id)
                if request.reply_to_message_id else None
            ),
        )

        payload = {
            "messaging_product": "whatsapp",
            "to": self._get_conv_phone(conv),
            "type": "text",
            "text": {"body": request.content, "preview_url": False},
        }

        if request.reply_to_message_id:
            orig = self.repo.get_by_id(uuid.UUID(request.reply_to_message_id))
            if orig and orig.meta_message_id:
                payload["context"] = {"message_id": orig.meta_message_id}

        try:
            result = self._post_to_meta(phone_number_id, access_token, payload)
            meta_id = result.get("messages", [{}])[0].get("id")
            message = self.repo.update(message.id, meta_message_id=meta_id, status=MessageStatus.SENT)
            self.conv_repo.update_conv(conv.id, last_message_at=datetime.now(), status="PENDING")
            return message
        except Exception as e:
            self.repo.update(message.id, status=MessageStatus.FAILED)
            if isinstance(e, ExternalAPIError):
                raise
            raise ExternalAPIError(f"WhatsApp send failed: {str(e)}")

    def send_image_message(
        self,
        request: SendMediaMessageRequest,
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppMessage:
        conv = self.conv_repo.get_by_id(uuid.UUID(request.conversation_id))
        if not conv:
            raise ResourceNotFoundError("Conversation not found")

        image_obj: dict = {}
        if request.media_url:
            image_obj["link"] = request.media_url
        elif request.media_id:
            image_obj["id"] = request.media_id
        if request.caption:
            image_obj["caption"] = request.caption

        payload = {
            "messaging_product": "whatsapp",
            "to": self._get_conv_phone(conv),
            "type": "image",
            "image": image_obj,
        }
        result = self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = self.repo.create(
            **self._base_create_kwargs(conv, agent_id),
            meta_message_id=meta_id,
            message_type=MessageType.IMAGE,
            caption=request.caption,
            status=MessageStatus.SENT,
        )
        self.conv_repo.update_conv(conv.id, last_message_at=datetime.now(timezone.utc), status="PENDING")
        return message

    def send_video_message(
        self,
        request: SendMediaMessageRequest,
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppMessage:
        conv = self.conv_repo.get_by_id(uuid.UUID(request.conversation_id))
        if not conv:
            raise ResourceNotFoundError("Conversation not found")

        video_obj: dict = {}
        if request.media_url:
            video_obj["link"] = request.media_url
        elif request.media_id:
            video_obj["id"] = request.media_id
        if request.caption:
            video_obj["caption"] = request.caption

        payload = {
            "messaging_product": "whatsapp",
            "to": self._get_conv_phone(conv),
            "type": "video",
            "video": video_obj,
        }
        result = self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = self.repo.create(
            **self._base_create_kwargs(conv, agent_id),
            meta_message_id=meta_id,
            message_type=MessageType.VIDEO,
            caption=request.caption,
            status=MessageStatus.SENT,
        )
        self.conv_repo.update_conv(conv.id, last_message_at=datetime.now(timezone.utc), status="PENDING")
        return message

    def send_audio_message(
        self,
        request: SendMediaMessageRequest,
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppMessage:
        conv = self.conv_repo.get_by_id(uuid.UUID(request.conversation_id))
        if not conv:
            raise ResourceNotFoundError("Conversation not found")

        audio_obj: dict = {}
        if request.media_url:
            audio_obj["link"] = request.media_url
        elif request.media_id:
            audio_obj["id"] = request.media_id

        payload = {
            "messaging_product": "whatsapp",
            "to": self._get_conv_phone(conv),
            "type": "audio",
            "audio": audio_obj,
        }
        result = self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = self.repo.create(
            **self._base_create_kwargs(conv, agent_id),
            meta_message_id=meta_id,
            message_type=MessageType.AUDIO,
            status=MessageStatus.SENT,
        )
        self.conv_repo.update_conv(conv.id, last_message_at=datetime.now(timezone.utc), status="PENDING")
        return message

    def send_document_message(
        self,
        request: SendMediaMessageRequest,
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppMessage:
        conv = self.conv_repo.get_by_id(uuid.UUID(request.conversation_id))
        if not conv:
            raise ResourceNotFoundError("Conversation not found")

        doc_obj: dict = {}
        if request.media_url:
            doc_obj["link"] = request.media_url
        elif request.media_id:
            doc_obj["id"] = request.media_id
        if request.caption:
            doc_obj["caption"] = request.caption
        if request.file_name:
            doc_obj["filename"] = request.file_name

        payload = {
            "messaging_product": "whatsapp",
            "to": self._get_conv_phone(conv),
            "type": "document",
            "document": doc_obj,
        }
        result = self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = self.repo.create(
            **self._base_create_kwargs(conv, agent_id),
            meta_message_id=meta_id,
            message_type=MessageType.DOCUMENT,
            caption=request.caption,
            status=MessageStatus.SENT,
        )
        self.conv_repo.update_conv(conv.id, last_message_at=datetime.now(timezone.utc), status="PENDING")
        return message

    def send_template_message(
        self,
        request: SendTemplateMessageRequest,
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppMessage:
        from models.postgres_model import Template

        conv = self.conv_repo.get_by_id(uuid.UUID(request.conversation_id))
        if not conv:
            raise ResourceNotFoundError("Conversation not found")

        # Resolve template body for display
        template_body: str = request.template_name
        template_db_id = None
        try:
            local_template = (
                self.db.query(Template)
                .filter(Template.template_name == request.template_name)
                .order_by(Template.id)
                .first()
            )
            if local_template:
                template_db_id = local_template.id
                if local_template.template_body:
                    template_body = local_template.template_body
                    if request.components:
                        for comp in request.components:
                            if comp.get("type") == "body":
                                params = comp.get("parameters", [])
                                for idx, param in enumerate(params, start=1):
                                    placeholder = "{{" + str(idx) + "}}"
                                    template_body = template_body.replace(placeholder, param.get("text", ""))
        except Exception:
            pass

        components_payload = request.components or []
        if not components_payload and local_template:
            from services.template_service import resolve_template_header_component
            components_payload = resolve_template_header_component(
                local_template,
                access_token=access_token,
                phone_number_id=phone_number_id,
            )

        template_obj: dict = {
            "name": request.template_name,
            "language": {"code": request.language_code},
        }

        if components_payload:
            template_obj["components"] = components_payload

        payload = {
            "messaging_product": "whatsapp",
            "to": self._get_conv_phone(conv),
            "type": "template",
            "template": template_obj,
        }

        result = self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = self.repo.create(
            **self._base_create_kwargs(conv, agent_id),
            meta_message_id=meta_id,
            message_type=MessageType.TEMPLATE,
            content=template_body,
            template_id=template_db_id,
            status=MessageStatus.SENT,
        )
        self.conv_repo.update_conv(conv.id, last_message_at=datetime.now(timezone.utc), status="PENDING")
        return message

    def send_media_upload(
        self,
        conversation_id: uuid.UUID,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        message_type_str: str,
        caption: Optional[str],
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> dict:
        from core.config import settings as cfg
        from services.media_service import MediaService

        conv = self.conv_repo.get_by_id(conversation_id)
        if not conv:
            raise ResourceNotFoundError("Conversation not found")

        base = cfg.META_BASE_URL.rstrip("/")
        version = cfg.META_API_VERSION

        # 1. Upload media to Meta API
        upload_url = f"{base}/{version}/{phone_number_id}/media"
        headers = {"Authorization": f"Bearer {access_token}"}

        with httpx.Client(timeout=60.0) as client:
            upload_resp = client.post(
                upload_url,
                headers=headers,
                files={"file": (filename, file_bytes, mime_type)},
                data={"messaging_product": "whatsapp"},
            )
            upload_resp.raise_for_status()
            meta_media_id = upload_resp.json().get("id")

        if not meta_media_id:
            raise ExternalAPIError("Media upload to Meta failed")

        media_url = ""
        try:
            media_url = MediaService(self.db).get_meta_media_url(meta_media_id, access_token)
        except Exception:
            pass

        # 2. Send message via Meta API
        type_key = message_type_str.lower()
        media_payload: dict = {"id": meta_media_id}
        if caption and type_key in ("image", "video", "document"):
            media_payload["caption"] = caption
        if type_key == "document":
            media_payload["filename"] = filename

        clean_phone = self._get_conv_phone(conv)

        send_url = f"{base}/{version}/{phone_number_id}/messages"
        send_payload = {
            "messaging_product": "whatsapp",
            "to": clean_phone,
            "type": type_key,
            type_key: media_payload,
        }

        with httpx.Client(timeout=30.0) as client:
            send_resp = client.post(
                send_url,
                json=send_payload,
                headers={**headers, "Content-Type": "application/json"},
            )
            send_resp.raise_for_status()
            meta_msg_id = send_resp.json().get("messages", [{}])[0].get("id")

        # 3. Create DB records
        msg = WhatsAppMessage(
            organization_id=conv.organization_id,
            whatsapp_account_id=conv.whatsapp_account_id,
            conversation_id=conv.id,
            contact_id=conv.contact_id,
            meta_message_id=meta_msg_id,
            direction=MessageDirection.OUTBOUND,
            sender_type=SenderType.AGENT,
            sender_id=agent_id,
            message_type=MessageType(message_type_str),
            caption=caption,
            status=MessageStatus.SENT,
        )
        self.db.add(msg)
        self.db.flush()

        media_file = WhatsAppMediaFile(
            message_id=msg.id,
            meta_media_id=meta_media_id,
            file_name=filename,
            file_url=media_url,
            file_size=len(file_bytes),
            media_type=MessageType(message_type_str) if message_type_str in [e.value for e in MessageType] else None,
        )
        self.db.add(media_file)

        conv.last_message_at = datetime.now()
        conv.status = "PENDING"
        self.db.commit()
        self.db.refresh(msg)

        media_dict = {
            "id": str(media_file.id),
            "meta_media_id": meta_media_id,
            "media_id": meta_media_id,
            "file_name": filename,
            "file_url": media_url,
            "file_size": len(file_bytes),
            "mime_type": mime_type,
        }

        response_dict = {
            "id": str(msg.id),
            "conversation_id": str(conv.id),
            "meta_message_id": meta_msg_id,
            "direction": "OUTBOUND",
            "sender_type": "AGENT",
            "sender_id": str(agent_id),
            "message_type": message_type_str,
            "content": caption,
            "caption": caption,
            "status": "SENT",
            "is_deleted": False,
            "reply_to_message_id": None,
            "media_files": [media_dict],
            "reactions": [],
            "created_at": msg.created_at.isoformat() + "Z" if msg.created_at else None,
        }

        socket_svc.emit_new_message(conv.id, response_dict)
        return response_dict

    def handle_media_upload(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        conversation_id_str: str,
        message_type_str: str = "DOCUMENT",
        caption: Optional[str] = None,
        agent_id: int = 1,
    ) -> dict:
        if not file_bytes or not conversation_id_str:
            raise ValidationError("file_bytes and conversation_id are required")
        try:
            conv_uuid = uuid.UUID(conversation_id_str)
        except ValueError:
            raise ValidationError("Invalid conversation_id")

        from services.whatsapp_service import WhatsAppService
        wa = WhatsAppService(self.db).get_active_account()

        return self.send_media_upload(
            conversation_id=conv_uuid,
            file_bytes=file_bytes,
            filename=filename,
            mime_type=mime_type,
            message_type_str=(message_type_str or "DOCUMENT").upper(),
            caption=caption,
            agent_id=agent_id,
            phone_number_id=wa.phone_number_id,
            access_token=wa.access_token,
        )

    def send_location(
        self,
        conversation_id: uuid.UUID,
        latitude: float,
        longitude: float,
        name: str,
        address: str,
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppMessage:
        from core.config import settings as cfg

        conv = self.conv_repo.get_by_id(conversation_id)
        if not conv:
            raise ResourceNotFoundError("Conversation not found")

        clean_phone = self._get_conv_phone(conv)
        base = cfg.META_BASE_URL.rstrip("/")
        version = cfg.META_API_VERSION
        send_url = f"{base}/{version}/{phone_number_id}/messages"
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

        location_obj: dict = {"latitude": float(latitude), "longitude": float(longitude)}
        if name:
            location_obj["name"] = name
        if address:
            location_obj["address"] = address

        send_payload = {
            "messaging_product": "whatsapp",
            "to": clean_phone,
            "type": "location",
            "location": location_obj,
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(send_url, json=send_payload, headers=headers)
                resp.raise_for_status()
                meta_msg_id = resp.json().get("messages", [{}])[0].get("id")
        except httpx.HTTPStatusError as e:
            raise ExternalAPIError(f"Meta API error: {e.response.text}")

        content = f"📍 {name or ''} ({latitude}, {longitude})"
        msg = WhatsAppMessage(
            organization_id=conv.organization_id,
            whatsapp_account_id=conv.whatsapp_account_id,
            conversation_id=conv.id,
            contact_id=conv.contact_id,
            meta_message_id=meta_msg_id,
            direction=MessageDirection.OUTBOUND,
            sender_type=SenderType.AGENT,
            sender_id=agent_id,
            message_type=MessageType.LOCATION,
            content=content,
            status=MessageStatus.SENT,
        )
        self.db.add(msg)
        conv.last_message_at = datetime.utcnow()
        conv.status = "PENDING"
        self.db.commit()
        self.db.refresh(msg)
        return msg

    def delete_message(self, message_id: uuid.UUID) -> bool:
        msg = self.db.query(WhatsAppMessage).filter(WhatsAppMessage.id == message_id).first()
        if not msg:
            return False
        msg.is_deleted = True
        msg.content = None
        msg.caption = None
        self.db.commit()
        socket_svc.emit_message_deleted(msg.conversation_id, msg.id)
        return True

    def delete_messages_bulk(self, message_ids: list[uuid.UUID]) -> int:
        msgs = self.db.query(WhatsAppMessage).filter(WhatsAppMessage.id.in_(message_ids)).all()
        if not msgs:
            return 0
        for m in msgs:
            m.is_deleted = True
            m.content = None
            m.caption = None
            socket_svc.emit_message_deleted(m.conversation_id, m.id)
        self.db.commit()
        return len(msgs)

    def update_message_status(self, meta_message_id: str, new_status: str) -> None:
        self.repo.update_status_by_meta_id(meta_message_id, new_status)



# ==============================================================================
# MessageRepository
# ==============================================================================

class MessageRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, message_id: uuid.UUID) -> Optional[WhatsAppMessage]:
        return (
            self.db.query(WhatsAppMessage)
            .options(
                joinedload(WhatsAppMessage.reactions),
                joinedload(WhatsAppMessage.media_files),
            )
            .filter(WhatsAppMessage.id == message_id)
            .first()
        )

    def get_by_meta_id(self, meta_message_id: str) -> Optional[WhatsAppMessage]:
        return (
            self.db.query(WhatsAppMessage)
            .filter(WhatsAppMessage.meta_message_id == meta_message_id)
            .first()
        )

    def create(self, **kwargs) -> WhatsAppMessage:
        # Deduplicate by meta_message_id
        meta_id = kwargs.get("meta_message_id")
        if meta_id:
            existing = self.get_by_meta_id(meta_id)
            if existing:
                return existing

        # Guard against near-duplicate agent TEXT messages within 120s window
        conv_id = kwargs.get("conversation_id")
        content = kwargs.get("content")
        try:
            if conv_id and content is not None:
                message_type = kwargs.get("message_type", MessageType.TEXT)
                if kwargs.get("sender_type") == SenderType.AGENT and message_type == MessageType.TEXT:
                    window_start = datetime.now(timezone.utc) - timedelta(seconds=120)
                    recent = (
                        self.db.query(WhatsAppMessage)
                        .filter(WhatsAppMessage.conversation_id == conv_id)
                        .filter(WhatsAppMessage.sender_type == SenderType.AGENT)
                        .filter(WhatsAppMessage.content == content)
                        .filter(WhatsAppMessage.created_at >= window_start)
                        .first()
                    )
                    if recent:
                        return recent
        except Exception:
            pass

        message = WhatsAppMessage(**kwargs)
        self.db.add(message)
        self.db.commit()
        return self.get_by_id(message.id)

    def update(self, message_id: uuid.UUID, **kwargs) -> Optional[WhatsAppMessage]:
        message = self.get_by_id(message_id)
        if message:
            for k, v in kwargs.items():
                setattr(message, k, v)
            self.db.commit()
            self.db.refresh(message)
        return message

    def update_status_by_meta_id(self, meta_message_id: str, status: str) -> None:
        message = self.get_by_meta_id(meta_message_id)
        if message:
            message.status = status
            self.db.commit()

    def list_by_conversation(
        self,
        conversation_id: uuid.UUID,
        before_cursor: Optional[datetime] = None,
        page_size: int = 30,
    ) -> tuple[list[WhatsAppMessage], int]:
        query = self.db.query(WhatsAppMessage).filter(
            WhatsAppMessage.conversation_id == conversation_id
        )
        if before_cursor:
            query = query.filter(WhatsAppMessage.created_at < before_cursor)

        total = query.count()
        messages = (
            query.options(
                joinedload(WhatsAppMessage.reactions),
                joinedload(WhatsAppMessage.media_files),
            )
            .order_by(WhatsAppMessage.created_at.desc())
            .limit(page_size)
            .all()
        )
        messages.reverse()
        return messages, total
