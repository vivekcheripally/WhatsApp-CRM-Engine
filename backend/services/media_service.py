from __future__ import annotations

import uuid
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from core.config import settings as config
from models.postgres_model import MessageType, WhatsAppMediaFile


import os

from core.exceptions import ExternalAPIError, ResourceNotFoundError

class MediaService:
    def __init__(self, db: Session):
        self.db = db

    def stream_media_by_id(self, media_file_id: uuid.UUID) -> tuple[bytes, str]:
        from services.whatsapp_service import WhatsAppService
        wa = WhatsAppService(self.db).get_active_account()
        return self.stream_media_file(media_file_id, wa.access_token)

    def get_meta_media_url(self, media_id: str, access_token: str) -> str:
        """Fetch download URL from Meta API."""
        meta_base_url = getattr(config, "META_BASE_URL", "https://graph.facebook.com")
        meta_api_version = getattr(config, "META_API_VERSION", "v23.0")
        url = f"{meta_base_url}/{meta_api_version}/{media_id}"
        headers = {"Authorization": f"Bearer {access_token}"}
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["url"]

    def stream_media_file(self, media_file_id: uuid.UUID, access_token: str) -> tuple[bytes, str]:
        """Fetch media bytes and content type from local disk or Meta API."""
        mf = self.db.query(WhatsAppMediaFile).filter(WhatsAppMediaFile.id == media_file_id).first()
        if not mf:
            raise ResourceNotFoundError("Media file not found")

        if mf.file_url and (mf.file_url.startswith("/uploads/") or "uploads" in mf.file_url):
            clean_path = mf.file_url.lstrip("/")
            if os.path.exists(clean_path):
                with open(clean_path, "rb") as f:
                    content = f.read()
                ext = os.path.splitext(clean_path)[1].lower()
                media_type = "image/png" if ext == ".png" else ("image/webp" if ext == ".webp" else "image/jpeg")
                return content, media_type

        if not mf.meta_media_id:
            raise ResourceNotFoundError("Media ID missing")

        meta_base_url = getattr(config, "META_BASE_URL", "https://graph.facebook.com").rstrip("/")
        meta_api_version = getattr(config, "META_API_VERSION", "v23.0")
        url = f"{meta_base_url}/{meta_api_version}/{mf.meta_media_id}"
        headers = {"Authorization": f"Bearer {access_token}"}

        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url, headers=headers)
            resp.raise_for_status()
            cdn_url = resp.json().get("url")
            if not cdn_url:
                raise ExternalAPIError("Meta CDN URL empty")
            r_file = client.get(cdn_url, headers=headers)
            r_file.raise_for_status()
            content_type = r_file.headers.get("content-type", "image/jpeg")
            return r_file.content, content_type


    def process_incoming_media(
        self,
        message_id: uuid.UUID,
        media_id: str,
        access_token: str,
        mime_type: Optional[str] = None,
        file_name: Optional[str] = None,
    ) -> WhatsAppMediaFile:
        """Create media record pointing to zero-disk backend proxy stream."""
        media_type = _mime_to_message_type(mime_type)
        final_fname = file_name or str(media_id)
        temp_id = uuid.uuid4()
        file_url = f"/api/messages/media/{temp_id}/stream"

        media = WhatsAppMediaFile(
            id=temp_id,
            message_id=message_id,
            meta_media_id=media_id,
            file_name=final_fname,
            file_url=file_url,
            file_size=None,
            media_type=media_type,
        )
        self.db.add(media)
        self.db.commit()
        self.db.refresh(media)
        return media

    def get_signed_url_for_media(self, media: WhatsAppMediaFile) -> str:
        return media.file_url or f"/api/messages/media/{media.id}/stream"


    @staticmethod
    def _mime_to_ext(mime: str) -> str:
        mapping = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "video/mp4": ".mp4",
            "video/3gpp": ".3gp",
            "audio/mpeg": ".mp3",
            "audio/ogg": ".ogg",
            "audio/opus": ".opus",
            "application/pdf": ".pdf",
            "application/vnd.ms-excel": ".xls",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
            "application/msword": ".doc",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        }
        return mapping.get(mime, "")


def _mime_to_message_type(mime_type: Optional[str]) -> Optional[MessageType]:
    """Map MIME type string to MessageType enum."""
    if not mime_type:
        return None
    mime = mime_type.lower()
    if mime.startswith("image/"):
        return MessageType.IMAGE
    if mime.startswith("video/"):
        return MessageType.VIDEO
    if mime.startswith("audio/"):
        return MessageType.AUDIO
    if mime in ("application/pdf", "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"):
        return MessageType.DOCUMENT
    return None
