import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_db
from routes.deps import get_current_user, get_active_organization_id, require_org_admin, require_permission
from models.postgres_model import Permission
from schemas.agent import AgentOnboardRequest, AgentAssignChannelsRequest, AgentAssignCampaignsRequest, AgentUpdateRequest
from services.agent_service import AgentService

router = APIRouter(prefix="/api/users/agents", tags=["Agent Management"])


@router.get("", dependencies=[Depends(require_org_admin)])
def list_agents(
    org_id: uuid.UUID = Depends(get_active_organization_id),
    db: Session = Depends(get_db),
):
    """List all Sales Agents in the Organization (Org Admin only)."""
    return AgentService(db).list_agents(org_id)


@router.post("", dependencies=[Depends(require_org_admin)])
def onboard_agent(
    payload: AgentOnboardRequest,
    current_user: dict = Depends(get_current_user),
    org_id: uuid.UUID = Depends(get_active_organization_id),
    db: Session = Depends(get_db),
):
    """Onboard a new Sales Agent account (Org Admin only)."""
    try:
        actor_id = uuid.UUID(current_user["id"])
        return AgentService(db).onboard_agent(
            organization_id=org_id,
            email=payload.email,
            password=payload.password,
            full_name=payload.full_name,
            assigned_channel_ids=payload.assigned_channel_ids,
            actor_id=actor_id,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{agent_id}/channel-assignments", dependencies=[Depends(require_org_admin)])
def assign_channels(
    agent_id: uuid.UUID,
    payload: AgentAssignChannelsRequest,
    current_user: dict = Depends(get_current_user),
    org_id: uuid.UUID = Depends(get_active_organization_id),
    db: Session = Depends(get_db),
):
    """RESTful endpoint mapping WABA channels to a Sales Agent (Org Admin only)."""
    try:
        actor_id = uuid.UUID(current_user["id"])
        ids = payload.whatsapp_account_ids or payload.channel_ids or []
        assigned_ids = AgentService(db).assign_channels_to_agent(
            organization_id=org_id,
            agent_id=agent_id,
            whatsapp_account_ids=ids,
            actor_id=actor_id,
        )
        return {"success": True, "agent_id": str(agent_id), "assigned_channel_ids": assigned_ids}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{agent_id}/campaign-assignments", dependencies=[Depends(require_org_admin)])
def assign_campaigns(
    agent_id: uuid.UUID,
    payload: AgentAssignCampaignsRequest,
    current_user: dict = Depends(get_current_user),
    org_id: uuid.UUID = Depends(get_active_organization_id),
    db: Session = Depends(get_db),
):
    """RESTful endpoint assigning campaigns to Sales Agents (Org Admin only)."""
    try:
        actor_id = uuid.UUID(current_user["id"])
        target_agent_id = str(agent_id)
        c_ids = payload.campaign_ids or ([payload.campaign_id] if payload.campaign_id else [])
        assigned_ids = AgentService(db).assign_agent_campaigns(
            organization_id=org_id,
            agent_id=agent_id,
            campaign_ids=c_ids,
            actor_id=actor_id,
        )
        return {"success": True, "agent_id": target_agent_id, "assigned_campaign_ids": assigned_ids}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{agent_id}", dependencies=[Depends(require_org_admin)])
def update_agent(
    agent_id: uuid.UUID,
    payload: AgentUpdateRequest,
    org_id: uuid.UUID = Depends(get_active_organization_id),
    db: Session = Depends(get_db),
):
    """Edit Sales Agent name, password, or status."""
    try:
        return AgentService(db).update_agent(
            organization_id=org_id,
            agent_id=agent_id,
            full_name=payload.full_name,
            password=payload.password,
            status_val=payload.status,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{agent_id}/toggle-status", dependencies=[Depends(require_org_admin)])
def toggle_agent_status(
    agent_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_active_organization_id),
    db: Session = Depends(get_db),
):
    """Toggle Sales Agent status between ACTIVE and INACTIVE."""
    try:
        return AgentService(db).toggle_agent_status(
            organization_id=org_id,
            agent_id=agent_id,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{agent_id}", dependencies=[Depends(require_org_admin)])
def delete_agent(
    agent_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_active_organization_id),
    db: Session = Depends(get_db),
):
    """Permanently delete Sales Agent."""
    try:
        return AgentService(db).delete_agent(
            organization_id=org_id,
            agent_id=agent_id,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
