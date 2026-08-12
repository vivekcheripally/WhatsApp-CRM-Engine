from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from core.database import SessionLocal
from models.postgres_model import (
    WhatsAppAccount,
    WhatsAppAccountStatus,
    WhatsAppScheduledMessage,
)
from services.message_service import MessageService
from schemas.whatsapp_inbox import (
    SendTemplateMessageRequest,
    SendTextMessageRequest,
)
import services.socket_service as socket_svc
from core.exceptions import ResourceNotFoundError, ValidationError


class InboxSchedulerService:
    def __init__(self, db):
        self.db = db

    def serialize(self, msg: WhatsAppScheduledMessage) -> dict:
        msg_type_str = msg.message_type.value if hasattr(msg.message_type, "value") else str(msg.message_type)
        return {
            "id": str(msg.id),
            "conversation_id": str(msg.conversation_id),
            "message_type": msg_type_str,
            "content": msg.content,
            "template_id": str(msg.template_id) if msg.template_id else None,
            "scheduled_at": msg.scheduled_at.isoformat() + "Z" if msg.scheduled_at else None,
            "status": msg.status,
            "error_message": msg.error_message,
            "created_at": msg.created_at.isoformat() + "Z" if msg.created_at else None,
        }

    def list_scheduled_messages_dto(
        self,
        status_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        waba_account_id: Optional[uuid.UUID] = None,
    ) -> dict:
        query = self.db.query(WhatsAppScheduledMessage)
        if status_filter:
            query = query.filter(WhatsAppScheduledMessage.status == status_filter)
        if waba_account_id:
            query = query.filter(WhatsAppScheduledMessage.whatsapp_account_id == waba_account_id)

        total = query.count()
        items = (
            query.order_by(WhatsAppScheduledMessage.scheduled_at.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return {
            "items": [self.serialize(m) for m in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "has_next": (page * page_size) < total,
        }

    def create_scheduled_message_dto(self, payload: dict, waba_account_id: Optional[uuid.UUID] = None) -> dict:
        from services.whatsapp_service import WhatsAppService
        from services.conversation_service import ConversationService
        from models.postgres_model import MessageType, Template

        data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else (payload if isinstance(payload, dict) else {})
        customer_phone: str = (data.get("customer_phone") or "").strip()
        customer_name: str | None = data.get("customer_name")
        message_type_str: str = (data.get("message_type") or "TEXT").upper()
        content: str | None = data.get("content")
        template_name: str | None = data.get("template_name")
        scheduled_at_raw: str | None = data.get("scheduled_at")

        if not customer_phone:
            raise ValidationError("customer_phone is required")
        if not scheduled_at_raw:
            raise ValidationError("scheduled_at is required")

        try:
            dt = datetime.fromisoformat(scheduled_at_raw.replace("Z", "+00:00"))
            scheduled_at = dt.astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError:
            raise ValidationError("scheduled_at must be a valid ISO8601 datetime")

        if scheduled_at <= datetime.utcnow() - timedelta(seconds=1):
            raise ValidationError("scheduled_at must be in the future")

        if message_type_str == "TEXT" and not content:
            raise ValidationError("content is required for TEXT messages")
        if message_type_str == "TEMPLATE" and not template_name:
            raise ValidationError("template_name is required for TEMPLATE messages")

        account = WhatsAppService(self.db).get_active_account(waba_account_id=waba_account_id)

        conv_svc = ConversationService(self.db)
        conv, _ = conv_svc.get_or_create(
            customer_phone=customer_phone,
            whatsapp_account_id=account.id,
            customer_name=customer_name,
            organization_id=account.organization_id,
        )

        template_id = None
        stored_content: str | None = content if message_type_str == "TEXT" else None
        if message_type_str == "TEMPLATE" and template_name:
            tmpl = (
                self.db.query(Template)
                .filter(Template.template_name == template_name)
                .order_by(Template.id.desc())
                .first()
            )
            if tmpl:
                template_id = tmpl.id
                stored_content = tmpl.template_body

        msg_type = MessageType(message_type_str) if message_type_str in [e.value for e in MessageType] else MessageType.TEXT

        msg = WhatsAppScheduledMessage(
            organization_id=account.organization_id,
            whatsapp_account_id=account.id,
            conversation_id=conv.id,
            contact_id=conv.contact_id,
            message_type=msg_type,
            content=stored_content,
            template_id=template_id,
            scheduled_at=scheduled_at,
            status="PENDING",
        )
        self.db.add(msg)
        self.db.commit()
        self.db.refresh(msg)

        return {
            "success": True,
            "scheduled_message": self.serialize(msg),
            "conversation_id": str(conv.id),
        }

    def cancel_scheduled_message_dto(self, message_id: uuid.UUID) -> dict:
        msg = self.db.query(WhatsAppScheduledMessage).filter(
            WhatsAppScheduledMessage.id == message_id
        ).first()
        if not msg:
            raise ResourceNotFoundError("Scheduled message not found")
        if msg.status == "SENT":
            raise ValidationError("Cannot cancel a message that has already been sent")

        self.db.delete(msg)
        self.db.commit()
        return {"success": True, "id": str(message_id)}


def process_due_messages() -> None:
    """Invoked by the BackgroundScheduler every 30s.
    Sends any PENDING scheduled messages whose scheduled_at has passed."""
    now = datetime.utcnow()
    db = SessionLocal()
    try:
        due = (
            db.query(WhatsAppScheduledMessage)
            .filter(
                WhatsAppScheduledMessage.status == "PENDING",
                WhatsAppScheduledMessage.scheduled_at <= now,
            )
            .with_for_update(skip_locked=True)
            .all()
        )

        if not due:
            return

        print(f"[scheduler] {len(due)} message(s) due at {now.isoformat()}")

        for msg in due:
            try:
                # Resolve WhatsApp account for this scheduled message
                wa = (
                    db.query(WhatsAppAccount)
                    .filter(WhatsAppAccount.id == msg.whatsapp_account_id)
                    .first()
                )
                if not wa:
                    wa = (
                        db.query(WhatsAppAccount)
                        .filter(WhatsAppAccount.status == WhatsAppAccountStatus.ACTIVE)
                        .first()
                        or db.query(WhatsAppAccount).first()
                    )

                if not wa or not wa.access_token or not wa.phone_number_id:
                    raise ResourceNotFoundError("No active WhatsApp account configured")

                svc = MessageService(db)
                message_type = (
                    msg.message_type.value
                    if hasattr(msg.message_type, "value")
                    else str(msg.message_type or "TEXT")
                ).upper()

                conv_id = str(msg.conversation_id)

                if message_type == "TEMPLATE" and msg.template_id:
                    from models.postgres_model import Template
                    tmpl = db.query(Template).filter(Template.id == msg.template_id).first()
                    template_name = tmpl.template_name if tmpl else ""
                    req = SendTemplateMessageRequest(
                        conversation_id=conv_id,
                        template_name=template_name,
                        language_code="en_US",
                    )
                    reply = svc.send_template_message(
                        req, agent_id=0,
                        phone_number_id=wa.phone_number_id,
                        access_token=wa.access_token,
                    )
                else:
                    req = SendTextMessageRequest(
                        conversation_id=conv_id,
                        content=msg.content or "",
                    )
                    reply = svc.send_text_message(
                        req, agent_id=0,
                        phone_number_id=wa.phone_number_id,
                        access_token=wa.access_token,
                    )

                # Emit to WebSocket
                if reply:
                    from services.webhook_service import WebhookService
                    ws = WebhookService(db)
                    socket_svc.emit_new_message(
                        msg.conversation_id,
                        ws._build_message_response(reply),
                    )

                msg.status = "SENT"
                db.commit()
                print(f"[scheduler] ✓ Sent scheduled msg id={msg.id} type={message_type}")

            except Exception as exc:
                try:
                    msg.status = "FAILED"
                    msg.error_message = str(exc)
                    db.commit()
                except Exception:
                    db.rollback()
                print(f"[scheduler] ✗ Failed scheduled msg id={msg.id}: {exc}")

    except Exception as exc:
        print(f"[scheduler] Error in process_due_messages: {exc}")
        db.rollback()
    finally:
        db.close()
