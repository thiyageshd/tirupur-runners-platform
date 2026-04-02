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

    async def _has_prior_paid_membership(self, user_id) -> bool:
        """Returns True if the user has ever had a paid membership."""
        result = await self.db.execute(
            select(Payment).where(
                Payment.user_id == user_id,
                Payment.status == "paid",
            )
        )
        return result.scalar_one_or_none() is not None

    async def create_order(self, user_id, year: int) -> dict:
        """
        Idempotent: if an unpaid order exists for this user+year, return it.
        If already paid, raise 409.
        New members pay ₹2000; existing members renew at ₹1500.
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
                "is_renewal": existing.amount_paise == settings.MEMBERSHIP_RENEWAL_AMOUNT_PAISE,
            }

        # Determine pricing: existing members renew at ₹1500, new at ₹2000
        is_renewal = await self._has_prior_paid_membership(user_id)
        amount_paise = (
            settings.MEMBERSHIP_RENEWAL_AMOUNT_PAISE
            if is_renewal
            else settings.MEMBERSHIP_NEW_AMOUNT_PAISE
        )

        # Create pending membership first
        membership_svc = MembershipService(self.db)
        membership = await membership_svc.create_pending_membership(user_id, year)

        # Create Razorpay order
        rz_order = self.rz.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"m{str(user_id).replace('-','')[:10]}{year}",
            "notes": {"user_id": str(user_id), "year": str(year)},
        })

        # Persist payment record
        payment = Payment(
            user_id=user_id,
            membership_id=membership.id,
            razorpay_order_id=rz_order["id"],
            amount_paise=amount_paise,
            currency="INR",
            status="created",
            idempotency_key=ikey,
            metadata_={"year": year, "receipt": rz_order.get("receipt"), "is_renewal": is_renewal},
        )
        self.db.add(payment)
        await self.db.flush()

        return {
            "order_id": rz_order["id"],
            "amount": amount_paise,
            "currency": "INR",
            "key_id": settings.RAZORPAY_KEY_ID,
            "is_renewal": is_renewal,
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

    async def sync_order_status(self, user_id) -> dict:
        """
        Admin action: check a stuck 'created' payment against Razorpay.
        - If Razorpay says paid/captured → activate membership.
        - If still pending or failed → mark payment failed, reset membership to
          'expired' so the user can initiate a fresh payment.
        """
        result = await self.db.execute(
            select(Payment)
            .where(Payment.user_id == user_id, Payment.status == "created")
            .order_by(Payment.created_at.desc())
        )
        payment = result.scalar_one_or_none()
        if not payment:
            raise HTTPException(status_code=404, detail="No pending payment found for this user")

        try:
            rz_order = self.rz.order.fetch(payment.razorpay_order_id)
        except Exception:
            raise HTTPException(status_code=502, detail="Could not reach Razorpay. Try again.")

        order_status = rz_order.get("status")  # created | attempted | paid

        if order_status == "paid":
            # Order paid — fetch the captured payment_id from payment items
            try:
                rz_payments = self.rz.order.payments(payment.razorpay_order_id)
                captured = next(
                    (p for p in rz_payments.get("items", []) if p["status"] == "captured"),
                    None,
                )
                if captured:
                    payment.razorpay_payment_id = captured["id"]
            except Exception:
                pass

            payment.status = "paid"
            if payment.membership_id:
                membership_svc = MembershipService(self.db)
                await membership_svc.activate_membership(payment.membership_id)
            await self.db.flush()
            return {"result": "activated", "message": "Payment confirmed. Membership activated."}

        elif order_status == "attempted":
            # At least one payment attempt exists — check individual payment statuses
            try:
                rz_payments = self.rz.order.payments(payment.razorpay_order_id)
                items = rz_payments.get("items", [])
            except Exception:
                raise HTTPException(status_code=502, detail="Could not fetch payment details from Razorpay.")

            # If any attempt is still in flight, do not reset — ask admin to check later
            in_flight = any(p["status"] in ("created", "authorized") for p in items)
            if in_flight:
                return {
                    "result": "pending",
                    "message": "Payment is still being processed by Razorpay (UPI/netbanking in flight). Check again in a few minutes.",
                }

            # All attempts failed — safe to reset membership so user can retry
            payment.status = "failed"
            if payment.membership_id:
                mem_result = await self.db.execute(
                    select(Membership).where(Membership.id == payment.membership_id)
                )
                membership = mem_result.scalar_one_or_none()
                if membership:
                    membership.status = "expired"
            await self.db.flush()
            return {
                "result": "reset",
                "message": "All payment attempts failed. Membership reset — user can retry payment.",
            }

        else:
            # order_status == "created" — order was never attempted, user abandoned checkout
            payment.status = "failed"
            if payment.membership_id:
                mem_result = await self.db.execute(
                    select(Membership).where(Membership.id == payment.membership_id)
                )
                membership = mem_result.scalar_one_or_none()
                if membership:
                    membership.status = "expired"
            await self.db.flush()
            return {
                "result": "reset",
                "message": "Payment was never attempted. Membership reset — user can retry payment.",
            }

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
