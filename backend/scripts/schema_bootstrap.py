"""
Schema bootstrap utility.

Run directly to reset/recreate all SQLAlchemy model tables:

    cd backend
    py scripts/schema_bootstrap.py
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from sqlalchemy import text

from core.database import engine, Base
import models.postgres_model  # noqa: F401 — registers all ORM models with Base


def bootstrap_schema(drop_first: bool = True) -> None:
    """Drop legacy schema (wiping orphan indexes/types) and create all new schema tables."""
    print("Connecting to database...")
    with engine.begin() as conn:
        conn.execute(text("SELECT 1"))

    if drop_first:
        print("Dropping existing schema & cascade dependencies...")
        with engine.begin() as conn:
            conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE;"))
            conn.execute(text("CREATE SCHEMA public;"))
            conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
            try:
                conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
                conn.execute(text('CREATE EXTENSION IF NOT EXISTS "pg_trgm";'))
            except Exception as ext_err:
                print(f"Extension creation notice: {ext_err}")
        print("Legacy schema completely wiped.")

    print("Creating new schema tables and indexes...")
    Base.metadata.create_all(bind=engine)
    print("Schema bootstrap complete successfully!")


if __name__ == "__main__":
    bootstrap_schema(drop_first=True)
