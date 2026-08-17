from __future__ import annotations

import uuid
import pytest
from sqlalchemy.orm import Session
from models.postgres_model import Organization, OrganizationStatus, User, UserRole, UserStatus
from schemas.super_admin import OnboardOrganizationRequest
from schemas.auth import ChangePasswordRequest
from services.super_admin_service import SuperAdminService
from services.auth_service import AuthService


@pytest.mark.unit
def test_onboard_and_approve_organization_credentials(db_session: Session):
    """Verify onboarding an organization and approving it generates credentials with must_change_password=True."""
    super_admin = SuperAdminService(db_session)
    
    # 1. Onboard Organization
    slug = f"acme-{uuid.uuid4().hex[:6]}"
    payload = OnboardOrganizationRequest(
        name="Acme Corporation",
        slug=slug,
        contact_name="Alice Admin",
        contact_email=f"alice.{slug}@example.com",
        plan_name="PRO",
    )
    onboard_res = super_admin.onboard_organization(payload)
    assert onboard_res["success"] is True
    assert onboard_res["status"] == "PENDING_APPROVAL"
    org_id = uuid.UUID(onboard_res["organization_id"])

    # 2. Approve Organization
    approve_res = super_admin.approve_organization(org_id)
    assert approve_res["success"] is True
    assert "initial_password" in approve_res
    temp_pw = approve_res["initial_password"]
    assert len(temp_pw) >= 10

    # 3. Verify user created in DB with must_change_password = True
    user = db_session.query(User).filter(User.organization_id == org_id).first()
    assert user is not None
    assert user.role == UserRole.ORG_ADMIN
    assert user.must_change_password is True

    # 4. User logs in with temporary credentials
    auth_svc = AuthService(db_session)
    login_res = auth_svc.authenticate_user(email=user.email, password=temp_pw)
    assert login_res["user"]["must_change_password"] is True

    # 5. User changes password to permanent password
    new_pw = "NewSecurePassword2026!"
    change_res = auth_svc.change_password(
        user_id=user.id,
        old_password=temp_pw,
        new_password=new_pw,
        confirm_password=new_pw,
    )
    assert change_res["message"] == "Password changed successfully"

    # 6. Verify must_change_password is now False
    db_session.refresh(user)
    assert user.must_change_password is False

    # 7. User can authenticate with new password
    login_res_new = auth_svc.authenticate_user(email=user.email, password=new_pw)
    assert login_res_new["user"]["must_change_password"] is False
