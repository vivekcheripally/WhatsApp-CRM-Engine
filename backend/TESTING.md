# 🧪 Automated Testing Framework Documentation

## 🚀 Overview

This backend codebase utilizes a production-grade automated testing framework built with **pytest**, **SQLAlchemy (SQLite in-memory test harness)**, **FastAPI TestClient**, **httpx**, and **pytest-cov**.

The framework isolates database transactions per test, mocks external HTTP services (Meta Graph API, Redis), and provides modular fixtures for entity seeding.

---

## 📁 Test Directory Structure

```
backend/
├── pytest.ini                 # Pytest configuration & markers
├── .coveragerc                # Coverage reporting configuration
├── TESTING.md                 # Testing framework documentation
└── tests/
    ├── conftest.py            # Master fixtures (DB engine, TestClient, mock Meta API, entity seeds)
    ├── factories/
    │   └── factories.py       # Dynamic test entity generator (TestDataFactory)
    ├── unit/                  # Service & business logic unit tests
    │   ├── test_message_service.py
    │   ├── test_conversation_service.py
    │   └── test_campaign_service.py
    ├── integration/           # HTTP API Router & database integration tests
    │   ├── test_routes_conversations.py
    │   └── test_routes_dashboard.py
    ├── smoke/                 # Fast health & route mount sanity checks
    │   └── test_smoke_health.py
    └── e2e/                   # Full end-to-end customer journey tests
        └── test_e2e_customer_journey.py
```

---

## 🏃 Running Tests

### 1. Run Complete Test Suite
```powershell
py -m pytest tests/
```

### 2. Run Specific Test Category
- **Unit Tests Only:**
  ```powershell
  py -m pytest -m unit
  ```
- **Integration Tests Only:**
  ```powershell
  py -m pytest -m integration
  ```
- **Smoke Tests Only:**
  ```powershell
  py -m pytest -m smoke
  ```
- **End-to-End Journey Tests Only:**
  ```powershell
  py -m pytest -m e2e
  ```

### 3. Generate Code Coverage Report
```powershell
py -m pytest --cov=. tests/
```

---

## 🛠️ Writing New Tests

### Reusable Fixtures (`conftest.py`)
- `db_session`: Isolated DB session that automatically rolls back after each test run.
- `client`: `FastAPI.testclient.TestClient` connected to the in-memory test database.
- `sample_org`: Seeded `Organization` instance.
- `sample_wa_account`: Seeded `WhatsAppAccount` instance.
- `sample_contact`: Seeded `Contact` instance.
- `sample_template`: Seeded `Template` instance (with header media & template body text).
- `sample_conversation`: Seeded `WhatsAppConversation` instance.
- `sample_message`: Seeded `WhatsAppMessage` instance.
- `sample_campaign`: Seeded `Campaign` instance.

### Example Unit Test Pattern
```python
import pytest
from sqlalchemy.orm import Session
from services.message_service import MessageService

@pytest.mark.unit
def test_my_service_method(db_session: Session, sample_message):
    svc = MessageService(db_session)
    result = svc.serialize_message(sample_message)
    assert result["id"] == str(sample_message.id)
```
