#!/usr/bin/env python3
"""
import_members.py — Bulk import existing Tirupur Runners members from Excel.

Usage (run from backend/ directory):
    python scripts/import_members.py
    python scripts/import_members.py --excel resources/Tirupur\ Runners\ Member\ 2025-26.xls
    python scripts/import_members.py --dry-run        # preview without writing to DB

What it does:
  - Reads all rows from the Excel registration sheet
  - Creates a User for each member (skips rows with duplicate email)
  - Password set to: <mobile_number>_runners  (e.g. 9876543210_runners)
  - Creates an active Membership for year 2025 (Apr 2025 – Mar 2026)
  - Fully idempotent — safe to re-run; existing emails are skipped
"""

import os
import sys
import asyncio
import argparse
from datetime import date, datetime
from pathlib import Path

# ── Load .env before importing app modules ──────────────────────────────────
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# Provide dummy values for required pydantic-settings fields not needed here
os.environ.setdefault("SECRET_KEY", "dummy-not-needed")
os.environ.setdefault("RAZORPAY_KEY_ID", "dummy")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "dummy")
os.environ.setdefault("RAZORPAY_WEBHOOK_SECRET", "dummy")

# ── Now safe to import app modules ───────────────────────────────────────────
import xlrd
import bcrypt
import pyotp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.models.models import User, Membership

# ─────────────────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

# Excel column indices (0-based)
COL_NAME = 2
COL_PHONE = 3
COL_MEMBERSHIP_STATUS = 4
COL_DOB = 5
COL_EMAIL = 6
COL_EMERGENCY_NAME = 9
COL_EMERGENCY_PHONE = 10

# Membership period for 2025-26
MEMBERSHIP_YEAR = 2025
MEMBERSHIP_START = date(2025, 4, 1)
MEMBERSHIP_END = date(2026, 3, 31)


def excel_date_to_age(serial: float) -> int:
    """Convert Excel serial date to age in years (as of today)."""
    try:
        dt = xlrd.xldate_as_datetime(serial, 0)
        today = date.today()
        age = today.year - dt.year - ((today.month, today.day) < (dt.month, dt.day))
        return max(1, min(age, 120))  # sanity clamp
    except Exception:
        return 30  # fallback default


def clean_phone(raw) -> str:
    """Convert Excel float phone number to a clean 10-digit string."""
    try:
        phone = str(int(float(raw))).strip()
        # Keep only digits, take last 10
        digits = "".join(c for c in phone if c.isdigit())
        return digits[-10:] if len(digits) >= 10 else digits
    except Exception:
        return str(raw).strip()


def clean_str(raw) -> str:
    return str(raw).strip() if raw else ""


def read_excel(excel_path: str) -> list[dict]:
    """Parse Excel and return list of member dicts."""
    wb = xlrd.open_workbook(excel_path)
    sh = wb.sheet_by_index(0)
    members = []

    for i in range(1, sh.nrows):  # skip header row
        row = sh.row_values(i)

        name = clean_str(row[COL_NAME])
        email = clean_str(row[COL_EMAIL]).lower()
        phone = clean_phone(row[COL_PHONE])
        emergency_name = clean_str(row[COL_EMERGENCY_NAME])
        emergency_phone = clean_phone(row[COL_EMERGENCY_PHONE]) if row[COL_EMERGENCY_PHONE] else ""
        dob = row[COL_DOB]
        membership_status = clean_str(row[COL_MEMBERSHIP_STATUS])

        # Skip rows missing critical fields
        if not name or not email or not phone:
            print(f"  [SKIP] Row {i+1}: missing name/email/phone — {name!r} {email!r} {phone!r}")
            continue

        age = excel_date_to_age(dob) if dob else 30

        members.append({
            "full_name": name,
            "email": email,
            "phone": phone,
            "age": age,
            "emergency_contact": emergency_name or None,
            "emergency_phone": emergency_phone or None,
            "membership_status": membership_status,
        })

    return members


async def import_members(excel_path: str, dry_run: bool = False):
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set. Check your .env file.")
        sys.exit(1)

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Connecting to database...")

    engine = create_async_engine(database_url, echo=False)
    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    members = read_excel(excel_path)
    print(f"Found {len(members)} rows in Excel.\n")

    created = 0
    skipped = 0
    errors = 0

    async with session_factory() as db:
        for m in members:
            try:
                # Check for existing user by email
                result = await db.execute(
                    select(User).where(User.email == m["email"])
                )
                existing_user = result.scalar_one_or_none()

                if existing_user:
                    print(f"  [SKIP]  {m['email']} — already exists")
                    skipped += 1
                    continue

                # Build password: <mobile>_runners
                raw_password = f"{m['phone']}_runners"
                hashed = hash_password(raw_password)

                user = User(
                    full_name=m["full_name"],
                    email=m["email"],
                    phone=m["phone"],
                    age=m["age"],
                    gender="not_specified",   # not collected in Excel
                    emergency_contact=m["emergency_contact"],
                    emergency_phone=m["emergency_phone"],
                    hashed_password=hashed,
                    otp_secret=pyotp.random_base32(),
                    is_admin=False,
                )

                membership = Membership(
                    user=user,
                    start_date=MEMBERSHIP_START,
                    end_date=MEMBERSHIP_END,
                    status="active",
                    year=MEMBERSHIP_YEAR,
                )

                if not dry_run:
                    db.add(user)
                    db.add(membership)
                    await db.flush()

                print(f"  [OK]    {m['email']} — {m['full_name']} (pwd: {raw_password})")
                created += 1

            except Exception as e:
                print(f"  [ERROR] {m['email']} — {e}")
                errors += 1
                if not dry_run:
                    await db.rollback()

        if not dry_run and created > 0:
            await db.commit()
            print(f"\nCommitted {created} new users to the database.")

    await engine.dispose()

    print("\n" + "─" * 50)
    print(f"  Total rows   : {len(members)}")
    print(f"  Created      : {created}")
    print(f"  Skipped      : {skipped}  (already in DB)")
    print(f"  Errors       : {errors}")
    if dry_run:
        print("\n  DRY RUN — no changes written to DB.")
    print("─" * 50 + "\n")


def main():
    default_excel = str(
        Path(__file__).parent.parent / "resources" / "Tirupur Runners Member 2025-26.xls"
    )

    parser = argparse.ArgumentParser(description="Import Tirupur Runners members from Excel")
    parser.add_argument(
        "--excel",
        default=default_excel,
        help="Path to the .xls membership file",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing to DB",
    )
    args = parser.parse_args()

    if not Path(args.excel).exists():
        print(f"ERROR: Excel file not found: {args.excel}")
        sys.exit(1)

    asyncio.run(import_members(args.excel, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
