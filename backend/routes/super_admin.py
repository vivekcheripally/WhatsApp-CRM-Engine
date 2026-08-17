import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from core.database import get_db
from core.exceptions import DomainException
from routes.deps import require_super_admin
from schemas.super_admin import OnboardOrganizationRequest
from services.super_admin_service import SuperAdminService

from services.email_service import EmailService

router = APIRouter(prefix="/api/super-admin", tags=["Super Admin"])


@router.get("/metrics")
def get_metrics(admin: dict = Depends(require_super_admin), db: Session = Depends(get_db)):
    return SuperAdminService(db).get_platform_metrics()


@router.get("/organizations")
def list_organizations(admin: dict = Depends(require_super_admin), db: Session = Depends(get_db)):
    return SuperAdminService(db).list_organizations()


@router.get("/organizations/analytics")
def get_organization_analytics(admin: dict = Depends(require_super_admin), db: Session = Depends(get_db)):
    return SuperAdminService(db).get_organization_analytics()


@router.post("/organizations/onboard")
def onboard_org(
    payload: OnboardOrganizationRequest,
    admin: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    try:
        return SuperAdminService(db).onboard_organization(payload)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/organizations/{org_id}/approve")
async def approve_org(
    org_id: uuid.UUID,
    admin: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    try:
        res = SuperAdminService(db).approve_organization(org_id)
        if res.get("initial_password"):
            recipient = res.get("contact_email") or res.get("user_email") or ""
            email_sent, email_err = await EmailService.send_organization_credentials_email(
                contact_name=res.get("contact_name") or "",
                org_name=res.get("org_name") or "",
                login_email=res.get("user_email") or "",
                temp_password=res["initial_password"],
                recipient_email=recipient,
            )
            res["email_sent"] = email_sent
            res["email_error"] = email_err
            if email_sent:
                res["message"] = f"Organization approved successfully. Credentials sent to {res.get('contact_email')}."
            else:
                res["message"] = f"Organization approved successfully, but credentials could not be emailed ({email_err})."
        return res
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/organizations/{org_id}/suspend")
def suspend_org(
    org_id: uuid.UUID,
    admin: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    try:
        return SuperAdminService(db).suspend_organization(org_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/organizations/{org_id}/reactivate")
def reactivate_org(
    org_id: uuid.UUID,
    admin: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    try:
        return SuperAdminService(db).reactivate_organization(org_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

        
@router.delete("/organizations/{org_id}")
def delete_org(
    org_id: uuid.UUID,
    admin: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    try:
        return SuperAdminService(db).delete_organization(org_id)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
