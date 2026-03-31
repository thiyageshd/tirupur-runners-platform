#!/usr/bin/env python3
"""
migrate_to_hostinger.py — Copy PostgreSQL data from Render (or local) to Hostinger VPS.

Copies:  users, memberships, member_profiles, site_settings
Skips:   payments (Razorpay transaction history)

Usage (run from backend/ directory):

  From Render dev DB → Hostinger:
    SOURCE_DB_URL="postgresql://user:pass@dpg-xxx.render.com/tirupur_runners_dev?ssl=require" \
    TARGET_DB_URL="postgresql://tirupur_runners:password@localhost:5432/tirupur_runners" \
    python scripts/migrate_to_hostinger.py

  From local DB → Hostinger (via SSH tunnel, see setup guide):
    SOURCE_DB_URL="postgresql://thiyagesh@localhost:5432/tirupur_runners" \
    TARGET_DB_URL="postgresql://tirupur_runners:password@<VPS_IP>:5432/tirupur_runners" \
    python scripts/migrate_to_hostinger.py

  Dry run (preview row counts, no writes):
    ... python scripts/migrate_to_hostinger.py --dry-run

The script is idempotent — safe to re-run; duplicate rows are skipped via
ON CONFLICT DO NOTHING.
"""

import os
import sys
import asyncio
import argparse
from pathlib import Path

import asyncpg

# ── Tables to migrate (order matters — FK dependencies) ──────────────────────
TABLES = ["users", "memberships", "member_profiles", "site_settings"]
SKIP   = {"payments"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def to_asyncpg_dsn(url: str) -> tuple[str, bool]:
    """
    Strip SQLAlchemy driver prefix and extract ssl=require flag.
    asyncpg doesn't parse ssl from the query string — pass it as a kwarg.
    Returns (cleaned_dsn, needs_ssl).
    """
    dsn = url.replace("postgresql+asyncpg://", "postgresql://")
    needs_ssl = any(p in dsn for p in ("ssl=require", "sslmode=require"))
    for param in ("?ssl=require", "&ssl=require", "?sslmode=require", "&sslmode=require"):
        dsn = dsn.replace(param, "")
    return dsn, needs_ssl


async def connect(url: str) -> asyncpg.Connection:
    dsn, needs_ssl = to_asyncpg_dsn(url)
    if needs_ssl:
        return await asyncpg.connect(dsn, ssl="require")
    return await asyncpg.connect(dsn)


async def create_schema(target_url: str):
    """Run SQLAlchemy create_all + ALTER patches on the target DB."""
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text
    from app.models.models import Base

    # Convert plain postgresql:// to postgresql+asyncpg:// for SQLAlchemy
    sa_url = target_url.replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(sa_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Schema patches matching main.py lifespan
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS t_shirt_size VARCHAR(10)"))
        await conn.execute(text("ALTER TABLE member_profiles ALTER COLUMN photo_url TYPE TEXT"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_2 VARCHAR(200)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_phone_2 VARCHAR(20)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'approved'"))
        await conn.execute(text("ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS aadhar_url TEXT"))
        await conn.execute(text("ALTER TABLE memberships ADD COLUMN IF NOT EXISTS membership_id VARCHAR(20) UNIQUE"))
    await engine.dispose()
    print("  ✓ Schema ready on target DB")


async def copy_table(
    src: asyncpg.Connection,
    dst: asyncpg.Connection,
    table: str,
    dry_run: bool,
):
    rows = await src.fetch(f'SELECT * FROM "{table}"')
    if not rows:
        print(f"  {table}: 0 rows — nothing to copy")
        return

    columns = list(rows[0].keys())
    col_list     = ", ".join(f'"{c}"' for c in columns)
    placeholders = ", ".join(f"${i + 1}" for i in range(len(columns)))
    sql = (
        f'INSERT INTO "{table}" ({col_list}) '
        f'VALUES ({placeholders}) '
        f'ON CONFLICT DO NOTHING'
    )

    if dry_run:
        print(f"  {table}: {len(rows)} rows (dry run — not written)")
        return

    data = [tuple(row[c] for c in columns) for row in rows]
    await dst.executemany(sql, data)
    print(f"  ✓ {table}: {len(rows)} rows copied")


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(
        description="Migrate DB to Hostinger VPS PostgreSQL (excludes payments)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show row counts without writing to target"
    )
    parser.add_argument(
        "--source",
        default=os.getenv(
            "SOURCE_DB_URL",
            "postgresql://thiyagesh@localhost:5432/tirupur_runners",
        ),
        help="Source DB URL (Render or local)",
    )
    parser.add_argument(
        "--target",
        default=os.getenv("TARGET_DB_URL"),
        help="Target Hostinger DB URL  e.g. postgresql://tirupur_runners:pass@<VPS_IP>:5432/tirupur_runners",
    )
    args = parser.parse_args()

    if not args.target:
        print(
            "\nERROR: TARGET_DB_URL is required.\n"
            "  Set it as an env var:  export TARGET_DB_URL=postgresql://user:pass@<VPS_IP>:5432/tirupur_runners\n"
            "  Or pass it directly:   --target postgresql://...\n"
        )
        sys.exit(1)

    source_preview = args.source.split("@")[-1]
    target_preview = args.target.split("@")[-1]

    print(f"\n{'─' * 58}")
    print(f"  Tirupur Runners — DB Migration to Hostinger")
    print(f"{'─' * 58}")
    print(f"  Source : ...@{source_preview}")
    print(f"  Target : ...@{target_preview}")
    print(f"  Mode   : {'DRY RUN (no data written)' if args.dry_run else 'LIVE'}")
    print(f"  Copy   : {', '.join(TABLES)}")
    print(f"  Skip   : {', '.join(SKIP)}")
    print(f"{'─' * 58}\n")

    # ── 1. Create schema on target ────────────────────────────────────────────
    if not args.dry_run:
        print("Step 1/2 — Creating schema on target DB ...")
        await create_schema(args.target)
    else:
        print("Step 1/2 — Schema creation skipped (dry run)")

    # ── 2. Copy data ──────────────────────────────────────────────────────────
    print(f"\nStep 2/2 — Copying data ...")
    src = await connect(args.source)
    dst = await connect(args.target) if not args.dry_run else None

    try:
        for table in TABLES:
            await copy_table(src, dst, table, dry_run=args.dry_run)
    finally:
        await src.close()
        if dst:
            await dst.close()

    print(f"\n{'✓ Migration complete!' if not args.dry_run else 'Dry run complete — no data written.'}")
    print(f"  Skipped: {', '.join(SKIP)}\n")


if __name__ == "__main__":
    asyncio.run(main())
