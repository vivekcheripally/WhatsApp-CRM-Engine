from __future__ import annotations

import uuid
from typing import Optional, List

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from core.exceptions import DuplicateResourceError, ValidationError, PermissionError
from core.database import get_db
from routes.deps import get_active_organization_id, get_current_user, require_org_admin
from schemas.contact import (
    ContactCreateSchema,
    ContactImportResponseSchema,
    ContactListResponseSchema,
    ContactResponseSchema,
    ContactUpdateSchema,
)
from schemas.agent import ContactAssignRequest
from services.contact_service import ContactService

router = APIRouter(tags=["Contacts"])


@router.get("")
def list_contacts(
    q: Optional[str] = Query(None, description="Search term for name, phone, or email"),
    status: Optional[str] = Query(None, description="Filter by status (ACTIVE, INACTIVE, UNSUBSCRIBED)"),
    source: Optional[str] = Query(None, description="Filter by source (MANUAL, INBOUND_WHATSAPP, CSV_IMPORT)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    svc = ContactService(db)
    items, total, has_more = svc.list_contacts(
        q=q,
        status_filter=status,
        source_filter=source,
        page=page,
        page_size=page_size,
        organization_id=org_id,
        current_user=user,
    )
    return {
        "success": True,
        "contacts": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": has_more,
    }


@router.post("/create")
def create_contact(
    data: ContactCreateSchema = Body(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    svc = ContactService(db)
    actor_id = uuid.UUID(user["id"]) if user and user.get("id") else None
    try:
        res = svc.create_contact(
            name=data.name,
            phone_number=data.phone_number,
            email=data.email,
            tag=data.tag,
            status_str=data.status,
            source_str=data.source or "MANUAL",
            attributes=data.attributes,
            organization_id=org_id,
            actor_id=actor_id,
        )
        return {"success": True, "contact": res}
    except DuplicateResourceError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/assign", dependencies=[Depends(require_org_admin)])
def assign_contacts(
    payload: ContactAssignRequest = Body(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    """Bulk assign contacts to a Sales Agent (Org Admin only)."""
    contact_uuids = [uuid.UUID(cid) for cid in payload.contact_ids]
    new_owner_uuid = uuid.UUID(payload.new_owner_id)
    svc = ContactService(db)
    updated_count = svc.assign_contacts(
        organization_id=org_id,
        contact_ids=contact_uuids,
        new_owner_id=new_owner_uuid,
    )
    return {"success": True, "assigned_contacts_count": updated_count, "new_owner_id": payload.new_owner_id}


@router.get("/{contact_id}")
def get_contact_detail(
    contact_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        cid = uuid.UUID(contact_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid contact ID")

    svc = ContactService(db)
    try:
        res = svc.get_by_id(cid, current_user=user)
        if not res:
            raise HTTPException(status_code=404, detail="Contact not found")
        return {"success": True, "contact": res}
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.put("/{contact_id}")
@router.patch("/{contact_id}")
def update_contact(
    contact_id: str,
    data: ContactUpdateSchema = Body(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        cid = uuid.UUID(contact_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid contact ID")

    svc = ContactService(db)
    try:
        res = svc.update_contact(
            contact_id=cid,
            name=data.name,
            phone_number=data.phone_number,
            email=data.email,
            tag=data.tag,
            status_str=data.status,
            source_str=data.source,
            attributes=data.attributes,
            current_user=user,
        )
        if not res:
            raise HTTPException(status_code=404, detail="Contact not found")
        return {"success": True, "contact": res}
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/{contact_id}")
def delete_contact(
    contact_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        cid = uuid.UUID(contact_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid contact ID")

    actor_id = uuid.UUID(user["id"]) if user and user.get("id") else None
    svc = ContactService(db)
    success = svc.delete_contact(cid, actor_id=actor_id)
    if not success:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"success": True, "deleted": True, "id": contact_id}


@router.post("/import")
async def import_contacts(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    content = await file.read()
    actor_id = uuid.UUID(user["id"]) if user and user.get("id") else None
    svc = ContactService(db)
    try:
        return svc.import_contacts_from_file(
            file_bytes=content,
            filename=file.filename,
            organization_id=org_id,
            actor_id=actor_id,
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
