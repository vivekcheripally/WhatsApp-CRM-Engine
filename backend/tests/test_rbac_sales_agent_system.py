import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import uuid
from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.postgres_model import (
    Organization,
    User,
    UserRole,
    UserStatus,
    WhatsAppAccount,
    WhatsAppAccountStatus,
    Contact,
    Campaign,
    WhatsAppConversation,
)
from services.agent_service import AgentService
from services.contact_service import ContactService
from services.campaign_service import CampaignService
from services.conversation_service import ConversationService
from repositories.channel_assignment_repository import ChannelAssignmentRepository
from repositories.campaign_assignment_repository import CampaignAssignmentRepository


def test_rbac_and_sales_agent_flow(db_session: Session):
    db: Session = db_session
    try:
        # 1. Create Organization
        org = Organization(
            name="Test RBAC Org",
            slug=f"rbac-org-{uuid.uuid4().hex[:6]}",
            unassigned_inbox_visible_to_agents=True,
        )
        db.add(org)
        db.commit()
        db.refresh(org)

        # 2. Create Org Admin User
        admin_user = User(
            organization_id=org.id,
            email=f"admin-{uuid.uuid4().hex[:6]}@test.com",
            hashed_password="hashed_pass",
            full_name="Org Admin",
            role=UserRole.ORG_ADMIN,
            status=UserStatus.ACTIVE,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        # 3. Create WABA Account
        waba = WhatsAppAccount(
            organization_id=org.id,
            account_name="Primary Sales WABA",
            waba_id="waba_12345",
            phone_number_id=f"phone_{uuid.uuid4().hex[:8]}",
            access_token="token_abc",
            status=WhatsAppAccountStatus.ACTIVE,
        )
        db.add(waba)
        db.commit()
        db.refresh(waba)

        # 4. Onboard Sales Agent
        agent_svc = AgentService(db)
        agent_res = agent_svc.onboard_agent(
            organization_id=org.id,
            email=f"agent-{uuid.uuid4().hex[:6]}@test.com",
            password="AgentPassword123!",
            full_name="Sales Agent 1",
            assigned_channel_ids=[str(waba.id)],
            actor_id=admin_user.id,
        )
        agent_id = uuid.UUID(agent_res["id"])
        assert agent_res["role"] == UserRole.SALES_AGENT.value

        # Verify Channel Assignment
        assigned_channels = ChannelAssignmentRepository.get_assigned_channel_ids(db, agent_id, org.id)
        assert waba.id in assigned_channels

        # 5. Create Contacts (1 owned by Admin, 1 owned by Agent)
        contact_svc = ContactService(db)
        contact_admin = contact_svc.create_contact(
            name="Admin Lead",
            phone_number=f"+919876{uuid.uuid4().hex[:6]}",
            organization_id=org.id,
            actor_id=admin_user.id,
        )
        contact_agent = contact_svc.create_contact(
            name="Agent Lead",
            phone_number=f"+919875{uuid.uuid4().hex[:6]}",
            organization_id=org.id,
            actor_id=agent_id,
        )

        # Verify RLS Contact List for Admin vs Agent
        admin_context = {"id": str(admin_user.id), "role": UserRole.ORG_ADMIN.value, "organization_id": str(org.id)}
        agent_context = {"id": str(agent_id), "role": UserRole.SALES_AGENT.value, "organization_id": str(org.id)}

        admin_contacts, admin_total, _ = contact_svc.list_contacts(organization_id=org.id, current_user=admin_context)
        agent_contacts, agent_total, _ = contact_svc.list_contacts(organization_id=org.id, current_user=agent_context)

        assert admin_total == 2
        assert agent_total == 1
        assert agent_contacts[0]["id"] == contact_agent["id"]

        # 6. Test Conversation Creation & Claiming
        conv_svc = ConversationService(db)
        conv, _ = conv_svc.get_or_create(
            customer_phone=contact_admin["phone_number"],
            whatsapp_account_id=waba.id,
            organization_id=org.id,
        )
        assert conv.assignee_id is None  # Unassigned queue

        # Agent claims conversation
        claimed_conv = conv_svc.claim_conversation(conv.id, agent_id)
        assert claimed_conv["assignee_id"] == str(agent_id)

        print("\nALL RBAC AND SALES AGENT SYSTEM TESTS PASSED PERFECTLY!")

    finally:
        if db_session is None:
            db.close()


if __name__ == "__main__":
    test_rbac_and_sales_agent_flow()
