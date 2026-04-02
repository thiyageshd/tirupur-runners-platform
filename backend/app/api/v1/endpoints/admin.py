import csv
import io
import openpyxl
import xlrd
import logging
import uuid as uuid_module
from datetime import date
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, Query, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.db.session import get_db
from app.schemas.schemas import MemberListItem, AdminStatsResponse, UserResponse, OfflineUploadResult, TshirtUpdateRequest, PendingUserItem, MembershipIdUpdateRequest, AadharUploadRequest
from app.services.membership_service import MembershipService
from app.models.models import User, Membership, Payment, MemberProfile
from app.core.security import get_current_admin
from app.utils.email import send_approval_email, send_rejection_email
from app.core.config import settings
from app.core.uploads import save_aadhar_file


router = APIRouter(prefix="/admin", tags=["admin"])

logger = logging.getLogger(__name__)


@router.get("/members", response_model=list[MemberListItem])
async def list_members(
    status: Optional[str] = Query(None, pattern="^(active|expired|pending)$"),
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
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
    # Count only approved users as "total members" — pending/rejected should not
    # increase the membership counts until approved.
    total_members = await db.scalar(
        select(func.count()).select_from(User).where(User.account_status == "approved")
    )

    active_user_ids = select(Membership.user_id).where(Membership.status == "active")
    expired_user_ids = select(Membership.user_id).where(Membership.status == "expired")

    active_count = await db.scalar(
        select(func.count(func.distinct(Membership.user_id))).where(Membership.status == "active")
    )
    expired_count = await db.scalar(
        select(func.count(func.distinct(Membership.user_id))).where(
            Membership.status == "expired",
            Membership.user_id.not_in(active_user_ids),
        )
    )
    # Pending membership payment — only users with no active or expired membership
    pending_count = await db.scalar(
        select(func.count(func.distinct(Membership.user_id))).where(
            Membership.status == "pending",
            Membership.user_id.not_in(active_user_ids),
            Membership.user_id.not_in(expired_user_ids),
        )
    )
    total_revenue = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount_paise), 0))
        .where(Payment.status == "paid")
    )

    return {
        "total_members": total_members or 0,
        "active_members": active_count or 0,
        "expired_members": expired_count or 0,
        "pending_members": pending_count or 0,
        "total_revenue_paise": total_revenue or 0,
    }


def _parse_csv_rows(content: bytes) -> list[dict]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    return [dict(row) for row in reader]


def _parse_xlsx_rows(content: bytes) -> list[dict]:
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    headers = None
    rows = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            headers = [str(h).strip() if h is not None else "" for h in row]
        else:
            rows.append({h: (str(v) if v is not None else "") for h, v in zip(headers, row)})
    return rows


def _parse_xls_rows(content: bytes) -> list[dict]:
    wb = xlrd.open_workbook(file_contents=content)
    ws = wb.sheet_by_index(0)
    headers = [str(ws.cell_value(0, c)).strip() for c in range(ws.ncols)]
    rows = []
    for r in range(1, ws.nrows):
        rows.append({h: str(ws.cell_value(r, c)) for c, h in enumerate(headers)})
    return rows


