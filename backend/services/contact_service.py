from __future__ import annotations

import io
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from core.exceptions import DuplicateResourceError, ValidationError, PermissionError, NotFoundError
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from models.postgres_model import Contact, ContactStatus, Organization, UserRole


def _normalize_phone(phone: str) -> str:
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    if not cleaned.startswith("+"):
        cleaned = "+" + cleaned
    return cleaned


def _serialize_contact(c: Contact) -> Dict[str, Any]:
    tag_val = None
    if isinstance(c.attributes, dict):
        tag_val = c.attributes.get("tag") or c.attributes.get("tags")
        if isinstance(tag_val, list):
            tag_val = ", ".join(tag_val)

    st_val = c.status.value if hasattr(c.status, "value") else str(c.status)

    owner_name = None
    owner_role_type = "O"
    target_user = c.owner or c.creator
    if target_user:
        owner_name = target_user.full_name or target_user.email
        r_val = target_user.role.value if hasattr(target_user.role, "value") else str(target_user.role)
        owner_role_type = "O" if r_val in ["ORG_ADMIN", "SYSTEM_ADMIN", "super_admin"] else "A"
    else:
        owner_name = "Org Admin"
        owner_role_type = "O"

    return {
        "id": str(c.id),
        "name": c.name or c.phone_number,
        "phone_number": c.phone_number,
        "phone": c.phone_number,          # compat alias
        "email": c.email,
        "tag": tag_val,
        "status": st_val,
        "source": c.source or "MANUAL",
        "owner_id": str(c.owner_id) if c.owner_id else None,
        "owner_name": owner_name,
        "owner_role_type": owner_role_type,
        "created_by": str(c.created_by) if c.created_by else None,
        "attributes": c.attributes or {},
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


class ContactService:

    def __init__(self, db: Session):
        self.db = db

    def list_contacts(
        self,
        q: Optional[str] = None,
        status_filter: Optional[str] = None,
        source_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        organization_id: Optional[uuid.UUID] = None,
        current_user: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[Dict[str, Any]], int, bool]:
        query = self.db.query(Contact).filter(Contact.is_deleted == False)

        if organization_id:
            query = query.filter(Contact.organization_id == organization_id)

        # Row-Level Security: Sales Agents see owned contacts or contacts created by them
        if current_user and current_user.get("role") == UserRole.SALES_AGENT.value:
            user_uuid = uuid.UUID(current_user["id"])
            query = query.filter(
                or_(
                    Contact.owner_id == user_uuid,
                    Contact.created_by == user_uuid,
                )
            )

        if status_filter and status_filter.upper() != "ALL":
            try:
                st = ContactStatus(status_filter.upper())
                query = query.filter(Contact.status == st)
            except ValueError:
                pass

        if source_filter and source_filter.upper() != "ALL":
            query = query.filter(func.upper(Contact.source) == source_filter.upper())

        if q and q.strip():
            term = f"%{q.strip()}%"
            query = query.filter(
                or_(
                    Contact.name.ilike(term),
                    Contact.phone_number.ilike(term),
                    Contact.email.ilike(term),
                )
            )

        total = query.count()
        offset = max(0, (page - 1) * page_size)
        contacts = (
            query.order_by(Contact.created_at.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        has_more = (offset + len(contacts)) < total
        return [_serialize_contact(c) for c in contacts], total, has_more

    def get_by_id(self, contact_id: uuid.UUID, current_user: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        query = self.db.query(Contact).filter(Contact.id == contact_id, Contact.is_deleted == False)
        c = query.first()
        if not c:
            return None

        # Row-Level Ownership Check for Sales Agents
        if current_user and current_user.get("role") == UserRole.SALES_AGENT.value:
            user_uuid = uuid.UUID(current_user["id"])
            if c.owner_id != user_uuid and c.created_by != user_uuid:
                raise PermissionError("Access denied: You do not own this contact.")

        return _serialize_contact(c)

    def create_contact(
        self,
        name: str,
        phone_number: str,
        email: Optional[str] = None,
        tag: Optional[str] = None,
        status_str: Optional[str] = "ACTIVE",
        source_str: Optional[str] = "MANUAL",
        attributes: Optional[Dict[str, Any]] = None,
        organization_id: Optional[uuid.UUID] = None,
        actor_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        norm_phone = _normalize_phone(phone_number)

        # Check existing active contact
        existing = (
            self.db.query(Contact)
            .filter(
                Contact.organization_id == organization_id,
                Contact.phone_number == norm_phone,
                Contact.is_deleted == False,
            )
            .first()
        )
        if existing:
            raise DuplicateResourceError(
                f"Contact with phone {norm_phone} already exists."
            )

        st = ContactStatus.ACTIVE
        if status_str:
            try:
                st = ContactStatus(status_str.upper())
            except ValueError:
                pass

        attr = attributes.copy() if attributes else {}
        if tag:
            attr["tag"] = tag

        contact = Contact(
            organization_id=organization_id,
            name=name,
            phone_number=norm_phone,
            email=email,
            status=st,
            source=source_str or "MANUAL",
            attributes=attr,
            created_by=actor_id,
            owner_id=actor_id,
            is_deleted=False,
        )
        self.db.add(contact)
        self.db.commit()
        self.db.refresh(contact)
        return _serialize_contact(contact)

    def update_contact(
        self,
        contact_id: uuid.UUID,
        name: Optional[str] = None,
        phone_number: Optional[str] = None,
        email: Optional[str] = None,
        tag: Optional[str] = None,
        status_str: Optional[str] = None,
        source_str: Optional[str] = None,
        attributes: Optional[Dict[str, Any]] = None,
        current_user: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        c = self.db.query(Contact).filter(Contact.id == contact_id, Contact.is_deleted == False).first()
        if not c:
            return None

        # RLS Check
        if current_user and current_user.get("role") == UserRole.SALES_AGENT.value:
            user_uuid = uuid.UUID(current_user["id"])
            if c.owner_id != user_uuid and c.created_by != user_uuid:
                raise PermissionError("Access denied: You cannot edit unowned contacts.")

        if name is not None:
            c.name = name
        if phone_number is not None:
            c.phone_number = _normalize_phone(phone_number)
        if email is not None:
            c.email = email
        if status_str is not None:
            try:
                c.status = ContactStatus(status_str.upper())
            except ValueError:
                pass
        if source_str is not None:
            c.source = source_str

        if attributes is not None or tag is not None:
            attr = c.attributes.copy() if c.attributes else {}
            if attributes is not None:
                attr.update(attributes)
            if tag is not None:
                attr["tag"] = tag
            c.attributes = attr

        self.db.commit()
        self.db.refresh(c)
        return _serialize_contact(c)

    def delete_contact(self, contact_id: uuid.UUID, actor_id: Optional[uuid.UUID] = None) -> bool:
        """Soft delete contact."""
        c = self.db.query(Contact).filter(Contact.id == contact_id, Contact.is_deleted == False).first()
        if not c:
            return False
        c.is_deleted = True
        c.deleted_at = datetime.now(timezone.utc)
        c.deleted_by = actor_id
        self.db.commit()
        return True

    def assign_contacts(
        self,
        organization_id: uuid.UUID,
        contact_ids: List[uuid.UUID],
        new_owner_id: uuid.UUID,
    ) -> int:
        """Bulk assigns contacts to a Sales Agent."""
        updated = (
            self.db.query(Contact)
            .filter(
                Contact.organization_id == organization_id,
                Contact.id.in_(contact_ids),
                Contact.is_deleted == False,
            )
            .update({Contact.owner_id: new_owner_id}, synchronize_session=False)
        )
        self.db.commit()
        return updated

    def import_contacts_from_file(
        self,
        file_bytes: bytes,
        filename: str,
        organization_id: Optional[uuid.UUID] = None,
        actor_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        if not organization_id:
            org = self.db.query(Organization).first()
            if not org:
                org = Organization(name="Default Organization", slug="default")
                self.db.add(org)
                self.db.flush()
            organization_id = org.id

        fn = filename.lower()
        if fn.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes))
        elif fn.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            raise ValidationError(
                "Unsupported file format. Please upload CSV or Excel.",
            )

        df.columns = [str(col).strip().lower() for col in df.columns]

        phone_col = None
        for col in ("phone", "phone_number", "mobile", "whatsapp"):
            if col in df.columns:
                phone_col = col
                break

        if not phone_col:
            raise ValidationError(
                "Missing required 'phone' or 'phone_number' column in file.",
            )

        name_col = "name" if "name" in df.columns else None
        email_col = "email" if "email" in df.columns else None
        tag_col = "tag" if "tag" in df.columns else ("tags" if "tags" in df.columns else None)

        imported = 0
        skipped = 0

        for _, row in df.iterrows():
            raw_phone = str(row.get(phone_col, "")).strip()
            if not raw_phone or raw_phone.lower() in ("nan", "none"):
                skipped += 1
                continue

            try:
                norm_phone = _normalize_phone(raw_phone)
            except Exception:
                skipped += 1
                continue

            name_val = str(row.get(name_col, "")).strip() if name_col and pd.notna(row.get(name_col)) else norm_phone
            email_val = str(row.get(email_col, "")).strip() if email_col and pd.notna(row.get(email_col)) else None
            tag_val = str(row.get(tag_col, "")).strip() if tag_col and pd.notna(row.get(tag_col)) else None

            existing = (
                self.db.query(Contact)
                .filter(
                    Contact.organization_id == organization_id,
                    Contact.phone_number == norm_phone,
                    Contact.is_deleted == False,
                )
                .first()
            )
            if existing:
                skipped += 1
                continue

            attr = {}
            if tag_val:
                attr["tag"] = tag_val

            new_c = Contact(
                organization_id=organization_id,
                name=name_val,
                phone_number=norm_phone,
                email=email_val,
                status=ContactStatus.ACTIVE,
                source="CSV_IMPORT",
                attributes=attr,
                created_by=actor_id,
                owner_id=actor_id,
                is_deleted=False,
            )
            self.db.add(new_c)
            imported += 1

        self.db.commit()
        return {
            "success": True,
            "message": f"Successfully imported {imported} contacts ({skipped} skipped).",
            "imported_contacts": imported,
            "skipped": skipped,
        }
