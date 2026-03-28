from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from app.db.session import get_db
from app.schemas.schemas import MembershipResponse
from app.services.membership_service import MembershipService
from app.core.security import get_current_user

router = APIRouter(prefix="/memberships", tags=["memberships"])


@router.get("/my", response_model=MembershipResponse)
async def get_my_membership(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = MembershipService(db)
    membership = await svc.get_latest_membership(current_user.id)
    if not membership:
        from fastapi import HTTPException
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
