"""Create (or reset) an admin account without wiping any data.

Usage (from backend/, venv active):
    python create_admin.py                      # admin@civicfix.app / admin123
    python create_admin.py me@example.com MyPass123 "My Name"
"""
import asyncio
import os
import sys

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from security import hash_password
from utils import utcnow

load_dotenv()


async def create_admin(db, email: str, password: str, name: str) -> str:
    email = email.lower().strip()
    fields = {
        "name": name,
        "password_hash": hash_password(password),
        "role": "admin",
        "team": None,
        "banned": False,
    }
    existing = await db.users.find_one({"email": email})
    if existing:
        await db.users.update_one({"_id": existing["_id"]}, {"$set": fields})
        return "updated"
    await db.users.insert_one({"email": email, "created_at": utcnow(), **fields})
    return "created"


async def main():
    email = sys.argv[1] if len(sys.argv) > 1 else "admin@civicfix.app"
    password = sys.argv[2] if len(sys.argv) > 2 else "admin123"
    name = sys.argv[3] if len(sys.argv) > 3 else "City Admin"
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client[os.getenv("DB_NAME", "civicfix")]
    result = await create_admin(db, email, password, name)
    print(f"Admin {result}: {email} / {password}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
