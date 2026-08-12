import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    UUID,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from core.database import Base


# ==============================================================================
# ENUM DEFINITIONS (Python StrEnum -> Native SQL Enum)
# ==============================================================================

class OrganizationStatus(str, enum.Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    REJECTED = "REJECTED"


class UserRole(str, enum.Enum):
    SYSTEM_ADMIN = "SYSTEM_ADMIN"
    ORG_ADMIN = "ORG_ADMIN"
    SALES_AGENT = "SALES_AGENT"


class Permission(str, enum.Enum):
    CAMPAIGN_READ = "CAMPAIGN_READ"
    CAMPAIGN_CREATE = "CAMPAIGN_CREATE"
    CAMPAIGN_RUN = "CAMPAIGN_RUN"
    CAMPAIGN_ASSIGN = "CAMPAIGN_ASSIGN"
    CONTACT_READ = "CONTACT_READ"
    CONTACT_CREATE = "CONTACT_CREATE"
    CONTACT_EDIT = "CONTACT_EDIT"
    CONTACT_DELETE = "CONTACT_DELETE"
    CONTACT_ASSIGN = "CONTACT_ASSIGN"
    CONVERSATION_READ = "CONVERSATION_READ"
    CONVERSATION_REPLY = "CONVERSATION_REPLY"
    CONVERSATION_CLAIM = "CONVERSATION_CLAIM"
    CONVERSATION_ASSIGN = "CONVERSATION_ASSIGN"
    CONVERSATION_CLOSE = "CONVERSATION_CLOSE"
    WABA_MANAGE = "WABA_MANAGE"
    AGENT_MANAGE = "AGENT_MANAGE"
    ANALYTICS_READ = "ANALYTICS_READ"


class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


class WhatsAppAccountStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DISCONNECTED = "DISCONNECTED"


class ContactStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    UNSUBSCRIBED = "UNSUBSCRIBED"
    BLOCKED = "BLOCKED"
    ARCHIVED = "ARCHIVED"


class TemplateCategory(str, enum.Enum):
    MARKETING = "MARKETING"
    UTILITY = "UTILITY"
    AUTHENTICATION = "AUTHENTICATION"


class TemplateStatus(str, enum.Enum):
    APPROVED = "APPROVED"
    PENDING = "PENDING"
    REJECTED = "REJECTED"
    PAUSED = "PAUSED"
    DISABLED = "DISABLED"
    ARCHIVED = "ARCHIVED"


class HeaderType(str, enum.Enum):
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    DOCUMENT = "DOCUMENT"
    LOCATION = "LOCATION"
    NONE = "NONE"


class CampaignStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    SENDING = "SENDING"
    COMPLETED = "COMPLETED"
    PAUSED = "PAUSED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class CampaignRecipientStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"
    REPLIED = "REPLIED"


class ConversationStatus(str, enum.Enum):
    OPEN = "OPEN"
    PENDING = "PENDING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class MessageDirection(str, enum.Enum):
    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"


class SenderType(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    AGENT = "AGENT"
    SYSTEM = "SYSTEM"
    BOT = "BOT"


class MessageType(str, enum.Enum):
    TEXT = "TEXT"
    TEMPLATE = "TEMPLATE"
    IMAGE = "IMAGE"
    DOCUMENT = "DOCUMENT"
    AUDIO = "AUDIO"
    VIDEO = "VIDEO"
    STICKER = "STICKER"
    LOCATION = "LOCATION"
    CONTACTS = "CONTACTS"
    INTERACTIVE = "INTERACTIVE"
    REACTION = "REACTION"
    UNSUPPORTED = "UNSUPPORTED"


class MessageStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"


class ScheduleStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class MatchType(str, enum.Enum):
    EXACT = "EXACT"
    CONTAINS = "CONTAINS"
    STARTS_WITH = "STARTS_WITH"
    REGEX = "REGEX"


class ResponseType(str, enum.Enum):
    TEXT = "TEXT"
    TEMPLATE = "TEMPLATE"
    MEDIA = "MEDIA"


class ReactionUserType(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    AGENT = "AGENT"


# ==============================================================================
# MULTI-TENANCY & CORE CONFIGURATION MODELS
# ==============================================================================

class Organization(Base):
    """Root tenant entity representing a client company or team."""
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False, unique=True, index=True)
    contact_name = Column(String(255), nullable=True)
    contact_email = Column(String(255), nullable=True)
    plan_name = Column(String(50), default="STARTER")
    max_monthly_messages = Column(Integer, default=10000)
    unassigned_inbox_visible_to_agents = Column(Boolean, default=True, nullable=False)
    status = Column(SQLEnum(OrganizationStatus), default=OrganizationStatus.PENDING_APPROVAL, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    whatsapp_accounts = relationship("WhatsAppAccount", back_populates="organization", cascade="all, delete-orphan")
    contacts = relationship("Contact", back_populates="organization", cascade="all, delete-orphan")
    templates = relationship("Template", back_populates="organization", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="organization", cascade="all, delete-orphan")
    auto_replies = relationship("WhatsAppAutoReply", back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    """User account entity. Supports Organization Admins, Sales Agents, and global System Admins."""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(SQLEnum(UserRole), nullable=False, index=True)
    status = Column(SQLEnum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
    must_change_password = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="users")

    __table_args__ = (
        CheckConstraint(
            "(role = 'SYSTEM_ADMIN' AND organization_id IS NULL) OR (role IN ('ORG_ADMIN', 'SALES_AGENT') AND organization_id IS NOT NULL)",
            name="chk_user_org_scope"
        ),
    )


class UserWhatsAppAccountAssignment(Base):
    """Bridge table mapping Sales Agents to assigned WhatsApp Business Accounts (WABAs)."""
    __tablename__ = "user_whatsapp_account_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    whatsapp_account_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "whatsapp_account_id", name="uq_user_wa_account_assignment"),
    )


class CampaignAgentAssignment(Base):
    """Bridge table mapping Campaigns to assigned Sales Agents (Many-to-Many)."""
    __tablename__ = "campaign_agent_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("campaign_id", "user_id", name="uq_campaign_user_assignment"),
    )



class WhatsAppAccount(Base):
    """Meta WABA account configurations (1 Org can have multiple accounts/phone numbers)."""
    __tablename__ = "whatsapp_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    account_name = Column(String(255), nullable=False)
    waba_id = Column(String(255), nullable=False, index=True)
    phone_number_id = Column(String(255), nullable=False, unique=True, index=True)
    display_phone_number = Column(String(50), nullable=True)
    verified_name = Column(String(255), nullable=True)
    access_token = Column(Text, nullable=False)
    webhook_verify_token = Column(String(255), nullable=True)
    webhook_verified = Column(Boolean, default=False, nullable=False)
    channel_name = Column(String(100), nullable=True)
    is_default = Column(Boolean, default=False, nullable=False, index=True)
    status = Column(SQLEnum(WhatsAppAccountStatus), default=WhatsAppAccountStatus.ACTIVE, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="whatsapp_accounts")
    templates = relationship("Template", back_populates="whatsapp_account", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="whatsapp_account", cascade="all, delete-orphan")
    conversations = relationship("WhatsAppConversation", back_populates="whatsapp_account", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_wa_account_org_status", "organization_id", "status"),
        Index("ix_whatsapp_accounts_org_phone", "organization_id", "phone_number_id", unique=True),
    )


# ==============================================================================
# CONTACT MANAGEMENT (CRM)
# ==============================================================================

class Contact(Base):
    """Customer database scoped per organization."""
    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    phone_number = Column(String(32), nullable=False, index=True)  # E.164 standard format (+1234567890)
    email = Column(String(255), nullable=True)
    status = Column(SQLEnum(ContactStatus), default=ContactStatus.ACTIVE, nullable=False, index=True)
    source = Column(String(50), default="MANUAL", server_default="MANUAL", nullable=False, index=True)
    attributes = Column(JSONB, default=dict, nullable=False)  # Dynamic custom fields (tags, order_id, city, etc.)

    # Ownership & Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


    # Relationships
    organization = relationship("Organization", back_populates="contacts")
    conversations = relationship("WhatsAppConversation", back_populates="contact", cascade="all, delete-orphan")
    campaign_recipients = relationship("CampaignRecipient", back_populates="contact")
    owner = relationship("User", foreign_keys=[owner_id])
    creator = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        UniqueConstraint("organization_id", "phone_number", name="uq_org_contact_phone"),
        Index("ix_contacts_org_phone", "organization_id", "phone_number"),
        Index("ix_contacts_org_owner", "organization_id", "owner_id"),
    )


# ==============================================================================
# TEMPLATES & CAMPAIGN MANAGEMENT
# ==============================================================================

class Template(Base):
    """Meta WABA Message Templates."""
    __tablename__ = "templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    whatsapp_account_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    template_name = Column(String(255), nullable=False)
    category = Column(SQLEnum(TemplateCategory), nullable=False)
    language = Column(String(20), default="en_US", nullable=False)
    header_type = Column(SQLEnum(HeaderType), default=HeaderType.NONE, nullable=True)
    template_body = Column(Text, nullable=False)
    footer = Column(String(255), nullable=True)
    buttons = Column(JSONB, nullable=True)
    components = Column(JSONB, nullable=True)  # Full raw payload definition for Meta API
    status = Column(SQLEnum(TemplateStatus), default=TemplateStatus.PENDING, nullable=False, index=True)
    meta_template_id = Column(String(255), nullable=True, index=True)
    meta_updated_at = Column(DateTime(timezone=True), nullable=True)
    header_media_url = Column(String(500), nullable=True)
    meta_header_media_id = Column(String(255), nullable=True)

    header_filename = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="templates")
    whatsapp_account = relationship("WhatsAppAccount", back_populates="templates")
    campaigns = relationship("Campaign", back_populates="template")

    __table_args__ = (
        UniqueConstraint("whatsapp_account_id", "template_name", "language", name="uq_waba_template_name_lang"),
    )


