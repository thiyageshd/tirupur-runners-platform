import csv
import io
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.schemas.schemas import MemberListItem, AdminStatsResponse
from app.services.membership_service import MembershipService
from app.models.models import User, Membership, Payment
from app.core.security import get_current_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/members", response_model=list[MemberListItem])
async def list_members(
    status: Optional[str] = Query(None, pattern="^(active|expired|pending)$"),
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    # Lazily sync expired memberships on admin access
    svc = MembershipService(db)
    await svc.sync_expired_statuses()
    members = await svc.get_all_with_user(status_filter=status)
    return members


@router.get("/members/export")
async def export_members_csv(
    status: Optional[str] = Query(None),
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    svc = MembershipService(db)
    await svc.sync_expired_statuses()
    members = await svc.get_all_with_user(status_filter=status)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "full_name", "email", "phone", "age", "gender",
            "membership_status", "membership_year", "start_date", "end_date", "created_at"
        ],
    )
    writer.writeheader()
    for m in members:
        writer.writerow({
            "full_name": m["full_name"],
            "email": m["email"],
            "phone": m["phone"],
            "age": m["age"],
            "gender": m["gender"],
            "membership_status": m["membership_status"],
            "membership_year": m["membership_year"],
            "start_date": m["start_date"],
            "end_date": m["end_date"],
            "created_at": m["created_at"],
        })

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=members.csv"},
    )


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    total_members = await db.scalar(select(func.count()).select_from(User))

    active_count = await db.scalar(
        select(func.count()).select_from(Membership).where(Membership.status == "active")
    )
    expired_count = await db.scalar(
        select(func.count()).select_from(Membership).where(Membership.status == "expired")
    )
    total_revenue = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount_paise), 0))
        .where(Payment.status == "paid")
    )

    return {
        "total_members": total_members or 0,
        "active_members": active_count or 0,
        "expired_members": expired_count or 0,
        "total_revenue_paise": total_revenue or 0,
    }
