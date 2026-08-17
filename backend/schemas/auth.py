from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = False


class UserSummary(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    organization_id: Optional[str] = None
    must_change_password: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSummary


class ForceChangePasswordRequest(BaseModel):
    new_password: str
    confirm_password: str


class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    old_password: Optional[str] = None
    new_password: str
    confirm_password: Optional[str] = None
