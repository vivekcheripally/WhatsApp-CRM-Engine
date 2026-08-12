from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.exceptions import ExternalAPIError, ResourceNotFoundError, ValidationError
from routes.deps import get_active_organization_id, get_current_user
from schemas.template import TemplateUpdateSchema
from services.template_service import TemplateService

router = APIRouter(tags=["Templates"])


@router.post("/create")
async def create_template(
    request: Request,
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
    current_user: dict = Depends(get_current_user),
):
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        data = await request.json()
    else:
        form = await request.form()
        data = {k: form.get(k) for k in form.keys()}

    file_bytes = None
    filename = None
    if file and file.filename:
        file_bytes = await file.read()
        filename = file.filename

    try:
        return TemplateService(db).create_template_flow(
            data=data,
            file_bytes=file_bytes,
            filename=filename,
            org_id=org_id,
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ExternalAPIError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("")
def get_templates(
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
    current_user: dict = Depends(get_current_user),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    return TemplateService(db).get_all_templates(org_id=org_id, waba_account_id=waba_uuid)


@router.post("/sync-all")
def sync_all_templates(
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
    current_user: dict = Depends(get_current_user),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    return TemplateService(db).sync_all_templates(org_id=org_id, waba_account_id=waba_uuid)


@router.post("/{template_id}/sync-status")
def sync_template_status(
    template_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return TemplateService(db).sync_template_status_by_id(uuid.UUID(template_id))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ExternalAPIError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.post("/{template_id}/resubmit")
def resubmit_template(
    template_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return TemplateService(db).resubmit_template_by_id(uuid.UUID(template_id))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ExternalAPIError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.put("/{template_id}")
def update_template(
    template_id: str,
    payload: TemplateUpdateSchema,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return TemplateService(db).update_template_by_id(uuid.UUID(template_id), payload)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{template_id}")
def delete_template(
    template_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return TemplateService(db).delete_template_by_id(uuid.UUID(template_id))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/activity/recent")
def get_recent_activities(
    limit: int = 5,
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
    current_user: dict = Depends(get_current_user),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    return TemplateService(db).get_recent_activities(org_id, limit, waba_account_id=waba_uuid)
