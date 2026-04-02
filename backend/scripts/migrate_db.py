"""
Run pending DB migrations idempotently.
Usage: cd backend && .venv/bin/python scripts/migrate_db.py
"""
import asyncio
import sys

sys.path.insert(0, ".")
from app.db.session import engine
from sqlalchemy import text


async def migrate():
    async with engine.begin() as conn:
        await conn.execute(text(
            "ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url TEXT"
        ))
    print("DB migrations done")


asyncio.run(migrate())
