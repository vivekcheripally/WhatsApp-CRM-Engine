"""
Application configuration using Pydantic BaseSettings.

All settings are read from environment variables and/or a .env file at
the backend root.  Access settings everywhere via the singleton:

    from core.config import settings
    print(settings.DATABASE_URL)
"""

from pathlib import Path
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # ─── Application ───────────────────────────────────────────────────────
    APP_NAME: str = "FastSales WhatsApp Module"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    PUBLIC_BASE_URL: Optional[str] = None  # e.g. https://your-ngrok-subdomain.ngrok-free.app


    # ─── Authentication / JWT & Cookie ────────────────────────────────────
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"

    @field_validator("JWT_SECRET_KEY", mode="after")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if not v or not v.strip():
            # If missing, provide a safe dev fallback or raise error
            raise ValueError(
                "CRITICAL SECURITY ERROR: 'JWT_SECRET_KEY' environment variable is missing or empty! "
                "Set a secure secret key in your .env file before starting the application."
            )
        return v
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    # ─── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str = ""
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40
    DATABASE_POOL_TIMEOUT: int = 30

    # ─── Redis & Celery Task Broker ────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # ─── Meta / WhatsApp Cloud API ─────────────────────────────────────────
    ACCESS_TOKEN: Optional[str] = None          # legacy / campaign sender
    PHONE_NUMBER_ID: Optional[str] = None       # legacy / campaign sender
    WABA_ID: Optional[str] = None

    META_APP_ID: Optional[str] = None
    META_APP_SECRET: Optional[str] = None
    META_VERIFY_TOKEN: Optional[str] = None
    META_ACCESS_TOKEN: Optional[str] = None
    META_BUSINESS_ACCOUNT_ID: Optional[str] = None
    META_WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    META_API_VERSION: str = "v23.0"
    META_BASE_URL: str = "https://graph.facebook.com"
    # Set to "true" in dev to skip HMAC webhook signature check
    META_WEBHOOK_SKIP_SIGNATURE: str = "false"

    # ─── WebSocket ─────────────────────────────────────────────────────────
    WS_SECRET: str = ""

    # ─── AWS S3 & Cloud Storage ──────────────────────────────────────────
    STORAGE_PROVIDER: str = "local"  # 'local' or 's3'
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    AWS_BUCKET_NAME: str = "whatsapp-inbox-media"
    S3_BUCKET_NAME: Optional[str] = None
    S3_CUSTOM_DOMAIN: Optional[str] = None
    AWS_SIGNED_URL_EXPIRY: int = 3600  # seconds

    # ─── CORS ──────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # ─── Scheduler ─────────────────────────────────────────────────────────
    ENABLE_SCHEDULER: bool = False

    class Config:
        env_file = str(Path(__file__).resolve().parents[1] / ".env")
        env_file_encoding = "utf-8"
        case_sensitive = True
        # Allow extra fields in .env without raising validation errors
        extra = "ignore"

# Module-level singleton — import this everywhere
settings = Settings()
