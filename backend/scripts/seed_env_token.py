import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import logging
from core.database import SessionLocal
from services.whatsapp_service import WhatsAppService
from schemas.whatsapp_inbox import WhatsAppConnectRequest
from core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_env_token")

def seed_env_token():
    token = settings.META_ACCESS_TOKEN
    waba_id = settings.META_WABA_ID
    phone_id = settings.META_PHONE_NUMBER_ID

    if not token or not phone_id:
        logger.info("No META_ACCESS_TOKEN or META_PHONE_NUMBER_ID found in settings. Skipping seed.")
        return

    logger.info("Seeding WhatsApp credentials from settings into database...")
    db = SessionLocal()
    try:
        svc = WhatsAppService(db)
        req = WhatsAppConnectRequest(
            account_name="Default WhatsApp Account",
            waba_id=waba_id or "default_waba",
            phone_number_id=phone_id,
            access_token=token,
        )
        account = svc.connect(req)
        logger.info("Successfully seeded WhatsApp Account ID: %s", account.id)
    except Exception as exc:
        logger.error("Failed to seed WhatsApp credentials: %s", exc)
    finally:
        db.close()

if __name__ == "__main__":
    seed_env_token()
