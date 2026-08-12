import sys
import uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.database import SessionLocal
from core.security import hash_password
from models.postgres_model import User

def reset_password(email: str, new_password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email.strip()).first()
        if not user:
            print(f"[ERROR] User with email '{email}' not found in database.")
            return False
        
        user.hashed_password = hash_password(new_password)
        user.must_change_password = True  # Require mandatory password change on login
        db.commit()
        print(f"[OK] Password for '{email}' successfully reset to: '{new_password}'")
        return True
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        reset_password(sys.argv[1], sys.argv[2])
    else:
        print("Usage: python scripts/reset_user_password.py <email> <new_password>")
