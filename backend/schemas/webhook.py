from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class WebhookVerificationSchema(BaseModel):
    hub_mode: str
    hub_challenge: str
    hub_verify_token: str


class WebhookPayloadSchema(BaseModel):
    object: Optional[str] = "whatsapp_business_account"
    entry: List[Dict[str, Any]] = []


class WhatsAppAccountSettingsSchema(BaseModel):
    phone_number_id: str
    waba_id: Optional[str] = None
    display_phone_number: Optional[str] = None
    access_token: Optional[str] = None


class WhatsAppSettingsResponseSchema(BaseModel):
    success: bool
    connected: bool
    waba_id: Optional[str] = None
    phone_number_id: Optional[str] = None
    display_phone_number: Optional[str] = None
    status: Optional[str] = "ACTIVE"
