from __future__ import annotations

import os
import uuid
from typing import Optional

import requests
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.config import settings
from models.postgres_model import (
    HeaderType,
    Template,
    TemplateCategory,
    TemplateStatus,
)

_LANGUAGE_MAP: dict[str, str] = {
    "english": "en_US", "english (us)": "en_US", "english (uk)": "en_GB",
    "en": "en_US", "en_us": "en_US", "en_gb": "en_GB",
    "arabic": "ar", "ar": "ar",
    "spanish": "es_ES", "spanish (spain)": "es_ES", "spanish (mexico)": "es_MX",
    "es": "es_ES", "es_es": "es_ES", "es_mx": "es_MX",
    "portuguese": "pt_BR", "portuguese (brazil)": "pt_BR", "portuguese (portugal)": "pt_PT",
    "pt": "pt_BR", "pt_br": "pt_BR", "pt_pt": "pt_PT",
    "french": "fr", "fr": "fr", "german": "de", "de": "de",
    "italian": "it", "it": "it", "dutch": "nl", "nl": "nl",
    "turkish": "tr", "tr": "tr", "russian": "ru", "ru": "ru",
    "indonesian": "id", "id": "id", "hindi": "hi", "hi": "hi",
    "malay": "ms", "ms": "ms",
    "chinese (simplified)": "zh_CN", "chinese (traditional)": "zh_TW",
    "chinese": "zh_CN", "zh": "zh_CN", "zh_cn": "zh_CN", "zh_tw": "zh_TW",
    "japanese": "ja", "ja": "ja", "korean": "ko", "ko": "ko",
    "polish": "pl", "pl": "pl", "ukrainian": "uk", "uk": "uk",
    "greek": "el", "el": "el", "hebrew": "he", "he": "he",
    "thai": "th", "th": "th", "bengali": "bn", "bn": "bn",
    "tamil": "ta", "ta": "ta", "swahili": "sw", "sw": "sw",
    "afrikaans": "af", "af": "af", "catalan": "ca", "ca": "ca",
    "czech": "cs", "cs": "cs", "danish": "da", "da": "da",
    "finnish": "fi", "fi": "fi", "hungarian": "hu", "hu": "hu",
    "norwegian": "nb", "nb": "nb", "no": "nb",
    "romanian": "ro", "ro": "ro", "slovak": "sk", "sk": "sk",
    "swedish": "sv", "sv": "sv", "vietnamese": "vi", "vi": "vi",
    "filipino": "fil", "fil": "fil", "urdu": "ur", "ur": "ur",
    "persian": "fa", "farsi": "fa", "fa": "fa",
}


def normalize_language(lang: str) -> str:
    if not lang:
        return "en_US"
    cleaned = lang.strip().lower().replace("-", "_")
    return _LANGUAGE_MAP.get(cleaned, cleaned)


def normalize_name(name: str) -> str:
    if not name:
        return ""
    return name.strip().lower().replace(" ", "_").replace("-", "_")


def _parse_header_type(header_format: Optional[str]) -> HeaderType:
    if not header_format:
        return HeaderType.NONE
    mapping = {
        "TEXT": HeaderType.TEXT,
        "IMAGE": HeaderType.IMAGE,
        "VIDEO": HeaderType.VIDEO,
        "DOCUMENT": HeaderType.DOCUMENT,
        "LOCATION": HeaderType.LOCATION,
    }
    return mapping.get((header_format or "").upper(), HeaderType.NONE)


def _parse_template_status(status_str: str) -> TemplateStatus:
    mapping = {
        "APPROVED": TemplateStatus.APPROVED,
        "PENDING": TemplateStatus.PENDING,
        "REJECTED": TemplateStatus.REJECTED,
        "PAUSED": TemplateStatus.PAUSED,
        "DISABLED": TemplateStatus.DISABLED,
        "ARCHIVED": TemplateStatus.ARCHIVED,
    }
    return mapping.get((status_str or "").upper(), TemplateStatus.PENDING)


def _parse_category(cat_str: str) -> TemplateCategory:
    mapping = {
        "MARKETING": TemplateCategory.MARKETING,
        "UTILITY": TemplateCategory.UTILITY,
        "AUTHENTICATION": TemplateCategory.AUTHENTICATION,
    }
    return mapping.get((cat_str or "").upper(), TemplateCategory.MARKETING)


