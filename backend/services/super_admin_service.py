from __future__ import annotations
import secrets
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from core.exceptions import ValidationError, ResourceNotFoundError
from core.security import hash_password
from models.postgres_model import (
    Organization,
    OrganizationStatus,
    User,
    UserRole,
    UserStatus,
    WhatsAppMessage,
    WhatsAppAccount,
    WhatsAppAccountStatus,
)
from schemas.super_admin import OnboardOrganizationRequest


class SuperAdminService:
    def __init__(self, db: Session):
        self.db = db

    def list_organizations(self) -> list[dict]:
        orgs = self.db.query(Organization).all()
        return [
            {
                "id": str(o.id),
                "name": o.name,
                "slug": o.slug,
                "contact_name": o.contact_name,
                "contact_email": o.contact_email,
                "status": o.status.value if hasattr(o.status, "value") else str(o.status),
                "plan_name": o.plan_name,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orgs
        ]

    def onboard_organization(self, payload: OnboardOrganizationRequest) -> dict:
        existing = self.db.query(Organization).filter(Organization.slug == payload.slug).first()
        if existing:
            raise ValidationError("Organization slug already exists")

        org = Organization(
            name=payload.name,
            slug=payload.slug,
            contact_name=payload.contact_name,
            contact_email=payload.contact_email,
            plan_name=payload.plan_name or "STARTER",
            status=OrganizationStatus.PENDING_APPROVAL,
        )
        self.db.add(org)
        self.db.commit()
        self.db.refresh(org)
        return {"success": True, "organization_id": str(org.id), "status": org.status.value}

    def approve_organization(self, org_id: uuid.UUID) -> dict:
        org = self.db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise ResourceNotFoundError("Organization not found")

        org.status = OrganizationStatus.ACTIVE
        org.approved_at = datetime.now(timezone.utc)

        existing_user = self.db.query(User).filter(User.organization_id == org.id).first()
        if existing_user:
            self.db.commit()
            return {
                "success": True,
                "organization_id": str(org.id),
                "user_email": existing_user.email,
                "message": "Organization approved",
            }

        contact_email = org.contact_email or f"admin@{org.slug}.com"
        temp_password = secrets.token_urlsafe(10)
        user = User(
            organization_id=org.id,
            email=contact_email,
            hashed_password=hash_password(temp_password),
            full_name=org.contact_name or org.name,
            role=UserRole.ORG_ADMIN,
            status=UserStatus.ACTIVE,
        )
        self.db.add(user)
        self.db.commit()

        return {
            "success": True,
            "organization_id": str(org.id),
            "user_email": user.email,
            "initial_password": temp_password,
            "message": "Organization approved and single tenant user credentials generated successfully",
        }

    def suspend_organization(self, org_id: uuid.UUID) -> dict:
        org = self.db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise ResourceNotFoundError("Organization not found")
        org.status = OrganizationStatus.SUSPENDED
        self.db.commit()
        return {"success": True, "message": "Organization suspended"}

    def reactivate_organization(self, org_id: uuid.UUID) -> dict:
        org = self.db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise ResourceNotFoundError("Organization not found")
        org.status = OrganizationStatus.ACTIVE
        self.db.commit()
        return {"success": True, "message": "Organization reactivated successfully"}

    def get_platform_metrics(self) -> dict:
        return {
            "total_organizations": self.db.query(Organization).count(),
            "active_organizations": self.db.query(Organization).filter(Organization.status == OrganizationStatus.ACTIVE).count(),
            "pending_approvals": self.db.query(Organization).filter(Organization.status == OrganizationStatus.PENDING_APPROVAL).count(),
            "suspended_organizations": self.db.query(Organization).filter(Organization.status == OrganizationStatus.SUSPENDED).count(),
            "total_messages_sent": self.db.query(WhatsAppMessage).count(),
            "active_whatsapp_accounts": self.db.query(WhatsAppAccount).filter(WhatsAppAccount.status == WhatsAppAccountStatus.ACTIVE).count(),
        }
