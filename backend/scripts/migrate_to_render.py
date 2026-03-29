#!/usr/bin/env python3
"""
migrate_to_render.py — Copy local PostgreSQL data to Render PostgreSQL.

Copies:  users, memberships, member_profiles, site_settings
Skips:   payments (Razorpay transaction history — not needed on new DB)

Usage (run from backend/ directory):
    SOURCE_DB_URL="postgresql+asyncpg://thiyagesh@localhost:5432/tirupur_runners" \
    TARGET_DB_URL="postgresql+asyncpg://user:pass@host.render.com/tirupur_runners?ssl=require" \
    python scripts/migrate_to_render.py

Dry run (preview row counts, no writes):
    ... python scripts/migrate_to_render.py --dry-run

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

def to_asyncpg_dsn(url: str) -> str:
    """Strip SQLAlchemy driver prefix so asyncpg can connect directly."""
    return url.replace("postgresql+asyncpg://", "postgresql://")


async def connect(url: str) -> asyncpg.Connection:
    dsn = to_asyncpg_dsn(url)
    # Render requires SSL; honour ?ssl=require / ?sslmode=require from the URL
    return await asyncpg.connect(dsn)


async def create_schema(target_url: str):
    """Run SQLAlchemy create_all + ALTER patches on the target DB."""
    # Import app modules (must run from backend/)
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text
    from app.models.models import Base

    engine = create_async_engine(target_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Schema patches that predate the ORM (same as main.py lifespan)
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS t_shirt_size VARCHAR(10)")
        )
        await conn.execute(
            text("ALTER TABLE member_profiles ALTER COLUMN photo_url TYPE TEXT")
        )
    await engine.dispose()
    print("  ✓ schema ready on target")


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
        description="Migrate local DB to Render PostgreSQL (excludes payments)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show row counts without writing to target"
    )
    parser.add_argument(
        "--source",
        default=os.getenv(
            "SOURCE_DB_URL",
            "postgresql+asyncpg://thiyagesh@localhost:5432/tirupur_runners",
        ),
        help="Source DB URL (default: local dev DB)",
    )
    parser.add_argument(
        "--target",
        default=os.getenv("TARGET_DB_URL"),
        help="Target DB URL (Render PostgreSQL — get from Render dashboard)",
    )
    args = parser.parse_args()

    if not args.target:
        print(
            "\nERROR: TARGET_DB_URL is required.\n"
            "  Set it as an env var:  export TARGET_DB_URL=postgresql+asyncpg://...\n"
            "  Or pass it directly:   --target postgresql+asyncpg://...\n"
        )
        sys.exit(1)

    source_preview = args.source.split("@")[-1]   # hide credentials in log
    target_preview = args.target.split("@")[-1]

    print(f"\n{'─' * 55}")
    print(f"  Tirupur Runners — DB Migration to Render")
    print(f"{'─' * 55}")
    print(f"  Source : ...@{source_preview}")
    print(f"  Target : ...@{target_preview}")
    print(f"  Mode   : {'DRY RUN (no data written)' if args.dry_run else 'LIVE'}")
    print(f"  Copy   : {', '.join(TABLES)}")
    print(f"  Skip   : {', '.join(SKIP)}")
    print(f"{'─' * 55}\n")

    # ── 1. Create schema on target ────────────────────────────────────────────
    if not args.dry_run:
        print("Step 1/2 — Creating schema on target DB …")
        await create_schema(args.target)
    else:
        print("Step 1/2 — Schema creation skipped (dry run)")

    # ── 2. Copy data ──────────────────────────────────────────────────────────
    print(f"\nStep 2/2 — Copying data …")
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