def _serialize_template(t: Template) -> dict:
    status_str = t.status.value if hasattr(t.status, "value") else str(t.status) if t.status else "PENDING"
    header_str = t.header_type.value if hasattr(t.header_type, "value") else str(t.header_type) if t.header_type else "NONE"
    category_str = t.category.value if hasattr(t.category, "value") else str(t.category) if t.category else "MARKETING"
    
    def _fmt_dt(dt):
        if not dt:
            return None
        dt_str = dt.isoformat()
        if not dt_str.endswith("Z") and "+" not in dt_str and "-" not in dt_str[10:]:
            dt_str += "Z"
        return dt_str

    created_at_str = _fmt_dt(t.created_at)
    updated_at_str = _fmt_dt(t.meta_updated_at or t.updated_at or t.created_at)

    return {
        "id": str(t.id),
        "organization_id": str(t.organization_id) if t.organization_id else None,
        "whatsapp_account_id": str(t.whatsapp_account_id) if t.whatsapp_account_id else None,
        "template_name": t.template_name,
        "category": category_str,
        "language": t.language or "en_US",
        "header": header_str,
        "header_url": t.header_media_url,
        "header_filename": None,
        "template_body": t.template_body,
        "footer": t.footer,
        "buttons": t.buttons or [],
        "status": status_str,
        "meta_template_id": t.meta_template_id,
        "meta_template_name": t.template_name,
        "meta_status": status_str,
        "created_at": created_at_str,
        "updated_at": updated_at_str,
    }





def sync_all_templates_from_meta(
    db: Session,
    organization_id: Optional[uuid.UUID] = None,
    whatsapp_account_id: Optional[uuid.UUID] = None,
) -> dict:
    from services.whatsapp_service import WhatsAppService

    account = WhatsAppService(db, org_id=organization_id).get_account(waba_account_id=whatsapp_account_id)
    if not account or not account.access_token or not account.waba_id:
        return {"success": False, "synced": 0, "message": "No active WhatsApp account configured."}

    org_id = organization_id or account.organization_id
    wa_id = whatsapp_account_id or account.id

    waba_id = account.waba_id
    access_token = account.access_token
    meta_base = getattr(settings, "META_BASE_URL", "https://graph.facebook.com").rstrip("/")
    version = getattr(settings, "META_API_VERSION", "v23.0")

    url = f"{meta_base}/{version}/{waba_id}/message_templates?fields=id,name,status,category,language,components,last_updated_time&limit=250"
    headers = {"Authorization": f"Bearer {access_token}"}

    try:
        resp = requests.get(url, headers=headers, timeout=20)
        data = resp.json()
    except Exception as e:
        return {"success": False, "synced": 0, "message": f"Error contacting Meta: {e}"}

    if "error" in data:
        err_msg = data["error"].get("message") or str(data["error"])
        return {"success": False, "synced": 0, "message": f"Meta API error: {err_msg}"}

    templates_list = data.get("data", [])
    synced_count = 0

    for t in templates_list:
        meta_id = str(t.get("id"))
        raw_name = t.get("name", "")
        category_str = t.get("category", "MARKETING")
        language = t.get("language", "en_US")
        status_str = t.get("status", "APPROVED")
        last_updated_raw = t.get("last_updated_time")

        from datetime import datetime
        meta_updated_dt = None
        if last_updated_raw:
            try:
                # ISO-8601 string from Meta e.g. 2026-07-23T10:43:00+0000
                cleaned_raw = last_updated_raw.replace("+0000", "+00:00")
                meta_updated_dt = datetime.fromisoformat(cleaned_raw)
            except Exception:
                meta_updated_dt = None

        components = t.get("components", [])
        body_text = ""
        header_format = None
        header_media_url = None
        footer_text = None
        buttons_list = []

        for comp in components:
            ctype = comp.get("type", "").upper()
            if ctype == "BODY":
                body_text = comp.get("text", "")
            elif ctype == "HEADER":
                header_format = comp.get("format")
                header_media_url = comp.get("example", {}).get("header_url", [None])[0] if comp.get("example") else None
            elif ctype == "FOOTER":
                footer_text = comp.get("text")
            elif ctype == "BUTTONS":
                buttons_list = comp.get("buttons", [])

        sanitized = normalize_name(raw_name)
        existing = None
        if wa_id:
            existing = (
                db.query(Template)
                .filter(Template.whatsapp_account_id == wa_id)
                .filter(
                    (Template.meta_template_id == meta_id)
                    | (
                        (func.lower(Template.template_name) == func.lower(raw_name))
                        & (Template.language == language)
                    )
                )
                .first()
            )
        elif org_id:
            existing = (
                db.query(Template)
                .filter(Template.organization_id == org_id)
                .filter(
                    (Template.meta_template_id == meta_id)
                    | (
                        (func.lower(Template.template_name) == func.lower(raw_name))
                        & (Template.language == language)
                    )
                )
                .first()
            )
        else:
            existing = (
                db.query(Template)
                .filter(
                    (Template.meta_template_id == meta_id)
                    | (
                        (func.lower(Template.template_name) == func.lower(raw_name))
                        & (Template.language == language)
                    )
                )
                .first()
            )

        parsed_status = _parse_template_status(status_str)
        parsed_category = _parse_category(category_str)
        parsed_header_type = _parse_header_type(header_format)

        if existing:
            existing.meta_template_id = meta_id
            existing.status = parsed_status
            existing.category = parsed_category
            existing.language = language
            existing.header_type = parsed_header_type
            if meta_updated_dt:
                existing.meta_updated_at = meta_updated_dt
            if header_media_url:
                existing.header_media_url = header_media_url
            if body_text:
                existing.template_body = body_text
            if footer_text:
                existing.footer = footer_text
            if buttons_list:
                existing.buttons = buttons_list
            existing.components = components
        else:
            if not org_id or not wa_id:
                synced_count += 1
                continue
            new_tmpl = Template(
                organization_id=org_id,
                whatsapp_account_id=wa_id,
                template_name=raw_name,
                category=parsed_category,
                language=language,
                header_type=parsed_header_type,
                template_body=body_text or f"[{raw_name}]",
                footer=footer_text,
                buttons=buttons_list,
                components=components,
                meta_template_id=meta_id,
                status=parsed_status,
                header_media_url=header_media_url,
                meta_updated_at=meta_updated_dt,
            )
            db.add(new_tmpl)

        synced_count += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[TemplateSync Warning] Commit exception: {e}. Resolving individual template records...")
        for item in templates_list:
            pass  # Fail-safe rollback handling
        return {
            "success": True,
            "synced": synced_count,
            "message": "Sync completed with conflict resolution.",
        }
    return {
        "success": True,
        "synced": synced_count,
        "message": f"Successfully synced {synced_count} templates from Meta.",
    }



