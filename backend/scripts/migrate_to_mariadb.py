#!/usr/bin/env python3
"""
migrate_to_mariadb.py — Copy local PostgreSQL data to local MariaDB.

Copies:  users, memberships, member_profiles, site_settings, payments
Source:  local PostgreSQL (asyncpg)
Target:  local MariaDB (PyMySQL)

Usage (run from backend/ directory):
    python scripts/migrate_to_mariadb.py --dry-run
    python scripts/migrate_to_mariadb.py

Override defaults via env vars:
    SOURCE_DB_URL="postgresql://..." TARGET_DB_URL="mysql+aiomysql://..." \
    python scripts/migrate_to_mariadb.py

The script is idempotent — re-running skips existing rows via INSERT IGNORE.
"""

import os
import sys
import json
import asyncio
import argparse
import uuid as uuid_mod
from datetime import datetime
from pathlib import Path

import asyncpg
import pymysql
import pymysql.cursors

# ── Tables to migrate (FK order matters) ─────────────────────────────────────
TABLES = ["users", "memberships", "member_profiles", "site_settings", "payments"]

DEFAULT_SOURCE = "postgresql://thiyagesh@localhost:5432/tirupur_runners"
DEFAULT_TARGET = "mysql+aiomysql://dbeaver:MyStrongPassword123!@127.0.0.1:3306/tirupur_runners"


# ── Type transform: PostgreSQL → MariaDB ──────────────────────────────────────

def transform_value(v):
    """Convert PostgreSQL-specific types to MariaDB-compatible Python types."""
    if isinstance(v, uuid_mod.UUID):
        # PostgreSQL UUID → plain 36-char string
        return str(v)
    if isinstance(v, datetime):
        # Strip timezone info — MariaDB DATETIME is timezone-naive; values stay UTC
        return v.replace(tzinfo=None)
    if isinstance(v, (dict, list)):
        # JSON columns — PyMySQL does not auto-serialize; do it explicitly
        return json.dumps(v)
    return v


# ── Schema creation on MariaDB ────────────────────────────────────────────────

async def create_schema(target_url: str):
    """Run SQLAlchemy create_all against the MariaDB target."""
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from sqlalchemy.ext.asyncio import create_async_engine
    from app.models.models import Base

    url = target_url
    if url.startswith("mysql://"):
        url = "mysql+aiomysql://" + url[len("mysql://"):]

    engine = create_async_engine(url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("  ✓ Schema created on target")


# ── Copy one table ────────────────────────────────────────────────────────────

async def copy_table(
    src: asyncpg.Connection,
    dst: pymysql.connections.Connection | None,
    table: str,
    dry_run: bool,
):
    rows = await src.fetch(f'SELECT * FROM "{table}"')
    if not rows:
        print(f"  {table}: 0 rows — nothing to copy")
        return

    columns = list(rows[0].keys())
    col_list     = ", ".join(f"`{c}`" for c in columns)
    placeholders = ", ".join(["%s"] * len(columns))
    sql = f"INSERT IGNORE INTO `{table}` ({col_list}) VALUES ({placeholders})"

    if dry_run:
        print(f"  {table}: {len(rows)} rows  (dry run — not written)")
        return

    data = [tuple(transform_value(row[c]) for c in columns) for row in rows]

    with dst.cursor() as cursor:
        cursor.executemany(sql, data)
    dst.commit()
    print(f"  ✓ {table}: {len(rows)} rows copied")


# ── Parse mysql+aiomysql://user:pass@host:port/db ─────────────────────────────

def parse_mysql_url(url: str) -> dict:
    for prefix in ("mysql+aiomysql://", "mysql+pymysql://", "mysql://"):
        if url.startswith(prefix):
            url = url[len(prefix):]
            break
    userinfo, hostinfo = url.split("@", 1)
    db_user, db_pass   = userinfo.split(":", 1)
    hostport, db_name  = hostinfo.rsplit("/", 1)
    if ":" in hostport:
        db_host, db_port = hostport.split(":", 1)
        db_port = int(db_port)
    else:
        db_host, db_port = hostport, 3306
    return dict(host=db_host, port=db_port, user=db_user, password=db_pass, database=db_name)


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Migrate PostgreSQL → MariaDB")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview row counts without writing anything")
    parser.add_argument("--source",
                        default=os.getenv("SOURCE_DB_URL", DEFAULT_SOURCE),
                        help="PostgreSQL source URL")
    parser.add_argument("--target",
                        default=os.getenv("TARGET_DB_URL", DEFAULT_TARGET),
                        help="MariaDB target URL")
    args = parser.parse_args()

    source_preview = args.source.split("@")[-1]
    target_preview = args.target.split("@")[-1]

    print(f"\n{'─' * 58}")
    print(f"  Tirupur Runners — PostgreSQL → MariaDB Migration")
    print(f"{'─' * 58}")
    print(f"  Source : ...@{source_preview}")
    print(f"  Target : ...@{target_preview}")
    print(f"  Mode   : {'DRY RUN (no data written)' if args.dry_run else 'LIVE'}")
    print(f"  Tables : {', '.join(TABLES)}")
    print(f"{'─' * 58}\n")

    # ── Step 1: Create schema ─────────────────────────────────────────────────
    if not args.dry_run:
        print("Step 1/2 — Creating schema on MariaDB …")
        await create_schema(args.target)
    else:
        print("Step 1/2 — Schema creation skipped (dry run)")

    # ── Step 2: Copy data ─────────────────────────────────────────────────────
    print("\nStep 2/2 — Copying data …")

    src_dsn = args.source.replace("postgresql+asyncpg://", "postgresql://")
    src = await asyncpg.connect(src_dsn)

    dst = None
    if not args.dry_run:
        conn_params = parse_mysql_url(args.target)
        dst = pymysql.connect(**conn_params, charset="utf8mb4")

    try:
        for table in TABLES:
            await copy_table(src, dst, table, dry_run=args.dry_run)
    finally:
        await src.close()
        if dst:
            dst.close()

    if args.dry_run:
        print("\nDry run complete — no data written.")
    else:
        print("\n✓ Migration complete!")
    print()


if __name__ == "__main__":
    asyncio.run(main())
