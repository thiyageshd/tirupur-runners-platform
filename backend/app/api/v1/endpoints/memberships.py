from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import date

from app.db.session import get_db
from app.schemas.schemas import MembershipResponse
from app.services.membership_service import MembershipService
from app.models.models import Membership
from app.core.security import get_current_user

router = APIRouter(prefix="/memberships", tags=["memberships"])


@router.get("/my", response_model=MembershipResponse)
async def get_my_membership(
    year: Optional[int] = Query(None, description="Fetch membership for a specific year"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = MembershipService(db)
    if year is not None:
        result = await db.execute(
            select(Membership).where(
                and_(Membership.user_id == current_user.id, Membership.year == year)
            )
        )
        membership = result.scalar_one_or_none()
    else:
        membership = await svc.get_latest_membership(current_user.id)
    if not membership:
        raise HTTPException(status_code=404, detail="No membership found")
    return membership


@router.get("/my/active", response_model=MembershipResponse)
async def get_active_membership(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = MembershipService(db)
    membership = await svc.get_active_membership(current_user.id)
    if not membership:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="No active membership")
    return membership
