from __future__ import annotations

import uuid
from typing import Optional

from core.exceptions import ResourceNotFoundError, ValidationError
from sqlalchemy.orm import Session

from models.postgres_model import (
    MatchType,
    ResponseType,
    WhatsAppAutoReply,
    WhatsAppScheduledMessage,
)


class AutoReplyService:
    """
    Unified auto-reply and chatbot rule service backed by WhatsAppAutoReply.
    Replaces the old AutoReplyService + ChatbotRuleService split.
    """

    def __init__(self, db: Session):
        self.db = db

    def list(
        self,
        organization_id: Optional[uuid.UUID] = None,
        whatsapp_account_id: Optional[uuid.UUID] = None,
    ) -> list[WhatsAppAutoReply]:
        q = self.db.query(WhatsAppAutoReply).order_by(
            WhatsAppAutoReply.priority.desc(),
            WhatsAppAutoReply.created_at,
        )
        if organization_id:
            q = q.filter(WhatsAppAutoReply.organization_id == organization_id)
        if whatsapp_account_id:
            q = q.filter(WhatsAppAutoReply.whatsapp_account_id == whatsapp_account_id)
        return q.all()

    def serialize(self, i: WhatsAppAutoReply) -> dict:
        return {
            "id": str(i.id),
            "name": getattr(i, "rule_name", None) or i.trigger_keyword or "",
            "rule_name": getattr(i, "rule_name", None) or i.trigger_keyword or "",
            "trigger_keyword": i.trigger_keyword,
            "match_type": i.match_type.value if hasattr(i.match_type, "value") else str(i.match_type),
            "response_content": i.response_content,
            "message": i.response_content,
            "response_template": i.response_content,
            "priority": i.priority,
            "is_active": i.is_active,
            "active": i.is_active,
            "created_at": i.created_at.isoformat() + "Z" if i.created_at else None,
        }

    def list_auto_replies_dto(self, org_id: Optional[uuid.UUID] = None) -> dict:
        from services.whatsapp_service import WhatsAppService
        account = None
        try:
            account = WhatsAppService(self.db).get_active_account()
        except Exception:
            pass

        items = self.list(organization_id=org_id or (account.organization_id if account else None))
        return {"success": True, "auto_replies": [self.serialize(i) for i in items]}

    def create_auto_reply_dto(self, payload: any, org_id: Optional[uuid.UUID] = None) -> dict:
        from services.whatsapp_service import WhatsAppService
        account = None
        try:
            account = WhatsAppService(self.db).get_active_account()
        except Exception:
            pass

        keyword = getattr(payload, "trigger_keyword", None) or getattr(payload, "pattern", None) or getattr(payload, "name", None) or getattr(payload, "rule_name", None) or ""
        msg_text = getattr(payload, "response_content", None) or getattr(payload, "message", None) or getattr(payload, "response_template", None) or ""
        active_flag = getattr(payload, "is_active", None) if getattr(payload, "is_active", None) is not None else (getattr(payload, "active", None) if getattr(payload, "active", None) is not None else True)

        match_type_str = getattr(payload, "match_type", "EXACT") or "EXACT"
        try:
            mt = MatchType(match_type_str.upper())
        except ValueError:
            mt = MatchType.EXACT

        item = self.create(
            organization_id=org_id or (account.organization_id if account else None),
            whatsapp_account_id=account.id if account else None,
            rule_name=getattr(payload, "rule_name", None) or getattr(payload, "name", None) or keyword,
            trigger_keyword=keyword,
            match_type=mt,
            response_type=ResponseType.TEXT,
            response_content=msg_text,
            is_active=active_flag,
            priority=getattr(payload, "priority", 0) or 0,
        )
        return {"success": True, "auto_reply": self.serialize(item)}

    def update_auto_reply_dto(self, item_id: uuid.UUID, payload: any) -> dict:
        data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else (payload if isinstance(payload, dict) else {})
        item = self.db.query(WhatsAppAutoReply).filter(WhatsAppAutoReply.id == item_id).first()
        if not item:
            raise ResourceNotFoundError("Not found")

        if "trigger_keyword" in data or "pattern" in data or "name" in data:
            item.trigger_keyword = data.get("trigger_keyword") or data.get("pattern") or data.get("name")
        if "response_content" in data or "message" in data or "response_template" in data:
            item.response_content = (
                data.get("response_content") or data.get("message") or data.get("response_template")
            )
        if "is_active" in data:
            item.is_active = data["is_active"]
        elif "active" in data:
            item.is_active = data["active"]
        if "match_type" in data and data["match_type"]:
            try:
                item.match_type = MatchType(data["match_type"].upper())
            except ValueError:
                pass
        if "priority" in data and data["priority"] is not None:
            item.priority = int(data["priority"])

        self.db.commit()
        self.db.refresh(item)
        return {"success": True, "auto_reply": self.serialize(item)}

    def delete_auto_reply_dto(self, item_id: uuid.UUID) -> dict:
        item = self.db.query(WhatsAppAutoReply).filter(WhatsAppAutoReply.id == item_id).first()
        if not item:
            raise ResourceNotFoundError("Not found")
        self.delete(item_id)
        return {"success": True}

    def serialize_rule(self, r: WhatsAppAutoReply) -> dict:
        rule_name_str = getattr(r, "rule_name", None) or r.trigger_keyword or ""
        return {
            "id": str(r.id),
            "keyword": r.trigger_keyword or rule_name_str,
            "name": rule_name_str,
            "rule_name": rule_name_str,
            "response": r.response_content or "",
            "is_active": r.is_active,
            "active": r.is_active,
            "match_exact": (r.match_type == MatchType.EXACT),
            "match_type": r.match_type.value if hasattr(r.match_type, "value") else str(r.match_type),
            "priority": r.priority,
            "created_at": r.created_at.isoformat() + "Z" if r.created_at else None,
            "updated_at": r.updated_at.isoformat() + "Z" if r.updated_at else None,
        }

    def list_chatbot_rules_dto(self, org_id: Optional[uuid.UUID] = None) -> list[dict]:
        from services.whatsapp_service import WhatsAppService
        account = None
        try:
            account = WhatsAppService(self.db).get_active_account()
        except Exception:
            pass
        items = self.list(organization_id=org_id or (account.organization_id if account else None))
        return [self.serialize_rule(r) for r in items]

    def create_chatbot_rule_dto(self, payload: any, org_id: Optional[uuid.UUID] = None) -> dict:
        from services.whatsapp_service import WhatsAppService
        account = None
        try:
            account = WhatsAppService(self.db).get_active_account()
        except Exception:
            pass

        data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else (payload if isinstance(payload, dict) else {})
        keyword = (data.get("trigger_keyword") or data.get("keyword") or data.get("name") or data.get("rule_name") or "").strip()
        resp_text = (data.get("response_content") or data.get("response") or data.get("message") or "").strip()
        if not keyword or not resp_text:
            raise ValidationError("keyword and response are required")

        match_exact = bool(data.get("match_exact", False))
        match_type_val = data.get("match_type")
        if match_type_val:
            try:
                match_type = MatchType(match_type_val.upper())
            except ValueError:
                match_type = MatchType.EXACT if match_exact else MatchType.CONTAINS
        else:
            match_type = MatchType.EXACT if match_exact else MatchType.CONTAINS

        rule = self.create(
            organization_id=org_id or (account.organization_id if account else None),
            whatsapp_account_id=account.id if account else None,
            rule_name=keyword,
            trigger_keyword=keyword,
            match_type=match_type,
            response_type=ResponseType.TEXT,
            response_content=resp_text,
            is_active=bool(data.get("is_active", data.get("active", True))),
            priority=int(data.get("priority", 0) or 0),
        )
        return self.serialize_rule(rule)

    def update_chatbot_rule_dto(self, rule_id: uuid.UUID, payload: any) -> dict:
        data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else (payload if isinstance(payload, dict) else {})
        rule = self.db.query(WhatsAppAutoReply).filter(WhatsAppAutoReply.id == rule_id).first()
        if not rule:
            raise ResourceNotFoundError("Rule not found")

        if "trigger_keyword" in data or "keyword" in data or "name" in data:
            kw = (data.get("trigger_keyword") or data.get("keyword") or data.get("name") or "").strip()
            rule.trigger_keyword = kw
            rule.rule_name = kw
        if "response_content" in data or "response" in data or "message" in data:
            rule.response_content = data.get("response_content") or data.get("response") or data.get("message")
        if "is_active" in data:
            rule.is_active = data["is_active"]
        elif "active" in data:
            rule.is_active = data["active"]
        if "match_exact" in data:
            rule.match_type = MatchType.EXACT if data["match_exact"] else MatchType.CONTAINS
        elif "match_type" in data and data["match_type"]:
            try:
                rule.match_type = MatchType(data["match_type"].upper())
            except ValueError:
                pass
        if "priority" in data and data["priority"] is not None:
            rule.priority = int(data["priority"])

        self.db.commit()
        self.db.refresh(rule)
        return self.serialize_rule(rule)

    def delete_chatbot_rule_dto(self, rule_id: uuid.UUID) -> dict:
        rule = self.db.query(WhatsAppAutoReply).filter(WhatsAppAutoReply.id == rule_id).first()
        if not rule:
            raise ResourceNotFoundError("Rule not found")
        self.delete(rule_id)
        return {"success": True, "id": str(rule_id)}

    def get_active(
        self,
        organization_id: Optional[uuid.UUID] = None,
        whatsapp_account_id: Optional[uuid.UUID] = None,
    ) -> list[WhatsAppAutoReply]:
        q = (
            self.db.query(WhatsAppAutoReply)
            .filter(WhatsAppAutoReply.is_active == True)
            .order_by(WhatsAppAutoReply.priority.desc())
        )
        if organization_id:
            q = q.filter(WhatsAppAutoReply.organization_id == organization_id)
        if whatsapp_account_id:
            q = q.filter(WhatsAppAutoReply.whatsapp_account_id == whatsapp_account_id)
        return q.all()

    def match(
        self,
        text: str,
        organization_id: Optional[uuid.UUID] = None,
        whatsapp_account_id: Optional[uuid.UUID] = None,
    ) -> Optional[WhatsAppAutoReply]:
        """Return first active rule that matches the incoming text."""
        rules = self.get_active(organization_id, whatsapp_account_id)
        lower = text.lower().strip()
        for rule in rules:
            kw = (rule.trigger_keyword or "").lower().strip()
            if not kw:
                continue
            match_type = rule.match_type
            if match_type == MatchType.EXACT:
                if lower == kw:
                    return rule
            elif match_type == MatchType.CONTAINS:
                if kw in lower:
                    return rule
            elif match_type == MatchType.STARTS_WITH:
                if lower.startswith(kw):
                    return rule
            elif match_type == MatchType.REGEX:
                import re
                try:
                    if re.search(kw, lower):
                        return rule
                except re.error:
                    pass
        return None

    def create(self, **kwargs) -> WhatsAppAutoReply:
        obj = WhatsAppAutoReply(**kwargs)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, obj_id: uuid.UUID, **kwargs) -> Optional[WhatsAppAutoReply]:
        obj = (
            self.db.query(WhatsAppAutoReply)
            .filter(WhatsAppAutoReply.id == obj_id)
            .first()
        )
        if obj:
            for k, v in kwargs.items():
                setattr(obj, k, v)
            self.db.commit()
            self.db.refresh(obj)
        return obj

    def delete(self, obj_id: uuid.UUID) -> None:
        obj = (
            self.db.query(WhatsAppAutoReply)
            .filter(WhatsAppAutoReply.id == obj_id)
            .first()
        )
        if obj:
            self.db.delete(obj)
            self.db.commit()
