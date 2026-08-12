from __future__ import annotations

import pytest
from sqlalchemy.orm import Session
from services.conversation_service import ConversationService
from models.postgres_model import WhatsAppConversation, WhatsAppAccount, Contact, Organization


@pytest.mark.unit
def test_get_or_create_conversation_new(
    db_session: Session, sample_org: Organization, sample_wa_account: WhatsAppAccount
):
    """Verify ConversationService.get_or_create creates new contact and conversation."""
    svc = ConversationService(db_session)
    phone = "919988776655"

    conv, created = svc.get_or_create(
        customer_phone=phone,
        whatsapp_account_id=sample_wa_account.id,
        organization_id=sample_org.id,
        customer_name="Alice Smith",
    )

    assert created is True
    assert conv.id is not None
    assert conv.contact.phone_number == phone
    assert conv.contact.name == "Alice Smith"


@pytest.mark.unit
def test_get_or_create_conversation_existing(
    db_session: Session, sample_conversation: WhatsAppConversation, sample_contact: Contact
):
    """Verify ConversationService.get_or_create returns existing conversation on duplicate call."""
    svc = ConversationService(db_session)

    conv, created = svc.get_or_create(
        customer_phone=sample_contact.phone_number,
        whatsapp_account_id=sample_conversation.whatsapp_account_id,
        organization_id=sample_conversation.organization_id,
    )

    assert created is False
    assert conv.id == sample_conversation.id
