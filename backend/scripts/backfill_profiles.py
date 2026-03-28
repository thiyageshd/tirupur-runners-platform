#!/usr/bin/env python3
"""
backfill_profiles.py — Populate member_profiles for existing users from Excel.

Usage (run from backend/ directory):
    PYTHONPATH=. python scripts/backfill_profiles.py
    PYTHONPATH=. python scripts/backfill_profiles.py --dry-run
"""

import os, sys, asyncio, argparse
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

os.environ.setdefault("SECRET_KEY", "dummy")
os.environ.setdefault("RAZORPAY_KEY_ID", "dummy")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "dummy")
os.environ.setdefault("RAZORPAY_WEBHOOK_SECRET", "dummy")

import xlrd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.models.models import User, MemberProfile

EXCEL_PATH = str(Path(__file__).parent.parent / "resources" / "Tirupur Runners Member 2025-26.xls")

COL_EMAIL       = 6
COL_TSHIRT      = 7
COL_BLOOD_GROUP = 8
COL_PHOTO_URL   = 11
COL_PROFESSION  = 12
COL_WORK_DETAILS= 13
COL_INTERESTS   = 14
COL_BIO         = 15
COL_STRAVA      = 16

VALID_TSHIRT = {'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'}


def clean(raw) -> str:
    return str(raw).strip() if raw else ""

def safe_col(row, idx) -> str:
    try:
        return clean(row[idx])
    except (IndexError, TypeError):
        return ""

def convert_drive_url(url: str) -> str:
    """Convert Google Drive open?id= links to direct image URLs."""
    if url and "drive.google.com/open?id=" in url:
        file_id = url.split("open?id=")[-1].strip()
        return f"https://drive.google.com/uc?export=view&id={file_id}"
    return url


async def backfill(excel_path: str, dry_run: bool):
    db_url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://thiyagesh@localhost:5432/tirupur_runners")
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(db_url, echo=False)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    wb = xlrd.open_workbook(excel_path)
    sh = wb.sheet_by_index(0)
    print(f"Excel rows: {sh.nrows - 1}\n")

    created = updated = skipped = 0

    async with factory() as db:
        for i in range(1, sh.nrows):
            row = sh.row_values(i)
            email = clean(row[COL_EMAIL]).lower()
            if not email:
                continue

            # Find user
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            if not user:
                print(f"  [SKIP]  {email} — not in DB")
                skipped += 1
                continue

            # Parse profile fields
            raw_tshirt = safe_col(row, COL_TSHIRT).upper()
            t_shirt_size = raw_tshirt if raw_tshirt in VALID_TSHIRT else None
            blood_group  = safe_col(row, COL_BLOOD_GROUP) or None
            photo_url    = convert_drive_url(safe_col(row, COL_PHOTO_URL)) or None
            profession   = safe_col(row, COL_PROFESSION) or None
            work_details = safe_col(row, COL_WORK_DETAILS) or None
            interests    = safe_col(row, COL_INTERESTS) or None
            bio          = safe_col(row, COL_BIO) or None
            strava_link  = safe_col(row, COL_STRAVA) or None

            # Also update t_shirt_size on User row
            if t_shirt_size and user.t_shirt_size != t_shirt_size:
                if not dry_run:
                    user.t_shirt_size = t_shirt_size

            # Upsert MemberProfile
            result = await db.execute(
                select(MemberProfile).where(MemberProfile.user_id == user.id)
            )
            profile = result.scalar_one_or_none()

            if profile:
                action = "UPDATE"
                updated += 1
            else:
                profile = MemberProfile(user_id=user.id)
                action = "CREATE"
                created += 1

            print(f"  [{action}] {email} — tshirt={t_shirt_size}, blood={blood_group}, profession={profession}")

            if not dry_run:
                profile.blood_group  = blood_group
                profile.photo_url    = photo_url
                profile.profession   = profession
                profile.work_details = work_details
                profile.interests    = interests
                profile.bio          = bio
                profile.strava_link  = strava_link
                if action == "CREATE":
                    db.add(profile)

        if not dry_run:
            await db.commit()
            print(f"\nCommitted.")

    await engine.dispose()
    print("\n" + "─" * 50)
    print(f"  Created  : {created}")
    print(f"  Updated  : {updated}")
    print(f"  Skipped  : {skipped}  (not in DB)")
    if dry_run:
        print("\n  DRY RUN — nothing written.")
    print("─" * 50)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--excel", default=EXCEL_PATH)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not Path(args.excel).exists():
        print(f"ERROR: Excel not found: {args.excel}")
        sys.exit(1)
    asyncio.run(backfill(args.excel, args.dry_run))

if __name__ == "__main__":
    main()
