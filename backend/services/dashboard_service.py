from __future__ import annotations

import uuid
from typing import Optional, Dict, Any
from sqlalchemy import func
from sqlalchemy.orm import Session


from models.postgres_model import (
    Campaign,
    CampaignRecipient,
    CampaignRecipientStatus,
    Contact,
    MessageStatus,
    SenderType,
    Template,
    TemplateStatus,
    WhatsAppAccount,
    WhatsAppAccountStatus,
    WhatsAppMessage,
)
from schemas.dashboard import (
    CampaignSummaryItem,
    DashboardSummarySchema,
    TemplateOverviewSchema,
    UnifiedDashboardResponse,
)


class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def _get_active_organization_id(self) -> Optional[uuid.UUID]:
        account = (
            self.db.query(WhatsAppAccount)
            .filter(WhatsAppAccount.status == WhatsAppAccountStatus.ACTIVE)
            .first()
            or self.db.query(WhatsAppAccount).first()
        )
        return account.organization_id if account else None

    def get_unified_dashboard(self, org_id: Optional[uuid.UUID] = None) -> UnifiedDashboardResponse:
        """
        Consolidate metrics into 4 optimized SQL aggregation queries,
        eliminating the 20+ query N+1 loop.
        """
        if not org_id:
            org_id = self._get_active_organization_id()

        # 1. Total Contacts count
        q_contacts = self.db.query(func.count(Contact.id))
        if org_id:
            q_contacts = q_contacts.filter(Contact.organization_id == org_id)
        total_contacts = q_contacts.scalar() or 0

        # 2. Template Status Breakdown (1 grouped query instead of 4)
        q_templates = self.db.query(Template.status, func.count(Template.id))
        if org_id:
            q_templates = q_templates.filter(Template.organization_id == org_id)
        template_counts = dict(q_templates.group_by(Template.status).all())

        approved = template_counts.get(TemplateStatus.APPROVED, 0)
        pending = template_counts.get(TemplateStatus.PENDING, 0)
        rejected = template_counts.get(TemplateStatus.REJECTED, 0)
        disabled = template_counts.get(TemplateStatus.DISABLED, 0)
        total_templates = sum(template_counts.values())

        # 3. Message Status Breakdown (1 grouped query instead of 4)
        q_msgs = self.db.query(WhatsAppMessage.status, func.count(WhatsAppMessage.id)).filter(
            WhatsAppMessage.sender_type == SenderType.AGENT
        )
        if org_id:
            q_msgs = q_msgs.filter(WhatsAppMessage.organization_id == org_id)
        msg_counts = dict(q_msgs.group_by(WhatsAppMessage.status).all())

        sent = msg_counts.get(MessageStatus.SENT, 0)
        delivered = msg_counts.get(MessageStatus.DELIVERED, 0)
        read = msg_counts.get(MessageStatus.READ, 0)
        failed = msg_counts.get(MessageStatus.FAILED, 0)
        total_messages = sent + delivered + read + failed

        # 4. Recent Campaigns with Recipient Counts (2 simple queries: 1 for top 10 campaigns, 1 batch query for recipient stats)
        total_campaigns_query = self.db.query(func.count(Campaign.id))
        if org_id:
            total_campaigns_query = total_campaigns_query.filter(Campaign.organization_id == org_id)
        total_campaigns = total_campaigns_query.scalar() or 0

        q_camp = self.db.query(Campaign)
        if org_id:
            q_camp = q_camp.filter(Campaign.organization_id == org_id)
        recent_campaigns = q_camp.order_by(Campaign.created_at.desc()).limit(10).all()

        campaign_items = []
        if recent_campaigns:
            camp_ids = [c.id for c in recent_campaigns]
            recipient_stats = (
                self.db.query(
                    CampaignRecipient.campaign_id,
                    CampaignRecipient.status,
                    func.count(CampaignRecipient.id),
                )
                .filter(CampaignRecipient.campaign_id.in_(camp_ids))
                .group_by(CampaignRecipient.campaign_id, CampaignRecipient.status)
                .all()
            )

            # Map stats by campaign_id
            stats_map: dict[uuid.UUID, dict[str, int]] = {c_id: {"total": 0, "delivered": 0} for c_id in camp_ids}
            for c_id, r_status, count in recipient_stats:
                if c_id in stats_map:
                    stats_map[c_id]["total"] += count
                    if r_status == CampaignRecipientStatus.DELIVERED:
                        stats_map[c_id]["delivered"] += count

            for c in recent_campaigns:
                status_str = c.status.value if hasattr(c.status, "value") else str(c.status) if c.status else "DRAFT"
                s = stats_map.get(c.id, {"total": 0, "delivered": 0})
                campaign_items.append(
                    CampaignSummaryItem(
                        id=str(c.id),
                        name=c.campaign_name or "Unnamed Campaign",
                        status=status_str,
                        total=s["total"],
                        delivered=s["delivered"],
                        contact_count=s["total"],
                    )
                )

        return UnifiedDashboardResponse(
            summary=DashboardSummarySchema(
                total_contacts=total_contacts,
                total_templates=total_templates,
                total_campaigns=total_campaigns,
                total_messages=total_messages,
                sent=sent,
                delivered=delivered,
                read=read,
                failed=failed,
            ),
            templates=TemplateOverviewSchema(
                approved=approved,
                pending=pending,
                rejected=rejected,
                disabled=disabled,
            ),
            campaigns=campaign_items,
        )

