import uuid
from core.celery_app import celery_app
from core.database import SessionLocal


@celery_app.task(name="services.tasks.execute_campaign_task", bind=True, max_retries=3, default_retry_delay=15)
def execute_campaign_task(self, campaign_id_str: str):
    """Celery worker task to execute WhatsApp campaign message sends in background."""
    db = SessionLocal()
    try:
        from services.campaign_service import CampaignService
        c_uuid = uuid.UUID(campaign_id_str)
        CampaignService(db).execute_campaign_background(c_uuid)
    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(name="services.tasks.process_scheduled_campaigns_task")
def process_scheduled_campaigns_task():
    """Celery Beat scheduled job: Polls for campaigns scheduled for execution."""
    db = SessionLocal()
    try:
        from services.campaign_service import process_scheduled_campaigns
        process_scheduled_campaigns()
    finally:
        db.close()


@celery_app.task(name="services.tasks.process_due_messages_task")
def process_due_messages_task():
    """Celery Beat scheduled job: Polls for scheduled inbox messages due for sending."""
    db = SessionLocal()
    try:
        from services.inbox_scheduler_service import process_due_messages
        process_due_messages()
    finally:
        db.close()
