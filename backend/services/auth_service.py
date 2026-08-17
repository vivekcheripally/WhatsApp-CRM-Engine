from __future__ import annotations
import json
import re
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from core.exceptions import ValidationError, ResourceNotFoundError
from core.security import verify_password, hash_password, create_access_token, create_refresh_token, decode_access_token
from core.redis import get_redis_client
from models.postgres_model import User, UserStatus, UserRole, OrganizationStatus


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self._redis = None

    @property
    def redis(self):
        if self._redis is None:
            try:
                self._redis = get_redis_client()
            except Exception:
                self._redis = None
        return self._redis

    def _validate_password_strength(self, password: str) -> None:
        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters long")
        if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
            raise ValidationError("Password must contain both letters and numbers")

    def authenticate_user(self, email: str, password: str, remember_me: bool = False) -> dict:
        user = self.db.query(User).filter(User.email == email).first()
        if not user or not verify_password(password, user.hashed_password):
            raise ValidationError("Invalid email or password")
        if user.status != UserStatus.ACTIVE:
            raise ValidationError("User account is inactive or disabled")

        if user.role in (UserRole.ORG_ADMIN, UserRole.SALES_AGENT):
            if not user.organization or user.organization.status != OrganizationStatus.ACTIVE:
                raise ValidationError("Organization account is pending approval or suspended")

        # Generate unique Session ID (sid)
        sid = str(uuid.uuid4())
        ttl_seconds = (7 * 24 * 3600) if remember_me else (24 * 3600)

        # Record active session in Redis
        if self.redis:
            try:
                session_data = json.dumps({
                    "user_id": str(user.id),
                    "email": user.email,
                    "role": user.role.value if hasattr(user.role, "value") else str(user.role),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                self.redis.set(f"session:{sid}", session_data, ex=ttl_seconds)
                self.redis.sadd(f"user_sessions:{user.id}", sid)
                self.redis.expire(f"user_sessions:{user.id}", 30 * 24 * 3600)
            except Exception:
                pass  # Fallback gracefully if Redis is momentarily unavailable

        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "org_id": str(user.organization_id) if user.organization_id else None,
            "must_change_password": user.must_change_password,
            "sid": sid,
        }

        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token({"sub": str(user.id), "sid": sid, "remember_me": remember_me})

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "sid": sid,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.value if hasattr(user.role, "value") else str(user.role),
                "organization_id": str(user.organization_id) if user.organization_id else None,
                
                "must_change_password": getattr(user, "must_change_password", False),
            },
        }

    def refresh_access_token(self, refresh_token_str: str) -> dict:
        try:
            payload = decode_access_token(refresh_token_str)
        except Exception:
            raise ValidationError("Invalid or expired refresh token")

        if payload.get("token_type") != "refresh":
            raise ValidationError("Token is not a valid refresh token")

        user_id = payload.get("sub")
        sid = payload.get("sid")

        if not user_id or not sid:
            raise ValidationError("Malformed refresh token payload")

        # Verify active session in Redis
        if self.redis:
            try:
                session_exists = self.redis.exists(f"session:{sid}")
                if not session_exists:
                    raise ValidationError("Session has been revoked or expired")
            except ValidationError:
                raise
            except Exception:
                pass  # Fallback if Redis is down

        user = self.db.query(User).filter(User.id == uuid.UUID(str(user_id))).first()
        if not user or user.status != UserStatus.ACTIVE:
            raise ValidationError("User account is inactive or disabled")

        new_access_token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "org_id": str(user.organization_id) if user.organization_id else None,
            "must_change_password": user.must_change_password,
            "sid": sid,
        })

        return {
            "access_token": new_access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.value if hasattr(user.role, "value") else str(user.role),
                "organization_id": str(user.organization_id) if user.organization_id else None,
                "must_change_password": bool(user.must_change_password),
            },
        }

    def revoke_session(self, sid: str) -> None:
        if self.redis and sid:
            try:
                self.redis.delete(f"session:{sid}")
            except Exception:
                pass

    def revoke_all_user_sessions(self, user_id: str | uuid.UUID) -> dict:
        str_uid = str(user_id)
        if self.redis:
            try:
                sids = self.redis.smembers(f"user_sessions:{str_uid}")
                if sids:
                    for sid in sids:
                        self.redis.delete(f"session:{sid}")
                    self.redis.delete(f"user_sessions:{str_uid}")
            except Exception:
                pass
        return {"message": "All sessions revoked successfully across all devices"}

    def force_change_password(self, user_id: str | uuid.UUID, new_password: str, confirm_password: str) -> dict:
        if new_password != confirm_password:
            raise ValidationError("New password and confirm password do not match")

        self._validate_password_strength(new_password)

        user = self.db.query(User).filter(User.id == uuid.UUID(str(user_id))).first()
        if not user:
            raise ResourceNotFoundError("User not found")

        user.hashed_password = hash_password(new_password)
        user.must_change_password = False
        self.db.commit()
        self.db.refresh(user)

        return {
            "message": "Password updated successfully",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.value if hasattr(user.role, "value") else str(user.role),
                "organization_id": str(user.organization_id) if user.organization_id else None,
                "must_change_password": False,
            },
        }

    def change_password(self, user_id: str | uuid.UUID, old_password: str, new_password: str, confirm_password: Optional[str] = None) -> dict:
        user = self.db.query(User).filter(User.id == uuid.UUID(str(user_id))).first()
        if not user:
            raise ResourceNotFoundError("User not found")

        if not verify_password(old_password, user.hashed_password):
            raise ValidationError("Current password is incorrect")

        if confirm_password is not None and new_password != confirm_password:
            raise ValidationError("New password and confirm password do not match")

        self._validate_password_strength(new_password)

        user.hashed_password = hash_password(new_password)
        user.must_change_password = False
        self.db.commit()

        return {"message": "Password changed successfully"}



    # def change_password(self, user_id: str, current_password: str, new_password: str) -> dict:
    #     user = self.db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    #     if not user:
    #         raise ResourceNotFoundError("User not found")
    #     if not verify_password(current_password, user.hashed_password):
    #         raise ValidationError("Current password is incorrect")
    #     if len(new_password) < 6:
    #         raise ValidationError("New password must be at least 6 characters long")
    #     if current_password == new_password:
    #         raise ValidationError("New password must be different from current password")

    #     user.hashed_password = hash_password(new_password)
    #     user.must_change_password = False
    #     self.db.commit()
    #     return {"success": True, "message": "Password changed successfully"}
