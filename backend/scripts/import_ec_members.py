#!/usr/bin/env python3
"""
import_ec_members.py — Tag EC (Executive Committee) members on their memberships.

Usage (run from backend/ directory):
    python scripts/import_ec_members.py --file ec_members.csv
    python scripts/import_ec_members.py --file ec_members.xlsx --year 2025
    python scripts/import_ec_members.py --file ec_members.csv --dry-run

Input CSV/Excel columns (case-insensitive):
    email OR phone    — to match the user
    ec_title          — e.g. President, Vice President, EC Member
    ec_fy             — financial year string, e.g. "2025/26"

What it does:
  - Matches each row to a user by email or phone
  - Finds their membership for the given year
  - Sets is_ec_member=True, ec_title, ec_fy on that membership
"""

import os
import sys
import csv
import asyncio
import argparse
from pathlib import Path

from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

os.environ.setdefault("SECRET_KEY", "dummy-not-needed")
os.environ.setdefault("RAZORPAY_KEY_ID", "dummy")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "dummy")
os.environ.setdefault("RAZORPAY_WEBHOOK_SECRET", "dummy")

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.models.models import User, Membership

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env")
    sys.exit(1)


def read_rows(file_path: str) -> list[dict]:
    path = file_path.lower()
    if path.endswith(".csv"):
        with open(file_path, newline="", encoding="utf-8-sig") as f:
            return [dict(row) for row in csv.DictReader(f)]
    elif path.endswith(".xlsx"):
        import openpyxl
        import io
        wb = openpyxl.load_workbook(file_path, data_only=True)
        ws = wb.active
        headers = None
        rows = []
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0:
                headers = [str(h).strip().lower() if h else "" for h in row]
            else:
                rows.append({h: (str(v).strip() if v is not None else "") for h, v in zip(headers, row)})
        return rows
    elif path.endswith(".xls"):
        import xlrd
        wb = xlrd.open_workbook(file_path)
        ws = wb.sheet_by_index(0)
        headers = [str(ws.cell_value(0, c)).strip().lower() for c in range(ws.ncols)]
        rows = []
        for r in range(1, ws.nrows):
            rows.append({h: str(ws.cell_value(r, c)).strip() for c, h in enumerate(headers)})
        return rows
    else:
        print("ERROR: Unsupported file type. Use CSV, XLS, or XLSX.")
        sys.exit(1)


async def run(file_path: str, year: int, dry_run: bool):
    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    rows = read_rows(file_path)
    print(f"Read {len(rows)} rows from {file_path}")

    matched = 0
    not_found_user = 0
    not_found_membership = 0

    async with Session() as db:
        for i, row in enumerate(rows, start=2):
            # Normalize keys
            row = {k.lower().strip(): v for k, v in row.items()}

            email = row.get("email", "").lower().strip()
            phone_raw = row.get("phone", row.get("mobile", "")).strip()
            ec_title = row.get("ec_title", row.get("title", "EC Member")).strip()
            ec_fy = row.get("ec_fy", row.get("fy", f"{year}/{str(year + 1)[-2:]}")).strip()

            # Find user
            user = None
            if email:
                result = await db.execute(select(User).where(User.email == email))
                user = result.scalar_one_or_none()
            if not user and phone_raw:
                digits = "".join(c for c in phone_raw if c.isdigit())[-10:]
                if len(digits) == 10:
                    result = await db.execute(select(User).where(User.phone == digits))
                    user = result.scalar_one_or_none()

            if not user:
                print(f"  Row {i}: User not found (email={email}, phone={phone_raw})")
                not_found_user += 1
                continue

            # Find membership for the given year
            result = await db.execute(
                select(Membership).where(
                    Membership.user_id == user.id,
                    Membership.year == year,
                )
            )
            membership = result.scalar_one_or_none()
            if not membership:
                print(f"  Row {i}: No membership for {user.full_name} in year {year}")
                not_found_membership += 1
                continue

            print(f"  Tagging {user.full_name} ({user.email}) as EC: {ec_title} ({ec_fy})")
            if not dry_run:
                membership.is_ec_member = True
                membership.ec_title = ec_title
                membership.ec_fy = ec_fy
            matched += 1

        if not dry_run:
            await db.commit()

    print(f"\nDone. Tagged={matched}, User not found={not_found_user}, Membership not found={not_found_membership}")
    if dry_run:
        print("DRY RUN — no changes written.")


if __name__ == "__main__":
    from datetime import date as _date
    default_year = _date.today().year

    # parser = argparse.ArgumentParser()
    # parser.add_argument("--file", required=True, help="Path to CSV/XLS/XLSX with EC member list")
    # parser.add_argument("--year", type=int, default=default_year, help=f"Membership year to tag (default: {default_year})")
    # parser.add_argument("--dry-run", action="store_true")
    # args = parser.parse_args()
    # asyncio.run(run(args.file, args.year, args.dry_run))
    file_path = "scripts/Office_Bearers_25_26.xlsx"
    asyncio.run(run(file_path, 2026, dry_run=True))

