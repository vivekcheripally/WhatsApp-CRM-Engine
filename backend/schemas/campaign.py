from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class CampaignCreateSchema(BaseModel):
    campaign_name: str
    template_id: str
    contact_ids: List[str]
    waba_account_id: Optional[str] = None
    schedule_time: Optional[str] = None


class CampaignUpdateSchema(BaseModel):
    campaign_name: Optional[str] = None
    template_id: Optional[str] = None
    contact_ids: Optional[List[str]] = None
    waba_account_id: Optional[str] = None


class CampaignRunPayload(BaseModel):
    campaign_id: str


class CampaignSummaryItem(BaseModel):
    id: str
    campaign_name: str
    status: str
    contact_count: int
    created_at: Optional[str] = None
    template_id: Optional[str] = None
    template_name: Optional[str] = None

    model_config = {"from_attributes": True}
