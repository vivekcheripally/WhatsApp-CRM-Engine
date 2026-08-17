from __future__ import annotations

import os
import sys
import uuid
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

# Register SQLite type compiler for PostgreSQL JSONB
@compiles(JSONB, "sqlite")
def visit_JSONB(type_, compiler, **kw):
    return "TEXT"

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from core.database import Base, get_db
from models.postgres_model import (
    Organization,
    OrganizationStatus,
    WhatsAppAccount,
    WhatsAppAccountStatus,
    Contact,
    ContactStatus,
    Template,
    TemplateStatus,
    TemplateCategory,
    HeaderType,
    WhatsAppConversation,
    ConversationStatus,
    WhatsAppMessage,
    MessageDirection,
    SenderType,
    MessageType,
    MessageStatus,
    Campaign,
    CampaignStatus,
)

# Use SQLite in-memory for fast, isolated test database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create all database tables before tests run, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provide a transactional database session that rolls back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()


from routes.deps import get_current_user


@pytest.fixture
def client(db_session: Session, sample_org: Organization) -> Generator[TestClient, None, None]:
    """FastAPI TestClient overriding get_db and get_current_user with test session and tenant context."""
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    def _override_get_current_user():
        return {
            "id": str(uuid.uuid4()),
            "email": "admin@testcorp.com",
            "role": "ORG_ADMIN",
            "organization_id": str(sample_org.id),
            "must_change_password": False,
        }

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def sample_org(db_session: Session) -> Organization:
    """Fixture providing a persisted test Organization."""
    org = Organization(
        id=uuid.uuid4(),
        name="Test Corp",
        slug="test-corp",
        status=OrganizationStatus.ACTIVE,
    )
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


@pytest.fixture
def sample_wa_account(db_session: Session, sample_org: Organization) -> WhatsAppAccount:
    """Fixture providing a persisted test WhatsAppAccount."""
    wa = WhatsAppAccount(
        id=uuid.uuid4(),
        organization_id=sample_org.id,
        account_name="Test WABA Account",
        phone_number_id="109283746501928",
        waba_id="987654321098765",
        display_phone_number="15551234567",
        access_token="EAAX_TEST_TOKEN_12345",
        status=WhatsAppAccountStatus.ACTIVE,
    )
    db_session.add(wa)
    db_session.commit()
    db_session.refresh(wa)
    return wa


@pytest.fixture
def sample_contact(db_session: Session, sample_org: Organization) -> Contact:
    """Fixture providing a persisted test Contact."""
    contact = Contact(
        id=uuid.uuid4(),
        organization_id=sample_org.id,
        phone_number="919030003699",
        name="John Doe Test",
        status=ContactStatus.ACTIVE,
    )
    db_session.add(contact)
    db_session.commit()
    db_session.refresh(contact)
    return contact


@pytest.fixture
def sample_template(db_session: Session, sample_org: Organization, sample_wa_account: WhatsAppAccount) -> Template:
    """Fixture providing a persisted test Template."""
    tmpl = Template(
        id=uuid.uuid4(),
        organization_id=sample_org.id,
        whatsapp_account_id=sample_wa_account.id,
        template_name="test_template_card",
        language="en_US",
        category=TemplateCategory.MARKETING,
        header_type=HeaderType.DOCUMENT,
        header_media_url="/uploads/sample_doc.pdf",
        template_body="Hello {{1}}, welcome to FastSales!",
        components=[
            {"type": "HEADER", "format": "DOCUMENT"},
            {"type": "BODY", "text": "Hello {{1}}, welcome to FastSales!"},
        ],
        status=TemplateStatus.APPROVED,
    )
    db_session.add(tmpl)
    db_session.commit()
    db_session.refresh(tmpl)
    return tmpl


@pytest.fixture
def sample_conversation(db_session: Session, sample_org: Organization, sample_wa_account: WhatsAppAccount, sample_contact: Contact) -> WhatsAppConversation:
    """Fixture providing a persisted test WhatsAppConversation."""
    conv = WhatsAppConversation(
        id=uuid.uuid4(),
        organization_id=sample_org.id,
        whatsapp_account_id=sample_wa_account.id,
        contact_id=sample_contact.id,
        status=ConversationStatus.OPEN,
        unread_count=0,
    )
    db_session.add(conv)
    db_session.commit()
    db_session.refresh(conv)
    return conv


@pytest.fixture
def sample_message(db_session: Session, sample_conversation: WhatsAppConversation) -> WhatsAppMessage:
    """Fixture providing a persisted test WhatsAppMessage."""
    msg = WhatsAppMessage(
        id=uuid.uuid4(),
        organization_id=sample_conversation.organization_id,
        whatsapp_account_id=sample_conversation.whatsapp_account_id,
        conversation_id=sample_conversation.id,
        direction=MessageDirection.INBOUND,
        sender_type=SenderType.CUSTOMER,
        message_type=MessageType.TEXT,
        content="Hello, I need help with my order",
        status=MessageStatus.READ,
    )
    db_session.add(msg)
    db_session.commit()
    db_session.refresh(msg)
    return msg


@pytest.fixture
def sample_campaign(db_session: Session, sample_org: Organization, sample_wa_account: WhatsAppAccount, sample_template: Template) -> Campaign:
    """Fixture providing a persisted test Campaign."""
    camp = Campaign(
        id=uuid.uuid4(),
        organization_id=sample_org.id,
        whatsapp_account_id=sample_wa_account.id,
        campaign_name="Summer Promotion 2026",
        template_id=sample_template.id,
        status=CampaignStatus.DRAFT,
        sent_count=0,
        failed_count=0,
    )
    db_session.add(camp)
    db_session.commit()
    db_session.refresh(camp)
    return camp
