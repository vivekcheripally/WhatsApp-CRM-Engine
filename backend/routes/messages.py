from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.exceptions import ExternalAPIError, ResourceNotFoundError, ValidationError
from routes.deps import get_current_user
from schemas.whatsapp_inbox import AddReactionRequest, SendMessageRequest
from services.media_service import MediaService
from services.message_service import MessageService
from services.reaction_service import ReactionService

router = APIRouter(tags=["Inbox Messages"])


@router.post("/api/messages/send", response_model=dict)
def create_message(
    payload: SendMessageRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = MessageService(db)
    agent_id = user.get("id", 1)
    try:
        return svc.send_message(payload, agent_id=agent_id)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ExternalAPIError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.post("/api/messages/send/media-upload")
async def send_media_upload(
    file: UploadFile = File(...),
    conversation_id: str = Form(...),
    message_type: str = Form("DOCUMENT"),
    caption: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = MessageService(db)
    agent_id = user.get("id", 1)
    file_bytes = await file.read()
    filename = file.filename or "upload"
    mime_type = file.content_type or "application/octet-stream"

    try:
        return svc.handle_media_upload(
            file_bytes=file_bytes,
            filename=filename,
            mime_type=mime_type,
            conversation_id_str=conversation_id,
            message_type_str=message_type,
            caption=caption,
            agent_id=agent_id,
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ExternalAPIError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.post("/api/messages/{message_id}/reactions")
def add_reaction(
    message_id: str,
    payload: AddReactionRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = ReactionService(db)
    return svc.add_reaction_dto(
        message_id=uuid.UUID(message_id),
        emoji=payload.emoji,
        customer_phone=str(payload.customer_phone or "agent"),
    )


@router.get("/api/messages/{message_id}/reactions")
def get_reactions(
    message_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = ReactionService(db)
    result = svc.get_reactions_for_message(uuid.UUID(message_id))
    return result.model_dump(mode="json")


@router.get("/api/messages/media/{media_file_id}/stream")
def stream_media_from_meta(
    media_file_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        mf_uuid = uuid.UUID(media_file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid media file id")

    svc = MediaService(db)
    try:
        content, content_type = svc.stream_media_by_id(mf_uuid)
        return Response(
            content=content,
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except Exception as e:
        print(f"[MediaStream] Error streaming media {media_file_id}: {e}")
        raise HTTPException(status_code=404, detail="Media stream error or file expired.")