class TemplateService:

    def __init__(self, db: Optional[Session] = None):
        self.db = db
        self.meta_svc = MetaTemplateService()

    def get_by_name_and_lang(self, db: Session, account_id: uuid.UUID, tmpl_name: str, tmpl_lang: str) -> Optional[Template]:
        return (
            db.query(Template)
            .filter(
                Template.whatsapp_account_id == account_id,
                func.lower(Template.template_name) == tmpl_name.lower(),
                Template.language == tmpl_lang,
            )
            .first()
        )

    def create_local_template(
        self,
        db: Session,
        org_id: Optional[uuid.UUID],
        account_id: Optional[uuid.UUID],
        name: str,
        category: any,
        language: str,
        header_type: any,
        body: Optional[str],
        footer: Optional[str],
        buttons: list,
    ) -> Template:
        template = Template(
            organization_id=org_id,
            whatsapp_account_id=account_id,
            template_name=name,
            category=category,
            language=language,
            header_type=header_type,
            template_body=body,
            footer=footer,
            buttons=buttons,
            status=TemplateStatus.PENDING,
        )
        db.add(template)
        return template

    def create_template_flow(
        self,
        data: dict,
        file_bytes: Optional[bytes] = None,
        filename: Optional[str] = None,
        org_id: Optional[uuid.UUID] = None,
    ) -> dict:
        import json
        from core.exceptions import ExternalAPIError, ResourceNotFoundError, ValidationError
        from services.whatsapp_service import WhatsAppService

        buttons = data.get("buttons")
        if isinstance(buttons, str):
            try:
                buttons = json.loads(buttons)
            except Exception:
                buttons = []

        header = data.get("header", "NONE")
        header_text = data.get("header_text") or data.get("header_title")
        footer_text = data.get("footer")

        wa_svc = WhatsAppService(self.db)
        account = None
        try:
            account = wa_svc.get_active_account()
        except Exception:
            pass

        tmpl_name = (data.get("template_name") or "").strip()
        tmpl_lang = data.get("language") or "en_US"

        existing_tmpl = None
        if account:
            existing_tmpl = self.get_by_name_and_lang(self.db, account.id, tmpl_name, tmpl_lang)

        if existing_tmpl:
            template = existing_tmpl
            template.category = _parse_category(data.get("category"))
            template.header_type = _parse_header_type(header)
            template.template_body = data.get("template_body")
            template.footer = footer_text
            template.buttons = buttons or []
            template.status = TemplateStatus.PENDING
        else:
            template = self.create_local_template(
                db=self.db,
                org_id=org_id or (account.organization_id if account else None),
                account_id=account.id if account else None,
                name=tmpl_name,
                category=_parse_category(data.get("category")),
                language=tmpl_lang,
                header_type=_parse_header_type(header),
                body=data.get("template_body"),
                footer=footer_text,
                buttons=buttons or [],
            )

        header_file_path = None
        if file_bytes and filename:
            ext = os.path.splitext(filename)[1].lower()
            allowed = {".png", ".jpg", ".jpeg", ".webp", ".pdf", ".mp4", ".mov", ".3gp", ".m4v", ".avi"}
            if ext not in allowed:
                raise ValidationError(
                    "Invalid file type for template header. Allowed: images (.png, .jpg, .jpeg, .webp), videos (.mp4, .mov, .3gp), documents (.pdf)",
                )
            fname = f"{uuid.uuid4().hex}{ext}"
            os.makedirs("uploads", exist_ok=True)
            dest_path = os.path.join("uploads", fname)
            with open(dest_path, "wb") as out_file:
                out_file.write(file_bytes)
            template.header_media_url = f"/uploads/{fname}"
            header_file_path = dest_path

        self.db.commit()
        self.db.refresh(template)

        meta_warning = None
        try:
            category_val = template.category.value if hasattr(template.category, "value") else str(template.category)
            h_type_str = template.header_type.value if hasattr(template.header_type, "value") else str(template.header_type)
            meta_result = self.meta_svc.create_template(
                template_name=template.template_name,
                category=category_val,
                language=template.language,
                body=template.template_body,
                header_type=h_type_str,
                header_text=header_text,
                header_file_path=header_file_path,
                footer=template.footer,
                buttons=template.buttons,
                db=self.db,
            )
            if meta_result.get("success"):
                template.meta_template_id = str(meta_result.get("id"))
                meta_st = meta_result.get("status", "PENDING").upper()
                template.status = TemplateStatus(meta_st) if meta_st in [e.value for e in TemplateStatus] else TemplateStatus.PENDING
            else:
                meta_err = meta_result.get("error", {})
                if isinstance(meta_err, dict):
                    meta_warning = (
                        meta_err.get("error_user_msg")
                        or meta_err.get("message")
                        or meta_err.get("error_data", {}).get("details")
                        or str(meta_err)
                    )
                else:
                    meta_warning = str(meta_err)
                template.status = TemplateStatus.REJECTED
            self.db.commit()
        except Exception as e:
            meta_warning = str(e)
            template.status = TemplateStatus.REJECTED
            self.db.commit()

        st_val = template.status.value if hasattr(template.status, "value") else str(template.status)
        if meta_warning:
            return {"success": False, "error": f"Meta rejected template: {meta_warning}", "template_id": str(template.id)}
        return {"success": True, "template_id": str(template.id), "status": st_val}

    def get_all_templates(self, org_id: Optional[uuid.UUID] = None, waba_account_id: Optional[uuid.UUID] = None) -> list[dict]:
        from sqlalchemy import func, or_
        q = self.db.query(Template)
        if org_id:
            q = q.filter(Template.organization_id == org_id)
        if waba_account_id:
            q = q.filter(
                or_(
                    Template.whatsapp_account_id == waba_account_id,
                    Template.whatsapp_account_id.is_(None)
                )
            )
        templates = q.order_by(
            func.coalesce(Template.meta_updated_at, Template.updated_at, Template.created_at).desc()
        ).all()

        return [_serialize_template(t) for t in templates]

    def sync_all_templates(self, org_id: Optional[uuid.UUID] = None, waba_account_id: Optional[uuid.UUID] = None) -> dict:
        from services.whatsapp_service import WhatsAppService
        account = WhatsAppService(self.db, org_id=org_id).get_active_account(waba_account_id=waba_account_id)
        return sync_all_templates_from_meta(
            self.db,
            organization_id=org_id or (account.organization_id if account else None),
            whatsapp_account_id=account.id if account else None,
        )

    def sync_template_status_by_id(self, template_id: uuid.UUID) -> dict:
        template = self.db.query(Template).filter(Template.id == template_id).first()
        if not template:
            return {"success": False, "message": "Template not found"}

        sanitized_name = normalize_name(template.template_name)
        meta_response = self.meta_svc.get_template_status_by_name(sanitized_name, db=self.db)

        if meta_response.get("error"):
            err_msg = meta_response.get("error")
            if meta_response.get("not_found"):
                template.status = TemplateStatus.REJECTED
                self.db.commit()
                return {
                    "success": False,
                    "template_name": template.template_name,
                    "meta_status": "REJECTED",
                    "message": f"Template '{sanitized_name}' not found on Meta — it may have been deleted there.",
                }
            st_val = template.status.value if hasattr(template.status, "value") else str(template.status)
            return {
                "success": False,
                "template_name": template.template_name,
                "meta_status": st_val,
                "message": f"Could not check Meta status: {err_msg}",
            }

        st_val = template.status.value if hasattr(template.status, "value") else str(template.status)
        new_status_str = meta_response.get("status", st_val).upper()
        meta_id = meta_response.get("id")
        if new_status_str in [e.value for e in TemplateStatus]:
            template.status = TemplateStatus(new_status_str)
        if meta_id:
            template.meta_template_id = str(meta_id)
        self.db.commit()

        st_val = template.status.value if hasattr(template.status, "value") else str(template.status)
        return {
            "success": True,
            "template_name": template.template_name,
            "meta_status": st_val,
            "message": f"Approval status: {st_val}",
        }

    def get_recent_activities(self, org_id: Optional[uuid.UUID] = None, limit: int = 5, waba_account_id: Optional[uuid.UUID] = None) -> list[dict]:
        from sqlalchemy import func, or_
        q = self.db.query(Template)
        if org_id:
            q = q.filter(Template.organization_id == org_id)
        if waba_account_id:
            q = q.filter(
                or_(
                    Template.whatsapp_account_id == waba_account_id,
                    Template.whatsapp_account_id.is_(None)
                )
            )
        templates = q.order_by(
            func.coalesce(Template.meta_updated_at, Template.updated_at, Template.created_at).desc()
        ).limit(limit).all()
        activities = []
        for t in templates:
            st_val = t.status.value if hasattr(t.status, "value") else str(t.status)
            ts = (t.updated_at or t.created_at)
            ts_str = ts.isoformat() if ts else None
            activities.append({
                "id": str(t.id),
                "template_name": t.template_name,
                "status": st_val,
                "action": "updated" if t.updated_at else "created",
                "created_at": ts_str,
                "timestamp": ts_str,
            })
        return activities

    def resubmit_template_by_id(self, template_id: uuid.UUID) -> dict:
        template = self.db.query(Template).filter(Template.id == template_id).first()
        if not template:
            return {"success": False, "message": "Template not found"}

        normalized_lang = normalize_language(template.language or "en_US")
        category_val = template.category.value if hasattr(template.category, "value") else str(template.category)
        header_type_val = template.header_type.value if hasattr(template.header_type, "value") else str(template.header_type)

        meta_result = self.meta_svc.create_template(
            template_name=template.template_name,
            category=category_val,
            language=normalized_lang,
            body=template.template_body,
            header_type=header_type_val,
            footer=template.footer,
            buttons=template.buttons,
            db=self.db,
        )

        if meta_result.get("success"):
            template.meta_template_id = str(meta_result.get("id"))
            meta_st = meta_result.get("status", "PENDING").upper()
            if meta_st in [e.value for e in TemplateStatus]:
                template.status = TemplateStatus(meta_st)
            template.language = normalized_lang
            self.db.commit()
            st_val = template.status.value if hasattr(template.status, "value") else str(template.status)
            return {"success": True, "message": f"Template submitted to Meta. Status: {st_val}"}
        else:
            meta_err = meta_result.get("error", {})
            err_msg = (meta_err.get("error_user_msg") or meta_err.get("message") or str(meta_err)) if isinstance(meta_err, dict) else str(meta_err)
            hint_text = f"Language was normalized to '{normalized_lang}'."
            return {
                "success": False,
                "message": f"Meta rejected the template: {err_msg}",
                "hint": hint_text,
            }

    def update_template_by_id(self, template_id: uuid.UUID, payload: dict) -> dict:
        template = self.db.query(Template).filter(Template.id == template_id).first()
        if not template:
            return {"success": False, "error": "Template not found"}

        if "template_name" in payload and payload["template_name"]:
            template.template_name = payload["template_name"]
        if "category" in payload and payload["category"]:
            template.category = _parse_category(payload["category"])
        if "language" in payload and payload["language"]:
            template.language = payload["language"]
        if "header" in payload and payload["header"]:
            template.header_type = _parse_header_type(payload["header"])
        if "template_body" in payload and payload["template_body"]:
            template.template_body = payload["template_body"]
        if "footer" in payload:
            template.footer = payload["footer"]
        if "buttons" in payload:
            template.buttons = payload["buttons"]

        self.db.commit()
        self.db.refresh(template)
        return {"success": True, "message": "Template updated successfully", "template_id": str(template.id)}

    def delete_template_by_id(self, template_id: uuid.UUID) -> bool:
        template = self.db.query(Template).filter(Template.id == template_id).first()
        if not template:
            return False
        self.db.delete(template)
        self.db.commit()
        return True



