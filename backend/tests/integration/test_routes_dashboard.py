from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
def test_dashboard_metrics_endpoint(client: TestClient):
    """Integration test for GET /api/dashboard metrics API endpoint."""
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()

    assert "summary" in data
    assert "templates" in data
    assert "campaigns" in data

    summary = data["summary"]
    assert "total_contacts" in summary
    assert "total_templates" in summary
    assert "total_campaigns" in summary
    assert "total_messages" in summary
