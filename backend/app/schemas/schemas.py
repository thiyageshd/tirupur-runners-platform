from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator
import uuid


# ─── Auth ────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(..., pattern=r"^\+?[6-9]\d{9}$")
    age: int = Field(..., ge=5, le=100)
    gender: str = Field(..., pattern=r"^(male|female|other)$")
    address: Optional[str] = Field(None, max_length=500)
    emergency_contact: Optional[str] = Field(None, max_length=200)
    emergency_phone: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OTPRequest(BaseModel):
    email: EmailStr


class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ─── User ─────────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    phone: str
    age: int
    gender: str
    address: Optional[str]
    emergency_contact: Optional[str]
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Membership ──────────────────────────────────────────────────────────────

class MembershipResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    start_date: date
    end_date: date
    status: str
    year: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Payment ─────────────────────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    year: Optional[int] = None  # defaults to current year


class OrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str


class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class WebhookPayload(BaseModel):
    event: str
    payload: dict


# ─── Admin ───────────────────────────────────────────────────────────────────

class MemberListItem(BaseModel):
    user_id: uuid.UUID
    full_name: str
    email: str
    phone: str
    age: int
    gender: str
    membership_status: str
    membership_year: int
    start_date: Optional[date]
    end_date: Optional[date]
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminStatsResponse(BaseModel):
    total_members: int
    active_members: int
    expired_members: int
    total_revenue_paise: int
