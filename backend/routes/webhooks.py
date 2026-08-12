import json
from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from core.database import get_db
from core.webhook_security import verify_meta_signature
from services.webhook_service import WebhookService

router = APIRouter(tags=["Webhooks"])

@router.get("/api/whatsapp/webhook")
async def verify_webhook(request: Request):
    success, body, status_code = WebhookService.verify_webhook_token(request.query_params)
    return PlainTextResponse(body, status_code=status_code)


@router.post("/api/whatsapp/webhook")
async def webhook(
    request: Request,
    raw_body: bytes = Depends(verify_meta_signature),
    db: Session = Depends(get_db),
):
    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception:
        return {"status": "error", "message": "Invalid JSON"}

    try:
        WebhookService(db).process_webhook_payload(data)
    except Exception as e:
        print(f"[Webhook] Error processing payload: {e}")

    # Always return 200 so Meta doesn't retry
    return {"status": "ok"}
