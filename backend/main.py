from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
from sqlalchemy import text

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # Create new tables (member_profiles, etc.)
        await conn.run_sync(Base.metadata.create_all)
        # Add columns to existing tables that predate the ORM changes
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS t_shirt_size VARCHAR(10)")
        )
        await conn.execute(
            text("ALTER TABLE member_profiles ALTER COLUMN photo_url TYPE TEXT")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_2 VARCHAR(200)")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_phone_2 VARCHAR(20)")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'approved'")
        )
        await conn.execute(
            text("ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS aadhar_url TEXT")
        )
        await conn.execute(
            text("ALTER TABLE memberships ADD COLUMN IF NOT EXISTS membership_id VARCHAR(20) UNIQUE")
        )
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    description="Registration platform for Tirupur Runners Club",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Serve uploaded files (Aadhar, etc.) — used in local dev; on VPS Nginx serves /uploads/ directly
_uploads_dir = Path(settings.UPLOADS_DIR) if settings.UPLOADS_DIR else Path(__file__).parent / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}
