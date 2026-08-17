import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import logging
from core.database import SessionLocal, engine, Base
from core.security import hash_password
from models.postgres_model import User, UserRole, UserStatus, Organization
import models.postgres_model  # noqa: F401

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_super_admin")


def seed_super_admin(
    email: str = "admin@platform.com",
    password: str = "SuperAdminSecret123!",
):
    # Ensure tables exist in the configured database
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Super Admin
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            existing.hashed_password = hash_password(password)
            existing.status = UserStatus.ACTIVE
            db.commit()
            logger.info("Updated password for Super Admin user '%s'.", email)
        else:
            admin_user = User(
                organization_id=None,
                email=email,
                hashed_password=hash_password(password),
                full_name="Super Admin",
                role=UserRole.SYSTEM_ADMIN,
                status=UserStatus.ACTIVE,
            )
            db.add(admin_user)
            db.commit()
            logger.info("Successfully seeded Super Admin user: %s", email)

        # 2. Default Organization & Org Admin
        from models.postgres_model import OrganizationStatus
        org = db.query(Organization).first()
        if not org:
            org = Organization(
                name="Acme Corp",
                slug="acme-corp",
                status=OrganizationStatus.ACTIVE,
            )
            db.add(org)
            db.commit()
            db.refresh(org)
            logger.info("Seeded default organization: Acme Corp")
        else:
            org.status = OrganizationStatus.ACTIVE
            db.commit()

        org_admin = db.query(User).filter(User.email == "orgadmin@platform.com").first()
        if org_admin:
            org_admin.hashed_password = hash_password("OrgAdminSecret123!")
            org_admin.status = UserStatus.ACTIVE
            org_admin.organization_id = org.id
            db.commit()
            logger.info("Updated password for Org Admin user 'orgadmin@platform.com'.")
        else:
            org_admin_user = User(
                organization_id=org.id,
                email="orgadmin@platform.com",
                hashed_password=hash_password("OrgAdminSecret123!"),
                full_name="Acme Org Admin",
                role=UserRole.ORG_ADMIN,
                status=UserStatus.ACTIVE,
            )
            db.add(org_admin_user)
            db.commit()
            logger.info("Successfully seeded Org Admin user: orgadmin@platform.com")

    except Exception as exc:
        db.rollback()
        logger.error("Failed to seed users: %s", exc)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_super_admin()
