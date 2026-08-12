from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from models.postgres_model import (
    Contact,
    ReactionUserType,
    WhatsAppMessage,
    WhatsAppMessageReaction,
)
from schemas.whatsapp_inbox import MessageReactionsResponse, ReactionGrouped
from services.message_service import MessageRepository


class ReactionService:
    def __init__(self, db: Session):
        self.db = db
        self.msg_repo = MessageRepository(db)

    def _resolve_contact_id(
        self, msg: WhatsAppMessage, customer_phone: str
    ) -> Optional[uuid.UUID]:
        """Derive contact_id by looking up Contact in the same org by phone."""
        try:
            contact = (
                self.db.query(Contact)
                .filter(
                    Contact.organization_id == msg.organization_id,
                    Contact.phone_number == customer_phone,
                )
                .first()
            )
            return contact.id if contact else None
        except Exception:
            return None

    def handle_reaction_by_message_id(
        self,
        message_id: uuid.UUID,
        emoji: str,
        customer_phone: str,
    ) -> Optional[WhatsAppMessageReaction]:
        msg = self.msg_repo.get_by_id(message_id)
        if not msg:
            return None

        contact_id = self._resolve_contact_id(msg, customer_phone)
        q = self.db.query(WhatsAppMessageReaction).filter(
            WhatsAppMessageReaction.message_id == msg.id
        )
        if contact_id:
            q = q.filter(WhatsAppMessageReaction.contact_id == contact_id)
        existing = q.first()

        # If emoji is empty or same as existing, remove reaction (toggle off)
        if not emoji or (existing and existing.emoji == emoji):
            if existing:
                self.db.delete(existing)
                self.db.commit()
            return None

        if existing:
            existing.emoji = emoji
            self.db.commit()
            self.db.refresh(existing)
            return existing
        else:
            reaction = WhatsAppMessageReaction(
                message_id=msg.id,
                contact_id=contact_id,
                emoji=emoji,
                reacted_by=ReactionUserType.CUSTOMER if customer_phone != "agent" else ReactionUserType.AGENT,
            )
            self.db.add(reaction)
            self.db.commit()
            self.db.refresh(reaction)
            return reaction

    def add_reaction_dto(self, message_id: uuid.UUID, emoji: str, customer_phone: str) -> dict:
        reaction = self.handle_reaction_by_message_id(message_id, emoji, customer_phone)
        if reaction is None:
            return {"id": None, "message_id": str(message_id), "emoji": "", "customer_phone": customer_phone, "created_at": None}

        contact = getattr(reaction, "contact", None)
        return {
            "id": str(reaction.id),
            "message_id": str(reaction.message_id),
            "emoji": reaction.emoji,
            "customer_phone": contact.phone_number if contact else None,
            "created_at": reaction.created_at.isoformat() + "Z" if reaction.created_at else None,
        }

    def handle_reaction(
        self,
        meta_message_id: str,
        emoji: str,
        customer_phone: str,
    ) -> Optional[WhatsAppMessageReaction]:
        msg = (
            self.db.query(WhatsAppMessage)
            .filter(WhatsAppMessage.meta_message_id == meta_message_id)
            .first()
        )
        if not msg:
            return None
        return self.handle_reaction_by_message_id(msg.id, emoji, customer_phone)

    def get_reactions_for_message(
        self, message_id: uuid.UUID
    ) -> MessageReactionsResponse:
        reactions = (
            self.db.query(WhatsAppMessageReaction)
            .options(joinedload(WhatsAppMessageReaction.contact))
            .filter(WhatsAppMessageReaction.message_id == message_id)
            .all()
        )
        grouped: dict[str, list[str]] = defaultdict(list)

        for r in reactions:
            phone = (r.contact.phone_number if r.contact else None) or ""
            grouped[r.emoji].append(phone)

        result = [
            ReactionGrouped(emoji=emoji, count=len(phones), customers=phones)
            for emoji, phones in grouped.items()
        ]
        return MessageReactionsResponse(
            message_id=str(message_id),
            reactions=result,
            total=len(reactions),
        )
