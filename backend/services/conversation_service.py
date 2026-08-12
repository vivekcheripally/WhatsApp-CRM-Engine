from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from core.exceptions import PermissionError, NotFoundError, ValidationError
from models.postgres_model import (
    CampaignRecipient,
    CampaignRecipientStatus,
    Contact,
    ContactStatus,
    MessageDirection,
    MessageStatus,
    MessageType,
    Organization,
    SenderType,
    UserRole,
    WhatsAppAccount,
    WhatsAppAccountStatus,
    WhatsAppConversation,
    WhatsAppMessage,
)
from repositories.channel_assignment_repository import ChannelAssignmentRepository


def normalize_e164(phone: str, default_country_code: str = "91") -> str:
    """Normalize any phone string to canonical E.164 format without symbols."""
    if not phone:
        return ""
    digits = "".join(ch for ch in phone if ch.isdigit())
    if not digits:
        return ""
    if len(digits) == 10:
        return f"{default_country_code}{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"{default_country_code}{digits[1:]}"
    return digits


def _normalize_phone(phone: str) -> str:
    return normalize_e164(phone)


def _get_organization(db: Session, org_id: Optional[uuid.UUID] = None) -> Optional[Organization]:
    if org_id:
        return db.query(Organization).filter(Organization.id == org_id).first()
    return db.query(Organization).first()


def _get_active_account(db: Session, org_id: Optional[uuid.UUID] = None) -> Optional[WhatsAppAccount]:
    q = db.query(WhatsAppAccount).filter(WhatsAppAccount.status == WhatsAppAccountStatus.ACTIVE)
    if org_id:
        q = q.filter(WhatsAppAccount.organization_id == org_id)
    return q.first() or db.query(WhatsAppAccount).first()


def _get_or_create_contact(
    db: Session,
    organization_id: uuid.UUID,
    phone_number: str,
    name: Optional[str] = None,
) -> Contact:
    norm_phone = normalize_e164(phone_number)

    contact = (
        db.query(Contact)
        .filter(
            Contact.organization_id == organization_id,
            Contact.phone_number == norm_phone,
            Contact.is_deleted == False,
        )
        .first()
    )

    if not contact and len(norm_phone) >= 10:
        last10 = norm_phone[-10:]
        contact = (
            db.query(Contact)
            .filter(
                Contact.organization_id == organization_id,
                Contact.phone_number.endswith(last10),
                Contact.is_deleted == False,
            )
            .first()
        )
        if contact:
            contact.phone_number = norm_phone

    if not contact:
        contact = Contact(
            organization_id=organization_id,
            phone_number=norm_phone,
            name=name,
            status=ContactStatus.ACTIVE,
            source="INBOUND_WHATSAPP",
            attributes={},
            is_deleted=False,
        )
        db.add(contact)
        db.flush()

    elif name and (not contact.name or contact.name == contact.phone_number):
        contact.name = name

    return contact


