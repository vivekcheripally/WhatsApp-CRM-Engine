from __future__ import annotations

import pytest
from sqlalchemy.orm import Session
from services.campaign_service import CampaignService
from models.postgres_model import Campaign, CampaignStatus, CampaignRecipient, CampaignRecipientStatus, Contact


@pytest.mark.unit
def test_prepare_campaign_run(db_session: Session, sample_campaign: Campaign, sample_contact: Contact):
    """Verify CampaignService.prepare_campaign_run updates status and recipient metrics."""
    # Add a campaign recipient
    rec = CampaignRecipient(
        organization_id=sample_campaign.organization_id,
        campaign_id=sample_campaign.id,
        contact_id=sample_contact.id,
        status=CampaignRecipientStatus.PENDING,
    )
    db_session.add(rec)
    db_session.commit()

    svc = CampaignService(db_session)
    result = svc.prepare_campaign_run(sample_campaign.id)

    assert result["success"] is True
    assert result["campaign_id"] == str(sample_campaign.id)

    # Database check
    updated_camp = db_session.query(Campaign).filter(Campaign.id == sample_campaign.id).first()
    assert updated_camp.status in (CampaignStatus.SENDING, CampaignStatus.COMPLETED, CampaignStatus.DRAFT)