class Campaign(Base):
    """Marketing / Bulk Outbound WhatsApp Campaigns."""
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    whatsapp_account_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.id", ondelete="SET NULL"), nullable=True, index=True)
    campaign_name = Column(String(255), nullable=False)
    status = Column(SQLEnum(CampaignStatus), default=CampaignStatus.DRAFT, nullable=False, index=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # Performance Counters
    total_recipients = Column(Integer, default=0, nullable=False)
    sent_count = Column(Integer, default=0, nullable=False)
    delivered_count = Column(Integer, default=0, nullable=False)
    read_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)

    # Ownership, Execution & Soft Delete
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    executed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="campaigns")
    whatsapp_account = relationship("WhatsAppAccount", back_populates="campaigns")
    template = relationship("Template", back_populates="campaigns")
    recipients = relationship("CampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")


class CampaignRecipient(Base):
    """Recipient delivery tracking ledger for campaigns."""
    __tablename__ = "campaign_recipients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    message_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_messages.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(SQLEnum(CampaignRecipientStatus), default=CampaignRecipientStatus.PENDING, nullable=False, index=True)
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    campaign = relationship("Campaign", back_populates="recipients")
    contact = relationship("Contact", back_populates="campaign_recipients")
    message = relationship("WhatsAppMessage")

    __table_args__ = (
        Index("ix_campaign_recipients_campaign_status", "campaign_id", "status"),
        Index("ix_campaign_recipients_org", "organization_id"),
    )


