import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine

def main():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TYPE campaignrecipientstatus ADD VALUE IF NOT EXISTS 'REPLIED';"))
            conn.commit()
            print("Successfully added REPLIED to Postgres ENUM campaignrecipientstatus.")
        except Exception as e:
            print(f"Postgres ENUM update notice: {e}")

if __name__ == "__main__":
    main()
