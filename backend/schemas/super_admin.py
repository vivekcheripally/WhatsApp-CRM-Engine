from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class OnboardOrganizationRequest(BaseModel):
    name: str
    slug: str
    contact_name: str
    contact_email: str
    plan_name: Optional[str] = "STARTER"


class OrganizationSummaryItem(BaseModel):
    id: str
    name: str
    slug: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    status: str
    plan_name: str
    created_at: Optional[str] = None


class PlatformMetricsResponse(BaseModel):
    total_organizations: int
    active_organizations: int
    pending_approvals: int
    suspended_organizations: int
    total_messages_sent: int
    active_whatsapp_accounts: int
