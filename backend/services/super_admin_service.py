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
    Template,
    Campaign,
    Contact,
    WhatsAppAutoReply,
    MessageDirection,
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
        slug = payload.slug.strip().lower() if payload.slug else payload.name.lower().replace(" ", "-")
        existing = self.db.query(Organization).filter(Organization.slug == slug).first()
        if existing:
             raise ValidationError(f"Organization slug '{slug}' already exists. Please enter a different slug.")

        org = Organization(
            name=payload.name,
            slug=slug,
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

        # Check if email is already taken by another user in system
        user_with_email = self.db.query(User).filter(User.email == contact_email).first()
        if user_with_email:
            parts = contact_email.split("@") if "@" in contact_email else [org.slug, "nexora.com"]
            domain = parts[1] if len(parts) > 1 else "nexora.com"
            contact_email = f"admin.{org.slug}@{domain}"
            if self.db.query(User).filter(User.email == contact_email).first():
                contact_email = f"admin.{org.slug}.{secrets.token_hex(3)}@{domain}"

        temp_password = secrets.token_urlsafe(10)
        user = User(
            organization_id=org.id,
            email=contact_email,
            hashed_password=hash_password(temp_password),
            full_name=org.contact_name or org.name,
            role=UserRole.ORG_ADMIN,
            status=UserStatus.ACTIVE,
            must_change_password=True,
        )
        self.db.add(user)
        self.db.commit()

        return {
            "success": True,
            "organization_id": str(org.id),
            "org_name": org.name,
            "contact_name": org.contact_name or org.name,
            "contact_email": org.contact_email or contact_email,
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

    def delete_organization(self, org_id: uuid.UUID) -> dict:
        org = self.db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise ResourceNotFoundError("Organization not found")
        self.db.delete(org)
        self.db.commit()
        return {"success": True, "message": "Organization deleted successfully"}

    def get_platform_metrics(self) -> dict:
        return {
            "total_organizations": self.db.query(Organization).count(),
            "active_organizations": self.db.query(Organization).filter(Organization.status == OrganizationStatus.ACTIVE).count(),
            "pending_approvals": self.db.query(Organization).filter(Organization.status == OrganizationStatus.PENDING_APPROVAL).count(),
            "suspended_organizations": self.db.query(Organization).filter(Organization.status == OrganizationStatus.SUSPENDED).count(),
            "total_messages_sent": self.db.query(WhatsAppMessage).count(),
            "active_whatsapp_accounts": self.db.query(WhatsAppAccount).filter(WhatsAppAccount.status == WhatsAppAccountStatus.ACTIVE).count(),
        }
    
    def get_organization_analytics(self) -> list[dict]:
        orgs = self.db.query(Organization).all()
        result = []
        for o in orgs:
            # Templates count breakdown
            templates = self.db.query(Template).filter(Template.organization_id == o.id).all()
            templates_approved = sum(1 for t in templates if (t.status.value if hasattr(t.status, "value") else str(t.status)) == "APPROVED")
            templates_pending = sum(1 for t in templates if (t.status.value if hasattr(t.status, "value") else str(t.status)) == "PENDING")
            templates_rejected = sum(1 for t in templates if (t.status.value if hasattr(t.status, "value") else str(t.status)) == "REJECTED")

            # Campaigns count breakdown
            campaigns = self.db.query(Campaign).filter(Campaign.organization_id == o.id, Campaign.is_deleted == False).all()
            campaigns_draft = sum(1 for c in campaigns if (c.status.value if hasattr(c.status, "value") else str(c.status)) == "DRAFT")
            campaigns_sending = sum(1 for c in campaigns if (c.status.value if hasattr(c.status, "value") else str(c.status)) == "SENDING")
            campaigns_scheduled = sum(1 for c in campaigns if (c.status.value if hasattr(c.status, "value") else str(c.status)) == "SCHEDULED")
            campaigns_completed = sum(1 for c in campaigns if (c.status.value if hasattr(c.status, "value") else str(c.status)) == "COMPLETED")
            campaigns_failed = sum(1 for c in campaigns if (c.status.value if hasattr(c.status, "value") else str(c.status)) == "FAILED")
            total_campaign_recipients = sum(c.total_recipients or 0 for c in campaigns)
            total_campaign_sent = sum(c.sent_count or 0 for c in campaigns)
            total_campaign_delivered = sum(c.delivered_count or 0 for c in campaigns)
            total_campaign_read = sum(c.read_count or 0 for c in campaigns)

            # Messages
            messages_sent = self.db.query(WhatsAppMessage).filter(
                WhatsAppMessage.organization_id == o.id,
                WhatsAppMessage.direction == MessageDirection.OUTBOUND
            ).count()

            # Contacts
            contacts_count = self.db.query(Contact).filter(Contact.organization_id == o.id, Contact.is_deleted == False).count()

            # WhatsApp Accounts
            wa_accounts_count = self.db.query(WhatsAppAccount).filter(WhatsAppAccount.organization_id == o.id).count()

            # Auto Replies
            auto_replies_count = self.db.query(WhatsAppAutoReply).filter(WhatsAppAutoReply.organization_id == o.id).count()

            # Users / Agents
            users_count = self.db.query(User).filter(User.organization_id == o.id).count()

            result.append({
                "org_id": str(o.id),
                "org_name": o.name,
                "org_slug": o.slug,
                "contact_name": o.contact_name,
                "contact_email": o.contact_email,
                "status": o.status.value if hasattr(o.status, "value") else str(o.status),
                "plan_name": o.plan_name,
                "created_at": o.created_at.isoformat() if o.created_at else None,

                "templates_total": len(templates),
                "templates_approved": templates_approved,
                "templates_pending": templates_pending,
                "templates_rejected": templates_rejected,

                "campaigns_total": len(campaigns),
                "campaigns_draft": campaigns_draft,
                "campaigns_sending": campaigns_sending,
                "campaigns_scheduled": campaigns_scheduled,
                "campaigns_completed": campaigns_completed,
                "campaigns_failed": campaigns_failed,
                "campaign_recipients": total_campaign_recipients,
                "campaign_sent": total_campaign_sent,
                "campaign_delivered": total_campaign_delivered,
                "campaign_read": total_campaign_read,

                "messages_sent": messages_sent,
                "contacts_count": contacts_count,
                "whatsapp_accounts_count": wa_accounts_count,
                "auto_replies_count": auto_replies_count,
                "users_count": users_count,
            })
        return result