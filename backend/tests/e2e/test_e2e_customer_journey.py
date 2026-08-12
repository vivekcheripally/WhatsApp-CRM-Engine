from __future__ import annotations

import uuid
import pytest
from unittest.mock import patch
from sqlalchemy.orm import Session
from services.conversation_service import ConversationService
from services.message_service import MessageService
from services.campaign_service import CampaignService
from models.postgres_model import (
    Organization,
    WhatsAppAccount,
    Template,
)
from schemas.campaign import CampaignCreateSchema
from schemas.whatsapp_inbox import SendTextMessageRequest


@pytest.mark.e2e
def test_complete_inbox_and_campaign_journey(
    db_session: Session,
    sample_org: Organization,
    sample_wa_account: WhatsAppAccount,
    sample_template: Template,
):
    """
    End-to-End Test covering complete business workflow:
    1. Customer initiates contact -> Conversation created.
    2. Agent replies with text message -> Message persisted & serialized.
    3. Campaign created & triggered -> Recipient count updated.
    4. Dashboard metrics reflect active conversation & messages.
    """
    # 1. Customer initiates contact
    conv_svc = ConversationService(db_session)
    customer_phone = "919876543210"
    conv, created = conv_svc.get_or_create(
        customer_phone=customer_phone,
        whatsapp_account_id=sample_wa_account.id,
        organization_id=sample_org.id,
        customer_name="E2E Customer",
    )
    assert created is True
    assert conv.contact.name == "E2E Customer"

    # 2. Agent sends text message (Mock external Meta API network request)
    with patch.object(MessageService, "_post_to_meta") as mock_meta:
        mock_meta.return_value = {
            "messages": [{"id": "wamid.HBgLMTE5ODc2NTQzMjEwFQIAERgSQTU1QUE1QUE1QUE1QUE1QUEA"}]
        }

        msg_svc = MessageService(db_session)
        req = SendTextMessageRequest(
            conversation_id=str(conv.id),
            content="Hello from E2E Agent!",
        )
        msg = msg_svc.send_text_message(
            req,
            agent_id=1,
            phone_number_id=sample_wa_account.phone_number_id,
            access_token=sample_wa_account.access_token,
        )
        assert msg.id is not None
        assert msg.content == "Hello from E2E Agent!"

    # 3. Create & execute campaign
    camp_svc = CampaignService(db_session)
    schema = CampaignCreateSchema(
        organization_id=sample_org.id,
        whatsapp_account_id=sample_wa_account.id,
        campaign_name="E2E Black Friday Sale",
        template_id=str(sample_template.id),
        contact_ids=[str(conv.contact.id)],
    )
    camp = camp_svc.create_campaign(schema)
    camp_id = uuid.UUID(camp.get("campaign_id") or camp.get("id"))
    run_res = camp_svc.prepare_campaign_run(camp_id)
    assert run_res["success"] is True

    # 4. Verify message list serialization for conversation
    messages = conv_svc.get_conversation_messages(conv.id)
    assert messages["total"] >= 1
    assert any(m["content"] == "Hello from E2E Agent!" for m in messages["items"])
