import uuid
from typing import List, Optional
from pydantic import BaseModel, EmailStr

class AgentOnboardRequest(BaseModel):
    email: str
    password: str
    full_name: str
    assigned_channel_ids: Optional[List[str]] = None

class AgentUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    status: Optional[str] = None

class AgentAssignChannelsRequest(BaseModel):
    whatsapp_account_ids: Optional[List[str]] = None
    channel_ids: Optional[List[str]] = None

class AgentAssignCampaignsRequest(BaseModel):
    campaign_id: Optional[str] = None
    campaign_ids: Optional[List[str]] = None
    user_ids: Optional[List[str]] = None

class ContactAssignRequest(BaseModel):
    contact_ids: List[str]
    new_owner_id: str

class ConversationAssignRequest(BaseModel):
    assignee_id: Optional[str] = None  # None releases to unassigned/bot queue
