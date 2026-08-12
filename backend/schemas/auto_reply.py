from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class AutoReplyRuleCreateSchema(BaseModel):
    trigger_keyword: Optional[str] = None
    keyword: Optional[str] = None
    name: Optional[str] = None
    rule_name: Optional[str] = None

    response_content: Optional[str] = None
    response: Optional[str] = None
    message: Optional[str] = None

    match_type: Optional[str] = "EXACT"
    match_exact: Optional[bool] = None
    is_active: Optional[bool] = True
    active: Optional[bool] = True
    priority: Optional[int] = 1


class AutoReplyRuleUpdateSchema(BaseModel):
    trigger_keyword: Optional[str] = None
    keyword: Optional[str] = None
    name: Optional[str] = None
    rule_name: Optional[str] = None

    response_content: Optional[str] = None
    response: Optional[str] = None
    message: Optional[str] = None

    match_type: Optional[str] = None
    match_exact: Optional[bool] = None
    is_active: Optional[bool] = None
    active: Optional[bool] = None
    priority: Optional[int] = None


class AutoReplyRuleResponseSchema(BaseModel):
    id: str
    trigger_keyword: str
    response_content: str
    match_type: str
    is_active: bool
    priority: int
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}