class ConversationService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ConversationRepository(db)

    def get_or_create(
        self,
        customer_phone: str,
        whatsapp_account_id: Optional[uuid.UUID] = None,
        customer_name: Optional[str] = None,
        organization_id: Optional[uuid.UUID] = None,
    ) -> Tuple[WhatsAppConversation, bool]:
        if not organization_id:
            org = _get_organization(self.db)
            if not org:
                raise RuntimeError("No organization found in database")
            organization_id = org.id

        if not whatsapp_account_id:
            account = _get_active_account(self.db, organization_id)
            if not account:
                raise RuntimeError("No active WhatsApp account configured")
            whatsapp_account_id = account.id

        phone = _normalize_phone(customer_phone)
        contact = _get_or_create_contact(self.db, organization_id, phone, customer_name)

        conv = (
            self.db.query(WhatsAppConversation)
            .filter(
                WhatsAppConversation.whatsapp_account_id == whatsapp_account_id,
                WhatsAppConversation.contact_id == contact.id,
                WhatsAppConversation.is_deleted == False,
            )
            .first()
        )

        created = False
        if not conv:
            conv = WhatsAppConversation(
                organization_id=organization_id,
                whatsapp_account_id=whatsapp_account_id,
                contact_id=contact.id,
                status="OPEN",
                is_archived=False,
                unread_count=0,
                last_message_at=datetime.now(timezone.utc),
                assignee_id=None,  # Unassigned queue by default
                is_deleted=False,
            )
            self.db.add(conv)
            self.db.flush()
            created = True

        return conv, created

    def record_outgoing_inbox_message(
        self,
        customer_phone: str,
        content: Optional[str],
        message_type: str = "TEXT",
        meta_message_id: Optional[str] = None,
        customer_name: Optional[str] = None,
        organization_id: Optional[uuid.UUID] = None,
        whatsapp_account_id: Optional[uuid.UUID] = None,
    ) -> WhatsAppConversation:
        if not organization_id:
            org = _get_organization(self.db)
            organization_id = org.id if org else None

        if not whatsapp_account_id:
            account = _get_active_account(self.db, organization_id)
            whatsapp_account_id = account.id if account else None

        conv, _ = self.get_or_create(
            customer_phone,
            whatsapp_account_id=whatsapp_account_id,
            customer_name=customer_name,
            organization_id=organization_id,
        )

        msg = WhatsAppMessage(
            organization_id=organization_id,
            whatsapp_account_id=whatsapp_account_id,
            conversation_id=conv.id,
            contact_id=conv.contact_id,
            meta_message_id=meta_message_id,
            direction=MessageDirection.OUTBOUND,
            sender_type=SenderType.AGENT,
            message_type=MessageType(message_type.upper()) if message_type else MessageType.TEXT,
            content=content,
            status=MessageStatus.SENT if meta_message_id else MessageStatus.PENDING,
        )
        self.db.add(msg)

        conv.last_message_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(conv)
        return conv

    def list_conversations(
        self,
        org_id: Optional[uuid.UUID] = None,
        waba_account_id: Optional[uuid.UUID] = None,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        archived: Optional[bool] = None,
        unread: Optional[bool] = None,
        page: int = 1,
        page_size: int = 50,
        current_user: Optional[Dict[str, Any]] = None,
    ) -> dict:
        query = self.db.query(WhatsAppConversation).options(joinedload(WhatsAppConversation.contact)).filter(WhatsAppConversation.is_deleted == False)

        if org_id:
            query = query.filter(WhatsAppConversation.organization_id == org_id)
        if waba_account_id:
            query = query.filter(WhatsAppConversation.whatsapp_account_id == waba_account_id)

        # RLS Filtering for Sales Agents (Channel Visibility + Conversation Assignee Responsibility)
        if current_user and current_user.get("role") == UserRole.SALES_AGENT.value and org_id:
            agent_uuid = uuid.UUID(current_user["id"])
            assigned_channel_ids = ChannelAssignmentRepository.get_assigned_channel_ids(self.db, agent_uuid, org_id)

            # Restrict query to assigned WABA channels
            query = query.filter(WhatsAppConversation.whatsapp_account_id.in_(assigned_channel_ids))

            # Configurable Org Unassigned Inbox Visibility Setting
            org = _get_organization(self.db, org_id)
            unassigned_visible = org.unassigned_inbox_visible_to_agents if org else True

            if unassigned_visible:
                query = query.filter(
                    or_(
                        WhatsAppConversation.assignee_id == agent_uuid,
                        WhatsAppConversation.assignee_id.is_(None),
                    )
                )
            else:
                query = query.filter(WhatsAppConversation.assignee_id == agent_uuid)

        if status_filter:
            query = query.filter(WhatsAppConversation.status == status_filter)

        if search:
            query = query.join(WhatsAppConversation.contact).filter(
                or_(
                    Contact.phone_number.ilike(f"%{search}%"),
                    Contact.name.ilike(f"%{search}%"),
                )
            )

        if archived is None:
            query = query.filter(WhatsAppConversation.is_archived == False)
        else:
            query = query.filter(WhatsAppConversation.is_archived == archived)

        if unread is True:
            query = query.filter(WhatsAppConversation.unread_count > 0)

        total = query.count()
        conversations = (
            query.order_by(WhatsAppConversation.last_message_at.desc().nullslast())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        conv_ids = [c.id for c in conversations]
        last_msgs = _batch_last_message_info(self.db, conv_ids)

        items = []
        for c in conversations:
            preview, last_sender, last_status = last_msgs.get(c.id, (None, None, None))
            items.append(_format_conv_dict(c, preview, last_sender, last_status, db=self.db))

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "has_next": (page * page_size) < total,
        }

    def assign_conversation(
        self,
        conv_id: uuid.UUID,
        assignee_id: Optional[uuid.UUID],
        actor_id: Optional[uuid.UUID] = None,
    ) -> dict:
        """Assigns conversation to a specific Sales Agent or releases to unassigned/bot queue."""
        conv = self.db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id, WhatsAppConversation.is_deleted == False).first()
        if not conv:
            raise NotFoundError("Conversation not found.")

        conv.assignee_id = assignee_id
        conv.assigned_at = datetime.now(timezone.utc) if assignee_id else None
        conv.assigned_by = actor_id
        self.db.commit()
        self.db.refresh(conv)

        preview, last_sender, last_status = _single_last_message_info(self.db, conv.id)
        return _format_conv_dict(conv, preview, last_sender, last_status)

    def claim_conversation(self, conv_id: uuid.UUID, agent_id: uuid.UUID) -> dict:
        """Allows a Sales Agent to claim an unassigned conversation in their assigned channel."""
        conv = self.db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id, WhatsAppConversation.is_deleted == False).first()
        if not conv:
            raise NotFoundError("Conversation not found.")

        # Check channel assignment access
        has_access = ChannelAssignmentRepository.has_channel_access(self.db, agent_id, conv.whatsapp_account_id, conv.organization_id)
        if not has_access:
            raise PermissionError("Access denied: You are not assigned to this WhatsApp channel.")

        conv.assignee_id = agent_id
        conv.assigned_at = datetime.now(timezone.utc)
        conv.assigned_by = agent_id
        self.db.commit()
        self.db.refresh(conv)

        preview, last_sender, last_status = _single_last_message_info(self.db, conv.id)
        return _format_conv_dict(conv, preview, last_sender, last_status)

    def get_conversation_details(self, conv_id: uuid.UUID, current_user: Optional[Dict[str, Any]] = None) -> Optional[dict]:
        conv = (
            self.db.query(WhatsAppConversation)
            .options(joinedload(WhatsAppConversation.contact))
            .filter(WhatsAppConversation.id == conv_id, WhatsAppConversation.is_deleted == False)
            .first()
        )
        if not conv:
            return None

        # RLS Channel Access Check
        if current_user and current_user.get("role") == UserRole.SALES_AGENT.value:
            agent_uuid = uuid.UUID(current_user["id"])
            has_access = ChannelAssignmentRepository.has_channel_access(self.db, agent_uuid, conv.whatsapp_account_id, conv.organization_id)
            if not has_access:
                raise PermissionError("Access denied: You are not assigned to this WhatsApp channel.")

        preview, last_sender, last_status = _single_last_message_info(self.db, conv.id)
        return _format_conv_dict(conv, preview, last_sender, last_status, db=self.db)

    def update_conversation_fields(self, conv_id: uuid.UUID, payload: dict) -> Optional[dict]:
        conv = (
            self.db.query(WhatsAppConversation)
            .options(joinedload(WhatsAppConversation.contact))
            .filter(WhatsAppConversation.id == conv_id, WhatsAppConversation.is_deleted == False)
            .first()
        )
        if not conv:
            return None

        for field in ("status", "is_archived"):
            if field in payload:
                setattr(conv, field, payload[field])

        if "customer_name" in payload and conv.contact:
            conv.contact.name = payload["customer_name"]

        self.db.commit()
        self.db.refresh(conv)
        preview, last_sender, last_status = _single_last_message_info(self.db, conv.id)
        return _format_conv_dict(conv, preview, last_sender, last_status, db=self.db)

    def mark_conversation_as_read(self, conv_id: uuid.UUID) -> Optional[dict]:
        conv = (
            self.db.query(WhatsAppConversation)
            .options(joinedload(WhatsAppConversation.contact))
            .filter(WhatsAppConversation.id == conv_id, WhatsAppConversation.is_deleted == False)
            .first()
        )
        if not conv:
            return None
        conv.unread_count = 0
        self.db.commit()
        self.db.refresh(conv)
        preview, last_sender, last_status = _single_last_message_info(self.db, conv.id)
        return _format_conv_dict(conv, preview, last_sender, last_status, db=self.db)

    def delete_conversation(self, conv_id: uuid.UUID) -> bool:
        """Soft delete conversation."""
        conv = self.db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id, WhatsAppConversation.is_deleted == False).first()
        if not conv:
            return False
        conv.is_deleted = True
        self.db.commit()
        return True

    def get_conversation_messages(self, conv_id: uuid.UUID, page: int = 1, page_size: int = 50) -> dict:
        total = (
            self.db.query(WhatsAppMessage)
            .filter(WhatsAppMessage.conversation_id == conv_id, WhatsAppMessage.is_deleted == False)
            .count()
        )

        messages = (
            self.db.query(WhatsAppMessage)
            .options(
                joinedload(WhatsAppMessage.media_files),
                joinedload(WhatsAppMessage.reactions),
            )
            .filter(WhatsAppMessage.conversation_id == conv_id, WhatsAppMessage.is_deleted == False)
            .order_by(WhatsAppMessage.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        messages.reverse()

        from services.message_service import MessageService
        msg_svc = MessageService(self.db)
        items = [msg_svc.serialize_message(m) for m in messages]

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "has_more": (page * page_size) < total,
            "cursor": None,
        }

    def mark_resolved(self, conversation_id: uuid.UUID) -> Optional[WhatsAppConversation]:
        return self.repo.update_status(conversation_id, "RESOLVED")

    def mark_open(self, conversation_id: uuid.UUID) -> Optional[WhatsAppConversation]:
        return self.repo.update_status(conversation_id, "OPEN")

    def mark_pending(self, conversation_id: uuid.UUID) -> Optional[WhatsAppConversation]:
        return self.repo.update_status(conversation_id, "PENDING")


def _format_conv_dict(c: WhatsAppConversation, preview=None, last_sender=None, last_status=None, db: Optional[Session] = None) -> dict:
    phone = c.contact.phone_number if c.contact else None
    name = c.contact.name if c.contact else None

    is_broadcast_reply = False
    broadcast_campaign_id = None
    if db and c.contact_id:
        rec = (
            db.query(CampaignRecipient)
            .filter(CampaignRecipient.contact_id == c.contact_id)
            .order_by(CampaignRecipient.created_at.desc())
            .first()
        )
        if rec and rec.status == CampaignRecipientStatus.REPLIED:
            is_broadcast_reply = True
            broadcast_campaign_id = str(rec.campaign_id) if rec.campaign_id else None

    tags = ["Campaign Reply"] if is_broadcast_reply else []

    return {
        "id": str(c.id),
        "customer_phone": phone,
        "customer_name": name,
        "status": c.status if isinstance(c.status, str) else c.status.value,
        "is_archived": c.is_archived,
        "unread_count": c.unread_count or 0,
        "assignee_id": str(c.assignee_id) if c.assignee_id else None,
        "assigned_at": c.assigned_at.isoformat() + "Z" if c.assigned_at else None,
        "last_message_at": c.last_message_at.isoformat() + "Z" if c.last_message_at else None,
        "window_expires_at": c.window_expires_at.isoformat() + "Z" if c.window_expires_at else None,
        "last_message_preview": preview,
        "last_message_sender": last_sender,
        "last_message_status": last_status,
        "is_broadcast_reply": is_broadcast_reply,
        "broadcast_campaign_id": broadcast_campaign_id,
        "tags": tags,
        "created_at": c.created_at.isoformat() + "Z" if c.created_at else None,
        "updated_at": c.updated_at.isoformat() + "Z" if c.updated_at else None,
    }


def _single_last_message_info(db: Session, conversation_id: uuid.UUID):
    msg = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.conversation_id == conversation_id, WhatsAppMessage.is_deleted == False)
        .order_by(WhatsAppMessage.created_at.desc())
        .first()
    )
    if not msg:
        return None, None, None

    type_labels = {
        "IMAGE": "📷 Photo",
        "VIDEO": "🎥 Video",
        "AUDIO": "🎵 Audio",
        "DOCUMENT": "📄 Document",
        "STICKER": "😊 Sticker",
    }
    msg_type_val = msg.message_type.value if hasattr(msg.message_type, "value") else str(msg.message_type)
    preview = msg.content or type_labels.get(msg_type_val, f"[{msg_type_val}]")
    sender_val = msg.sender_type.value if hasattr(msg.sender_type, "value") else str(msg.sender_type)
    status_val = msg.status.value if hasattr(msg.status, "value") else str(msg.status)
    return preview, sender_val, status_val


