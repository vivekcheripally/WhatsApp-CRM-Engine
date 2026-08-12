from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from models.postgres_model import WhatsAppConversation, WhatsAppMessage


@pytest.mark.integration
def test_list_conversations_endpoint(client: TestClient, sample_conversation: WhatsAppConversation, sample_message: WhatsAppMessage):
    """Integration test for GET /api/conversations endpoint."""
    response = client.get("/api/conversations")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) >= 1
    assert data["items"][0]["id"] == str(sample_conversation.id)


@pytest.mark.integration
def test_get_conversation_messages_endpoint(client: TestClient, sample_conversation: WhatsAppConversation, sample_message: WhatsAppMessage):
    """Integration test for GET /api/conversations/{id}/messages endpoint."""
    response = client.get(f"/api/conversations/{sample_conversation.id}/messages")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)
