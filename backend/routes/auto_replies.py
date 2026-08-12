from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.exceptions import ResourceNotFoundError, ValidationError
from routes.deps import get_active_organization_id, get_current_user
from schemas.auto_reply import AutoReplyRuleCreateSchema, AutoReplyRuleUpdateSchema
from services.messaging_features_service import AutoReplyService

router = APIRouter(tags=["Auto Replies"])


@router.get("/settings/auto-replies")
def list_auto_replies(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_active_organization_id),
):
    return AutoReplyService(db).list_auto_replies_dto(org_id)


@router.post("/settings/auto-replies")
def create_auto_reply(
    payload: AutoReplyRuleCreateSchema,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_active_organization_id),
):
    try:
        return AutoReplyService(db).create_auto_reply_dto(payload, org_id)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/settings/auto-replies/{item_id}")
@router.put("/settings/auto-replies/{item_id}")
def update_auto_reply(
    item_id: str,
    payload: AutoReplyRuleUpdateSchema,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return AutoReplyService(db).update_auto_reply_dto(uuid.UUID(item_id), payload)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/settings/auto-replies/{item_id}")
def delete_auto_reply(
    item_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return AutoReplyService(db).delete_auto_reply_dto(uuid.UUID(item_id))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
