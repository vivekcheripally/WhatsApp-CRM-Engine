import uuid
from enum import Enum
from typing import Optional, Set
from fastapi import Request, WebSocket, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import decode_access_token
from models.postgres_model import User, UserRole, UserStatus, Organization, OrganizationStatus

security_scheme = HTTPBearer(auto_error=False)


class Permission(str, Enum):
    MANAGE_ORGANIZATION = "manage_organization"
    MANAGE_USERS = "manage_users"
    MANAGE_CHANNELS = "manage_channels"
    VIEW_ANALYTICS = "view_analytics"
    SEND_MESSAGES = "send_messages"
    READ_MESSAGES = "read_messages"
    MANAGE_CAMPAIGNS = "manage_campaigns"
    MANAGE_TEMPLATES = "manage_templates"


ROLE_PERMISSIONS: dict[str, Set[Permission]] = {
    "SYSTEM_ADMIN": set(Permission),
    "super_admin": set(Permission),
    "admin": set(Permission),
    "ORG_ADMIN": set(Permission),
    "ORG_USER": set(Permission),
    "SALES_AGENT": {
        Permission.SEND_MESSAGES,
        Permission.READ_MESSAGES,
        Permission.VIEW_ANALYTICS,
    },
}


from core.redis import get_redis_client

def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> dict:
    """
    Centralized dual-mode authentication dependency.
    1. Checks HTTP Authorization Bearer header first.
    2. Fallback to HttpOnly cookies ('refresh_token' or 'access_token') if header is missing.
    3. Validates server-side active session in Redis.
    """
    token = credentials.credentials if (credentials and credentials.credentials) else None
    if not token:
        token = request.cookies.get("access_token") or request.cookies.get("refresh_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required. Please sign in.",
        )
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        sid = payload.get("sid")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        # Validate Redis server-side session active status if sid present
        if sid:
            try:
                r = get_redis_client()
                if not r.exists(f"session:{sid}"):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Session has been revoked or expired. Please sign in again.",
                    )
            except HTTPException:
                raise
            except Exception:
                pass  # Fallback if Redis is temporarily unreachable

        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        if not user or user.status != UserStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive or disabled",
            )
        role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        return {
            "id": str(user.id),
            "email": user.email,
            "role": role_str,
            "organization_id": str(user.organization_id) if user.organization_id else None,
            "must_change_password": getattr(user, "must_change_password", False),
            "sid": sid,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate authentication credentials",
        )



def require_permission(required_permission: Permission):
    def permission_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = str(current_user.get("role") or "")
        user_permissions = ROLE_PERMISSIONS.get(user_role, set())
        if required_permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: Missing required permission '{required_permission.value}'",
            )
        return current_user
    return permission_checker


def require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") not in {UserRole.SYSTEM_ADMIN.value, "SYSTEM_ADMIN", "super_admin", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin privileges required")
    return current_user


def require_org_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") not in {UserRole.ORG_ADMIN.value, UserRole.SYSTEM_ADMIN.value, "ORG_ADMIN", "SYSTEM_ADMIN", "super_admin", "admin", "ORG_USER"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization Admin privileges required")
    return current_user


def require_sales_agent(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") not in {UserRole.SALES_AGENT.value, UserRole.SYSTEM_ADMIN.value, "SALES_AGENT", "SYSTEM_ADMIN"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sales Agent privileges required")
    return current_user


def require_org_user(current_user: dict = Depends(get_current_user)) -> dict:
    allowed = {UserRole.ORG_ADMIN.value, UserRole.SALES_AGENT.value, UserRole.SYSTEM_ADMIN.value, "ORG_ADMIN", "SALES_AGENT", "SYSTEM_ADMIN", "ORG_USER"}
    if current_user.get("role") not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization user access required")
    return current_user


def get_active_organization_id(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> uuid.UUID:
    """
    Resolves the active tenant Organization ID directly from current_user session context.
    
    Zero-Trust Security Standard:
    1. Tenant users (ORG_USER) are strictly bound to their organization_id.
    2. Super Admins (SYSTEM_ADMIN) cannot access tenant customer data (contacts, templates, messages)
       unless explicitly passing an 'X-Tenant-ID' header for authorized support operations.
    """
    tenant_header = request.headers.get("X-Tenant-ID")
    if current_user.get("role") in {"SYSTEM_ADMIN", "super_admin"}:
        if tenant_header:
            try:
                return uuid.UUID(tenant_header)
            except ValueError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-Tenant-ID header")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admins are forbidden from accessing tenant operational data (contacts, templates, campaigns, inbox). Please manage organizations via the Super Admin Portal.",
        )

    org_id_str = current_user.get("organization_id")
    if org_id_str:
        return uuid.UUID(org_id_str)
        
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User account is not associated with an active organization.",
    )


async def get_current_user_from_ws(websocket: WebSocket, db: Session) -> Optional[dict]:
    """
    WebSocket Authentication Dependency.
    1. Extracts JWT token from query parameter ('ws?token=<jwt>') or HttpOnly cookies ('refresh_token' / 'access_token').
    2. Decodes JWT token, checks active Redis session, and validates active user in database.
    3. Rejects connection with WebSocket 1008 Policy Violation if invalid.
    """
    token = websocket.query_params.get("token")
    if not token:
        token = websocket.cookies.get("refresh_token") or websocket.cookies.get("access_token")

    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication token required")
        return None

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        sid = payload.get("sid")
        if not user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token payload")
            return None

        # Verify active session in Redis if sid is present
        if sid:
            try:
                r = get_redis_client()
                if not r.exists(f"session:{sid}"):
                    await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Session has been revoked or expired")
                    return None
            except Exception:
                pass  # Fallback if Redis is temporarily unreachable

        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        if not user and payload.get("email"):
            user = db.query(User).filter(User.email == payload.get("email")).first()

        if not user:
            role_str = payload.get("role", "")
            if role_str in {"SYSTEM_ADMIN", "super_admin", "admin"}:
                return {
                    "id": user_id,
                    "email": payload.get("email", "admin@platform.com"),
                    "role": role_str,
                    "organization_id": payload.get("org_id"),
                }
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="User account inactive or disabled")
            return None

        if user.status != UserStatus.ACTIVE:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="User account inactive or disabled")
            return None

        role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        return {
            "id": str(user.id),
            "email": user.email,
            "role": role_str,
            "organization_id": str(user.organization_id) if user.organization_id else None,
        }
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication failed")
        return None
