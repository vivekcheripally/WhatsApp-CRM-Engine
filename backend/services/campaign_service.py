from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from core.database import SessionLocal
from models.postgres_model import (
    Campaign,
    CampaignRecipient,
    CampaignRecipientStatus,
    CampaignStatus,
    Contact,
    MessageDirection,
    MessageStatus,
    MessageType,
    SenderType,
    Template,
    WhatsAppAccount,
    WhatsAppAccountStatus,
    WhatsAppMediaFile,
    WhatsAppMessage,
)
from core.exceptions import ResourceNotFoundError
from services.meta_service import MetaWhatsAppService
from services.whatsapp_service import WhatsAppService


def _meta_service(
    db: Session,
    waba_account_id: Optional[uuid.UUID] = None,
    org_id: Optional[uuid.UUID] = None,
) -> MetaWhatsAppService:
    account = WhatsAppService(db, org_id=org_id).get_account(waba_account_id=waba_account_id)
    if not account or not account.access_token or not account.phone_number_id:
        raise ResourceNotFoundError("WhatsApp account is not configured. Go to Settings → Configuration to connect.")
    return MetaWhatsAppService(
        access_token=account.access_token,
        phone_number_id=account.phone_number_id,
    )


class CampaignService:
    def __init__(self, db: Session):
        self.db = db

    def create_campaign(
        self,
        data,
        org_id: Optional[uuid.UUID] = None,
        waba_account_id: Optional[uuid.UUID] = None,
    ) -> dict:
        if not data.template_id:
            return {"success": False, "message": "Please select a message template."}
        try:
            tmpl_uuid = uuid.UUID(data.template_id)
        except ValueError:
            return {"success": False, "message": "Invalid template selected."}

        template = self.db.query(Template).filter(Template.id == tmpl_uuid).first()
        if not template:
            return {"success": False, "message": "Template not found"}

        target_waba_id = waba_account_id or getattr(data, "waba_account_id", None)
        account = None
        if target_waba_id:
            try:
                acc_uuid = uuid.UUID(str(target_waba_id)) if not isinstance(target_waba_id, uuid.UUID) else target_waba_id
                account = self.db.query(WhatsAppAccount).filter(
                    WhatsAppAccount.id == acc_uuid,
                )
                if org_id:
                    account = account.filter(WhatsAppAccount.organization_id == org_id)
                account = account.first()
            except Exception:
                pass
        if not account:
            account = (
                self.db.query(WhatsAppAccount)
                .filter(WhatsAppAccount.organization_id == org_id, WhatsAppAccount.status == WhatsAppAccountStatus.ACTIVE)
                .order_by(WhatsAppAccount.is_default.desc())
                .first()
                or self.db.query(WhatsAppAccount).first()
            )
        if not account:
            return {"success": False, "message": "No active WhatsApp channel found"}

        sched_dt = None
        if data.schedule_time:
            try:
                sched_dt = datetime.fromisoformat(data.schedule_time.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                pass

        campaign_status = CampaignStatus.SCHEDULED if sched_dt else CampaignStatus.DRAFT

        valid_contact_ids = []
        for cid in (data.contact_ids or []):
            try:
                valid_contact_ids.append(uuid.UUID(str(cid)))
            except ValueError:
                pass

        campaign = Campaign(
            organization_id=org_id or account.organization_id,
            whatsapp_account_id=account.id,
            campaign_name=data.campaign_name,
            template_id=template.id,
            status=campaign_status,
            scheduled_at=sched_dt,
            total_recipients=len(valid_contact_ids),
        )
        self.db.add(campaign)
        self.db.flush()

        for cid_uuid in valid_contact_ids:
            recipient = CampaignRecipient(
                organization_id=org_id or account.organization_id,
                campaign_id=campaign.id,
                contact_id=cid_uuid,
                status=CampaignRecipientStatus.PENDING,
            )
            self.db.add(recipient)

        self.db.commit()
        self.db.refresh(campaign)

        st_val = campaign.status.value if hasattr(campaign.status, "value") else str(campaign.status)
        return {
            "success": True,
            "campaign_id": str(campaign.id),
            "message": "Campaign created successfully" if not sched_dt else "Campaign scheduled successfully",
            "campaign_status": st_val,
        }

    def get_campaign_details(self, c_uuid: uuid.UUID) -> dict:
        campaign = self.db.query(Campaign).filter(Campaign.id == c_uuid).first()
        if not campaign:
            return {"success": False, "error": "Campaign not found"}

        recipients = self.db.query(CampaignRecipient).filter(CampaignRecipient.campaign_id == c_uuid).all()
        contact_ids = [str(r.contact_id) for r in recipients if r.contact_id]

        st_val = campaign.status.value if hasattr(campaign.status, "value") else str(campaign.status)
        return {
            "success": True,
            "campaign": {
                "id": str(campaign.id),
                "campaign_name": campaign.campaign_name,
                "template_id": str(campaign.template_id) if campaign.template_id else None,
                "status": st_val,
                "contact_ids": contact_ids,
            },
        }

    def update_campaign(self, c_uuid: uuid.UUID, data) -> dict:
        campaign = self.db.query(Campaign).filter(Campaign.id == c_uuid).first()
        if not campaign:
            return {"success": False, "error": "Campaign not found"}

        if data.campaign_name is not None:
            campaign.campaign_name = data.campaign_name

        if data.template_id:
            try:
                tmpl_uuid = uuid.UUID(data.template_id)
                template = self.db.query(Template).filter(Template.id == tmpl_uuid).first()
                if not template:
                    return {"success": False, "error": "Template not found"}
                campaign.template_id = template.id
            except ValueError:
                return {"success": False, "error": "Invalid template ID"}

        if data.contact_ids is not None:
            self.db.query(CampaignRecipient).filter(CampaignRecipient.campaign_id == c_uuid).delete(synchronize_session=False)
            valid_cids = set()
            for cid in data.contact_ids:
                try:
                    valid_cids.add(uuid.UUID(str(cid)))
                except ValueError:
                    pass
            for cid_uuid in valid_cids:
                self.db.add(CampaignRecipient(
                    organization_id=campaign.organization_id,
                    campaign_id=c_uuid,
                    contact_id=cid_uuid,
                    status=CampaignRecipientStatus.PENDING,
                ))
            campaign.total_recipients = len(valid_cids)

        self.db.commit()
        self.db.refresh(campaign)

        st_val = campaign.status.value if hasattr(campaign.status, "value") else str(campaign.status)
        return {
            "success": True,
            "message": "Campaign updated successfully",
            "campaign": {
                "id": str(campaign.id),
                "campaign_name": campaign.campaign_name,
                "template_id": str(campaign.template_id) if campaign.template_id else None,
                "status": st_val,
            },
        }

    def list_campaigns(
        self,
        org_id: Optional[uuid.UUID] = None,
        waba_account_id: Optional[uuid.UUID] = None,
    ) -> dict:
        """Fetches all campaigns, recipient counts, and template names in ONE single SQL query."""
        q = (
            self.db.query(
                Campaign,
                func.count(CampaignRecipient.id).label("contact_count"),
                Template.template_name.label("template_name"),
            )
            .outerjoin(CampaignRecipient, CampaignRecipient.campaign_id == Campaign.id)
            .outerjoin(Template, Template.id == Campaign.template_id)
            .group_by(Campaign.id, Template.id)
        )

        if org_id:
            q = q.filter(Campaign.organization_id == org_id)
        if waba_account_id:
            q = q.filter(Campaign.whatsapp_account_id == waba_account_id)

        results = q.order_by(Campaign.created_at.desc()).all()

        campaigns_list = []
        for campaign, contact_count, template_name in results:
            st_val = campaign.status.value if hasattr(campaign.status, "value") else str(campaign.status)
            campaigns_list.append({
                "id": str(campaign.id),
                "campaign_name": campaign.campaign_name,
                "status": st_val,
                "contact_count": contact_count,
                "created_at": campaign.created_at.isoformat() + "Z" if campaign.created_at else None,
                "template_id": str(campaign.template_id) if campaign.template_id else None,
                "template_name": template_name or "Unknown",
            })

        return {"success": True, "campaigns": campaigns_list}

    def prepare_campaign_run(self, c_uuid: uuid.UUID) -> dict:
        """Validate campaign and query recipient metrics for execution."""
        campaign = self.db.query(Campaign).filter(Campaign.id == c_uuid).first()
        if not campaign:
            return {"success": False, "error": "Campaign not found"}

        rec_count = self.db.query(CampaignRecipient).filter(CampaignRecipient.campaign_id == c_uuid).count()
        return {
            "success": True,
            "campaign_id": str(c_uuid),
            "message": "Campaign execution started in background",
            "sent": rec_count,
            "recipient_count": rec_count,
            "failed": 0,
        }

    def get_campaign_by_id(self, c_uuid: uuid.UUID) -> dict:
        campaign = self.db.query(Campaign).filter(Campaign.id == c_uuid).first()
        if not campaign:
            return {"success": False, "message": "Campaign not found"}

        st_val = campaign.status.value if hasattr(campaign.status, "value") else str(campaign.status)
        return {
            "id": str(campaign.id),
            "campaign_name": campaign.campaign_name,
            "status": st_val,
            "created_at": campaign.created_at.isoformat() + "Z" if campaign.created_at else None,
        }

    def get_campaign_analytics(self, c_uuid: uuid.UUID) -> dict:
        campaign = self.db.query(Campaign).filter(Campaign.id == c_uuid).first()
        if not campaign:
            return {"success": False, "message": "Campaign not found"}

        recipients = self.db.query(CampaignRecipient).filter(CampaignRecipient.campaign_id == c_uuid).all()
        total_recipients = len(recipients)

        def _st(r):
            return r.status.value if hasattr(r.status, "value") else str(r.status)

        sent = len([r for r in recipients if _st(r) == "SENT"])
        delivered = len([r for r in recipients if _st(r) == "DELIVERED"])
        read = len([r for r in recipients if _st(r) == "READ"])
        failed = len([r for r in recipients if _st(r) == "FAILED"])

        return {
            "campaign_id": str(campaign.id),
            "campaign_name": campaign.campaign_name,
            "contact_count": total_recipients,
            "total_recipients": total_recipients,
            "sent": sent,
            "delivered": delivered,
            "read": read,
            "failed": failed,
        }

    def get_campaign_recipients(self, c_uuid: uuid.UUID) -> dict:
        campaign = self.db.query(Campaign).filter(Campaign.id == c_uuid).first()
        if not campaign:
            return {"success": False, "message": "Campaign not found"}

        template = self.db.query(Template).filter(Template.id == campaign.template_id).first() if campaign.template_id else None
        recipients = (
            self.db.query(CampaignRecipient)
            .options(joinedload(CampaignRecipient.contact))
            .filter(CampaignRecipient.campaign_id == c_uuid)
            .all()
        )

        def _st(r):
            return r.status.value if hasattr(r.status, "value") else str(r.status)

        rows = []
        for r in recipients:
            contact = r.contact
            st_val = (_st(r) or "PENDING").lower()
            rows.append({
                "contact_id": str(r.contact_id) if r.contact_id else None,
                "contact_name": contact.name if contact else None,
                "phone_number": contact.phone_number if contact else None,
                "message_id": str(r.message_id) if r.message_id else None,
                "status": st_val,
                "sent_at": r.sent_at.isoformat() + "Z" if r.sent_at else None,
            })

        statuses = [row["status"] for row in rows]
        summary = {
            "total": len(rows),
            "sent": statuses.count("sent"),
            "delivered": statuses.count("delivered"),
            "read": statuses.count("read"),
            "failed": statuses.count("failed"),
            "pending": statuses.count("pending"),
        }

        c_st = campaign.status.value if hasattr(campaign.status, "value") else str(campaign.status)
        return {
            "success": True,
            "campaign_id": str(campaign.id),
            "campaign_name": campaign.campaign_name,
            "campaign_status": c_st,
            "template_name": template.template_name if template else None,
            "created_at": campaign.created_at.isoformat() + "Z" if campaign.created_at else None,
            "summary": summary,
            "recipients": rows,
        }

    def delete_campaign(self, c_uuid: uuid.UUID) -> bool:
        campaign = self.db.query(Campaign).filter(Campaign.id == c_uuid).first()
        if not campaign:
            return False
        self.db.query(CampaignRecipient).filter(CampaignRecipient.campaign_id == c_uuid).delete()
        self.db.delete(campaign)
        self.db.commit()
        return True

    def execute_campaign_background(self, c_uuid: uuid.UUID) -> None:
        """
        Production Background Campaign Worker.
        - Uses gevent.pool.Pool(20) for bounded high-speed parallel dispatching.
        - Employs self-healing auto-renewal if Meta media handles expire (code 131051).
        - Executes single bulk database commits to prevent connection pool overflow.
        """
        import gevent
        from gevent.pool import Pool
        from services.template_service import resolve_template_header_component
        from services.conversation_service import ConversationService

        campaign = self.db.query(Campaign).filter(Campaign.id == c_uuid).first()
        if not campaign or not campaign.template_id:
            return

        template = self.db.query(Template).filter(Template.id == campaign.template_id).first()
        if not template:
            return

        template_name = (template.template_name or "").lower().replace(" ", "_").replace("-", "_")
        language_code = template.language or "en_US"

        recipients = (
            self.db.query(CampaignRecipient)
            .options(joinedload(CampaignRecipient.contact))
            .filter(CampaignRecipient.campaign_id == c_uuid)
            .all()
        )
        if not recipients:
            return

        try:
            meta = _meta_service(self.db, waba_account_id=campaign.whatsapp_account_id, org_id=campaign.organization_id)
        except Exception:
            return

        cached_components = resolve_template_header_component(
            template,
            access_token=meta.access_token,
            phone_number_id=meta.phone_number_id,
            db=self.db,
        )

        header_media_id = None
        header_media_link = None
        header_type_enum = MessageType.TEXT
        if template and template.header_type:
            h_type_str = (template.header_type.value if hasattr(template.header_type, "value") else str(template.header_type)).upper()
            if h_type_str == "IMAGE":
                header_type_enum = MessageType.IMAGE
            elif h_type_str == "VIDEO":
                header_type_enum = MessageType.VIDEO
            elif h_type_str == "DOCUMENT":
                header_type_enum = MessageType.DOCUMENT

        tmpl_body_text = None
        if template and template.components and isinstance(template.components, list):
            for comp in template.components:
                if isinstance(comp, dict) and comp.get("type", "").upper() == "BODY":
                    tmpl_body_text = comp.get("text")
                    break

        if cached_components and isinstance(cached_components, list) and len(cached_components) > 0:
            params = cached_components[0].get("parameters", [])
            if params and len(params) > 0:
                p_type = params[0].get("type", "")
                p_obj = params[0].get(p_type, {})
                header_media_id = p_obj.get("id")
                header_media_link = p_obj.get("link")

        sent_count = 0
        failed_count = 0
        conv_svc = ConversationService(self.db)
        messages_to_create = []
        media_files_to_create = []

        def send_single_recipient(rec):
            nonlocal sent_count, failed_count
            contact = rec.contact
            if not contact or not contact.phone_number:
                failed_count += 1
                rec.status = CampaignRecipientStatus.FAILED
                rec.error_message = "No phone number"
                return

            phone = contact.phone_number

            result = meta.send_template_message(
                to=phone,
                template_name=template_name,
                language_code=language_code,
                components=cached_components if cached_components else None,
            )

            # Self-Healing: If Meta returns Error 131051 (Expired Handle), reset cache & retry
            if "error" in result and isinstance(result.get("error"), dict) and result.get("error", {}).get("code") == 131051:
                template.meta_header_media_id = None
                fresh_components = resolve_template_header_component(
                    template, access_token=meta.access_token, phone_number_id=meta.phone_number_id, db=self.db
                )
                result = meta.send_template_message(
                    to=phone,
                    template_name=template_name,
                    language_code=language_code,
                    components=fresh_components if fresh_components else None,
                )

            meta_msg_id = None
            status_enum = CampaignRecipientStatus.FAILED
            if result.get("messages"):
                meta_msg_id = result["messages"][0].get("id")
                status_enum = CampaignRecipientStatus.SENT
                sent_count += 1
            else:
                failed_count += 1

            rec.status = status_enum
            rec.sent_at = datetime.utcnow() if status_enum == CampaignRecipientStatus.SENT else None
            if not meta_msg_id and "error" in result:
                rec.error_message = str(result.get("error"))

            if meta_msg_id and campaign.whatsapp_account_id:
                try:
                    conv, _ = conv_svc.get_or_create(
                        customer_phone=phone,
                        whatsapp_account_id=campaign.whatsapp_account_id,
                        customer_name=contact.name if contact else None,
                        organization_id=campaign.organization_id,
                    )
                    msg_id = uuid.uuid4()
                    msg = WhatsAppMessage(
                        id=msg_id,
                        organization_id=campaign.organization_id,
                        whatsapp_account_id=campaign.whatsapp_account_id,
                        conversation_id=conv.id,
                        contact_id=contact.id if contact else None,
                        campaign_id=campaign.id,
                        template_id=campaign.template_id,
                        direction=MessageDirection.OUTBOUND,
                        sender_type=SenderType.AGENT,
                        message_type=header_type_enum if header_type_enum != MessageType.TEXT else MessageType.TEMPLATE,
                        content=tmpl_body_text if tmpl_body_text else f"Template: {template.template_name}",
                        status=MessageStatus.SENT,
                        meta_message_id=meta_msg_id,
                    )
                    messages_to_create.append(msg)

                    if header_media_id or header_media_link:
                        temp_m_id = uuid.uuid4()
                        stream_url = header_media_link or f"/api/messages/media/{temp_m_id}/stream"
                        m_file = WhatsAppMediaFile(
                            id=temp_m_id,
                            message_id=msg_id,
                            meta_media_id=header_media_id,
                            file_name=template.template_name,
                            file_url=stream_url,
                            media_type=header_type_enum,
                        )
                        media_files_to_create.append(m_file)

                    rec.message_id = msg_id
                except Exception as ex:
                    print(f"[execute_campaign_background] Single recipient prep exception: {ex}")

        # Dispatch 20 parallel greenlet calls at a time
        pool = Pool(20)
        pool.map(send_single_recipient, recipients)

        # Single Bulk DB Write
        if messages_to_create:
            try:
                self.db.bulk_save_objects(messages_to_create)
                if media_files_to_create:
                    self.db.bulk_save_objects(media_files_to_create)
            except Exception as ex:
                print(f"[execute_campaign_background] Bulk save exception: {ex}")

        campaign.status = CampaignStatus.COMPLETED
        campaign.sent_count = sent_count
        campaign.failed_count = failed_count
        self.db.commit()


def process_scheduled_campaigns():
    print("Scheduler Tick:", datetime.now())
    db = SessionLocal()

    try:
        campaigns = db.query(Campaign).filter(
            Campaign.status == CampaignStatus.SCHEDULED
        ).all()

        now_utc = datetime.now(timezone.utc)
        for campaign in campaigns:
            if campaign.scheduled_at:
                sched_at = (
                    campaign.scheduled_at
                    if campaign.scheduled_at.tzinfo is not None
                    else campaign.scheduled_at.replace(tzinfo=timezone.utc)
                )
                if sched_at <= now_utc:
                    print(f"Running Campaign: {campaign.campaign_name}")

                    try:
                        wa = (
                            db.query(WhatsAppAccount)
                            .filter(WhatsAppAccount.organization_id == campaign.organization_id)
                            .filter(WhatsAppAccount.status == WhatsAppAccountStatus.ACTIVE)
                            .first()
                            or db.query(WhatsAppAccount)
                            .filter(WhatsAppAccount.organization_id == campaign.organization_id)
                            .first()
                        )
                        if not wa:
                            wa = db.query(WhatsAppAccount).filter(
                                WhatsAppAccount.status == WhatsAppAccountStatus.ACTIVE
                            ).first()
                        if not wa or not wa.access_token:
                            raise ResourceNotFoundError("No active WhatsApp account")

                        meta_svc = MetaWhatsAppService(
                            access_token=wa.access_token,
                            phone_number_id=wa.phone_number_id,
                        )
                    except ResourceNotFoundError as e:
                        print(f"Skipping campaign {campaign.id}: {e}")
                        continue

                    template = None
                    if campaign.template_id:
                        template = db.query(Template).filter(Template.id == campaign.template_id).first()

                    recipients = (
                        db.query(CampaignRecipient)
                        .filter(
                            CampaignRecipient.campaign_id == campaign.id,
                            CampaignRecipient.status == CampaignRecipientStatus.PENDING,
                        )
                        .all()
                    )

                    for rec in recipients:
                        contact = None
                        if rec.contact_id:
                            contact = db.query(Contact).filter(Contact.id == rec.contact_id).first()

                        if not contact:
                            rec.status = CampaignRecipientStatus.FAILED
                            rec.error_message = "Contact not found"
                            campaign.failed_count = (campaign.failed_count or 0) + 1
                            continue

                        phone = contact.phone_number
                        if template and template.template_name:
                            result = meta_svc.send_template_message(phone, template.template_name)
                        else:
                            message_text = (template.template_body if template else "") or ""
                            message_text = message_text.replace("{{name}}", contact.name or "")
                            result = meta_svc.send_text_message(phone, message_text)

                        meta_id = None
                        if result.get("messages"):
                            meta_id = result["messages"][0].get("id")

                        if result.get("success") is False or (not meta_id and "error" in result):
                            rec.status = CampaignRecipientStatus.FAILED
                            rec.error_message = str(result.get("error", "Unknown error"))
                            campaign.failed_count = (campaign.failed_count or 0) + 1
                        else:
                            rec.status = CampaignRecipientStatus.SENT
                            rec.sent_at = datetime.now(timezone.utc)
                            campaign.sent_count = (campaign.sent_count or 0) + 1

                    campaign.status = CampaignStatus.COMPLETED

        db.commit()

    except Exception as e:
        print("Scheduler Error:", str(e))
        db.rollback()

    finally:
        db.close()
