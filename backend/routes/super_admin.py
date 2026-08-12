import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from core.database import get_db
from core.exceptions import DomainException
from routes.deps import require_super_admin
from schemas.super_admin import OnboardOrganizationRequest
from services.super_admin_service import SuperAdminService

router = APIRouter(prefix="/api/super-admin", tags=["Super Admin"])


@router.get("/metrics")
def get_metrics(admin: dict = Depends(require_super_admin), db: Session = Depends(get_db)):
    return SuperAdminService(db).get_platform_metrics()


@router.get("/organizations")
def list_organizations(admin: dict = Depends(require_super_admin), db: Session = Depends(get_db)):
    return SuperAdminService(db).list_organizations()


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
def approve_org(
    org_id: uuid.UUID,
    admin: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    try:
        return SuperAdminService(db).approve_organization(org_id)
    except Exception as e:
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