# ==============================================================================
# INBOX, CONVERSATIONS & UNIFIED MESSAGING
# ==============================================================================

class WhatsAppConversation(Base):
    """Customer chat session window per WhatsApp account."""
    __tablename__ = "whatsapp_conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    whatsapp_account_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(SQLEnum(ConversationStatus), default=ConversationStatus.OPEN, nullable=False, index=True)
    is_archived = Column(Boolean, default=False, nullable=False, index=True)
    unread_count = Column(Integer, default=0, nullable=False)
    last_message_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # Meta 24-Hour Messaging Session Expiry Window
    window_expires_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # Conversation Responsibility & Assignee (Nullable for AI/Bot handling)
    assignee_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    whatsapp_account = relationship("WhatsAppAccount", back_populates="conversations")
    contact = relationship("Contact", back_populates="conversations")
    messages = relationship("WhatsAppMessage", back_populates="conversation", cascade="all, delete-orphan")
    scheduled_messages = relationship("WhatsAppScheduledMessage", back_populates="conversation", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("whatsapp_account_id", "contact_id", name="uq_account_contact_conversation"),
        Index("ix_wa_conv_org_account", "organization_id", "whatsapp_account_id"),
        Index("ix_wa_conv_last_msg", "whatsapp_account_id", "last_message_at"),
        Index("ix_wa_conv_assignee", "organization_id", "assignee_id"),
    )


