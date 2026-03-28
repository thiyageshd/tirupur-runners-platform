import hmac
import hashlib
import razorpay
from typing import Optional
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.models.models import Payment, Membership
from app.core.config import settings
from app.services.membership_service import MembershipService


def get_razorpay_client() -> razorpay.Client:
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


class PaymentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.rz = get_razorpay_client()

    def _idempotency_key(self, user_id, year: int) -> str:
        return f"member:{user_id}:{year}"

    async def get_existing_order(self, idempotency_key: str) -> Optional[Payment]:
        result = await self.db.execute(
            select(Payment).where(Payment.idempotency_key == idempotency_key)
        )
        return result.scalar_one_or_none()

    async def create_order(self, user_id, year: int) -> dict:
        """
        Idempotent: if an unpaid order exists for this user+year, return it.
        If already paid, raise 409.
        """
        ikey = self._idempotency_key(user_id, year)
        existing = await self.get_existing_order(ikey)

        if existing:
            if existing.status == "paid":
                raise HTTPException(
                    status_code=409,
                    detail=f"Membership for year {year} already paid",
                )
            # Return existing pending order — user can retry payment
            return {
                "order_id": existing.razorpay_order_id,
                "amount": existing.amount_paise,
                "currency": existing.currency,
                "key_id": settings.RAZORPAY_KEY_ID,
            }

        # Create pending membership first
        membership_svc = MembershipService(self.db)
        membership = await membership_svc.create_pending_membership(user_id, year)

        # Create Razorpay order
        rz_order = self.rz.order.create({
            "amount": settings.MEMBERSHIP_AMOUNT_PAISE,
            "currency": "INR",
            "receipt": f"rcpt_{user_id}_{year}",
            "notes": {"user_id": str(user_id), "year": str(year)},
        })

        # Persist payment record
        payment = Payment(
            user_id=user_id,
            membership_id=membership.id,
            razorpay_order_id=rz_order["id"],
            amount_paise=settings.MEMBERSHIP_AMOUNT_PAISE,
            currency="INR",
            status="created",
            idempotency_key=ikey,
            metadata_={"year": year, "receipt": rz_order.get("receipt")},
        )
        self.db.add(payment)
        await self.db.flush()

        return {
            "order_id": rz_order["id"],
            "amount": settings.MEMBERSHIP_AMOUNT_PAISE,
            "currency": "INR",
            "key_id": settings.RAZORPAY_KEY_ID,
        }

    async def verify_and_activate(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> Payment:
        """Verify HMAC signature, activate membership, mark payment paid."""
        # Signature check
        body = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode(),
            body.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected, razorpay_signature):
            raise HTTPException(status_code=400, detail="Invalid payment signature")

        # Fetch payment record
        result = await self.db.execute(
            select(Payment).where(Payment.razorpay_order_id == razorpay_order_id)
        )
        payment = result.scalar_one_or_none()
        if not payment:
            raise HTTPException(status_code=404, detail="Order not found")

        # Idempotent — already processed
        if payment.status == "paid":
            return payment

        payment.razorpay_payment_id = razorpay_payment_id
        payment.razorpay_signature = razorpay_signature
        payment.status = "paid"

        # Activate linked membership
        if payment.membership_id:
            membership_svc = MembershipService(self.db)
            await membership_svc.activate_membership(payment.membership_id)

        await self.db.flush()
        return payment

    async def handle_webhook(self, event: str, payload: dict) -> dict:
        """
        Razorpay webhook handler — idempotent.
        Only handles payment.captured for now.
        """
        if event == "payment.captured":
            payment_entity = payload.get("payment", {}).get("entity", {})
            order_id = payment_entity.get("order_id")
            payment_id = payment_entity.get("id")

            result = await self.db.execute(
                select(Payment).where(Payment.razorpay_order_id == order_id)
            )
            payment = result.scalar_one_or_none()

            if payment and payment.status != "paid":
                payment.razorpay_payment_id = payment_id
                payment.status = "paid"
                if payment.membership_id:
                    membership_svc = MembershipService(self.db)
                    await membership_svc.activate_membership(payment.membership_id)
                await self.db.flush()

        return {"status": "ok"}
