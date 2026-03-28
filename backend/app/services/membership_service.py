from datetime import date
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException

from app.models.models import Membership, User
from app.schemas.schemas import MembershipResponse


class MembershipService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_active_membership(self, user_id) -> Optional[Membership]:
        today = date.today()
        result = await self.db.execute(
            select(Membership).where(
                and_(
                    Membership.user_id == user_id,
                    Membership.status == "active",
                    Membership.end_date >= today,
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_latest_membership(self, user_id) -> Optional[Membership]:
        result = await self.db.execute(
            select(Membership)
            .where(Membership.user_id == user_id)
            .order_by(Membership.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create_pending_membership(self, user_id, year: int) -> Membership:
        """Creates a pending membership — activated on payment success."""
        existing = await self.get_active_membership(user_id)
        # Block only if there's already an active membership for the same or later year
        if existing and existing.year >= year:
            raise HTTPException(
                status_code=409,
                detail=f"Active membership exists until {existing.end_date}",
            )
        # Membership runs Apr 1 → Mar 31 of following year
        start_date = date(year, 4, 1)
        end_date = date(year + 1, 3, 31)
        membership = Membership(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            status="pending",
            year=year,
        )
        self.db.add(membership)
        await self.db.flush()
        return membership

    async def activate_membership(self, membership_id) -> Membership:
        result = await self.db.execute(
            select(Membership).where(Membership.id == membership_id)
        )
        membership = result.scalar_one_or_none()
        if not membership:
            raise HTTPException(status_code=404, detail="Membership not found")
        membership.status = "active"
        await self.db.flush()
        return membership

    async def get_all_with_user(self, status_filter: Optional[str] = None) -> List[dict]:
        """For admin listing — joins users + memberships."""
        query = (
            select(User, Membership)
            .join(Membership, User.id == Membership.user_id)
            .order_by(Membership.created_at.desc())
        )
        if status_filter:
            query = query.where(Membership.status == status_filter)

        result = await self.db.execute(query)
        rows = result.all()

        members = []
        for user, membership in rows:
            members.append({
                "user_id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "phone": user.phone,
                "age": user.age,
                "gender": user.gender,
                "is_admin": user.is_admin,
                "membership_status": membership.status,
                "membership_year": membership.year,
                "start_date": membership.start_date,
                "end_date": membership.end_date,
                "created_at": user.created_at,
            })
        return members

    async def sync_expired_statuses(self):
        """Called lazily — marks memberships past end_date as expired."""
        from sqlalchemy import update
        today = date.today()
        await self.db.execute(
            update(Membership)
            .where(and_(Membership.status == "active", Membership.end_date < today))
            .values(status="expired")
        )
