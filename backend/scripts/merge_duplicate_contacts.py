import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import SessionLocal
from models.postgres_model import Contact, WhatsAppConversation, WhatsAppMessage, CampaignRecipient
from services.conversation_service import normalize_e164


def merge_duplicates():
    db = SessionLocal()
    try:
        contacts = db.query(Contact).all()
        print(f"[Cleanup] Found {len(contacts)} total contacts in DB")

        # Group contacts by normalized E.164 phone
        phone_map = {}
        for c in contacts:
            norm = normalize_e164(c.phone_number)
            if norm not in phone_map:
                phone_map[norm] = []
            phone_map[norm].append(c)

        for norm_phone, group in phone_map.items():
            # Pick master contact (prioritize real names over phone numbers)
            master = sorted(
                group,
                key=lambda x: (
                    1 if (x.name and x.name != norm_phone and not x.name.startswith("91") and x.name != x.phone_number) else 0,
                    1 if (x.attributes and x.attributes.get("email")) else 0,
                    x.created_at or 0
                ),
                reverse=True
            )[0]

            duplicates = [c for c in group if c.id != master.id]

            if duplicates:
                print(f"[Cleanup] Merging {len(duplicates)} duplicates for phone: {norm_phone}")

                # Find or create master conversation
                master_conv = (
                    db.query(WhatsAppConversation)
                    .filter(WhatsAppConversation.contact_id == master.id)
                    .first()
                )

                for dup in duplicates:
                    print(f"  - Merging duplicate Contact {dup.id} ('{dup.name}') -> Master {master.id} ('{master.name}')")

                    # Merge attributes
                    if dup.attributes:
                        master_attrs = dict(master.attributes or {})
                        for k, v in dup.attributes.items():
                            if k not in master_attrs and v:
                                master_attrs[k] = v
                        master.attributes = master_attrs

                    dup_convs = db.query(WhatsAppConversation).filter(
                        WhatsAppConversation.contact_id == dup.id
                    ).all()

                    for dup_conv in dup_convs:
                        if master_conv:
                            # Re-link messages from dup_conv to master_conv
                            db.query(WhatsAppMessage).filter(
                                WhatsAppMessage.conversation_id == dup_conv.id
                            ).update({
                                "conversation_id": master_conv.id,
                                "contact_id": master.id
                            }, synchronize_session=False)
                            db.delete(dup_conv)
                        else:
                            # If master had no conversation, transfer dup_conv to master
                            dup_conv.contact_id = master.id
                            master_conv = dup_conv

                    # Re-link remaining Messages directly tied to dup contact
                    db.query(WhatsAppMessage).filter(
                        WhatsAppMessage.contact_id == dup.id
                    ).update({"contact_id": master.id}, synchronize_session=False)

                    # Re-link CampaignRecipients
                    db.query(CampaignRecipient).filter(
                        CampaignRecipient.contact_id == dup.id
                    ).update({"contact_id": master.id}, synchronize_session=False)

                    # Delete duplicate contact
                    db.delete(dup)

                db.flush()

            # Update master phone number to normalized format
            master.phone_number = norm_phone

        db.commit()
        remaining = db.query(Contact).all()
        print(f"\n[Cleanup] Complete! Remaining unique contacts: {len(remaining)}")
        for c in remaining:
            print(f"  - {c.name} ({c.phone_number})")

    except Exception as e:
        db.rollback()
        print(f"[Cleanup Error] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    merge_duplicates()