class WhatsAppMessage(Base):
    """
    Unified Single Source of Truth for ALL WhatsApp Messages.
    (Combines Inbox Messages, Campaign Sends, Auto-Replies & Webhook Status Audit logs).
    """
    __tablename__ = "whatsapp_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    whatsapp_account_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True, index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)

    meta_message_id = Column(String(255), nullable=True, unique=True, index=True)
    direction = Column(SQLEnum(MessageDirection), nullable=False, index=True)
    sender_type = Column(SQLEnum(SenderType), nullable=False)
    sender_id = Column(String(255), nullable=True)

    message_type = Column(SQLEnum(MessageType), default=MessageType.TEXT, nullable=False)
    content = Column(Text, nullable=True)
    caption = Column(Text, nullable=True)

    # Template messaging metadata if sent via template
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.id", ondelete="SET NULL"), nullable=True)
    template_params = Column(JSONB, nullable=True)

    status = Column(SQLEnum(MessageStatus), default=MessageStatus.SENT, nullable=False, index=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)

    reply_to_message_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_messages.id", ondelete="SET NULL"), nullable=True, index=True)

    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    conversation = relationship("WhatsAppConversation", back_populates="messages")
    media_files = relationship("WhatsAppMediaFile", back_populates="message", cascade="all, delete-orphan")
    reactions = relationship("WhatsAppMessageReaction", back_populates="message", cascade="all, delete-orphan")
    reply_to = relationship("WhatsAppMessage", remote_side=[id])

    __table_args__ = (
        Index("ix_wa_msg_conv_created", "conversation_id", "created_at"),
        Index("ix_wa_msg_account_status", "whatsapp_account_id", "status"),
    )


class WhatsAppMediaFile(Base):
    """Media assets linked to WhatsApp messages."""
    __tablename__ = "whatsapp_media_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    message_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    meta_media_id = Column(String(255), nullable=True)
    file_name = Column(String(255), nullable=True)
    file_url = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)
    media_type = Column(SQLEnum(MessageType), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    message = relationship("WhatsAppMessage", back_populates="media_files")


class WhatsAppMessageReaction(Base):
    """Emoji reactions on WhatsApp messages."""
    __tablename__ = "whatsapp_message_reactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    message_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    emoji = Column(String(10), nullable=False)
    reacted_by = Column(SQLEnum(ReactionUserType), default=ReactionUserType.CUSTOMER, nullable=False)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    message = relationship("WhatsAppMessage", back_populates="reactions")
    contact = relationship("Contact")


# ==============================================================================
# SCHEDULED MESSAGES & AUTOMATIONS
# ==============================================================================

class WhatsAppScheduledMessage(Base):
    """One-time scheduled inbox message sender."""
    __tablename__ = "whatsapp_scheduled_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    whatsapp_account_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)

    message_type = Column(SQLEnum(MessageType), default=MessageType.TEXT, nullable=False)
    content = Column(Text, nullable=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.id", ondelete="SET NULL"), nullable=True)
    template_params = Column(JSONB, nullable=True)

    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(SQLEnum(ScheduleStatus), default=ScheduleStatus.PENDING, nullable=False, index=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    conversation = relationship("WhatsAppConversation", back_populates="scheduled_messages")


class WhatsAppAutoReply(Base):
    """Unified Keyword Auto-Reply & Bot Rules engine."""
    __tablename__ = "whatsapp_auto_replies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    whatsapp_account_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_accounts.id", ondelete="CASCADE"), nullable=True, index=True)
    rule_name = Column(String(255), nullable=False)
    trigger_keyword = Column(String(255), nullable=False)
    match_type = Column(SQLEnum(MatchType), default=MatchType.EXACT, nullable=False)

    response_type = Column(SQLEnum(ResponseType), default=ResponseType.TEXT, nullable=False)
    response_content = Column(Text, nullable=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.id", ondelete="SET NULL"), nullable=True)
    media_url = Column(String(500), nullable=True)

    priority = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="auto_replies")


# Export all models
__all__ = [
    "Base",
    "Organization",
    "User",
    "WhatsAppAccount",
    "Contact",
    "Template",
    "Campaign",
    "CampaignRecipient",
    "WhatsAppConversation",
    "WhatsAppMessage",
    "WhatsAppMediaFile",
    "WhatsAppMessageReaction",
    "WhatsAppScheduledMessage",
    "WhatsAppAutoReply",
    # Enums
    "OrganizationStatus",
    "UserRole",
    "UserStatus",
    "WhatsAppAccountStatus",
    "ContactStatus",
    "TemplateCategory",
    "TemplateStatus",
    "HeaderType",
    "CampaignStatus",
    "CampaignRecipientStatus",
    "ConversationStatus",
    "MessageDirection",
    "SenderType",
    "MessageType",
    "MessageStatus",
    "ScheduleStatus",
    "MatchType",
    "ResponseType",
    "ReactionUserType",
]