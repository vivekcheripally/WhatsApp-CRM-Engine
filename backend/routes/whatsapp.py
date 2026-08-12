import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.exceptions import DomainException, ExternalAPIError, ResourceNotFoundError, ValidationError
from models.postgres_model import WhatsAppAccountStatus
from routes.deps import get_active_organization_id, get_current_user
from schemas.whatsapp_inbox import MessageRequest, WhatsAppConnectRequest, WhatsAppSettingsUpdateSchema
from services.whatsapp_service import WhatsAppService

router = APIRouter(tags=["WhatsApp"])


@router.get("/channels")
def list_whatsapp_channels(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    try:
        return WhatsAppService(db, org_id=org_id).list_channels_dto(current_user=user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/channels/{account_id}/set-default")
def set_default_whatsapp_channel(
    account_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    try:
        return WhatsAppService(db, org_id=org_id).set_default_channel_dto(account_id)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/channels/{account_id}")
def delete_whatsapp_channel(
    account_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    try:
        return WhatsAppService(db, org_id=org_id).delete_channel_dto(account_id)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DomainException as e:
        return {"success": False, "error": e.message}


@router.post("/send")
def send_message(
    data: MessageRequest,
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    try:
        return WhatsAppService(db, org_id=org_id).send_direct_template_message(data.to, data.template_name, waba_account_id=waba_uuid)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ExternalAPIError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.post("/connect")
def connect_whatsapp(
    payload: WhatsAppConnectRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    try:
        return WhatsAppService(db, org_id=org_id).connect_dto(payload)
    except DomainException as e:
        return {"success": False, "error": e.message}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/account")
def get_account(
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    return WhatsAppService(db, org_id=org_id).get_account_dto(waba_account_id=waba_uuid)


@router.delete("/disconnect")
def disconnect_account(
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    try:
        return WhatsAppService(db, org_id=org_id).disconnect_dto(waba_account_id=waba_uuid)
    except DomainException as e:
        return {"success": False, "error": e.message}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/status")
def get_status(
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    return WhatsAppService(db, org_id=org_id).get_status_dto(waba_account_id=waba_uuid)


@router.get("/settings")
def get_whatsapp_settings(
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    return WhatsAppService(db, org_id=org_id).get_settings_dto(waba_account_id=waba_uuid)


@router.put("/settings")
def update_whatsapp_settings(
    payload: WhatsAppSettingsUpdateSchema,
    waba_account_id: Optional[str] = Query(None),
    x_waba_account_id: Optional[str] = Header(None, alias="X-WABA-Account-ID"),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    org_id: Optional[uuid.UUID] = Depends(get_active_organization_id),
):
    target_waba = waba_account_id or x_waba_account_id
    waba_uuid = uuid.UUID(target_waba) if target_waba else None
    return WhatsAppService(db, org_id=org_id).update_settings_dto(payload, waba_account_id=waba_uuid)
