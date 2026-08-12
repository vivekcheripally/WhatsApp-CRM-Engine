from __future__ import annotations

import pytest
from sqlalchemy.orm import Session
from services.reaction_service import ReactionService
from models.postgres_model import WhatsAppMessage, ReactionUserType


@pytest.mark.unit
def test_reaction_service_instantiation(db_session: Session):
    """Verify ReactionService instantiates cleanly without NameError."""
    svc = ReactionService(db_session)
    assert svc.db is db_session


@pytest.mark.unit
def test_toggle_reaction_add_and_remove(db_session: Session, sample_message: WhatsAppMessage):
    """Verify handle_reaction_by_message_id adds and toggles emoji reactions."""
    svc = ReactionService(db_session)

    # 1. Add reaction
    r1 = svc.handle_reaction_by_message_id(sample_message.id, emoji="👍", customer_phone="agent")
    assert r1 is not None
    assert r1.emoji == "👍"

    # 2. Fetch reactions
    reactions_resp = svc.get_reactions_for_message(sample_message.id)
    assert reactions_resp.total == 1

    # 3. Remove reaction (toggle same emoji)
    r2 = svc.handle_reaction_by_message_id(sample_message.id, emoji="👍", customer_phone="agent")
    assert r2 is None

    # 4. Fetch reactions (now 0)
    reactions_resp_after = svc.get_reactions_for_message(sample_message.id)
    assert reactions_resp_after.total == 0
