from celery import Celery
from core.config import settings

celery_app = Celery(
    "fastsales_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    imports=["services.tasks"],
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    beat_schedule={
        "process-scheduled-campaigns-every-10s": {
            "task": "services.tasks.process_scheduled_campaigns_task",
            "schedule": 10.0,
        },
        "process-due-messages-every-30s": {
            "task": "services.tasks.process_due_messages_task",
            "schedule": 30.0,
        },
    },
)
