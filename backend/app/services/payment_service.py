import hmac
import hashlib
import logging
import razorpay
from typing import Optional
from datetime import date, datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.models.models import Payment, Membership, User
from app.core.config import settings
from app.services.membership_service import MembershipService

logger = logging.getLogger(__name__)


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
        """Returns True if the user is an existing member (paid before or has an expired/active membership)."""
        result = await self.db.execute(
            select(Payment).where(
                Payment.user_id == user_id,
                Payment.status == "paid",
            )
        )
        if result.scalar_one_or_none() is not None:
            return True
        # Also treat imported members (expired membership, no payment record) as renewals
        result = await self.db.execute(
            select(Membership).where(
                Membership.user_id == user_id,
                Membership.status.in_(["expired", "active"]),
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
            if existing.status == "created":
                # Return existing pending order — user can retry payment
                return {
                    "order_id": existing.razorpay_order_id,
                    "amount": existing.amount_paise,
                    "currency": existing.currency,
                    "key_id": settings.RAZORPAY_KEY_ID,
                    "is_renewal": existing.amount_paise == settings.MEMBERSHIP_RENEWAL_AMOUNT_PAISE,
                }
            # status == "failed" — previous attempt failed (e.g. test→live key switch).
            # Create a fresh Razorpay order and update the existing payment record.

        # Determine pricing: existing members renew at ₹1500, new at ₹2000
        is_renewal = await self._has_prior_paid_membership(user_id)
        amount_paise = (
            settings.MEMBERSHIP_RENEWAL_AMOUNT_PAISE
            if is_renewal
            else settings.MEMBERSHIP_NEW_AMOUNT_PAISE
        )
        # Override with test amount if set (e.g. 100 paise = ₹1 for live payment testing)
        if settings.PAYMENT_TEST_AMOUNT_PAISE > 0:
            amount_paise = settings.PAYMENT_TEST_AMOUNT_PAISE

        # Resolve membership: reuse/reset the linked one, or create new
        membership_svc = MembershipService(self.db)
        if existing and existing.membership_id:
            mem_result = await self.db.execute(
                select(Membership).where(Membership.id == existing.membership_id)
            )
            membership = mem_result.scalar_one_or_none()
            if membership:
                membership.status = "pending"
            else:
                membership = await membership_svc.create_pending_membership(user_id, year)
                existing.membership_id = membership.id
        else:
            membership = await membership_svc.create_pending_membership(user_id, year)

        # Create Razorpay order
        retry_suffix = "r" if existing else ""
        rz_order = self.rz.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"m{str(user_id).replace('-','')[:10]}{year}{retry_suffix}",
            "notes": {"user_id": str(user_id), "year": str(year)},
        })

        if existing:
            # Update the failed payment record with the new order
            existing.razorpay_order_id = rz_order["id"]
            existing.amount_paise = amount_paise
            existing.status = "created"
            existing.membership_id = membership.id
            existing.metadata_ = {"year": year, "receipt": rz_order.get("receipt"), "is_renewal": is_renewal}
            await self.db.flush()
        else:
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

        await self._save_receipt_for_payment(payment)
        await self.db.flush()
        return payment

    async def sync_stale_payments(self, user_id=None, min_age_minutes: int = 0) -> None:
        """
        Best-effort lazy sync — called automatically on membership/admin fetch.
        Never raises; failures are silently logged so the main request is unaffected.

        user_id      → check only that user's pending payment (dashboard load)
        min_age_minutes=30 → only check payments older than 30 mins (admin bulk load)
        """
        query = select(Payment).where(Payment.status == "created")
        if user_id:
            query = query.where(Payment.user_id == user_id)
        if min_age_minutes > 0:
            cutoff = datetime.now(timezone.utc) - timedelta(minutes=min_age_minutes)
            query = query.where(Payment.created_at < cutoff)

        result = await self.db.execute(query)
        payments = result.scalars().all()

        for payment in payments:
            try:
                rz_order = self.rz.order.fetch(payment.razorpay_order_id)
                order_status = rz_order.get("status")

                if order_status == "paid":
                    rz_payments = self.rz.order.payments(payment.razorpay_order_id)
                    captured = next(
                        (p for p in rz_payments.get("items", []) if p["status"] == "captured"),
                        None,
                    )
                    if captured:
                        payment.razorpay_payment_id = captured["id"]
                    payment.status = "paid"
                    if payment.membership_id:
                        membership_svc = MembershipService(self.db)
                        await membership_svc.activate_membership(payment.membership_id)
                    await self._save_receipt_for_payment(payment)
                    logger.info(f"Auto-activated membership for payment {payment.id}")

                elif order_status == "attempted":
                    rz_payments = self.rz.order.payments(payment.razorpay_order_id)
                    items = rz_payments.get("items", [])
                    in_flight = any(p["status"] in ("created", "authorized") for p in items)
                    if not in_flight:
                        # All attempts failed — reset
                        payment.status = "failed"
                        await self._reset_membership(payment)
                        logger.info(f"Auto-reset membership for failed payment {payment.id}")

                elif order_status == "created":
                    # Never attempted — reset
                    payment.status = "failed"
                    await self._reset_membership(payment)
                    logger.info(f"Auto-reset membership for abandoned payment {payment.id}")

            except Exception as exc:
                logger.warning(f"sync_stale_payments: skipping payment {payment.id}: {exc}")

        if payments:
            try:
                await self.db.flush()
            except Exception as exc:
                logger.warning(f"sync_stale_payments flush error: {exc}")

    def _make_receipt_html(self, payment: Payment, user) -> str:
        year_str = payment.idempotency_key.split(":")[-1] if payment.idempotency_key else ""
        try:
            year_num = int(year_str)
            fy_label = f"FY {year_num}\u2013{str(year_num + 1)[-2:]}"
        except (ValueError, TypeError):
            fy_label = "\u2014"
        is_offline = bool(payment.idempotency_key and payment.idempotency_key.startswith("offline:"))
        amount_str = f"\u20b9{payment.amount_paise // 100:,}"
        pay_ref = payment.razorpay_payment_id or payment.razorpay_order_id or "\u2014"
        pay_date = payment.created_at.strftime("%d %b %Y") if payment.created_at else "\u2014"
        member_name = user.full_name if user else ""
        member_email = user.email if user else ""
        member_phone = user.phone if user else ""
        offline_label = " (Offline)" if is_offline else ""
        return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt \u2013 Tirupur Runners Club</title>
