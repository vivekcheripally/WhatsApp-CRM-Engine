from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.smoke
def test_app_startup_health(client: TestClient):
    """Sanity check: verify application starts up and dashboard endpoint returns 200 OK."""
    response = client.get("/api/dashboard")
    assert response.status_code == 200


@pytest.mark.smoke
def test_conversations_list_health(client: TestClient):
    """Sanity check: verify conversations endpoint is mounted and accessible."""
    response = client.get("/api/conversations")
    assert response.status_code == 200
    assert "items" in response.json()


@pytest.mark.smoke
def test_templates_health(client: TestClient):
    """Sanity check: verify templates endpoint is mounted and accessible."""
    response = client.get("/api/templates")
    assert response.status_code == 200