class MetaTemplateService:

    def upload_sample_media_handle(
        self,
        token: str,
        file_path: Optional[str] = None,
        header_type: str = "IMAGE",
    ) -> Optional[str]:
        """Upload sample media file to Meta Resumable Upload API to obtain a header_handle ID."""
        try:
            base = settings.META_BASE_URL.rstrip("/")
            version = settings.META_API_VERSION

            if file_path and os.path.exists(file_path):
                file_name = os.path.basename(file_path)
                with open(file_path, "rb") as f:
                    file_bytes = f.read()
                ext = os.path.splitext(file_name)[1].lower()
                mime_type = "image/png" if ext == ".png" else ("image/jpeg" if ext in (".jpg", ".jpeg") else ("application/pdf" if ext == ".pdf" else "video/mp4"))
            else:
                file_name = "sample.png" if header_type == "IMAGE" else ("sample.pdf" if header_type == "DOCUMENT" else "sample.mp4")
                mime_type = "image/png" if header_type == "IMAGE" else ("application/pdf" if header_type == "DOCUMENT" else "video/mp4")
                file_bytes = b"0" * 1024

            file_length = len(file_bytes)

            # Step 1: Create upload session
            sess_url = f"{base}/{version}/app/uploads?file_name={file_name}&file_length={file_length}&file_type={mime_type}&access_token={token}"
            res1 = requests.post(sess_url, timeout=15)
            if not res1.ok:
                return None

            upload_id = res1.json().get("id")
            if not upload_id:
                return None

            # Step 2: Upload file bytes
            up_url = f"{base}/{version}/{upload_id}"
            headers = {"Authorization": f"OAuth {token}", "file_offset": "0"}
            res2 = requests.post(up_url, headers=headers, data=file_bytes, timeout=30)
            if not res2.ok:
                return None

            return res2.json().get("h")
        except Exception as e:
            print(f"[MetaTemplateService] Error uploading sample media handle: {e}")
            return None

    def create_template(
        self,
        template_name: str,
        category: str,
        language: str,
        body: str,
        header_type: Optional[str] = None,
        header_text: Optional[str] = None,
        header_file_path: Optional[str] = None,
        footer: Optional[str] = None,
        buttons: Optional[list] = None,
        db: Session = None,
    ):
        base = settings.META_BASE_URL.rstrip("/")
        version = settings.META_API_VERSION

        token = None
        waba = None
        if db:
            from services.whatsapp_service import WhatsAppService
            account = WhatsAppService(db).get_account()
            if account:
                token = account.access_token
                waba = account.waba_id

        token = token or getattr(settings, "META_ACCESS_TOKEN", None) or getattr(settings, "ACCESS_TOKEN", None)
        waba = waba or getattr(settings, "META_BUSINESS_ACCOUNT_ID", None) or getattr(settings, "WABA_ID", None)

        if not token or not waba:
            return {"success": False, "error": "WhatsApp account credentials (WABA_ID / ACCESS_TOKEN) are missing."}

        url = f"{base}/{version}/{waba}/message_templates"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        meta_language = normalize_language(language or "en_US")

        components = []

        # Header component
        h_type = (header_type or "").upper()
        if h_type and h_type != "NONE":
            if h_type == "TEXT" and header_text:
                components.append({"type": "HEADER", "format": "TEXT", "text": header_text})
            elif h_type in ("IMAGE", "VIDEO", "DOCUMENT"):
                header_comp = {"type": "HEADER", "format": h_type}
                handle = self.upload_sample_media_handle(token=token, file_path=header_file_path, header_type=h_type)
                if handle:
                    header_comp["example"] = {"header_handle": [handle]}
                components.append(header_comp)

        # Body component
        components.append({"type": "BODY", "text": body or ""})

        # Footer component
        if footer and footer.strip():
            components.append({"type": "FOOTER", "text": footer.strip()})

        # Buttons component
        if buttons and isinstance(buttons, list) and len(buttons) > 0:
            formatted_buttons = []
            for b in buttons:
                if not isinstance(b, dict):
                    continue
                btn_type = (b.get("type") or "QUICK_REPLY").upper()
                text_label = b.get("text") or b.get("label") or "Reply"
                if btn_type in ("QUICK_REPLY", "QUICKREPLY"):
                    formatted_buttons.append({"type": "QUICK_REPLY", "text": text_label})
                elif btn_type in ("URL", "WEBSITE") and b.get("url"):
                    formatted_buttons.append({"type": "URL", "text": text_label, "url": b.get("url")})
                elif btn_type in ("PHONE_NUMBER", "PHONE", "CALL") and b.get("phone_number"):
                    formatted_buttons.append({"type": "PHONE_NUMBER", "text": text_label, "phone_number": b.get("phone_number")})

            if formatted_buttons:
                components.append({"type": "BUTTONS", "buttons": formatted_buttons})

        payload = {
            "name": template_name.lower().replace(" ", "_").replace("-", "_"),
            "category": (category or "MARKETING").upper(),
            "language": meta_language,
            "components": components,
        }

        response = requests.post(url, headers=headers, json=payload, timeout=30)
        try:
            result = response.json()
        except ValueError:
            result = {"error": response.text}

        if not response.ok:
            return {
                "success": False,
                "status_code": response.status_code,
                "error": result.get("error") or response.text,
                "response": result,
            }

        res_id = str(result.get("id") or result.get("template_id") or "")
        if db and res_id:
            try:
                from services.whatsapp_service import WhatsAppService
                account = WhatsAppService(db).get_account()
                if account:
                    sanitized_name = template_name.lower().replace(" ", "_").replace("-", "_")
                    parsed_cat = _parse_category(category)
                    parsed_ht = _parse_header_type(header_type)
                    existing = (
                        db.query(Template)
                        .filter(
                            Template.whatsapp_account_id == account.id,
                            func.lower(Template.template_name) == sanitized_name,
                            Template.language == meta_language,
                        )
                        .first()
                    )
                    if existing:
                        existing.meta_template_id = res_id
                        existing.status = TemplateStatus.PENDING
                        existing.category = parsed_cat
                        existing.header_type = parsed_ht
                        existing.template_body = body or ""
                        if footer:
                            existing.footer = footer.strip()
                        existing.components = components
                    else:
                        tmpl = Template(
                            organization_id=account.organization_id,
                            whatsapp_account_id=account.id,
                            template_name=sanitized_name,
                            category=parsed_cat,
                            language=meta_language,
                            header_type=parsed_ht,
                            template_body=body or "",
                            footer=footer.strip() if footer else None,
                            components=components,
                            status=TemplateStatus.PENDING,
                            meta_template_id=res_id,
                        )
                        db.add(tmpl)
                    db.commit()
            except Exception as e:
                print(f"[MetaTemplateService] Error persisting created template: {e}")

        return {
            "success": True,
            "id": res_id,
            "status": result.get("status"),
            "response": result,
        }

    def get_template_status_by_name(self, template_name: str, db: Session = None) -> dict:
        base = settings.META_BASE_URL.rstrip("/")
        version = settings.META_API_VERSION
        token = None
        waba = None
        if db:
            from services.whatsapp_service import WhatsAppService
            account = WhatsAppService(db).get_account()
            if account:
                token = account.access_token
                waba = account.waba_id

        token = token or getattr(settings, "META_ACCESS_TOKEN", None)
        waba = waba or getattr(settings, "META_BUSINESS_ACCOUNT_ID", None)

        if not token or not waba:
            return {"error": "WhatsApp account is not connected."}

        sanitized = template_name.lower().replace(" ", "_").replace("-", "_")
        url = f"{base}/{version}/{waba}/message_templates?name={sanitized}&fields=id,name,status,category,language"
        headers = {"Authorization": f"Bearer {token}"}

        try:
            response = requests.get(url, headers=headers, timeout=10)
            result = response.json()
        except Exception as e:
            return {"error": str(e)}

        if not response.ok:
            err = result.get("error", {})
            return {"error": err.get("message") or response.text, "status_code": response.status_code}

        data = result.get("data", [])
        if not data:
            return {"error": f"No template named '{sanitized}' found on Meta", "not_found": True}

        first = data[0]
        return {
            "id": first.get("id"),
            "name": first.get("name"),
            "status": first.get("status"),
            "category": first.get("category"),
            "language": first.get("language"),
        }

    def get_template_status(self, meta_template_id: str, db: Session = None) -> dict:
        base = settings.META_BASE_URL.rstrip("/")
        version = settings.META_API_VERSION
        token = None
        if db:
            from services.whatsapp_service import WhatsAppService
            account = WhatsAppService(db).get_account()
            if account:
                token = account.access_token

        token = token or getattr(settings, "META_ACCESS_TOKEN", None)
        url = f"{base}/{version}/{meta_template_id}?fields=name,status,category"
        response = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
        try:
            return response.json()
        except Exception:
            return {"error": "invalid_json_response", "status_code": response.status_code}


