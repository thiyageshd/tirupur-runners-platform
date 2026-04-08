import json
import hmac
import hashlib
from datetime import date
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.schemas import CreateOrderRequest, OrderResponse, PaymentVerifyRequest, PaymentHistoryItem
from app.services.payment_service import PaymentService
from app.services.membership_service import current_fiscal_year
from app.models.models import Payment
from app.core.security import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/my", response_model=list[PaymentHistoryItem])
async def get_my_payments(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == current_user.id)
        .order_by(desc(Payment.created_at))
    )
    return result.scalars().all()


@router.post("/order", response_model=OrderResponse)
async def create_order(
    data: CreateOrderRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account_status = getattr(current_user, 'account_status', 'approved')
    if account_status != 'approved':
        msg = {
            'pending_approval': 'Your registration is pending admin approval. You will be notified once approved.',
            'rejected': 'Your registration has been rejected. Please contact the club for assistance.',
        }.get(account_status, 'Account not authorized to make payments.')
        raise HTTPException(status_code=403, detail=msg)
    year = data.year or current_fiscal_year()
    svc = PaymentService(db)
    return await svc.create_order(current_user.id, year)


@router.post("/verify")
async def verify_payment(
    data: PaymentVerifyRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = PaymentService(db)
    payment = await svc.verify_and_activate(
        data.razorpay_order_id,
        data.razorpay_payment_id,
        data.razorpay_signature,
    )
    return {"status": "success", "payment_id": str(payment.id)}


@router.post("/webhook")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Razorpay sends webhooks — verify the X-Razorpay-Signature header.
    Configure webhook secret in Razorpay dashboard and set RAZORPAY_WEBHOOK_SECRET.
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    webhook_secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
    if webhook_secret:
        expected = hmac.new(
            webhook_secret.encode(), body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = json.loads(body)
    event = payload.get("event", "")

    svc = PaymentService(db)
    return await svc.handle_webhook(event, payload.get("payload", {}))
