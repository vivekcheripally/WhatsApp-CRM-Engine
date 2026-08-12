import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings
from core.database import Base, engine
from core.redis import close_redis

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("fastsales")

# ─── Routers ───────────────────────────────────────────────────────────────────
from routes.dashboard import router as dashboard_router
from routes.templates import router as template_router
from routes.whatsapp import router as whatsapp_router
from routes.webhooks import router as webhook_router, verify_webhook, webhook as webhook_post
from routes.campaign import router as campaign_router
from routes.auto_replies import router as auto_replies_router
from routes.chatbot_rules import router as chatbot_rules_router
from routes.contacts import router as contact_router
from routes.ws import router as ws_router
from routes.inbox_conversations import router as inbox_conversations_router
from routes.messages import router as inbox_thread_messages_router
from routes.inbox_scheduled_messages import router as inbox_scheduled_router
from routes.auth import router as auth_router
from routes.super_admin import router as super_admin_router
from routes.agents import router as agents_router
from routes.deps import get_current_user


# ─── Lifespan Context Manager ──────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[%s] Starting up...", settings.APP_NAME)
    logger.info("Celery task queue & Celery Beat active for background jobs.")
    yield

    close_redis()
    logger.info("[%s] Shutdown complete.", settings.APP_NAME)


# ─── App Definition ────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "ws://localhost:8000",
        "ws://127.0.0.1:8000",
        "http://localhost",
        "http://127.0.0.1",
        *settings.CORS_ORIGINS,
    ],
    allow_origin_regex=r"^(https?|wss?)://(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.[0-9]{1,3}\.[0-9]{1,3})(:(\d+))?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Register Routers ──────────────────────────────────────────────────────────
# Public / Unprotected Webhooks Router
app.include_router(webhook_router)

# Protected Tenant Workspace Routers (Router-Level Global Safety Net)
app.include_router(dashboard_router,          prefix="/api/dashboard",      tags=["Dashboard"],      dependencies=[Depends(get_current_user)])
app.include_router(template_router,           prefix="/api/templates",       tags=["Templates"],      dependencies=[Depends(get_current_user)])
app.include_router(whatsapp_router,           prefix="/api/whatsapp",        tags=["WhatsApp"],       dependencies=[Depends(get_current_user)])
app.include_router(campaign_router,           prefix="/api/campaign",        tags=["Campaign"],       dependencies=[Depends(get_current_user)])
app.include_router(auto_replies_router,       prefix="/api",                 tags=["Auto Replies"],   dependencies=[Depends(get_current_user)])
app.include_router(chatbot_rules_router,      prefix="/api",                 tags=["Chatbot Rules"],  dependencies=[Depends(get_current_user)])
app.include_router(contact_router,            prefix="/api/contacts",        tags=["Contacts"],        dependencies=[Depends(get_current_user)])
app.include_router(agents_router,                                                                     dependencies=[Depends(get_current_user)])
app.include_router(ws_router)

# WhatsApp Inbox
app.include_router(inbox_conversations_router, dependencies=[Depends(get_current_user)])
app.include_router(inbox_thread_messages_router, dependencies=[Depends(get_current_user)])
app.include_router(inbox_scheduled_router, dependencies=[Depends(get_current_user)])

# Authentication & Super Admin
app.include_router(auth_router)
app.include_router(super_admin_router)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}