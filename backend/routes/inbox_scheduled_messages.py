from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.exceptions import ResourceNotFoundError, ValidationError
from routes.deps import get_current_user
from schemas.whatsapp_inbox import ScheduledMessageCreateSchema
from services.inbox_scheduler_service import InboxSchedulerService

router = APIRouter(prefix="/api/scheduled-messages", tags=["Inbox Scheduled Messages"])


@router.get("", response_model=dict)
def list_scheduled_messages(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    status_filter: Optional[str] = Query(None, alias="status"),
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    page: int = Query(1),
    page_size: int = Query(50),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    return InboxSchedulerService(db).list_scheduled_messages_dto(
        status_filter=status_filter,
        page=page,
        page_size=page_size,
        waba_account_id=waba_uuid,
    )


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_scheduled_message(
    payload: ScheduledMessageCreateSchema,
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    try:
        return InboxSchedulerService(db).create_scheduled_message_dto(payload, waba_account_id=waba_uuid)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{message_id}", response_model=dict)
def cancel_scheduled_message(
    message_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return InboxSchedulerService(db).cancel_scheduled_message_dto(uuid.UUID(message_id))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