<style>
  body{{font-family:sans-serif;max-width:480px;margin:48px auto;padding:24px;color:#111}}
  h2{{color:#16a34a;margin:0 0 2px}}
  .sub{{color:#888;font-size:13px;margin-bottom:28px}}
  table{{width:100%;border-collapse:collapse}}
  td{{padding:9px 0;border-bottom:1px solid #f0f0f0;font-size:14px;vertical-align:top}}
  td:first-child{{color:#888;width:38%}}
  td:last-child{{font-weight:500;word-break:break-all}}
  .amount{{font-size:20px;font-weight:700;color:#16a34a}}
  .badge{{display:inline-block;background:#dcfce7;color:#15803d;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600}}
  .footer{{margin-top:28px;font-size:11px;color:#bbb;text-align:center;border-top:1px solid #f0f0f0;padding-top:16px}}
  .print-btn{{margin-top:20px;padding:8px 20px;background:#16a34a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px}}
  @media print{{.print-btn{{display:none}}}}
</style></head><body>
<h2>Tirupur Runners Club</h2>
<p class="sub">Membership Payment Receipt</p>
<table>
  <tr><td>Member</td><td>{member_name}</td></tr>
  <tr><td>Email</td><td>{member_email}</td></tr>
  <tr><td>Phone</td><td>{member_phone}</td></tr>
  <tr><td>Membership</td><td>{fy_label}{offline_label}</td></tr>
  <tr><td>Payment Ref</td><td>{pay_ref}</td></tr>
  <tr><td>Date</td><td>{pay_date}</td></tr>
  <tr><td>Status</td><td><span class="badge">Paid</span></td></tr>
  <tr><td>Amount</td><td class="amount">{amount_str}</td></tr>
</table>
<button class="print-btn" onclick="window.print()">Print Receipt</button>
<p class="footer">Tirupur Runners Club &middot; tirupurrunners@gmail.com &middot; +91 94882 52599</p>
</body></html>"""

    async def _save_receipt_for_payment(self, payment: Payment) -> None:
        """Generate receipt HTML, save to disk, set payment.receipt_url. Never raises."""
        try:
            from app.core.uploads import save_receipt_file
            user_result = await self.db.execute(select(User).where(User.id == payment.user_id))
            user = user_result.scalar_one_or_none()
            year_str = payment.idempotency_key.split(":")[-1] if payment.idempotency_key else ""
            try:
                year = int(year_str)
            except (ValueError, TypeError):
                year = datetime.now(timezone.utc).year
            html = self._make_receipt_html(payment, user)
            payment.receipt_url = save_receipt_file(str(payment.id), year, html)
        except Exception as exc:
            logger.warning(f"_save_receipt_for_payment: {exc}")

    async def _reset_membership(self, payment: Payment) -> None:
        """Set the linked membership back to 'expired' so the user can retry payment."""
        if not payment.membership_id:
            return
        result = await self.db.execute(
            select(Membership).where(Membership.id == payment.membership_id)
        )
        membership = result.scalar_one_or_none()
        if membership:
            membership.status = "expired"

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
            await self._save_receipt_for_payment(payment)
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
                await self._save_receipt_for_payment(payment)
                await self.db.flush()

        return {"status": "ok"}
