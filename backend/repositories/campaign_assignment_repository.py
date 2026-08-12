import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from models.postgres_model import CampaignAgentAssignment

class CampaignAssignmentRepository:
    """Encapsulates SQL queries for Campaign-Agent assignments."""

    @staticmethod
    def get_assigned_campaign_ids(db: Session, user_id: uuid.UUID, organization_id: uuid.UUID) -> List[uuid.UUID]:
        """Returns list of campaign IDs assigned to the given Sales Agent."""
        assignments = (
            db.query(CampaignAgentAssignment.campaign_id)
            .filter(
                CampaignAgentAssignment.organization_id == organization_id,
                CampaignAgentAssignment.user_id == user_id,
                CampaignAgentAssignment.is_deleted == False,
            )
            .all()
        )
        return [row[0] for row in assignments]

    @staticmethod
    def get_assigned_agent_ids(db: Session, campaign_id: uuid.UUID, organization_id: uuid.UUID) -> List[uuid.UUID]:
        """Returns list of user IDs assigned to the specified campaign."""
        assignments = (
            db.query(CampaignAgentAssignment.user_id)
            .filter(
                CampaignAgentAssignment.organization_id == organization_id,
                CampaignAgentAssignment.campaign_id == campaign_id,
                CampaignAgentAssignment.is_deleted == False,
            )
            .all()
        )
        return [row[0] for row in assignments]

    @staticmethod
    def assign_campaign_agents(
        db: Session,
        organization_id: uuid.UUID,
        campaign_id: uuid.UUID,
        user_ids: List[uuid.UUID],
        actor_id: Optional[uuid.UUID] = None,
    ) -> List[CampaignAgentAssignment]:
        """Transactional update mapping a campaign to multiple Sales Agents."""
        existing = (
            db.query(CampaignAgentAssignment)
            .filter(
                CampaignAgentAssignment.organization_id == organization_id,
                CampaignAgentAssignment.campaign_id == campaign_id,
            )
            .all()
        )

        existing_map = {a.user_id: a for a in existing}
        target_set = set(user_ids)

        active = []
        for uid, assignment in existing_map.items():
            if uid not in target_set:
                assignment.is_deleted = True
            else:
                assignment.is_deleted = False
                active.append(assignment)

        for uid in target_set:
            if uid not in existing_map:
                new_assignment = CampaignAgentAssignment(
                    organization_id=organization_id,
                    campaign_id=campaign_id,
                    user_id=uid,
                    assigned_by=actor_id,
                    is_deleted=False,
                )
                db.add(new_assignment)
                active.append(new_assignment)

        db.commit()
        return active