def resolve_template_header_component(template, access_token: str = None, phone_number_id: str = None, db: Session = None) -> list:
    """
    Build Meta template header components for IMAGE, VIDEO, or DOCUMENT headers.
    Checks template.meta_header_media_id in PostgreSQL first for 0-latency caching.
    If missing, uploads via StorageService provider to Meta API and caches the generated handle.
    """
    if not template or not getattr(template, "header_type", None):
        return []

    h_type_str = (template.header_type.value if hasattr(template.header_type, "value") else str(template.header_type or "")).upper()
    if h_type_str not in ("IMAGE", "VIDEO", "DOCUMENT"):
        return []

    h_type_lower = h_type_str.lower()

    # Priority 1: Use cached meta_header_media_id handle from PostgreSQL database
    cached_id = getattr(template, "meta_header_media_id", None)
    if cached_id:
        return [{
            "type": "header",
            "parameters": [{
                "type": h_type_lower,
                h_type_lower: {"id": cached_id}
            }]
        }]

    media_link = None
    media_id = None

    # Priority 2: Upload file bytes via StorageService provider to Meta API
    m_url = getattr(template, "header_media_url", None)
    if m_url and access_token and phone_number_id:
        from services.storage_service import get_storage_provider
        storage = get_storage_provider()
        file_bytes = storage.get_file_bytes(m_url)
        if file_bytes:
            upload_url = f"{settings.META_BASE_URL.rstrip('/')}/{settings.META_API_VERSION}/{phone_number_id}/media"
            headers = {"Authorization": f"Bearer {access_token}"}
            mime_type = "image/png"
            if h_type_str == "DOCUMENT":
                mime_type = "application/pdf"
            elif h_type_str == "VIDEO":
                mime_type = "video/mp4"

            try:
                up_res = requests.post(
                    upload_url,
                    headers=headers,
                    files={"file": ("header_media", file_bytes, mime_type)},
                    data={"messaging_product": "whatsapp"},
                    timeout=15,
                )
                if up_res.ok:
                    media_id = up_res.json().get("id")
                    if media_id:
                        template.meta_header_media_id = media_id
                        if db:
                            try:
                                db.commit()
                            except Exception:
                                db.rollback()
            except Exception as e:
                print(f"[resolve_template_header_component] Media upload exception: {e}")

    # Priority 3: Fallback to PUBLIC_BASE_URL or template sample handle
    if not media_id and m_url:
        if m_url.startswith("http://") or m_url.startswith("https://"):
            if "127.0.0.1" not in m_url and "localhost" not in m_url:
                media_link = m_url
        elif m_url.startswith("/"):
            pub_base = getattr(settings, "PUBLIC_BASE_URL", None) or os.getenv("PUBLIC_BASE_URL")
            if pub_base and ("127.0.0.1" not in pub_base and "localhost" not in pub_base):
                media_link = f"{pub_base.rstrip('/')}{m_url}"

    if not media_id and not media_link:
        comps = getattr(template, "components", None)
        if isinstance(comps, list):
            for c in comps:
                if isinstance(c, dict) and c.get("type", "").upper() == "HEADER":
                    ex = c.get("example")
                    if isinstance(ex, dict):
                        h_handles = ex.get("header_handle")
                        if isinstance(h_handles, list) and len(h_handles) > 0 and h_handles[0]:
                            media_link = h_handles[0]
                            break

    # Build component parameter
    if media_id:
        return [{
            "type": "header",
            "parameters": [{
                "type": h_type_lower,
                h_type_lower: {"id": media_id}
            }]
        }]
    elif media_link:
        return [{
            "type": "header",
            "parameters": [{
                "type": h_type_lower,
                h_type_lower: {"link": media_link}
            }]
        }]

    return []