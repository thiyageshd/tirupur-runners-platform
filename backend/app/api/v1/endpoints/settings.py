from typing import Dict
from fastapi import APIRouter, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.models import SiteSettings
from app.core.security import get_current_admin

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULT_SETTINGS = {
    "contact_email": "tirupurrunners@gmail.com",
    "contact_phone": "+91 94882 52599",
    "run_location": "Tirupur Collectorate",
    "run_day_time": "Every Sunday, 5:30 AM",
    "maps_link": "https://maps.google.com/?q=Tirupur+Collectorate,Tirupur,Tamil+Nadu",
    "show_login": "true",
    "show_register": "true",
    "show_join_club": "true",
}


@router.get("")
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SiteSettings))
    rows = result.scalars().all()
    settings = dict(DEFAULT_SETTINGS)
    for row in rows:
        settings[row.key] = row.value
    return settings


@router.put("")
async def update_settings(
    data: Dict[str, str] = Body(...),
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    for key, value in data.items():
        result = await db.execute(select(SiteSettings).where(SiteSettings.key == key))
        existing = result.scalar_one_or_none()
        if existing:
            existing.value = str(value)
        else:
            db.add(SiteSettings(key=key, value=str(value)))
    await db.flush()
    return {"ok": True}
