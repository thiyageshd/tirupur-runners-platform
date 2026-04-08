from datetime import date, datetime
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from fastapi import HTTPException

from app.models.models import Membership, User, MemberProfile
from app.schemas.schemas import MembershipResponse


def current_fiscal_year() -> int:
    """Return the current fiscal year start (Apr 1 → Mar 31).
    e.g. April 2026 → 2026 (FY 2026-27), January 2026 → 2025 (FY 2025-26)."""
    today = date.today()
    return today.year if today.month >= 4 else today.year - 1


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
        # Prefer active/expired (paid) over pending (payment not yet confirmed)
        result = await self.db.execute(
            select(Membership)
            .where(
                Membership.user_id == user_id,
                Membership.status.in_(["active", "expired"]),
            )
            .order_by(Membership.year.desc())
            .limit(1)
        )
        membership = result.scalars().first()
        if membership:
            return membership
        # Fall back to pending only if no paid membership exists (first-time member)
        result = await self.db.execute(
            select(Membership)
            .where(Membership.user_id == user_id)
            .order_by(Membership.created_at.desc())
            .limit(1)
        )
        return result.scalars().first()

    async def create_pending_membership(self, user_id, year: int) -> Membership:
        """Creates a pending membership — activated on payment success."""
        existing = await self.get_active_membership(user_id)
        # Block only if there's already an active membership for the same or later year
        if existing and existing.year >= year:
            raise HTTPException(
                status_code=409,
                detail=f"Active membership exists until {existing.end_date}",
            )
        # Reuse existing pending membership for same year (idempotent on retry)
        pending_result = await self.db.execute(
            select(Membership).where(
                Membership.user_id == user_id,
                Membership.year == year,
                Membership.status == "pending",
            )
        )
        existing_pending = pending_result.scalars().first()
        if existing_pending:
            return existing_pending
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

    async def generate_membership_id(self) -> str:
        """Generate next membership ID in format YYYYMMTRnn (e.g. 202603TR01)."""
        prefix = datetime.now().strftime("%Y%m") + "TR"
        result = await self.db.execute(
            select(func.max(Membership.membership_id))
            .where(Membership.membership_id.like(f"{prefix}%"))
        )
        last_id = result.scalar()
        seq = (int(last_id[len(prefix):]) + 1) if last_id else 1
        return f"{prefix}{seq:02d}"

    async def activate_membership(self, membership_id) -> Membership:
        result = await self.db.execute(
            select(Membership).where(Membership.id == membership_id)
        )
        membership = result.scalar_one_or_none()
        if not membership:
            raise HTTPException(status_code=404, detail="Membership not found")
        # If the membership end_date is already past (e.g. payment captured late after FY end),
        # bump it to the current fiscal year so sync_expired_statuses won't immediately re-expire it.
        if membership.end_date < date.today():
            fy = current_fiscal_year()
            membership.year = fy
            membership.start_date = date(fy, 4, 1)
            membership.end_date = date(fy + 1, 3, 31)
        membership.status = "active"
        if not membership.membership_id:
            membership.membership_id = await self.generate_membership_id()
        await self.db.flush()
        return membership

    async def get_all_with_user(self, status_filter: Optional[str] = None) -> List[dict]:
        """For admin listing — joins users + memberships + profiles."""
        query = (
            select(User, Membership, MemberProfile)
            .join(Membership, User.id == Membership.user_id)
            .outerjoin(MemberProfile, User.id == MemberProfile.user_id)
            .order_by(Membership.created_at.desc())
        )
        if status_filter:
            query = query.where(Membership.status == status_filter)

        result = await self.db.execute(query)
        rows = result.all()

        seen = set()
        members = []
        for user, membership, profile in rows:
            if user.id in seen:
                continue
            seen.add(user.id)
            members.append({
                "user_id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "phone": user.phone,
                "age": user.age,
                "gender": user.gender,
                "is_admin": user.is_admin,
                "account_status": user.account_status,
                "t_shirt_size": user.t_shirt_size,
                "membership_status": membership.status,
                "membership_year": membership.year,
                "membership_id": membership.membership_id,
                "membership_uuid": str(membership.id),
                "start_date": membership.start_date,
                "end_date": membership.end_date,
                "created_at": user.created_at,
                "aadhar_url": profile.aadhar_url if profile else None,
                "dob": user.dob,
                "address": user.address,
                "emergency_contact": user.emergency_contact,
                "emergency_phone": user.emergency_phone,
                "emergency_contact_2": user.emergency_contact_2,
                "emergency_phone_2": user.emergency_phone_2,
                "ec_ref_name": user.ec_ref_name,
                "ec_ref_phone": user.ec_ref_phone,
                "member_ref_name": user.member_ref_name,
                "member_ref_phone": user.member_ref_phone,
                "is_ec_member": membership.is_ec_member,
                "ec_title": membership.ec_title,
                "ec_fy": membership.ec_fy,
                "blood_group": profile.blood_group if profile else None,
                "strava_link": profile.strava_link if profile else None,
                "profession": profile.profession if profile else None,
                "work_details": profile.work_details if profile else None,
                "interests": profile.interests if profile else None,
                "bio": profile.bio if profile else None,
            })
        return members

    async def sync_expired_statuses(self):
        """Called lazily on each admin members fetch.
        - active → expired  : when end_date has passed
        - expired → pending : when May 31 of the membership's end year has passed
                              and member has no active renewal (any financial year)
        """
        from sqlalchemy import update, cast, Integer, extract
        today = date.today()

        # Step 1: active → expired (end_date passed)
        await self.db.execute(
            update(Membership)
            .where(and_(Membership.status == "active", Membership.end_date < today))
            .values(status="expired")
        )

        active_user_ids = select(Membership.user_id).where(Membership.status == "active")
        end_year = cast(extract("year", Membership.end_date), Integer)

        # Step 2: expired → pending (after 31 May of end year, no active renewal)
        grace_deadline = func.make_date(end_year, 5, 31)
        await self.db.execute(
            update(Membership)
            .where(
                and_(
                    Membership.status == "expired",
                    grace_deadline < func.current_date(),
                    Membership.user_id.not_in(active_user_ids),
                )
            )
            .values(status="pending")
        )

        # Step 3: user account → inactive (after 31 Aug of end year, membership still pending)
        # Sets account_status = "inactive" on the User record
        inactive_deadline = func.make_date(end_year, 8, 31)
        inactive_membership_user_ids = (
            select(Membership.user_id)
            .where(
                and_(
                    Membership.status == "pending",
                    inactive_deadline < func.current_date(),
                    Membership.user_id.not_in(active_user_ids),
                )
            )
        )
        await self.db.execute(
            update(User)
            .where(
                and_(
                    User.account_status == "approved",
                    User.id.in_(inactive_membership_user_ids),
                )
            )
            .values(account_status="inactive")
        )
