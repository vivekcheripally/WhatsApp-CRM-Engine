from __future__ import annotations

import uuid
from typing import Optional, List

import httpx
from core.exceptions import DomainException, ExternalAPIError, ResourceNotFoundError, ValidationError
from sqlalchemy.orm import Session

from core.config import settings as config
from models.postgres_model import (
    Organization,
    OrganizationStatus,
    UserRole,
    WhatsAppAccount,
    WhatsAppAccountStatus,
)
from repositories.channel_assignment_repository import ChannelAssignmentRepository
from schemas.whatsapp_inbox import WhatsAppConnectRequest


class WhatsAppService:
    def __init__(self, db: Session, org_id: Optional[uuid.UUID] = None):
        self.db = db
        self.org_id = org_id
        self.repo = WhatsAppRepository(db)

    def get_active_account(self, waba_account_id: Optional[uuid.UUID] = None) -> WhatsAppAccount:
        q = self.db.query(WhatsAppAccount).filter(WhatsAppAccount.status == WhatsAppAccountStatus.ACTIVE)
        if self.org_id:
            q = q.filter(WhatsAppAccount.organization_id == self.org_id)
        
        if waba_account_id:
            wa = q.filter(WhatsAppAccount.id == waba_account_id).first()
        else:
            wa = q.filter(WhatsAppAccount.is_default == True).first() or q.first()

        if not wa or not wa.access_token or not wa.phone_number_id:
            raise ResourceNotFoundError(
                "WhatsApp account is not connected. Go to Settings to connect.",
            )
        return wa

    def list_channels_dto(self, current_user: Optional[dict] = None) -> dict:
        if not self.org_id:
            return {"success": False, "channels": [], "error": "Organization context required"}
        channels = self.repo.get_channels_by_org(self.org_id)

        # RLS Filtering: Sales Agents ONLY see WABA channels assigned to them
        if current_user and current_user.get("role") == UserRole.SALES_AGENT.value:
            agent_uuid = uuid.UUID(current_user["id"])
            assigned_channel_ids = ChannelAssignmentRepository.get_assigned_channel_ids(self.db, agent_uuid, self.org_id)
            channels = [ch for ch in channels if ch.id in assigned_channel_ids]

        result = []
        for ch in channels:
            st_str = ch.status.value if hasattr(ch.status, "value") else str(ch.status)
            result.append({
                "id": str(ch.id),
                "organization_id": str(ch.organization_id),
                "channel_name": ch.channel_name or ch.account_name or "Primary WABA",
                "waba_id": ch.waba_id or "",
                "phone_number_id": ch.phone_number_id or "",
                "display_phone_number": ch.display_phone_number or "",
                "verified_name": ch.verified_name or "",
                "status": st_str,
                "is_default": bool(ch.is_default),
                "created_at": ch.created_at.isoformat() if ch.created_at else None,
            })
        return {"success": True, "channels": result}

    def set_default_channel_dto(self, account_id: str) -> dict:
        if not self.org_id:
            return {"success": False, "error": "Organization context required"}
        try:
            self.repo.set_default_channel(uuid.UUID(account_id), self.org_id)
            return {"success": True, "message": "Primary default channel updated successfully"}
        except ResourceNotFoundError as e:
            return {"success": False, "error": str(e)}

    def delete_channel_dto(self, account_id: str) -> dict:
        if not self.org_id:
            return {"success": False, "error": "Organization context required"}
        try:
            acc_uuid = uuid.UUID(account_id)
            account = self.repo.get_by_id(acc_uuid)
            if not account or account.organization_id != self.org_id:
                return {"success": False, "error": "Channel not found"}
            self.repo.delete(acc_uuid)
            return {"success": True, "message": "Channel disconnected successfully"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def send_direct_template_message(self, to: str, template_name: str, waba_account_id: Optional[uuid.UUID] = None) -> dict:
        from datetime import datetime
        from models.postgres_model import MessageDirection, MessageStatus, MessageType, SenderType, Template, WhatsAppMessage
        from services.meta_service import MetaWhatsAppService
        from services.conversation_service import ConversationService
        import services.socket_service as socket_svc
        from services.webhook_service import WebhookService

        try:
            account = self.get_active_account(waba_account_id=waba_account_id)
        except DomainException as e:
            return {"success": False, "error": e.message}

        svc = MetaWhatsAppService(account.access_token, account.phone_number_id)

        tmpl = self.db.query(Template).filter(Template.template_name == template_name)
        if self.org_id:
            tmpl = tmpl.filter(Template.organization_id == self.org_id)
        tmpl = tmpl.first()
        language_code = (tmpl.language or "en_US") if tmpl else "en_US"

        components_payload = []
        if tmpl:
            from services.template_service import resolve_template_header_component
            components_payload = resolve_template_header_component(
                tmpl,
                access_token=account.access_token,
                phone_number_id=account.phone_number_id,
            )

        result = svc.send_template_message(
            to=to,
            template_name=template_name,
            language_code=language_code,
            components=components_payload if components_payload else None,
        )

        if isinstance(result, dict) and result.get("success") is False:
            meta_err = result.get("error")
            err_msg = str(meta_err)
            if isinstance(meta_err, dict):
                err_msg = (
                    meta_err.get("error_user_msg")
                    or meta_err.get("message")
                    or (meta_err.get("error_data") or {}).get("details")
                    or str(meta_err)
                )
            return {"success": False, "error": err_msg, "meta_response": result}

        meta_msg_id = None
        if isinstance(result, dict):
            meta_msg_id = (
                result.get("messages", [{}])[0].get("id")
                if isinstance(result.get("messages"), list)
                else result.get("id")
            )

        try:
            conv_svc = ConversationService(self.db)
            conv, _ = conv_svc.get_or_create(
                customer_phone=to,
                whatsapp_account_id=account.id,
                organization_id=account.organization_id,
            )

            header_media_id = None
            header_media_link = None
            header_type_enum = MessageType.TEMPLATE
            if components_payload and isinstance(components_payload, list) and len(components_payload) > 0:
                params = components_payload[0].get("parameters", [])
                if params and len(params) > 0:
                    p_type = params[0].get("type", "")
                    p_obj = params[0].get(p_type, {})
                    header_media_id = p_obj.get("id")
                    header_media_link = p_obj.get("link")
                    if p_type.upper() == "IMAGE":
                        header_type_enum = MessageType.IMAGE
                    elif p_type.upper() == "VIDEO":
                        header_type_enum = MessageType.VIDEO
                    elif p_type.upper() == "DOCUMENT":
                        header_type_enum = MessageType.DOCUMENT

            template_body_text = (
                tmpl.template_body if (tmpl and tmpl.template_body)
                else f"[Template: {template_name}]"
            )

            inbox_msg = WhatsAppMessage(
                organization_id=account.organization_id,
                whatsapp_account_id=account.id,
                conversation_id=conv.id,
                contact_id=conv.contact_id,
                meta_message_id=meta_msg_id,
                direction=MessageDirection.OUTBOUND,
                sender_type=SenderType.AGENT,
                message_type=header_type_enum,
                content=template_body_text,
                template_id=tmpl.id if tmpl else None,
                status=MessageStatus.SENT if meta_msg_id else MessageStatus.FAILED,
            )
            self.db.add(inbox_msg)
            self.db.flush()

            if header_media_id or header_media_link or (tmpl and tmpl.header_media_url):
                from models.postgres_model import WhatsAppMediaFile
                import uuid
                temp_m_id = uuid.uuid4()
                stream_url = header_media_link or (tmpl.header_media_url if tmpl else None) or f"/api/messages/media/{temp_m_id}/stream"
                m_file = WhatsAppMediaFile(
                    id=temp_m_id,
                    message_id=inbox_msg.id,
                    meta_media_id=header_media_id,
                    file_name=template_name,
                    file_url=stream_url,
                    media_type=header_type_enum,
                )
                self.db.add(m_file)

            conv.last_message_at = datetime.now()
            conv.status = "OPEN"
            self.db.commit()
            self.db.refresh(inbox_msg)

            try:
                ws = WebhookService(self.db)
                socket_svc.emit_new_message(conv.id, ws._build_message_response(inbox_msg))
            except Exception as e:
                print(f"[send_message] Socket broadcast warning: {e}")
        except Exception as e:
            print(f"[send_message] Error creating message record: {e}")

        return result

    def get_status_dto(self, waba_account_id: Optional[uuid.UUID] = None) -> dict:
        try:
            account = self.get_active_account(waba_account_id=waba_account_id)
            is_active = (account.status == WhatsAppAccountStatus.ACTIVE)
            st_str = account.status.value if hasattr(account.status, "value") else str(account.status)
            return {
                "connected": is_active,
                "status": st_str,
                "phone_number_id": account.phone_number_id,
                "display_phone_number": account.display_phone_number,
                "channel_name": account.channel_name or account.account_name,
                "is_default": account.is_default,
            }
        except Exception:
            return {"connected": False, "status": "DISCONNECTED"}

    def get_settings_dto(self, waba_account_id: Optional[uuid.UUID] = None) -> dict:
        try:
            account = self.get_active_account(waba_account_id=waba_account_id)
            st_str = account.status.value if hasattr(account.status, "value") else str(account.status)
            return {
                "success": True,
                "connected": (account.status == WhatsAppAccountStatus.ACTIVE),
                "waba_id": account.waba_id or "",
                "phone_number_id": account.phone_number_id or "",
                "access_token": account.access_token or "",
                "display_phone_number": account.display_phone_number or "",
                "verified_name": account.verified_name or "",
                "channel_name": account.channel_name or account.account_name or "",
                "is_default": account.is_default,
                "status": st_str,
            }
        except Exception:
            return {
                "success": True,
                "connected": False,
                "waba_id": "",
                "phone_number_id": "",
                "access_token": "",
                "display_phone_number": "",
                "verified_name": "",
                "channel_name": "",
                "is_default": False,
                "status": "DISCONNECTED",
            }

    def update_settings_dto(self, payload: any, waba_account_id: Optional[uuid.UUID] = None) -> dict:
        data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else (payload if isinstance(payload, dict) else {})
        try:
            account = self.get_active_account(waba_account_id=waba_account_id)
            for field in ("waba_id", "phone_number_id", "access_token", "account_name", "channel_name"):
                if field in data and data[field]:
                    setattr(account, field, data[field])
            if "status" in data and data["status"] == "ACTIVE":
                account.status = WhatsAppAccountStatus.ACTIVE
            if "is_default" in data and data["is_default"] and self.org_id:
                self.repo.set_default_channel(account.id, self.org_id)
            else:
                self.db.commit()
                self.db.refresh(account)
        except Exception:
            req = WhatsAppConnectRequest(
                waba_id=data.get("waba_id", ""),
                phone_number_id=data.get("phone_number_id", ""),
                access_token=data.get("access_token", ""),
                account_name=data.get("account_name", "Default Account"),
                channel_name=data.get("channel_name", None),
            )
            account = self.connect(req)

        st_str = account.status.value if hasattr(account.status, "value") else str(account.status)
        return {
            "success": True,
            "connected": (account.status == WhatsAppAccountStatus.ACTIVE),
            "waba_id": account.waba_id or "",
            "phone_number_id": account.phone_number_id or "",
            "access_token": account.access_token or "",
            "display_phone_number": account.display_phone_number or "",
            "verified_name": account.verified_name or "",
            "channel_name": account.channel_name or account.account_name or "",
            "is_default": account.is_default,
            "status": st_str,
        }

    def validate_token(self, access_token: str, phone_number_id: str) -> dict:
        meta_base_url = getattr(config, "META_BASE_URL", "https://graph.facebook.com")
        meta_api_version = getattr(config, "META_API_VERSION", "v23.0")
        url = f"{meta_base_url}/{meta_api_version}/{phone_number_id}"
        headers = {"Authorization": f"Bearer {access_token}"}

        with httpx.Client(timeout=10.0) as client:
            try:
                resp = client.get(url, headers=headers)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                raise ExternalAPIError(
                    f"Invalid Meta credentials: {e.response.text}",
                )
            except httpx.RequestError:
                raise ExternalAPIError(
                    "Could not reach Meta API",
                )

    def connect(self, request: WhatsAppConnectRequest) -> WhatsAppAccount:
        if not self.org_id:
            raise ValidationError("Organization ID context is required to connect a WhatsApp account.")

        phone_data = self.validate_token(request.access_token, request.phone_number_id)
        display_phone = phone_data.get("display_phone_number")
        verified_name = phone_data.get("verified_name")
        ch_name = request.channel_name or request.account_name or (f"WABA Channel ({display_phone})" if display_phone else "Primary WABA")

        account = self.repo.upsert(
            organization_id=self.org_id,
            account_name=request.account_name or "Default Account",
            channel_name=ch_name,
            waba_id=request.waba_id,
            phone_number_id=request.phone_number_id,
            access_token=request.access_token,
            display_phone_number=display_phone,
            verified_name=verified_name,
            status=WhatsAppAccountStatus.ACTIVE,
        )

        self.db.commit()

        try:
            from services.template_service import sync_all_templates_from_meta
            sync_all_templates_from_meta(
                self.db,
                organization_id=self.org_id,
                whatsapp_account_id=account.id,
            )
        except Exception as e:
            print(f"[WhatsAppService] Auto template sync warning: {e}")

        return account

    def connect_dto(self, request: WhatsAppConnectRequest) -> dict:
        account = self.connect(request)
        st_str = account.status.value if hasattr(account.status, "value") else str(account.status)
        return {
            "success": True,
            "account": {
                "id": str(account.id),
                "waba_id": account.waba_id,
                "phone_number_id": account.phone_number_id,
                "display_phone_number": account.display_phone_number,
                "verified_name": account.verified_name,
                "channel_name": account.channel_name,
                "is_default": account.is_default,
                "status": st_str,
            },
        }

    def get_account_dto(self, waba_account_id: Optional[uuid.UUID] = None) -> dict:
        try:
            account = self.get_active_account(waba_account_id=waba_account_id)
            st_str = account.status.value if hasattr(account.status, "value") else str(account.status)
            is_active = (account.status == WhatsAppAccountStatus.ACTIVE)
            return {
                "connected": is_active,
                "account": {
                    "id": str(account.id),
                    "waba_id": account.waba_id,
                    "phone_number_id": account.phone_number_id,
                    "display_phone_number": account.display_phone_number,
                    "verified_name": account.verified_name,
                    "channel_name": account.channel_name,
                    "is_default": account.is_default,
                    "status": st_str,
                    "webhook_verified": is_active,
                },
                "message": "Account connected" if is_active else "Account disconnected",
            }
        except Exception:
            return {"connected": False, "account": None, "message": "No WhatsApp account connected"}

    def get_account(self, waba_account_id: Optional[uuid.UUID] = None) -> Optional[WhatsAppAccount]:
        try:
            return self.get_active_account(waba_account_id=waba_account_id)
        except Exception:
            return self.repo.get_active_account(org_id=self.org_id)

    def disconnect(self, waba_account_id: Optional[uuid.UUID] = None) -> bool:
        account = self.get_active_account(waba_account_id=waba_account_id)
        if not account:
            return False
        self.repo.update(account.id, status=WhatsAppAccountStatus.DISCONNECTED)
        self.db.commit()
        return True

    def disconnect_dto(self, waba_account_id: Optional[uuid.UUID] = None) -> dict:
        self.disconnect(waba_account_id=waba_account_id)
        return {"success": True, "message": "Disconnected"}


class WhatsAppRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_channels_by_org(self, org_id: uuid.UUID) -> List[WhatsAppAccount]:
        return (
            self.db.query(WhatsAppAccount)
            .filter(WhatsAppAccount.organization_id == org_id)
            .order_by(WhatsAppAccount.is_default.desc(), WhatsAppAccount.created_at.asc())
            .all()
        )

    def set_default_channel(self, account_id: uuid.UUID, org_id: uuid.UUID) -> bool:
        channels = self.get_channels_by_org(org_id)
        found = False
        for ch in channels:
            if ch.id == account_id:
                ch.is_default = True
                found = True
            else:
                ch.is_default = False
        if not found:
            raise ResourceNotFoundError("WABA Channel not found")
        self.db.commit()
        return True

    def get_active_account(self, org_id: Optional[uuid.UUID] = None) -> Optional[WhatsAppAccount]:
        q = self.db.query(WhatsAppAccount).filter(WhatsAppAccount.status == WhatsAppAccountStatus.ACTIVE)
        if org_id:
            q = q.filter(WhatsAppAccount.organization_id == org_id)
        return q.filter(WhatsAppAccount.is_default == True).first() or q.first()

    def get_by_id(self, account_id: uuid.UUID) -> Optional[WhatsAppAccount]:
        return (
            self.db.query(WhatsAppAccount)
            .filter(WhatsAppAccount.id == account_id)
            .first()
        )

    def get_by_phone_number_id(self, phone_number_id: str) -> Optional[WhatsAppAccount]:
        if not phone_number_id:
            return self.db.query(WhatsAppAccount).filter(WhatsAppAccount.status == WhatsAppAccountStatus.ACTIVE).first()
        wa = (
            self.db.query(WhatsAppAccount)
            .filter(WhatsAppAccount.phone_number_id == str(phone_number_id).strip())
            .first()
        )
        if not wa:
            wa = (
                self.db.query(WhatsAppAccount)
                .filter(WhatsAppAccount.status == WhatsAppAccountStatus.ACTIVE)
                .order_by(WhatsAppAccount.is_default.desc(), WhatsAppAccount.created_at.asc())
                .first()
            )
        return wa

    def create(self, **kwargs) -> WhatsAppAccount:
        account = WhatsAppAccount(**kwargs)
        self.db.add(account)
        self.db.commit()
        self.db.refresh(account)
        return account

    def update(self, account_id: uuid.UUID, **kwargs) -> Optional[WhatsAppAccount]:
        account = self.get_by_id(account_id)
        if account:
            for k, v in kwargs.items():
                setattr(account, k, v)
            self.db.commit()
            self.db.refresh(account)
        return account

    def delete(self, account_id: uuid.UUID) -> bool:
        account = self.get_by_id(account_id)
        if account:
            self.db.delete(account)
            self.db.commit()
            return True
        return False

    def upsert(self, **kwargs) -> WhatsAppAccount:
        phone_number_id = kwargs.get("phone_number_id")
        org_id = kwargs.get("organization_id")
        
        existing = None
        if org_id and phone_number_id:
            existing = (
                self.db.query(WhatsAppAccount)
                .filter(
                    WhatsAppAccount.organization_id == org_id,
                    WhatsAppAccount.phone_number_id == phone_number_id,
                )
                .first()
            )

        has_channels = self.db.query(WhatsAppAccount).filter(WhatsAppAccount.organization_id == org_id).count() > 0 if org_id else False
        if not has_channels:
            kwargs["is_default"] = True

        if existing:
            for k, v in kwargs.items():
                setattr(existing, k, v)
            self.db.flush()
            return existing
        return self.create(**kwargs)