def _batch_last_message_info(db: Session, conv_ids: list[uuid.UUID]) -> dict[uuid.UUID, tuple]:
    if not conv_ids:
        return {}

    msgs = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.conversation_id.in_(conv_ids), WhatsAppMessage.is_deleted == False)
        .order_by(WhatsAppMessage.conversation_id, WhatsAppMessage.created_at.desc())
        .distinct(WhatsAppMessage.conversation_id)
        .all()
    )

    type_labels = {
        "IMAGE": "📷 Photo",
        "VIDEO": "🎥 Video",
        "AUDIO": "🎵 Audio",
        "DOCUMENT": "📄 Document",
        "STICKER": "😊 Sticker",
    }

    result = {}
    for msg in msgs:
        msg_type_val = msg.message_type.value if hasattr(msg.message_type, "value") else str(msg.message_type)
        preview = msg.content or type_labels.get(msg_type_val, f"[{msg_type_val}]")
        sender_val = msg.sender_type.value if hasattr(msg.sender_type, "value") else str(msg.sender_type)
        status_val = msg.status.value if hasattr(msg.status, "value") else str(msg.status)
        result[msg.conversation_id] = (preview, sender_val, status_val)

    return result


class ConversationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, conv_id: uuid.UUID) -> Optional[WhatsAppConversation]:
        return (
            self.db.query(WhatsAppConversation)
            .filter(WhatsAppConversation.id == conv_id, WhatsAppConversation.is_deleted == False)
            .first()
        )

    def update_status(
        self, conv_id: uuid.UUID, status: str
    ) -> Optional[WhatsAppConversation]:
        conv = self.get_by_id(conv_id)
        if conv:
            conv.status = status
            self.db.commit()
            self.db.refresh(conv)
        return conv

    def update_conv(self, conv_id: uuid.UUID, **kwargs) -> Optional[WhatsAppConversation]:
        conv = self.get_by_id(conv_id)
        if conv:
            for k, v in kwargs.items():
                setattr(conv, k, v)
            self.db.commit()
            self.db.refresh(conv)
        return conv
