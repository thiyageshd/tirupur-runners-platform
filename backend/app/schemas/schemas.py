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
    emergency_contact_2: Optional[str] = Field(None, max_length=200)
    emergency_phone_2: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)
    t_shirt_size: str = Field(..., pattern=r"^(XS|S|M|L|XL|XXL|XXXL)$")
    dob: date
    ec_ref_name: str = Field(..., min_length=2, max_length=200)
    ec_ref_phone: str = Field(..., min_length=10, max_length=20)
    member_ref_name: str = Field(..., min_length=2, max_length=200)
    member_ref_phone: str = Field(..., min_length=10, max_length=20)


class LoginRequest(BaseModel):
    identifier: str = Field(..., description="Email address or mobile number")
    password: str


class OTPRequest(BaseModel):
    email: EmailStr


class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=200)
    phone: Optional[str] = Field(None, pattern=r"^\+?[6-9]\d{9}$")
    age: Optional[int] = Field(None, ge=5, le=100)
    gender: Optional[str] = Field(None, pattern=r"^(male|female|other|not_specified)$")
    address: Optional[str] = Field(None, max_length=500)
    emergency_contact: Optional[str] = Field(None, max_length=200)
    emergency_phone: Optional[str] = None
    emergency_contact_2: Optional[str] = Field(None, max_length=200)
    emergency_phone_2: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str = Field(..., min_length=8)


# ─── Member Profile ───────────────────────────────────────────────────────────

class MemberProfileResponse(BaseModel):
    blood_group: Optional[str] = None
    photo_url: Optional[str] = None
    profession: Optional[str] = None
    work_details: Optional[str] = None
    interests: Optional[str] = None
    bio: Optional[str] = None
    strava_link: Optional[str] = None
    aadhar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class MemberProfileUpdate(BaseModel):
    blood_group: Optional[str] = Field(None, max_length=10)
    photo_url: Optional[str] = None  # accepts URL or base64 data URI
    profession: Optional[str] = Field(None, max_length=100)
    work_details: Optional[str] = Field(None, max_length=500)
    interests: Optional[str] = Field(None, max_length=500)
    bio: Optional[str] = Field(None, max_length=1000)
    strava_link: Optional[str] = Field(None, max_length=200)


class PhotoUploadRequest(BaseModel):
    photo_data: str = Field(..., description="Base64 data URI, e.g. data:image/jpeg;base64,...")


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
    emergency_phone: Optional[str] = None
    emergency_contact_2: Optional[str] = None
    emergency_phone_2: Optional[str] = None
    account_status: str = "approved"
    is_admin: bool
    t_shirt_size: Optional[str] = None
    profile: Optional[MemberProfileResponse] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Membership ──────────────────────────────────────────────────────────────

class MembershipResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    membership_id: Optional[str] = None
    start_date: date
    end_date: date
    status: str
    year: int
    is_ec_member: bool = False
    ec_title: Optional[str] = None
    ec_fy: Optional[str] = None
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
    is_admin: bool
    t_shirt_size: Optional[str] = None
    account_status: str
    membership_status: str
    membership_year: int
    membership_id: Optional[str] = None
    membership_uuid: Optional[str] = None
    start_date: Optional[date]
    end_date: Optional[date]
    created_at: datetime
    aadhar_url: Optional[str] = None
    dob: Optional[date] = None
    # User address & emergency contacts
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    emergency_contact_2: Optional[str] = None
    emergency_phone_2: Optional[str] = None
    # Reference fields
    ec_ref_name: Optional[str] = None
    ec_ref_phone: Optional[str] = None
    member_ref_name: Optional[str] = None
    member_ref_phone: Optional[str] = None
    # EC membership
    is_ec_member: bool = False
    ec_title: Optional[str] = None
    ec_fy: Optional[str] = None
    # Profile fields
    blood_group: Optional[str] = None
    strava_link: Optional[str] = None

    model_config = {"from_attributes": True}


class MembershipIdUpdateRequest(BaseModel):
    membership_id: str = Field(..., min_length=3, max_length=20)


class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    t_shirt_size: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None


class AdminStatsResponse(BaseModel):
    total_members: int
    active_members: int
    expired_members: int
    pending_members: int
    total_revenue_paise: int


class OfflinePaymentRow(BaseModel):
    row: int
    reason: str


class OfflineUploadResult(BaseModel):
    processed: int
    skipped: int
    errors: List[OfflinePaymentRow]


class TshirtUpdateRequest(BaseModel):
    t_shirt_size: str = Field(..., pattern=r"^(XS|S|M|L|XL|XXL|XXXL)$")


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class AadharUploadRequest(BaseModel):
    aadhar_data: str  # base64 data URI (image/* or application/pdf)


class PaymentHistoryItem(BaseModel):
    id: uuid.UUID
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    idempotency_key: str
    amount_paise: int
    status: str
    receipt_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PendingUserItem(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    phone: str
    age: int
    gender: str
    t_shirt_size: Optional[str] = None
    created_at: datetime
    aadhar_url: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    dob: Optional[date] = None
    ec_ref_name: Optional[str] = None
    ec_ref_phone: Optional[str] = None
    member_ref_name: Optional[str] = None
    member_ref_phone: Optional[str] = None
    blood_group: Optional[str] = None
    strava_link: Optional[str] = None
    photo_url: Optional[str] = None
    profession: Optional[str] = None
    work_details: Optional[str] = None
    interests: Optional[str] = None
    bio: Optional[str] = None

    model_config = {"from_attributes": True}


class ValidateRefsRequest(BaseModel):
    ec_ref_phone: str
    member_ref_phone: str
