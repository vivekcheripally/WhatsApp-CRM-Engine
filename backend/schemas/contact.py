from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr


class ContactCreateSchema(BaseModel):
    name: str
    phone_number: str
    email: Optional[str] = None
    tag: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    source: Optional[str] = "MANUAL"
    attributes: Optional[Dict[str, Any]] = None


class ContactUpdateSchema(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    tag: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None


class ContactResponseSchema(BaseModel):
    id: str
    name: Optional[str] = None
    phone_number: str
    email: Optional[str] = None
    tag: Optional[str] = None
    status: str
    source: str
    attributes: Dict[str, Any] = {}
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class ContactListResponseSchema(BaseModel):
    success: bool = True
    contacts: List[ContactResponseSchema]
    total: int
    page: int
    page_size: int
    has_more: bool


class ContactImportResponseSchema(BaseModel):
    success: bool
    message: str
    imported_contacts: int
    skipped: int
