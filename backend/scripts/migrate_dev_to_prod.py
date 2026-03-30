#!/usr/bin/env python3
"""
migrate_dev_to_prod.py — Copy Render DEV database to Render PROD database.

What is copied:
  ✓ users            (all columns incl. photos, emergency contacts, account_status)
  ✓ memberships      (incl. membership_id)
  ✓ member_profiles  (incl. aadhar_url, photo_url — these are large base64 blobs)
  ✓ site_settings    (admin toggle settings)

What is skipped:
  ✗ payments         (Razorpay transaction history — not needed on fresh prod)

The script is idempotent — safe to re-run; existing rows are skipped via
ON CONFLICT DO NOTHING.

NOTE: member_profiles contains base64-encoded photos (≤500 KB each) and
      aadhar cards (≤2 MB each). With 250 members this can be up to ~600 MB
      of data. The transfer will be slow over a WAN connection — that is normal.

─────────────────────────────────────────────────────────────────────────────
Usage (run from backend/ directory):

    SOURCE_DB_URL="<render-dev-internal-or-external-url>?ssl=require" \\
    TARGET_DB_URL="<render-prod-internal-or-external-url>?ssl=require" \\
    PYTHONPATH=. python scripts/migrate_dev_to_prod.py

Dry run (shows row counts, writes nothing):
    ... python scripts/migrate_dev_to_prod.py --dry-run

Override URLs directly:
    PYTHONPATH=. python scripts/migrate_dev_to_prod.py \\
        --source "postgresql://user:pass@dev-host/dev_db?ssl=require" \\
        --target "postgresql://user:pass@prod-host/prod_db?ssl=require"
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import asyncio
import argparse
from pathlib import Path

import asyncpg

sys.path.insert(0, str(Path(__file__).parent.parent))

# ── Tables to migrate (insertion order respects FK dependencies) ─────────────
TABLES = ["users", "memberships", "member_profiles", "site_settings"]
SKIP   = {"payments"}

# Dev DB default (external URL — works from local machine too)
DEV_DB_DEFAULT = (
    "postgresql://tirupur_runners_user:Havsfdt0oZp0S7chCRJEQSAgplBFntPI"
    "@dpg-d74bn8oule4c73evi4e0-a.singapore-postgres.render.com"
    "/tirupur_runners_dev?ssl=require"
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def to_asyncpg_dsn(url: str) -> tuple[str, bool]:
    """Strip SQLAlchemy driver prefix; extract ssl flag for asyncpg."""
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
    """Run SQLAlchemy create_all + all ALTER TABLE patches on the target DB."""
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text
    from app.models.models import Base

    # Normalise for SQLAlchemy
    sa_url = target_url.replace("postgresql://", "postgresql+asyncpg://")
    if "+asyncpg" not in sa_url:
        sa_url = sa_url.replace("postgresql://", "postgresql+asyncpg://")

    engine = create_async_engine(sa_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        patches = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS t_shirt_size VARCHAR(10)",
            "ALTER TABLE member_profiles ALTER COLUMN photo_url TYPE TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_2 VARCHAR(200)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_phone_2 VARCHAR(20)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'approved'",
            "ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS aadhar_url TEXT",
            "ALTER TABLE memberships ADD COLUMN IF NOT EXISTS membership_id VARCHAR(20) UNIQUE",
        ]
        for patch in patches:
            await conn.execute(text(patch))
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

    columns      = list(rows[0].keys())
    col_list     = ", ".join(f'"{c}"' for c in columns)
    placeholders = ", ".join(f"${i + 1}" for i in range(len(columns)))
    sql = (
        f'INSERT INTO "{table}" ({col_list}) '
        f'VALUES ({placeholders}) '
        f'ON CONFLICT DO NOTHING'
    )

    if dry_run:
        # Estimate data size for blob-heavy tables
        size_note = ""
        if table == "member_profiles":
            photo_chars  = sum(len(r["photo_url"])  if r["photo_url"]  else 0 for r in rows)
            aadhar_chars = sum(len(r["aadhar_url"]) if r["aadhar_url"] else 0 for r in rows)
            size_note = (
                f"  (photos ~{photo_chars // 1024} KB, "
                f"aadhar ~{aadhar_chars // 1024} KB)"
            )
        print(f"  {table}: {len(rows)} rows (dry run — not written){size_note}")
        return

    data = [tuple(row[c] for c in columns) for row in rows]
    await dst.executemany(sql, data)
    print(f"  ✓ {table}: {len(rows)} rows copied")


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(
        description="Migrate Render DEV → PROD (excludes payments)"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Show row counts without writing to target")
    parser.add_argument("--source",
                        default=os.getenv("SOURCE_DB_URL", DEV_DB_DEFAULT),
                        help="Source DB URL (default: Render dev)")
    parser.add_argument("--target",
                        default=os.getenv("TARGET_DB_URL"),
                        help="Target DB URL (Render prod — required)")
    args = parser.parse_args()

    if not args.target:
        print(
            "\nERROR: TARGET_DB_URL is required.\n"
            "  Set it:  export TARGET_DB_URL=postgresql://user:pass@host/db?ssl=require\n"
            "  Or pass: --target postgresql://...\n"
            "\nYou will get this URL from Render dashboard → your prod PostgreSQL\n"
            "  → Info → External Database URL\n"
        )
        sys.exit(1)

    source_preview = args.source.split("@")[-1]
    target_preview = args.target.split("@")[-1]

    print(f"\n{'─' * 60}")
    print(f"  Tirupur Runners — DEV → PROD Migration")
    print(f"{'─' * 60}")
    print(f"  Source : ...@{source_preview}")
    print(f"  Target : ...@{target_preview}")
    print(f"  Mode   : {'DRY RUN (no data written)' if args.dry_run else 'LIVE'}")
    print(f"  Copy   : {', '.join(TABLES)}")
    print(f"  Skip   : {', '.join(SKIP)}")
    print(f"{'─' * 60}\n")

    print("⚠  member_profiles includes base64 photos + aadhar data.")
    print("   Transfer may be slow (~minutes) depending on how many")
    print("   members have uploaded files. This is normal.\n")

    # Step 1: schema
    if not args.dry_run:
        print("Step 1/2 — Creating schema on prod DB …")
        await create_schema(args.target)
    else:
        print("Step 1/2 — Schema creation skipped (dry run)")

    # Step 2: data
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

    if not args.dry_run:
        print(f"\n{'✓ Migration complete!'}")
        print(f"  Skipped : {', '.join(SKIP)}")
        print(f"\nNext steps:")
        print(f"  1. Set env vars in Render dashboard → tirupur-runners-api:")
        print(f"       DATABASE_URL         (internal URL from Render prod DB)")
        print(f"       RAZORPAY_KEY_ID       (live key: rzp_live_...)")
        print(f"       RAZORPAY_KEY_SECRET")
        print(f"       RAZORPAY_WEBHOOK_SECRET")
        print(f"       GMAIL_USER            (e.g. tirupurrunnersmarathon@gmail.com)")
        print(f"       GMAIL_APP_PASSWORD    (16-char Google App Password)")
        print(f"  2. Verify: https://tirupur-runners-api.onrender.com/health\n")
    else:
        print(f"\nDry run complete — no data written.\n")


if __name__ == "__main__":
    asyncio.run(main())