@router.post("/offline-payments/upload", response_model=OfflineUploadResult)
async def upload_offline_payments(
    file: UploadFile = File(...),
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    filename = (file.filename or "").lower()

    if filename.endswith(".csv"):
        rows = _parse_csv_rows(content)
    elif filename.endswith(".xlsx"):
        rows = _parse_xlsx_rows(content)
    elif filename.endswith(".xls"):
        rows = _parse_xls_rows(content)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use CSV, XLS, or XLSX.")

    processed = 0
    skipped = 0
    errors = []

    for row_num, row in enumerate(rows, start=2):  # row 1 = header
        mobile = str(row.get("mobile", "") or "").strip().lstrip("+")
        email = str(row.get("email", "") or "").strip().lower()
        amount_str = str(row.get("amount", "") or "").strip()
        year_str = str(row.get("year", "") or "").strip()

        if not year_str or not amount_str:
            errors.append({"row": row_num, "reason": "Missing year or amount"})
            skipped += 1
            continue

        try:
            year = int(float(year_str))
            amount_paise = int(float(amount_str) * 100)
        except ValueError:
            errors.append({"row": row_num, "reason": f"Invalid year or amount: {year_str}, {amount_str}"})
            skipped += 1
            continue

        # Find user by mobile, then email
        user = None
        if mobile:
            result = await db.execute(
                select(User).where(User.phone.like(f"%{mobile[-10:]}"))
            )
            user = result.scalar_one_or_none()
        if not user and email:
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()

        if not user:
            errors.append({"row": row_num, "reason": f"User not found (mobile={mobile}, email={email})"})
            skipped += 1
            continue

        # Check for existing membership in that year
        result = await db.execute(
            select(Membership).where(
                and_(Membership.user_id == user.id, Membership.year == year)
            )
        )
        if result.scalar_one_or_none():
            errors.append({"row": row_num, "reason": f"{user.full_name}: membership for {year} already exists"})
            skipped += 1
            continue

        idem_key = f"offline:{user.id}:{year}"

        # Check for duplicate offline payment
        result = await db.execute(
            select(Payment).where(Payment.idempotency_key == idem_key)
        )
        if result.scalar_one_or_none():
            errors.append({"row": row_num, "reason": f"{user.full_name}: offline payment for {year} already recorded"})
            skipped += 1
            continue

        # Create payment record
        payment = Payment(
            user_id=user.id,
            razorpay_order_id=idem_key,
            amount_paise=amount_paise,
            currency="INR",
            status="paid",
            idempotency_key=idem_key,
        )
        db.add(payment)
        await db.flush()

        # Create active membership
        membership = Membership(
            user_id=user.id,
            start_date=date(year, 4, 1),
            end_date=date(year + 1, 3, 31),
            status="active",
            year=year,
        )
        db.add(membership)
        await db.flush()

        payment.membership_id = membership.id
        processed += 1

    return {"processed": processed, "skipped": skipped, "errors": errors}


@router.put("/users/{user_id}/tshirt", response_model=UserResponse)
async def update_tshirt(
    user_id: uuid_module.UUID,
    data: TshirtUpdateRequest,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.t_shirt_size = data.t_shirt_size
    await db.flush()
    return user


@router.put("/users/{user_id}/toggle-admin", response_model=UserResponse)
async def toggle_admin(
    user_id: uuid_module.UUID,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if current_admin.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot remove your own admin status")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_admin = not user.is_admin
    await db.flush()
    return user


@router.get("/users/inactive")
async def get_inactive_members(
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    svc = MembershipService(db)
    await svc.sync_expired_statuses()
    result = await db.execute(
        select(User, Membership)
        .join(Membership, Membership.user_id == User.id)
        .where(User.account_status == "inactive")
        .order_by(User.full_name.asc())
    )
    rows = result.all()
    return [
        {
            "user_id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "phone": u.phone,
            "year": m.year,
            "end_date": str(m.end_date),
        }
        for u, m in rows
    ]


@router.get("/users/rejected", response_model=list[PendingUserItem])
async def get_rejected_users(
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .where(User.account_status == "rejected")
        .order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return [
        PendingUserItem(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            phone=u.phone,
            age=u.age,
            gender=u.gender,
            t_shirt_size=u.t_shirt_size,
            created_at=u.created_at,
            aadhar_url=u.profile.aadhar_url if u.profile else None,
        )
        for u in users
    ]


@router.get("/users/pending", response_model=list[PendingUserItem])
async def get_pending_users(
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .where(User.account_status == "pending_approval")
        .order_by(User.created_at.asc())
    )
    users = result.scalars().all()
    return [
        PendingUserItem(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            phone=u.phone,
            age=u.age,
            gender=u.gender,
            t_shirt_size=u.t_shirt_size,
            created_at=u.created_at,
            aadhar_url=u.profile.aadhar_url if u.profile else None,
        )
        for u in users
    ]


@router.put("/users/{user_id}/approve", response_model=UserResponse)
async def approve_user(
    user_id: uuid_module.UUID,
    background_tasks: BackgroundTasks,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.account_status == "approved":
        raise HTTPException(status_code=400, detail="User is already approved")
    user.account_status = "approved"
    await db.flush()
    # Auto-create a pending membership for the upcoming membership year.
    # Use the current calendar year as the membership start year (Apr 1 -> Mar 31).
    try:
        year = date.today().year
        membership_svc = MembershipService(db)
        await membership_svc.create_pending_membership(user.id, year)
        logger.info(f"Auto-created pending membership for user {user.email} year={year}")
    except HTTPException as exc:
        # If an active membership already exists, ignore the conflict and proceed.
        if getattr(exc, "status_code", None) == 409:
            logger.info(f"Skipping pending membership creation for {user.email}: {exc.detail}")
        else:
            raise
    login_url = f"{settings.FRONTEND_URL}/members/login"
    background_tasks.add_task(send_approval_email, user.email, user.full_name, login_url)
    return user


@router.put("/users/{user_id}/reject", response_model=UserResponse)
async def reject_user(
    user_id: uuid_module.UUID,
    background_tasks: BackgroundTasks,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.account_status == "rejected":
        raise HTTPException(status_code=400, detail="User is already rejected")
    user.account_status = "rejected"
    await db.flush()
    background_tasks.add_task(send_rejection_email, user.email, user.full_name)
    return user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: uuid_module.UUID,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    # Only permitted admins can delete users
    permitted = [e.strip().lower() for e in settings.PROTECTED_ADMIN_EMAILS.split(",")]
    if current_admin.email.lower() not in permitted:
        raise HTTPException(status_code=403, detail="You do not have permission to delete users")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Allow deletion for users that are still pending approval or already rejected
    if user.account_status in ("pending_approval", "rejected"):
        from sqlalchemy import delete as sq_delete

        await db.execute(sq_delete(User).where(User.id == user.id))
        await db.flush()
        return {"message": f"Deleted the user {user.full_name} (status={user.account_status})"}

    # For approved users, require a pending membership to allow deletion
    if user.account_status == "approved":
        membership_result = await db.execute(
            select(Membership).where(Membership.user_id == user.id, Membership.status == "pending")
        )
        membership = membership_result.scalar_one_or_none()
        if not membership:
            raise HTTPException(status_code=400, detail="Can only delete approved users with pending membership")

        # Delete the user via a direct SQL DELETE so the ORM does not attempt to
        # null-out child PK/FK columns in Python. The DB's ON DELETE CASCADE will
        # remove dependent rows (MemberProfile, Memberships, Payments).
        from sqlalchemy import delete as sq_delete

        await db.execute(sq_delete(User).where(User.id == user.id))
        await db.flush()
        return {"message": f"Deleted the user {user.full_name} with pending membership for {membership.year}"}

    # Any other statuses are not deletable
    raise HTTPException(status_code=400, detail="Cannot delete user with current status")


@router.put("/memberships/{membership_uuid}/membership-id")
async def update_membership_id(
    membership_uuid: uuid_module.UUID,
    data: MembershipIdUpdateRequest,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    # Check uniqueness
    existing = await db.execute(
        select(Membership).where(Membership.membership_id == data.membership_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Membership ID '{data.membership_id}' is already in use")

    result = await db.execute(select(Membership).where(Membership.id == membership_uuid))
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    membership.membership_id = data.membership_id
    await db.flush()
    return {"membership_uuid": str(membership.id), "membership_id": membership.membership_id}


@router.put("/users/{user_id}/aadhar")
async def admin_replace_aadhar(
    user_id: uuid_module.UUID,
    data: AadharUploadRequest,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if not (data.aadhar_data.startswith("data:image/") or data.aadhar_data.startswith("data:application/pdf")):
        raise HTTPException(status_code=400, detail="Invalid file type. Must be image or PDF.")
    if len(data.aadhar_data) > 2_854_267:
        raise HTTPException(status_code=400, detail="File too large (max 2MB)")

    result = await db.execute(select(MemberProfile).where(MemberProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Member profile not found")

    profile.aadhar_url = save_aadhar_file(str(user_id), data.aadhar_data)
    await db.flush()
    return {"message": "Aadhar updated successfully"}
