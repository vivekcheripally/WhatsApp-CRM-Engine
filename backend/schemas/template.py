from __future__ import annotations

from typing import Any, List, Optional
from pydantic import BaseModel


class TemplateCreateSchema(BaseModel):
    template_name: str
    category: Optional[str] = "MARKETING"
    language: Optional[str] = "en_US"
    header: Optional[str] = "NONE"
    header_text: Optional[str] = None
    template_body: Optional[str] = None
    footer: Optional[str] = None
    buttons: Optional[List[Any]] = None


class TemplateUpdateSchema(BaseModel):
    template_name: Optional[str] = None
    category: Optional[str] = None
    language: Optional[str] = None
    header: Optional[str] = None
    template_body: Optional[str] = None
    footer: Optional[str] = None
    buttons: Optional[List[Any]] = None
