from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.exceptions import ExternalAPIError, ResourceNotFoundError, ValidationError
from routes.deps import get_active_organization_id, get_current_user
from schemas.campaign import (
    CampaignCreateSchema,
    CampaignRunPayload,
    CampaignUpdateSchema,
)
from services.campaign_service import CampaignService

router = APIRouter()


@router.post("/create-campaign")
def create_campaign(
    data: CampaignCreateSchema = Body(...),
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
    current_user: dict = Depends(get_current_user),
):
    target_waba = data.waba_account_id or waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    svc = CampaignService(db)
    try:
        return svc.create_campaign(data, org_id=org_id, waba_account_id=waba_uuid)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/details/{campaign_id}")
def get_campaign_details(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    svc = CampaignService(db)
    try:
        return svc.get_campaign_details(uuid.UUID(campaign_id))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/update/{campaign_id}")
def update_campaign(
    campaign_id: str,
    data: CampaignUpdateSchema = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    svc = CampaignService(db)
    try:
        return svc.update_campaign(uuid.UUID(campaign_id), data)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/list")
def list_campaigns(
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
    current_user: dict = Depends(get_current_user),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    svc = CampaignService(db)
    return svc.list_campaigns(org_id=org_id, waba_account_id=waba_uuid)


@router.get("/{campaign_id}")
def get_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    svc = CampaignService(db)
    try:
        return svc.get_campaign_by_id(uuid.UUID(campaign_id))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{campaign_id}/analytics")
def campaign_analytics(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    svc = CampaignService(db)
    try:
        return svc.get_campaign_analytics(uuid.UUID(campaign_id))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{campaign_id}/recipients")
def campaign_recipients(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    svc = CampaignService(db)
    try:
        return svc.get_campaign_recipients(uuid.UUID(campaign_id))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


from services.tasks import execute_campaign_task

@router.post("/run-campaign")
def run_campaign(
    data: CampaignRunPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    c_uuid = uuid.UUID(data.campaign_id)
    svc = CampaignService(db)
    try:
        result = svc.prepare_campaign_run(c_uuid)
        if not result.get("success"):
            return result

        # Dispatch outbound bulk messaging asynchronously to Celery Redis Task Queue
        try:
            execute_campaign_task.delay(str(c_uuid))
        except Exception:
            # Fallback to local execution if Celery worker is offline during local dev
            svc.execute_campaign_background(c_uuid)

        return result
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ExternalAPIError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.delete("/delete/{campaign_id}")
def delete_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    svc = CampaignService(db)
    try:
        success = svc.delete_campaign(uuid.UUID(campaign_id))
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
        return {"success": True, "message": "Campaign deleted successfully"}
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))