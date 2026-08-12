from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


# ==============================================================================
# ENUMS (mirror models/postgres_model.py)
# ==============================================================================

class MessageType(str, Enum):
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


class MessageStatus(str, Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"


class MessageDirection(str, Enum):
    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"


class SenderType(str, Enum):
    CUSTOMER = "CUSTOMER"
    AGENT = "AGENT"
    SYSTEM = "SYSTEM"
    BOT = "BOT"


class ConversationStatus(str, Enum):
    OPEN = "OPEN"
    PENDING = "PENDING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


# ==============================================================================
# WHATSAPP ACCOUNT
# ==============================================================================

class WhatsAppConnectRequest(BaseModel):
    waba_id: str
    phone_number_id: str
    access_token: str
    account_name: Optional[str] = "Default Account"
    channel_name: Optional[str] = None


class WhatsAppSettingsUpdateSchema(BaseModel):
    account_name: Optional[str] = None
    waba_id: Optional[str] = None
    phone_number_id: Optional[str] = None
    access_token: Optional[str] = None
    display_phone_number: Optional[str] = None
    channel_name: Optional[str] = None
    is_default: Optional[bool] = None
    status: Optional[str] = None


class WhatsAppAccountInfo(BaseModel):
    id: str
    waba_id: Optional[str] = None
    phone_number_id: Optional[str] = None
    display_phone_number: Optional[str] = None
    verified_name: Optional[str] = None
    channel_name: Optional[str] = None
    is_default: Optional[bool] = False
    status: str
    webhook_verified: Optional[bool] = False


class WhatsAppChannelResponseSchema(BaseModel):
    id: str
    organization_id: str
    channel_name: str
    waba_id: str
    phone_number_id: str
    display_phone_number: Optional[str] = None
    verified_name: Optional[str] = None
    status: str
    is_default: bool
    created_at: Optional[datetime] = None


class WhatsAppChannelListResponseSchema(BaseModel):
    success: bool
    channels: List[WhatsAppChannelResponseSchema]


class WhatsAppConnectResponse(BaseModel):
    success: bool
    account: Optional[WhatsAppAccountInfo] = None
    error: Optional[str] = None


class WhatsAppAccountResponse(BaseModel):
    connected: bool
    account: Optional[WhatsAppAccountInfo] = None
    message: str


class MessageRequest(BaseModel):
    to: str
    template_name: str


class ScheduledMessageCreateSchema(BaseModel):
    customer_phone: str
    scheduled_at: str
    customer_name: Optional[str] = None
    message_type: Optional[str] = "TEXT"
    content: Optional[str] = None
    template_name: Optional[str] = None
    components: Optional[List[Any]] = None


# ==============================================================================
# SEND MESSAGE REQUESTS
# ==============================================================================

class SendTextMessageRequest(BaseModel):
    conversation_id: str
    content: str
    reply_to_message_id: Optional[str] = None


class SendMediaMessageRequest(BaseModel):
    conversation_id: str
    message_type: MessageType
    media_url: Optional[str] = None
    media_id: Optional[str] = None  # meta media id for upload flow
    caption: Optional[str] = None
    file_name: Optional[str] = None
    reply_to_message_id: Optional[str] = None


class SendTemplateMessageRequest(BaseModel):
    conversation_id: str
    template_name: str
    language_code: str = "en_US"
    components: Optional[List[Any]] = None


class SendMessageRequest(BaseModel):
    """Unified single-request body for all message types."""
    conversation_id: str
    message_type: MessageType
    content: Optional[str] = None
    media_url: Optional[str] = None
    media_id: Optional[str] = None
    caption: Optional[str] = None
    file_name: Optional[str] = None
    reply_to_message_id: Optional[str] = None
    # Template fields
    template_name: Optional[str] = None
    language_code: Optional[str] = None
    components: Optional[List[Any]] = None


class AddReactionRequest(BaseModel):
    emoji: str = ""
    customer_phone: Optional[str] = "agent"


# ==============================================================================
# RESPONSE MODELS
# ==============================================================================

class MediaFileResponse(BaseModel):
    """Media file attachment on a message."""
    id: str
    # New schema uses meta_media_id; expose both for frontend compat
    meta_media_id: Optional[str] = None
    media_id: Optional[str] = None          # alias — populated from meta_media_id
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    mime_type: Optional[str] = None         # kept for frontend compat (not in new model)
    file_size: Optional[int] = None

    model_config = {"from_attributes": True}


class ReactionResponse(BaseModel):
    """Emoji reaction on a message."""
    id: str
    message_id: str
    emoji: str
    customer_phone: Optional[str] = None   # populated from reaction.contact.phone_number
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    """Full message payload returned by the API and emitted over WebSocket."""
    id: str
    conversation_id: str
    meta_message_id: Optional[str] = None
    direction: Optional[str] = None
    sender_type: str
    sender_id: Optional[str] = None
    message_type: str
    content: Optional[str] = None
    caption: Optional[str] = None
    status: str
    is_deleted: bool = False
    reply_to_message_id: Optional[str] = None
    media_files: List[MediaFileResponse] = []
    reactions: List[ReactionResponse] = []
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ContactSummary(BaseModel):
    """Embedded contact info within a conversation response."""
    id: str
    name: Optional[str] = None
    phone_number: str

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    """Conversation returned by the API.

    customer_phone and customer_name are populated from the linked Contact
    for frontend compatibility — they no longer live directly on the conversation
    table.
    """
    id: str
    contact_id: Optional[str] = None
    # Frontend-compat fields (populated from contact relationship in routes)
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None
    status: str
    is_archived: bool = False
    unread_count: int = 0
    last_message_at: Optional[datetime] = None
    window_expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ConversationCreatePayload(BaseModel):
    customer_phone: str
    customer_name: Optional[str] = None


class ConversationUpdatePayload(BaseModel):
    status: Optional[str] = None
    is_archived: Optional[bool] = None
    customer_name: Optional[str] = None


class ConversationListResponse(BaseModel):
    items: List[dict]
    total: int
    page: int
    page_size: int
    has_next: bool


class MessageListResponse(BaseModel):
    items: List[MessageResponse]
    total: int
    page: int
    page_size: int
    has_more: bool
    cursor: Optional[str] = None


# ==============================================================================
# REACTIONS AGGREGATE
# ==============================================================================

class ReactionGrouped(BaseModel):
    emoji: str
    count: int
    customers: List[str]


class MessageReactionsResponse(BaseModel):
    message_id: Any
    reactions: List[ReactionGrouped]
    total: int

