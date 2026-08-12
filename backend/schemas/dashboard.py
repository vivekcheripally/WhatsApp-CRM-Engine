from __future__ import annotations

from typing import List
from pydantic import BaseModel, ConfigDict


class DashboardSummarySchema(BaseModel):
    total_contacts: int = 0
    total_templates: int = 0
    total_campaigns: int = 0
    total_messages: int = 0
    sent: int = 0
    delivered: int = 0
    read: int = 0
    failed: int = 0

    model_config = ConfigDict(from_attributes=True)


class TemplateOverviewSchema(BaseModel):
    approved: int = 0
    pending: int = 0
    rejected: int = 0
    disabled: int = 0

    model_config = ConfigDict(from_attributes=True)


class CampaignSummaryItem(BaseModel):
    id: str
    name: str
    status: str
    total: int = 0
    delivered: int = 0
    contact_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class UnifiedDashboardResponse(BaseModel):
    summary: DashboardSummarySchema
    templates: TemplateOverviewSchema
    campaigns: List[CampaignSummaryItem]

    model_config = ConfigDict(from_attributes=True)
