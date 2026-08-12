from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from models.postgres_model import (
    Campaign,
    CampaignRecipient,
    CampaignRecipientStatus,
    Contact,
    ConversationStatus,
    MessageDirection,
    MessageStatus,
    MessageType,
    SenderType,
    Template,
    TemplateStatus,
    WhatsAppConversation,
    WhatsAppMessage,
)
from schemas.whatsapp_inbox import MessageResponse, ReactionResponse
from services.whatsapp_service import WhatsAppRepository
from services.conversation_service import ConversationService, ConversationRepository
from services.message_service import MessageRepository
from services.reaction_service import ReactionService
from services.media_service import MediaService
from services import socket_service as socket_svc

STATUS_MAP = {
    "sent": "SENT",
    "delivered": "DELIVERED",
    "read": "READ",
    "failed": "FAILED",
}

TYPE_MAP = {
    "text": "TEXT",
    "image": "IMAGE",
    "video": "VIDEO",
    "audio": "AUDIO",
    "document": "DOCUMENT",
    "sticker": "STICKER",
    "location": "LOCATION",
    "contacts": "CONTACTS",
    "interactive": "INTERACTIVE",
    "reaction": "REACTION",
}


class WebhookService:
    @staticmethod
    def verify_webhook_token(params: dict) -> tuple[bool, str, int]:
        from core.config import settings
        hub_mode = params.get("hub.mode") or params.get("hub_mode")
        hub_verify_token = params.get("hub.verify_token") or params.get("hub_verify_token")
        hub_challenge = params.get("hub.challenge") or params.get("hub_challenge")
        verify_token = (settings.META_VERIFY_TOKEN or "").strip()

        if hub_mode == "subscribe" and verify_token and (hub_verify_token or "").strip() == verify_token:
            return True, hub_challenge or "", 200

        return False, "Verification failed", 400

    def __init__(self, db: Session):
        self.db = db
        self.wa_repo = WhatsAppRepository(db)
        self.conv_svc = ConversationService(db)
        self.conv_repo = ConversationRepository(db)
        self.msg_repo = MessageRepository(db)
        self.reaction_svc = ReactionService(db)
        self.media_svc = MediaService(db)

    def process_webhook_payload(self, payload: dict) -> None:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                field = change.get("field")
                value = change.get("value", {})
                if field in {
                    "messages",
                    "smb_message_echoes",
                    "whatsapp_business_messaging",
                }:
                    self._handle_messages_change(value)
                elif field == "message_template_status_update":
                    self._handle_template_status_update(value)

    def _handle_template_status_update(self, value: dict) -> None:
        from sqlalchemy import func
        from models.postgres_model import Template, TemplateStatus

        meta_tmpl_id = str(value.get("message_template_id")) if value.get("message_template_id") else None
        tmpl_name = value.get("message_template_name")
        event_status = (value.get("event") or value.get("status") or "").upper()

        if not tmpl_name and not meta_tmpl_id:
            return

        query = self.db.query(Template)
        tmpl = None
        if meta_tmpl_id:
            tmpl = query.filter(Template.meta_template_id == meta_tmpl_id).first()

        if not tmpl and tmpl_name:
            tmpl = query.filter(func.lower(Template.template_name) == tmpl_name.lower()).first()

        if not tmpl:
            return

        parsed_st = event_status if event_status in [e.value for e in TemplateStatus] else "PENDING"
        tmpl.status = TemplateStatus(parsed_st)
        if meta_tmpl_id:
            tmpl.meta_template_id = meta_tmpl_id
        self.db.commit()

        socket_svc.emit_template_update(
            template_id=str(tmpl.id),
            template_name=tmpl.template_name,
            status_value=parsed_st,
            meta_template_id=meta_tmpl_id,
        )

    def _handle_messages_change(self, value: dict) -> None:
        metadata = value.get("metadata") or {}
        phone_number_id = metadata.get("phone_number_id")
        normalized_pid = str(phone_number_id) if phone_number_id else None

        if not normalized_pid:
            print("[Webhook Warning] Missing phone_number_id in incoming webhook payload metadata.")
            return

        # Resolve the exact WhatsApp account and tenant organization by Meta phone_number_id
        wa_account = self.wa_repo.get_by_phone_number_id(normalized_pid)

        if not wa_account:
            print(f"[Webhook Warning] Received webhook for unmapped phone_number_id: {normalized_pid}. Dropping payload.")
            return

        contacts = value.get("contacts") or []

        for msg_data in value.get("messages", []):
            self._handle_incoming_message(msg_data, wa_account, contacts, is_echo=False)

        echoes = value.get("message_echoes") or value.get("smb_message_echoes") or []
        for msg_data in echoes:
            self._handle_incoming_message(msg_data, wa_account, contacts, is_echo=True)

        for status_data in value.get("statuses", []):
            self._handle_status_update(status_data, wa_account)

    def _handle_incoming_message(
        self, msg_data: dict, wa_account, contacts: Optional[list] = None, is_echo: bool = False
    ) -> None:
        meta_msg_id = msg_data.get("id")
        raw_from = msg_data.get("from")
        raw_to = msg_data.get("to") or msg_data.get("recipient_id")
        timestamp = msg_data.get("timestamp")
        msg_type_str = msg_data.get("type", "text")

        display_num = (wa_account.display_phone_number or "").replace("+", "").replace(" ", "").strip()
        from_clean = (raw_from or "").replace("+", "").replace(" ", "").strip()

        if is_echo or (display_num and from_clean and (
            from_clean == display_num or display_num.endswith(from_clean[-10:] if len(from_clean) >= 10 else from_clean)
        )):
            target_phone = raw_to or raw_from
            sender_type = SenderType.AGENT
            msg_status = MessageStatus.SENT
            direction = MessageDirection.OUTBOUND
        else:
            target_phone = raw_from
            sender_type = SenderType.CUSTOMER
            msg_status = MessageStatus.DELIVERED
            direction = MessageDirection.INBOUND

        if not target_phone:
            return

        # Deduplicate
        if meta_msg_id and self.msg_repo.get_by_meta_id(meta_msg_id):
            return

        # Resolve contact name
        customer_name = None
        resolved_contacts = contacts or msg_data.get("contacts") or []
        if resolved_contacts:
            customer_name = resolved_contacts[0].get("profile", {}).get("name")

        # Get or create conversation (which also creates the Contact)
        conversation, _ = self.conv_svc.get_or_create(
            customer_phone=target_phone,
            whatsapp_account_id=wa_account.id,
            customer_name=customer_name,
            organization_id=wa_account.organization_id,
        )

        # Handle reaction type separately
        if msg_type_str == "reaction":
            self._handle_reaction(msg_data, conversation)
            return

        # Extract content
        content, caption, media_info = self._extract_content(msg_data, msg_type_str)
        msg_type = MessageType(TYPE_MAP.get(msg_type_str, "UNSUPPORTED"))

        # Suppress empty/phantom system messages with no text, caption, or media
        if not content and not caption and not media_info and msg_type_str != "reaction":
            return

        # Update conversation timestamps & 24-hour Meta messaging window using timezone-aware UTC
        from datetime import timezone
        try:
            ts = datetime.fromtimestamp(int(timestamp), tz=timezone.utc) if timestamp else datetime.now(timezone.utc)
        except Exception:
            ts = datetime.now(timezone.utc)

        # Create message record with matched Meta timestamp
        message = self.msg_repo.create(
            organization_id=wa_account.organization_id,
            whatsapp_account_id=wa_account.id,
            conversation_id=conversation.id,
            contact_id=conversation.contact_id,
            meta_message_id=meta_msg_id,
            direction=direction,
            sender_type=sender_type,
            message_type=msg_type,
            content=content,
            caption=caption,
            status=msg_status,
            created_at=ts,
        )

        # Process media
        if media_info:
            try:
                self.media_svc.process_incoming_media(
                    message_id=message.id,
                    media_id=media_info.get("id"),
                    access_token=wa_account.access_token,
                    mime_type=media_info.get("mime_type"),
                    file_name=media_info.get("filename"),
                )
            except Exception as e:
                print(f"[Webhook] Error processing incoming media: {e}")

        conv_update_kwargs = {
            "last_message_at": ts,
            "status": ConversationStatus.OPEN,
        }
        if sender_type == SenderType.CUSTOMER:
            conv_update_kwargs["window_expires_at"] = ts + timedelta(hours=24)

        self.conv_repo.update_conv(
            conversation.id,
            **conv_update_kwargs,
        )

        if sender_type == SenderType.CUSTOMER:
            self._increment_unread(conversation.id)
            self._check_and_mark_campaign_reply(conversation.contact_id)

        # Reload message with relations for broadcast
        self.db.expire(message)
        msg_for_broadcast = self.msg_repo.get_by_id(message.id)

        socket_svc.emit_new_message(
            conversation.id,
            self._build_message_response(msg_for_broadcast),
        )
        socket_svc.emit_conversation_update(conversation.id, {"status": "OPEN"})

        # Auto-reply / chatbot
        if content and msg_type == MessageType.TEXT and sender_type == SenderType.CUSTOMER:
            self._try_auto_respond(content, conversation, wa_account)

    def _try_auto_respond(self, text: str, conversation: WhatsAppConversation, wa_account) -> None:
        from services.messaging_features_service import AutoReplyService
        from services.message_service import MessageService
        from schemas.whatsapp_inbox import SendTextMessageRequest
        try:
            svc = AutoReplyService(self.db)
            rule = svc.match(text, wa_account.organization_id, wa_account.id)
            if not rule:
                return

            if self._should_skip_reply(conversation.id):
                return

            response_text = rule.response_content or ""
            if not response_text:
                return

            rendered = self._render_template(response_text, conversation, text)
            msg_svc = MessageService(self.db)
            req = SendTextMessageRequest(
                conversation_id=str(conversation.id), content=rendered
            )
            reply = msg_svc.send_text_message(req, 0, wa_account.phone_number_id, wa_account.access_token)
            socket_svc.emit_new_message(
                conversation.id, self._build_message_response(reply)
            )
        except Exception:
            pass

    def _render_template(self, template: str, conversation: WhatsAppConversation, incoming_text: str) -> str:
        class _SafeDict(dict):
            def __missing__(self, key):
                return ""

        contact = getattr(conversation, "contact", None)
        ctx = _SafeDict({
            "customer_name": (contact.name if contact else "") or "",
            "customer_phone": (contact.phone_number if contact else "") or "",
            "conversation_id": str(conversation.id),
            "last_message": incoming_text or "",
        })
        try:
            return template.format_map(ctx)
        except Exception:
            return template

    def _should_skip_reply(self, conversation_id: uuid.UUID, window_seconds: int = 10) -> bool:
        msgs, _ = self.msg_repo.list_by_conversation(conversation_id, page_size=20)

        from datetime import timezone
        now = datetime.now(timezone.utc)
        for m in reversed(msgs):
            if m.sender_type == SenderType.AGENT:
                if m.created_at:
                    c_at = m.created_at
                    if c_at.tzinfo is None:
                        c_at = c_at.replace(tzinfo=timezone.utc)
                    delta = (now - c_at).total_seconds()
                    if delta <= window_seconds:
                        return True
                break
        return False


    def _handle_status_update(self, status_data: dict, wa_account=None) -> None:
        meta_msg_id = status_data.get("id")
        status_str = status_data.get("status")
        new_status = STATUS_MAP.get(status_str) if isinstance(status_str, str) else None

        if status_str == "failed":
            print(f"[Webhook Status Failed] meta_msg_id={meta_msg_id} status_data={status_data}")

        if not meta_msg_id or not isinstance(meta_msg_id, str) or not new_status:
            return


        msg = self.msg_repo.get_by_meta_id(meta_msg_id)

        # Sync campaign recipient status
        self._sync_campaign_recipient(meta_msg_id, new_status)

        if not msg:
            return

        self.msg_repo.update_status_by_meta_id(meta_msg_id, new_status)

        conv = self.conv_repo.get_by_id(msg.conversation_id)
        if conv:
            if new_status in ("SENT", "DELIVERED") and msg.sender_type == SenderType.AGENT:
                if conv.status != ConversationStatus.PENDING:
                    self.conv_repo.update_conv(conv.id, status=ConversationStatus.PENDING)
                    socket_svc.emit_conversation_update(conv.id, {"status": "PENDING"})
            elif new_status == "READ" and msg.sender_type == SenderType.AGENT:
                if conv.status == ConversationStatus.PENDING:
                    self.conv_repo.update_conv(conv.id, status=ConversationStatus.OPEN)
                    socket_svc.emit_conversation_update(conv.id, {"status": "OPEN"})

            socket_svc.emit_message_status(
                msg.conversation_id, new_status, msg.id, meta_msg_id
            )

    def _sync_campaign_recipient(self, meta_msg_id: str, new_status: str) -> None:
        """Update CampaignRecipient status and Campaign counters via the linked WhatsAppMessage."""
        if not meta_msg_id or not new_status:
            return
        try:
            msg = self.db.query(WhatsAppMessage).filter(
                WhatsAppMessage.meta_message_id == meta_msg_id
            ).first()
            if not msg:
                return

            rec = self.db.query(CampaignRecipient).filter(
                CampaignRecipient.message_id == msg.id
            ).first()
            if rec:
                old_status = rec.status
                try:
                    rec.status = CampaignRecipientStatus(new_status)
                except ValueError:
                    pass

                now = datetime.utcnow()
                if new_status == "SENT":
                    rec.sent_at = now
                elif new_status == "DELIVERED":
                    rec.delivered_at = now
                elif new_status == "READ":
                    rec.read_at = now

                # Increment campaign metrics when recipient status advances
                if rec.campaign_id and old_status != rec.status:
                    camp = self.db.query(Campaign).filter(Campaign.id == rec.campaign_id).first()
                    if camp:
                        if new_status == "SENT":
                            camp.sent_count = (camp.sent_count or 0) + 1
                        elif new_status == "DELIVERED":
                            camp.delivered_count = (camp.delivered_count or 0) + 1
                        elif new_status == "READ":
                            camp.read_count = (camp.read_count or 0) + 1
                        elif new_status == "FAILED":
                            camp.failed_count = (camp.failed_count or 0) + 1

                self.db.commit()
        except Exception as e:
            print(f"[WebhookService] Error syncing campaign recipient: {e}")

    def _check_and_mark_campaign_reply(self, contact_id: Optional[uuid.UUID]) -> None:
        """When an inbound customer message arrives, check if the contact received a campaign message and mark as REPLIED."""
        if not contact_id:
            return
        try:
            rec = (
                self.db.query(CampaignRecipient)
                .filter(CampaignRecipient.contact_id == contact_id)
                .order_by(CampaignRecipient.created_at.desc())
                .first()
            )
            if rec:
                rec.status = CampaignRecipientStatus.REPLIED
                self.db.commit()
        except Exception as e:
            self.db.rollback()
            print(f"[Webhook] Error marking campaign reply: {e}")

    def _handle_reaction(self, msg_data: dict, conversation: WhatsAppConversation) -> None:
        reaction_data = msg_data.get("reaction", {})
        meta_msg_id = reaction_data.get("message_id")
        emoji = reaction_data.get("emoji", "")
        from_phone = msg_data.get("from")

        reaction = self.reaction_svc.handle_reaction(
            meta_message_id=meta_msg_id,
            emoji=emoji,
            customer_phone=from_phone,
        )
        if reaction:
            contact = getattr(reaction, "contact", None)
            response = ReactionResponse(
                id=str(reaction.id),
                message_id=str(reaction.message_id),
                emoji=reaction.emoji,
                customer_phone=contact.phone_number if contact else None,
                created_at=reaction.created_at,
            )
            socket_svc.emit_new_reaction(conversation.id, response)

    def _build_message_response(self, msg: WhatsAppMessage) -> MessageResponse:
        """Build a MessageResponse dict from a WhatsAppMessage ORM object."""
        from services.media_service import _mime_to_message_type

        media_files = []
        for mf in (msg.media_files or []):
            media_files.append({
                "id": str(mf.id),
                "meta_media_id": mf.meta_media_id,
                "media_id": mf.meta_media_id,
                "file_name": mf.file_name,
                "file_url": mf.file_url,
                "file_size": mf.file_size,
                "mime_type": None,
            })

        tmpl = getattr(msg, "template", None)
        if not tmpl and getattr(msg, "template_id", None):
            from models.postgres_model import Template
            tmpl = self.db.query(Template).filter(Template.id == msg.template_id).first()
        if not tmpl:
            if getattr(msg, "campaign_id", None):
                camp = self.db.query(Campaign).filter(Campaign.id == msg.campaign_id).first()
                if camp and camp.template_id:
                    tmpl = self.db.query(Template).filter(Template.id == camp.template_id).first()
            if not tmpl and msg.content and msg.content.startswith("Template: "):
                t_name = msg.content.replace("Template: ", "").strip()
                from sqlalchemy import func
                tmpl = self.db.query(Template).filter(func.lower(Template.template_name) == t_name.lower()).first()

        display_content = msg.content
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
                    media_files.append({
                        "id": f"tmpl_{msg.id}",
                        "meta_media_id": None,
                        "media_id": None,
                        "file_name": f"{tmpl.template_name}",
                        "file_url": media_link,
                        "file_size": 0,
                        "mime_type": f"{h_type_str.lower()}/png" if h_type_str == "IMAGE" else "application/pdf",
                    })





        reactions = []
        for r in (msg.reactions or []):
            contact = getattr(r, "contact", None)
            reactions.append({
                "id": str(r.id),
                "message_id": str(r.message_id),
                "emoji": r.emoji,
                "customer_phone": contact.phone_number if contact else None,
                "created_at": r.created_at,
            })

        return MessageResponse(
            id=str(msg.id),
            conversation_id=str(msg.conversation_id),
            meta_message_id=msg.meta_message_id,
            direction=msg.direction.value if msg.direction else None,
            sender_type=msg.sender_type.value if msg.sender_type else "CUSTOMER",
            sender_id=str(msg.sender_id) if msg.sender_id else None,
            message_type=msg.message_type.value if msg.message_type else "TEXT",
            content=display_content,
            caption=msg.caption,

            status=msg.status.value if msg.status else "SENT",
            is_deleted=msg.is_deleted or False,
            reply_to_message_id=str(msg.reply_to_message_id) if msg.reply_to_message_id else None,
            media_files=media_files,
            reactions=reactions,
            created_at=msg.created_at,
        )

    def _increment_unread(self, conversation_id: uuid.UUID) -> None:
        try:
            conv = self.conv_repo.get_by_id(conversation_id)
            if conv:
                conv.unread_count = (conv.unread_count or 0) + 1
                self.db.commit()
        except Exception:
            pass

    @staticmethod
    def _extract_content(
        msg_data: dict, msg_type: str
    ) -> tuple[Optional[str], Optional[str], Optional[dict]]:
        if msg_type == "text":
            return msg_data.get("text", {}).get("body"), None, None

        elif msg_type in ("image", "video", "audio", "document", "sticker"):
            media = msg_data.get(msg_type, {})
            return None, media.get("caption"), media

        elif msg_type == "location":
            loc = msg_data.get("location", {})
            return f"lat:{loc.get('latitude')},lon:{loc.get('longitude')}", None, None

        elif msg_type == "interactive":
            interactive = msg_data.get("interactive", {})
            resp_type = interactive.get("type")
            if resp_type == "button_reply":
                return interactive.get("button_reply", {}).get("title"), None, None
            elif resp_type == "list_reply":
                return interactive.get("list_reply", {}).get("title"), None, None

        return None, None, None
