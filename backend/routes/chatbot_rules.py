from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.exceptions import ResourceNotFoundError, ValidationError
from routes.deps import get_active_organization_id, get_current_user
from schemas.auto_reply import AutoReplyRuleCreateSchema, AutoReplyRuleUpdateSchema
from services.messaging_features_service import AutoReplyService

router = APIRouter(tags=["Chatbot Rules"])


@router.get("/settings/chatbot-rules")
def list_chatbot_rules(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_active_organization_id),
):
    rules = AutoReplyService(db).list_chatbot_rules_dto(org_id)
    return {"success": True, "chatbot_rules": rules}


@router.post("/settings/chatbot-rules")
def create_chatbot_rule(
    payload: AutoReplyRuleCreateSchema,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_active_organization_id),
):
    try:
        rule = AutoReplyService(db).create_chatbot_rule_dto(payload, org_id)
        return {"success": True, "chatbot_rule": rule}
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/settings/chatbot-rules/{item_id}")
@router.put("/settings/chatbot-rules/{item_id}")
def update_chatbot_rule(
    item_id: str,
    payload: AutoReplyRuleUpdateSchema,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        rule = AutoReplyService(db).update_chatbot_rule_dto(uuid.UUID(item_id), payload)
        return {"success": True, "chatbot_rule": rule}
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/settings/chatbot-rules/{item_id}")
def delete_chatbot_rule(
    item_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return AutoReplyService(db).delete_chatbot_rule_dto(uuid.UUID(item_id))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
