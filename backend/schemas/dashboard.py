from __future__ import annotations

from typing import List, Optional
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
    outbound_sent: int = 0
    inbox_conversations: int = 0
    active_campaigns: int = 0
    active_agents: int = 0

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
    read_count: int = 0
    recipients: int = 0

    model_config = ConfigDict(from_attributes=True)


class UnifiedDashboardResponse(BaseModel):
    summary: DashboardSummarySchema
    templates: TemplateOverviewSchema
    campaigns: List[CampaignSummaryItem]

    model_config = ConfigDict(from_attributes=True)


class MessageTrendItem(BaseModel):
    day: str
    date: str
    Sent: int = 0
    Delivered: int = 0
    Read: int = 0
    Failed: int = 0

    model_config = ConfigDict(from_attributes=True)


class MessageCategoryItem(BaseModel):
    name: str
    value: int
    color: str
    count: int

    model_config = ConfigDict(from_attributes=True)


class InboxStatusMetrics(BaseModel):
    total: int = 0
    open: int = 0
    pending: int = 0
    resolved: int = 0
    resolution_rate: int = 0

    model_config = ConfigDict(from_attributes=True)


class AgentPerformanceItem(BaseModel):
    id: str
    name: str
    email: str
    Conversations: int = 0
    Resolved: int = 0
    ResponseMin: str = "0.0"

    model_config = ConfigDict(from_attributes=True)


class AnalyticsReportResponse(BaseModel):
    time_range: str
    summary: DashboardSummarySchema
    trends: List[MessageTrendItem]
    category_distribution: List[MessageCategoryItem]
    inbox: InboxStatusMetrics
    agents: List[AgentPerformanceItem]
    templates: TemplateOverviewSchema
    campaigns: List[CampaignSummaryItem]

    model_config = ConfigDict(from_attributes=True)

