#!/usr/bin/env python3
"""
reset_passwords.py — Reset all user passwords to their 10-digit phone number.

Usage (run from backend/ directory):
    DATABASE_URL=postgresql+asyncpg://... python scripts/reset_passwords.py
    DATABASE_URL=postgresql+asyncpg://... python scripts/reset_passwords.py --dry-run

What it does:
  - Reads all users from the database
  - Sets hashed_password = bcrypt(phone) for every user
  - Supports --dry-run to preview without writing
"""

import os
import sys
import asyncio
import argparse
from pathlib import Path

# ── Load .env before importing app modules ──────────────────────────────────
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

os.environ.setdefault("SECRET_KEY", "dummy-not-needed")
os.environ.setdefault("RAZORPAY_KEY_ID", "dummy")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "dummy")
os.environ.setdefault("RAZORPAY_WEBHOOK_SECRET", "dummy")

# ── Now safe to import app modules ───────────────────────────────────────────
import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.models.models import User

# ─────────────────────────────────────────────────────────────────────────────


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


async def reset_passwords(dry_run: bool = False):
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set.")
        sys.exit(1)

    # Neon / Render may provide postgresql:// — asyncpg requires postgresql+asyncpg://
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Connecting to database...")

    engine = create_async_engine(database_url, echo=False)
    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    updated = 0
    skipped = 0

    async with session_factory() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()

        print(f"Found {len(users)} users.\n")

        for user in users:
            phone = user.phone
            if not phone or len(phone) < 10:
                print(f"  [SKIP] {user.email} — phone '{phone}' is not a valid 10-digit number")
                skipped += 1
                continue

            new_password = phone[-10:]  # take last 10 digits as stored
            print(f"  {'[DRY] ' if dry_run else ''}Reset: {user.email} → password = {new_password}")

            if not dry_run:
                user.hashed_password = hash_password(new_password)
            updated += 1

        if not dry_run and updated > 0:
            await db.commit()
            print(f"\nCommitted password resets for {updated} users.")

    await engine.dispose()

    print("\n" + "─" * 50)
    print(f"  Total users  : {len(users)}")
    print(f"  Updated      : {updated}")
    print(f"  Skipped      : {skipped}")
    if dry_run:
        print("\n  DRY RUN — no changes written to DB.")
    print("─" * 50 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Reset all user passwords to their phone number")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing to DB",
    )
    args = parser.parse_args()
    asyncio.run(reset_passwords(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
