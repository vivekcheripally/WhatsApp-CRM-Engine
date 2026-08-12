import uuid
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from core.security import hash_password
from core.exceptions import ValidationError, NotFoundError, PermissionError
from models.postgres_model import User, UserRole, UserStatus, WhatsAppAccount
from repositories.channel_assignment_repository import ChannelAssignmentRepository
from repositories.campaign_assignment_repository import CampaignAssignmentRepository

logger = logging.getLogger("agent_service")

class AgentService:
    def __init__(self, db: Session):
        self.db = db

    def list_agents(self, organization_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Returns all Sales Agents onboarded within the organization."""
        agents = (
            self.db.query(User)
            .filter(
                User.organization_id == organization_id,
                User.role == UserRole.SALES_AGENT,
            )
            .all()
        )
        from models.postgres_model import WhatsAppConversation, CampaignAgentAssignment
        result = []
        from repositories.campaign_assignment_repository import CampaignAssignmentRepository
        for agent in agents:
            channel_ids = ChannelAssignmentRepository.get_assigned_channel_ids(
                self.db, agent.id, organization_id
            )
            campaign_ids = CampaignAssignmentRepository.get_assigned_campaign_ids(
                self.db, agent.id, organization_id
            )
            open_chats_count = (
                self.db.query(WhatsAppConversation)
                .filter(
                    WhatsAppConversation.organization_id == organization_id,
                    WhatsAppConversation.assignee_id == agent.id,
                    WhatsAppConversation.is_deleted == False,
                )
                .count()
            )
            result.append({
                "id": str(agent.id),
                "email": agent.email,
                "full_name": agent.full_name,
                "role": agent.role.value if hasattr(agent.role, "value") else str(agent.role),
                "status": agent.status.value if hasattr(agent.status, "value") else str(agent.status),
                "assigned_channel_ids": [str(cid) for cid in channel_ids],
                "assigned_channels": [str(cid) for cid in channel_ids],
                "assigned_channels_count": len(channel_ids),
                "assigned_campaign_ids": [str(cid) for cid in campaign_ids],
                "assigned_campaigns": [str(cid) for cid in campaign_ids],
                "assigned_campaigns_count": len(campaign_ids),
                "open_chats_count": open_chats_count,
                "created_at": agent.created_at.isoformat() if agent.created_at else None,
            })
        return result

    def onboard_agent(
        self,
        organization_id: uuid.UUID,
        email: str,
        password: str,
        full_name: str,
        assigned_channel_ids: Optional[List[str]] = None,
        actor_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Onboards a new Sales Agent for the organization."""
        existing = self.db.query(User).filter(User.email == email).first()
        if existing:
            raise ValidationError(f"User with email '{email}' already exists.")

        agent = User(
            organization_id=organization_id,
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
            role=UserRole.SALES_AGENT,
            status=UserStatus.ACTIVE,
        )
        self.db.add(agent)
        self.db.commit()
        self.db.refresh(agent)

        assigned_channels = []
        if assigned_channel_ids:
            channel_uuids = [uuid.UUID(cid) for cid in assigned_channel_ids]
            ChannelAssignmentRepository.assign_channels(
                self.db, organization_id, agent.id, channel_uuids, actor_id
            )
            assigned_channels = assigned_channel_ids

        logger.info("Successfully onboarded Sales Agent: %s (%s)", email, agent.id)
        return {
            "id": str(agent.id),
            "email": agent.email,
            "full_name": agent.full_name,
            "role": UserRole.SALES_AGENT.value,
            "status": UserStatus.ACTIVE.value,
            "assigned_channel_ids": assigned_channels,
        }

    def assign_channels_to_agent(
        self,
        organization_id: uuid.UUID,
        agent_id: uuid.UUID,
        whatsapp_account_ids: List[str],
        actor_id: Optional[uuid.UUID] = None,
    ) -> List[str]:
        """Maps WABA accounts to a Sales Agent."""
        agent = self.db.query(User).filter(
            User.id == agent_id,
            User.organization_id == organization_id,
            User.role == UserRole.SALES_AGENT,
        ).first()
        if not agent:
            raise NotFoundError("Sales Agent not found in this organization.")

        account_uuids = [uuid.UUID(aid) for aid in whatsapp_account_ids]
        # Validate that accounts belong to org
        valid_count = (
            self.db.query(WhatsAppAccount)
            .filter(
                WhatsAppAccount.id.in_(account_uuids),
                WhatsAppAccount.organization_id == organization_id,
            )
            .count()
        )
        if valid_count != len(account_uuids):
            raise ValidationError("One or more WhatsApp Account IDs are invalid or belong to another organization.")

        ChannelAssignmentRepository.assign_channels(
            self.db, organization_id, agent.id, account_uuids, actor_id
        )
        logger.info("Updated channel assignments for agent %s: %s", agent_id, whatsapp_account_ids)
        return whatsapp_account_ids

    def assign_campaigns_to_agent(
        self,
        organization_id: uuid.UUID,
        campaign_id: uuid.UUID,
        user_ids: List[str],
        actor_id: Optional[uuid.UUID] = None,
    ) -> List[str]:
        """Maps a Campaign to one or more Sales Agents."""
        user_uuids = [uuid.UUID(uid) for uid in user_ids]
        CampaignAssignmentRepository.assign_campaign_agents(
            self.db, organization_id, campaign_id, user_uuids, actor_id
        )
        logger.info("Assigned campaign %s to agents: %s", campaign_id, user_ids)
        return user_ids

    def assign_agent_campaigns(
        self,
        organization_id: uuid.UUID,
        agent_id: uuid.UUID,
        campaign_ids: List[str],
        actor_id: Optional[uuid.UUID] = None,
    ) -> List[str]:
        """Maps a Sales Agent to a list of selected Campaign IDs."""
        from models.postgres_model import Campaign
        all_org_campaigns = (
            self.db.query(Campaign)
            .filter(Campaign.organization_id == organization_id, Campaign.is_deleted == False)
            .all()
        )
        target_cids = {uuid.UUID(cid) for cid in campaign_ids if cid}
        for c in all_org_campaigns:
            existing_agents = CampaignAssignmentRepository.get_assigned_agent_ids(
                self.db, c.id, organization_id
            )
            agent_set = set(existing_agents)
            if c.id in target_cids:
                agent_set.add(agent_id)
            else:
                agent_set.discard(agent_id)
            CampaignAssignmentRepository.assign_campaign_agents(
                self.db, organization_id, c.id, list(agent_set), actor_id
            )
        return campaign_ids

    def update_agent(
        self,
        organization_id: uuid.UUID,
        agent_id: uuid.UUID,
        full_name: Optional[str] = None,
        password: Optional[str] = None,
        status_val: Optional[str] = None,
    ) -> dict:
        agent = self.db.query(User).filter(
            User.id == agent_id,
            User.organization_id == organization_id,
            User.role == UserRole.SALES_AGENT,
        ).first()
        if not agent:
            raise ResourceNotFoundError("Sales Agent not found.")
        if full_name:
            agent.full_name = full_name
        if password:
            agent.hashed_password = hash_password(password)
        if status_val:
            agent.status = UserStatus(status_val.upper())
        self.db.commit()
        self.db.refresh(agent)
        return {
            "id": str(agent.id),
            "email": agent.email,
            "full_name": agent.full_name,
            "status": agent.status.value,
        }

    def toggle_agent_status(
        self,
        organization_id: uuid.UUID,
        agent_id: uuid.UUID,
    ) -> dict:
        agent = self.db.query(User).filter(
            User.id == agent_id,
            User.organization_id == organization_id,
            User.role == UserRole.SALES_AGENT,
        ).first()
        if not agent:
            raise ResourceNotFoundError("Sales Agent not found.")
        new_status = UserStatus.INACTIVE if agent.status == UserStatus.ACTIVE else UserStatus.ACTIVE
        agent.status = new_status
        self.db.commit()
        return {"success": True, "status": new_status.value}

    def delete_agent(
        self,
        organization_id: uuid.UUID,
        agent_id: uuid.UUID,
    ) -> dict:
        agent = self.db.query(User).filter(
            User.id == agent_id,
            User.organization_id == organization_id,
            User.role == UserRole.SALES_AGENT,
        ).first()
        if not agent:
            raise ResourceNotFoundError("Sales Agent not found.")

        # Clean up related assignments and conversations
        from models.postgres_model import UserWhatsAppAccountAssignment, CampaignAgentAssignment, WhatsAppConversation
        self.db.query(UserWhatsAppAccountAssignment).filter(
            UserWhatsAppAccountAssignment.user_id == agent_id
        ).delete(synchronize_session=False)

        self.db.query(CampaignAgentAssignment).filter(
            CampaignAgentAssignment.user_id == agent_id
        ).delete(synchronize_session=False)

        self.db.query(WhatsAppConversation).filter(
            WhatsAppConversation.assignee_id == agent_id
        ).update({"assignee_id": None}, synchronize_session=False)

        self.db.delete(agent)
        self.db.commit()
        return {"success": True, "message": "Agent deleted permanently from database"}
