from __future__ import annotations

import uuid
import random
from typing import Optional
from sqlalchemy.orm import Session
from models.postgres_model import (
    Organization,
    OrganizationStatus,
    Contact,
    ContactStatus,
    WhatsAppAccount,
    WhatsAppAccountStatus,
    WhatsAppConversation,
    ConversationStatus,
    WhatsAppMessage,
    MessageDirection,
    SenderType,
    MessageType,
    MessageStatus,
)


class TestDataFactory:
    """Helper factory for generating randomized test models in DB sessions."""

    @staticmethod
    def create_organization(db: Session, name: Optional[str] = None) -> Organization:
        unique = str(uuid.uuid4())[:8]
        org = Organization(
            id=uuid.uuid4(),
            name=name or f"Org {unique}",
            slug=f"org-{unique}",
            status=OrganizationStatus.ACTIVE,
        )
        db.add(org)
        db.commit()
        db.refresh(org)
        return org

    @staticmethod
    def create_contact(db: Session, org_id: uuid.UUID, phone: Optional[str] = None) -> Contact:
        phone_num = phone or f"91{random.randint(7000000000, 9999999999)}"
        contact = Contact(
            id=uuid.uuid4(),
            organization_id=org_id,
            phone_number=phone_num,
            name=f"Customer {phone_num[-4:]}",
            status=ContactStatus.ACTIVE,
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)
        return contact

    @staticmethod
    def create_conversation(
        db: Session, org_id: uuid.UUID, wa_id: uuid.UUID, contact_id: uuid.UUID
    ) -> WhatsAppConversation:
        conv = WhatsAppConversation(
            id=uuid.uuid4(),
            organization_id=org_id,
            whatsapp_account_id=wa_id,
            contact_id=contact_id,
            status=ConversationStatus.OPEN,
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
        return conv

    @staticmethod
    def create_message(
        db: Session,
        conv_id: uuid.UUID,
        content: str = "Test message body",
        msg_type: MessageType = MessageType.TEXT,
        direction: MessageDirection = MessageDirection.INBOUND,
    ) -> WhatsAppMessage:
        msg = WhatsAppMessage(
            id=uuid.uuid4(),
            conversation_id=conv_id,
            direction=direction,
            sender_type=SenderType.CUSTOMER if direction == MessageDirection.INBOUND else SenderType.AGENT,
            message_type=msg_type,
            content=content,
            status=MessageStatus.DELIVERED,
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg
