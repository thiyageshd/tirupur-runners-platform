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
  - Password set to: <10-digit mobile number>
  - Creates an active Membership for year 2025 (Apr 2025 – Mar 2026)
  - Creates a MemberProfile with blood group, photo, profession, etc.
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

from app.models.models import User, Membership, MemberProfile

# ─────────────────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Use raw bcrypt — produces $2b$ hashes compatible with passlib verify."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

# Excel column indices (0-based)
COL_NAME = 2
COL_PHONE = 3
COL_MEMBERSHIP_STATUS = 4
COL_DOB = 5
COL_EMAIL = 6
COL_TSHIRT = 7
COL_BLOOD_GROUP = 8
COL_EMERGENCY_NAME = 9
COL_EMERGENCY_PHONE = 10
COL_PHOTO_URL = 11
COL_PROFESSION = 12
COL_WORK_DETAILS = 13
COL_INTERESTS = 14
COL_BIO = 15
COL_STRAVA = 16

# Valid T-shirt sizes from Excel data
VALID_TSHIRT_SIZES = {'M', 'L', 'XL', 'XXL'}

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


def safe_col(row, idx) -> str:
    """Safely get column value, returns empty string if index out of range."""
    try:
        return clean_str(row[idx])
    except (IndexError, TypeError):
        return ""

def convert_drive_url(url: str) -> str:
    """Convert Google Drive open?id= links to direct image URLs."""
    if url and "drive.google.com/open?id=" in url:
        file_id = url.split("open?id=")[-1].strip()
        return f"https://drive.google.com/uc?export=view&id={file_id}"
    return url


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

        # Profile fields
        raw_tshirt = safe_col(row, COL_TSHIRT).upper()
        t_shirt_size = raw_tshirt if raw_tshirt in VALID_TSHIRT_SIZES else None
        blood_group = safe_col(row, COL_BLOOD_GROUP) or None
        photo_url = convert_drive_url(safe_col(row, COL_PHOTO_URL)) or None
        profession = safe_col(row, COL_PROFESSION) or None
        work_details = safe_col(row, COL_WORK_DETAILS) or None
        interests = safe_col(row, COL_INTERESTS) or None
        bio = safe_col(row, COL_BIO) or None
        strava_link = safe_col(row, COL_STRAVA) or None

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
            "t_shirt_size": t_shirt_size,
            "blood_group": blood_group,
            "photo_url": photo_url,
            "profession": profession,
            "work_details": work_details,
            "interests": interests,
            "bio": bio,
            "strava_link": strava_link,
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

                # Password: 10-digit phone number
                raw_password = m["phone"]
                hashed = hash_password(raw_password)

                user = User(
                    full_name=m["full_name"],
                    email=m["email"],
                    phone=m["phone"],
                    age=m["age"],
                    gender="not_specified",   # not collected in Excel
                    emergency_contact=m["emergency_contact"],
                    emergency_phone=m["emergency_phone"],
                    t_shirt_size=m["t_shirt_size"],
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

                    # Create MemberProfile with Excel data
                    profile = MemberProfile(
                        user_id=user.id,
                        blood_group=m["blood_group"],
                        photo_url=m["photo_url"],
                        profession=m["profession"],
                        work_details=m["work_details"],
                        interests=m["interests"],
                        bio=m["bio"],
                        strava_link=m["strava_link"],
                    )
                    db.add(profile)
                    await db.flush()

                print(f"  [OK]    {m['email']} — {m['full_name']} (pwd: {raw_password}, tshirt: {m['t_shirt_size'] or '—'})")
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
