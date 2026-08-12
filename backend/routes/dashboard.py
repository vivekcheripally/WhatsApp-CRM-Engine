from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from routes.deps import get_current_user
from schemas.dashboard import UnifiedDashboardResponse
from services.dashboard_service import DashboardService

router = APIRouter()


@router.get("", response_model=UnifiedDashboardResponse)
def get_unified_dashboard(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consolidated endpoint returning all dashboard metrics in 1 HTTP call."""
    svc = DashboardService(db)
    return svc.get_unified_dashboard(user.get("org_id"))


@router.get("/overview")
def get_overview(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    svc = DashboardService(db)
    return svc.get_unified_dashboard(user.get("org_id")).summary.model_dump()


@router.get("/summary")
def dashboard_summary(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    svc = DashboardService(db)
    return svc.get_unified_dashboard(user.get("org_id")).summary.model_dump()


@router.get("/campaigns")
def get_campaigns(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    svc = DashboardService(db)
    return [item.model_dump() for item in svc.get_unified_dashboard(user.get("org_id")).campaigns]


@router.get("/template-overview")
def template_overview(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    svc = DashboardService(db)
    return svc.get_unified_dashboard(user.get("org_id")).templates.model_dump()