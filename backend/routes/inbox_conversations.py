from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.exceptions import ExternalAPIError, ResourceNotFoundError, ValidationError, PermissionError, NotFoundError
from routes.deps import get_active_organization_id, get_current_user, require_org_user, require_org_admin
from schemas.whatsapp_inbox import (
    ConversationCreatePayload,
    ConversationListResponse,
    ConversationUpdatePayload,
    MessageListResponse,
)
from schemas.agent import ConversationAssignRequest
from services.conversation_service import ConversationService

router = APIRouter(tags=["Inbox Conversations"])


@router.post("/api/conversations", response_model=dict)
def create_conversation(
    payload: ConversationCreatePayload,
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
    current_user: dict = Depends(get_current_user),
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    svc = ConversationService(db)
    try:
        conversation, created = svc.get_or_create(
            payload.customer_phone,
            whatsapp_account_id=waba_uuid,
            customer_name=payload.customer_name,
            organization_id=org_id,
        )
        details = svc.get_conversation_details(conversation.id, current_user=current_user)
        return {"created": created, "conversation": details}
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ExternalAPIError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("/api/conversations", response_model=ConversationListResponse)
def list_conversations(
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
    current_user: dict = Depends(get_current_user),
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    archived: Optional[bool] = Query(None),
    unread: Optional[bool] = Query(None),
    page: int = Query(1),
    page_size: int = Query(50),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    svc = ConversationService(db)
    return svc.list_conversations(
        org_id=org_id,
        waba_account_id=waba_uuid,
        status_filter=status_filter,
        search=search,
        archived=archived,
        unread=unread,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get("/api/conversations/{conversation_id}", response_model=dict)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    svc = ConversationService(db)
    try:
        details = svc.get_conversation_details(uuid.UUID(conversation_id), current_user=current_user)
        if not details:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        return details
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/api/conversations/{conversation_id}/assign", response_model=dict)
def assign_conversation(
    conversation_id: str,
    payload: ConversationAssignRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Assigns conversation to a specific Sales Agent or releases to unassigned queue."""
    svc = ConversationService(db)
    actor_id = uuid.UUID(current_user["id"]) if current_user and current_user.get("id") else None
    assignee_uuid = uuid.UUID(payload.assignee_id) if payload.assignee_id else None
    try:
        return svc.assign_conversation(uuid.UUID(conversation_id), assignee_id=assignee_uuid, actor_id=actor_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/api/conversations/{conversation_id}/claim", response_model=dict)
def claim_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Allows a Sales Agent to claim an unassigned conversation in an assigned WABA channel."""
    svc = ConversationService(db)
    agent_id = uuid.UUID(current_user["id"])
    try:
        return svc.claim_conversation(uuid.UUID(conversation_id), agent_id=agent_id)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch("/api/conversations/{conversation_id}", response_model=dict)
def update_conversation(
    conversation_id: str,
    payload: ConversationUpdatePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    svc = ConversationService(db)
    updated = svc.update_conversation_fields(uuid.UUID(conversation_id), payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return updated


@router.post("/api/conversations/{conversation_id}/read", response_model=dict)
def mark_as_read(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    svc = ConversationService(db)
    updated = svc.mark_conversation_as_read(uuid.UUID(conversation_id))
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return updated


@router.delete("/api/conversations/{conversation_id}", response_model=dict)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    svc = ConversationService(db)
    success = svc.delete_conversation(uuid.UUID(conversation_id))
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return {"id": conversation_id, "deleted": True}


@router.get("/api/conversations/{conversation_id}/messages", response_model=dict)
def get_conversation_messages(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    page: int = Query(1),
    page_size: int = Query(50),
):
    svc = ConversationService(db)
    try:
        details = svc.get_conversation_details(uuid.UUID(conversation_id), current_user=current_user)
        if not details:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        return svc.get_conversation_messages(uuid.UUID(conversation_id), page=page, page_size=page_size)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
