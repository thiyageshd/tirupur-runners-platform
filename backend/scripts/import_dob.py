#!/usr/bin/env python3
"""
import_dob.py — Import date-of-birth for existing members from the Excel file.

Usage (run from backend/ directory):
    python scripts/import_dob.py
    python scripts/import_dob.py --excel resources/Tirupur\ Runners\ Member\ 2025-26.xls
    python scripts/import_dob.py --dry-run  # preview without writing to DB

What it does:
  - Reads the Excel file
  - Looks for DOB columns (tries common column name variants)
  - Matches rows to users by email or phone
  - Updates users.dob
  - Also recomputes users.age from dob
"""

import os
import sys
import asyncio
import argparse
from datetime import date, datetime
from pathlib import Path

from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

os.environ.setdefault("SECRET_KEY", "dummy-not-needed")
os.environ.setdefault("RAZORPAY_KEY_ID", "dummy")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "dummy")
os.environ.setdefault("RAZORPAY_WEBHOOK_SECRET", "dummy")

import xlrd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.models.models import User

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env")
    sys.exit(1)

# xlrd date parsing helper
def xlrd_date_to_python(xl_date_value, wb) -> date | None:
    try:
        t = xlrd.xldate_as_tuple(float(xl_date_value), wb.datemode)
        if t[0] == 0:
            return None
        return date(t[0], t[1], t[2])
    except Exception:
        return None

def parse_dob_str(value: str) -> date | None:
    """Try common date string formats."""
    value = str(value).strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%y", "%d-%m-%y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            pass
    return None

def compute_age(dob: date) -> int:
    today = date.today()
    age = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        age -= 1
    return age


async def run(excel_path: str, dry_run: bool):
    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    wb = xlrd.open_workbook(excel_path)
    ws = wb.sheet_by_index(0)

    headers = [str(ws.cell_value(0, c)).strip().lower() for c in range(ws.ncols)]
    print(f"Excel columns: {headers}")

    # Find DOB column
    dob_col = None
    for candidate in ("date of birth",):
        if candidate in headers:
            dob_col = headers.index(candidate)
            break

    # if dob_col is None:
    #     print("ERROR: Could not find a DOB column. Looked for: dob, 'date of birth', 'birth date', etc.")
    #     sys.exit(1)

    # Find email and phone columns
    email_col = next((i for i, h in enumerate(headers) if "email id" in h), None)
    phone_col = next((i for i, h in enumerate(headers) if any(x in h for x in ("mobile number",))), None)
    print(f"DOB col: {headers[dob_col]}, Email col: {headers[email_col] if email_col is not None else 'N/A'}, Phone col: {headers[phone_col] if phone_col is not None else 'N/A'}")

    matched = 0
    skipped = 0
    not_found = 0

    async with Session() as db:
        for row_idx in range(1, ws.nrows):
            raw_dob = ws.cell_value(row_idx, dob_col)
            cell_type = ws.cell_type(row_idx, dob_col)

            if cell_type == xlrd.XL_CELL_DATE:
                dob = xlrd_date_to_python(raw_dob, wb)
            else:
                dob = parse_dob_str(str(raw_dob))

            if not dob:
                skipped += 1
                continue

            # Try to find user
            user = None
            if email_col is not None:
                email = str(ws.cell_value(row_idx, email_col)).strip().lower()
                if email:
                    result = await db.execute(select(User).where(User.email == email))
                    user = result.scalar_one_or_none()

            if not user and phone_col is not None:
                phone_raw = str(ws.cell_value(row_idx, phone_col)).strip()
                digits = "".join(c for c in phone_raw if c.isdigit())[-10:]
                if len(digits) == 10:
                    result = await db.execute(select(User).where(User.phone == digits))
                    user = result.scalar_one_or_none()

            if not user:
                not_found += 1
                continue

            age = compute_age(dob)
            print(f"  Updating {user.full_name} ({user.email}): dob={dob}, age={age}")
            if not dry_run:
                user.dob = dob
                user.age = age
            matched += 1

        if not dry_run:
            await db.commit()

    print(f"\nDone. Matched={matched}, Skipped(no DOB)={skipped}, Not found={not_found}")
    if dry_run:
        print("DRY RUN — no changes written.")


if __name__ == "__main__":
    # parser = argparse.ArgumentParser()
    # parser.add_argument("--excel", default="resources/Tirupur Runners Member 2025-26.xls")
    # parser.add_argument("--dry-run", action="store_true")
    # args = parser.parse_args()
    # asyncio.run(run(args.excel, args.dry_run))
    filepath = "scripts/Tirupur_Runners_Member_25_26.xls"
    asyncio.run(run(filepath, dry_run=False))
