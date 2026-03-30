import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, Integer, Date,
    DateTime, ForeignKey, JSON, Text, text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(200), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    address = Column(String(500), nullable=True)
    emergency_contact = Column(String(200), nullable=True)
    emergency_phone = Column(String(20), nullable=True)
    emergency_contact_2 = Column(String(200), nullable=True)
    emergency_phone_2 = Column(String(20), nullable=True)
    account_status = Column(String(20), nullable=False, default="approved")
    t_shirt_size = Column(String(10), nullable=True)
    hashed_password = Column(String(255), nullable=True)
    otp_secret = Column(String(64), nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    memberships = relationship("Membership", back_populates="user", lazy="select")
    payments = relationship("Payment", back_populates="user", lazy="select")
    # Use passive_deletes so SQLAlchemy won't try to NULL out the FK on child
    # objects (DB has ON DELETE CASCADE) — this avoids errors where child
    # PK/FK columns are non-nullable / primary keys and cannot be blanked.
    profile = relationship(
        "MemberProfile",
        back_populates="user",
        uselist=False,
        lazy="selectin",
        passive_deletes=True,
    )


class Membership(Base):
    __tablename__ = "memberships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    membership_id = Column(String(20), unique=True, nullable=True, index=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    # active | expired | pending
    status = Column(String(20), nullable=False, default="pending")
    year = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User", back_populates="memberships")
    payments = relationship("Payment", back_populates="membership", lazy="select")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    membership_id = Column(UUID(as_uuid=True), ForeignKey("memberships.id", ondelete="SET NULL"), nullable=True)
    razorpay_order_id = Column(String(100), unique=True, nullable=False, index=True)
    razorpay_payment_id = Column(String(100), nullable=True)
    razorpay_signature = Column(String(255), nullable=True)
    amount_paise = Column(Integer, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    # created | paid | failed
    status = Column(String(20), nullable=False, default="created")
    # Idempotency: user_id + year, prevents duplicate memberships
    idempotency_key = Column(String(100), unique=True, nullable=False, index=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="payments")
    membership = relationship("Membership", back_populates="payments")


class MemberProfile(Base):
    __tablename__ = "member_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    blood_group = Column(String(10), nullable=True)
    photo_url = Column(Text, nullable=True)
    profession = Column(String(100), nullable=True)
    work_details = Column(String(500), nullable=True)
    interests = Column(String(500), nullable=True)
    bio = Column(String(1000), nullable=True)
    strava_link = Column(String(200), nullable=True)
    aadhar_url = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Let DB cascade deletes; avoid ORM nullification attempts on PK/FK
    user = relationship("User", back_populates="profile", passive_deletes=True)


class SiteSettings(Base):
    __tablename__ = "site_settings"

    key = Column(String(100), primary_key=True)
    value = Column(String(2000), nullable=False, default="")
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
