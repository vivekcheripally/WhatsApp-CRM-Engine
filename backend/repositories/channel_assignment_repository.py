import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from models.postgres_model import UserWhatsAppAccountAssignment, WhatsAppAccountStatus

class ChannelAssignmentRepository:
    """Encapsulates all SQL query operations for User WABA Channel Assignments."""

    @staticmethod
    def get_assigned_channel_ids(db: Session, user_id: uuid.UUID, organization_id: uuid.UUID) -> List[uuid.UUID]:
        """Returns list of active WhatsAppAccount IDs assigned to the specified Sales Agent."""
        assignments = (
            db.query(UserWhatsAppAccountAssignment.whatsapp_account_id)
            .filter(
                UserWhatsAppAccountAssignment.organization_id == organization_id,
                UserWhatsAppAccountAssignment.user_id == user_id,
                UserWhatsAppAccountAssignment.is_deleted == False,
            )
            .all()
        )
        return [row[0] for row in assignments]

    @staticmethod
    def assign_channels(
        db: Session,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        whatsapp_account_ids: List[uuid.UUID],
        actor_id: Optional[uuid.UUID] = None,
    ) -> List[UserWhatsAppAccountAssignment]:
        """
        Transactional update of channel assignments.
        Soft-deletes existing assignments not in whatsapp_account_ids, and creates new ones.
        """
        # Soft-delete removed assignments, reactivate selected
        existing = (
            db.query(UserWhatsAppAccountAssignment)
            .filter(
                UserWhatsAppAccountAssignment.organization_id == organization_id,
                UserWhatsAppAccountAssignment.user_id == user_id,
            )
            .all()
        )
        
        existing_account_ids = {a.whatsapp_account_id: a for a in existing}
        target_account_ids = set(whatsapp_account_ids)

        active_assignments = []
        for acct_id, assignment in existing_account_ids.items():
            if acct_id not in target_account_ids:
                assignment.is_deleted = True
                assignment.deleted_by = actor_id
            else:
                assignment.is_deleted = False
                assignment.updated_by = actor_id
                active_assignments.append(assignment)

        for acct_id in target_account_ids:
            if acct_id not in existing_account_ids:
                new_assignment = UserWhatsAppAccountAssignment(
                    organization_id=organization_id,
                    user_id=user_id,
                    whatsapp_account_id=acct_id,
                    created_by=actor_id,
                    updated_by=actor_id,
                    is_deleted=False,
                )
                db.add(new_assignment)
                active_assignments.append(new_assignment)

        db.commit()
        return active_assignments

    @staticmethod
    def has_channel_access(db: Session, user_id: uuid.UUID, whatsapp_account_id: uuid.UUID, organization_id: uuid.UUID) -> bool:
        """Returns True if the user has assignment access to the given WABA account."""
        count = (
            db.query(UserWhatsAppAccountAssignment)
            .filter(
                UserWhatsAppAccountAssignment.organization_id == organization_id,
                UserWhatsAppAccountAssignment.user_id == user_id,
                UserWhatsAppAccountAssignment.whatsapp_account_id == whatsapp_account_id,
                UserWhatsAppAccountAssignment.is_deleted == False,
            )
            .count()
        )
        return count > 0
