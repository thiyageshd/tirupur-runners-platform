#!/usr/bin/env python3
"""
assign_membership_ids.py — Backfill membership IDs for active memberships that have none.

Format: YYYYMMTRnn  (e.g. 202504TR01)
  YYYY  = --year arg
  MM    = --month arg (zero-padded)
  TR    = club prefix
  nn    = sequential number (2-digit, continues from existing IDs for that prefix)

Usage (run from backend/ directory):
    PYTHONPATH=. python scripts/assign_membership_ids.py --year 2025 --month 4
    PYTHONPATH=. python scripts/assign_membership_ids.py --year 2025 --month 4 --dry-run

    # Against Render dev:
    DATABASE_URL="postgresql+asyncpg://user:pass@host/db?ssl=require" \\
        PYTHONPATH=. python scripts/assign_membership_ids.py --year 2025 --month 4

Options:
    --year      Year for the prefix  (required, e.g. 2025)
    --month     Month for the prefix (required, 1-12)
    --dry-run   Preview assignments without writing to DB
    --db-url    Override DATABASE_URL env var
"""

import os
import sys
import asyncio
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func

from app.models.models import Membership


def normalise_url(url: str) -> str:
    """Ensure the URL uses the asyncpg driver and strips ssl query param."""
    url = url.replace("postgres://", "postgresql+asyncpg://")
    if "postgresql://" in url and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://")
    needs_ssl = "ssl=require" in url or "sslmode=require" in url
    for p in ("?ssl=require", "&ssl=require", "?sslmode=require", "&sslmode=require"):
        url = url.replace(p, "")
    return url, needs_ssl


async def main():
    parser = argparse.ArgumentParser(
        description="Backfill YYYYMMTRnn membership IDs for memberships that have none."
    )
    parser.add_argument("--year",  type=int, required=True, help="Year portion of the prefix (e.g. 2025)")
    parser.add_argument("--month", type=int, required=True, choices=range(1, 13),
                        metavar="MONTH", help="Month portion of the prefix (1-12)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--db-url",
                        default=os.getenv("DATABASE_URL",
                                          "postgresql+asyncpg://thiyagesh@localhost:5432/tirupur_runners"),
                        help="Database URL (default: local dev DB)")
    args = parser.parse_args()

    prefix = f"{args.year}{args.month:02d}TR"
    db_url, needs_ssl = normalise_url(args.db_url)
    connect_args = {"ssl": "require"} if needs_ssl else {}

    engine = create_async_engine(db_url, echo=False, connect_args=connect_args)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # All active memberships without an ID, oldest first
        result = await db.execute(
            select(Membership)
            .where(Membership.membership_id.is_(None))
            .where(Membership.status == "active")
            .order_by(Membership.created_at.asc())
        )
        memberships = result.scalars().all()

        if not memberships:
            print("\nNo active memberships found without a membership_id. Nothing to do.")
            await engine.dispose()
            return

        # Find the highest existing sequence for this prefix so we don't collide
        max_result = await db.execute(
            select(func.max(Membership.membership_id))
            .where(Membership.membership_id.like(f"{prefix}%"))
        )
        last_id = max_result.scalar()
        start_seq = (int(last_id[len(prefix):]) + 1) if last_id else 1

        print(f"\n{'─' * 50}")
        print(f"  Membership ID Backfill")
        print(f"{'─' * 50}")
        print(f"  Prefix  : {prefix}")
        print(f"  Start   : {prefix}{start_seq:02d}")
        print(f"  Count   : {len(memberships)}")
        print(f"  Mode    : {'DRY RUN — no changes written' if args.dry_run else 'LIVE'}")
        print(f"{'─' * 50}\n")

        for i, m in enumerate(memberships):
            new_id = f"{prefix}{start_seq + i:02d}"
            print(f"  {str(m.id)[:8]}…  year={m.year}  →  {new_id}")
            if not args.dry_run:
                m.membership_id = new_id

        if not args.dry_run:
            await db.commit()
            print(f"\n✓ Updated {len(memberships)} memberships.\n")
        else:
            print(f"\nDry run complete — no changes written.\n")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
