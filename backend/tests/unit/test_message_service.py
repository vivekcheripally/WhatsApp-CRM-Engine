from __future__ import annotations

import pytest
from sqlalchemy.orm import Session
from services.message_service import MessageService
from models.postgres_model import WhatsAppMessage, WhatsAppConversation, Template, MessageDirection, SenderType


@pytest.mark.unit
def test_serialize_text_message(db_session: Session, sample_message: WhatsAppMessage):
    """Verify MessageService.serialize_message formats plain text messages correctly."""
    svc = MessageService(db_session)
    serialized = svc.serialize_message(sample_message)

    assert serialized["id"] == str(sample_message.id)
    assert serialized["message_type"] == "TEXT"
    assert serialized["content"] == "Hello, I need help with my order"
    assert isinstance(serialized["media_files"], list)


@pytest.mark.unit
def test_serialize_template_message_with_body_resolution(
    db_session: Session, sample_conversation: WhatsAppConversation, sample_template: Template
):
    """Verify MessageService.serialize_message extracts BODY component text for templates."""
    msg = WhatsAppMessage(
        organization_id=sample_conversation.organization_id,
        whatsapp_account_id=sample_conversation.whatsapp_account_id,
        conversation_id=sample_conversation.id,
        template_id=sample_template.id,
        direction=MessageDirection.OUTBOUND,
        sender_type=SenderType.AGENT,
        message_type="TEMPLATE",
        content=f"Template: {sample_template.template_name}",
    )
    db_session.add(msg)
    db_session.commit()
    db_session.refresh(msg)

    svc = MessageService(db_session)
    serialized = svc.serialize_message(msg)

    # Should resolve body text from template component
    assert "Hello {{1}}, welcome to FastSales!" in serialized["content"]
    assert len(serialized["media_files"]) == 1
    assert serialized["media_files"][0]["file_url"] == "/uploads/sample_doc.pdf"
    assert serialized["media_files"][0]["mime_type"] == "application/pdf"
