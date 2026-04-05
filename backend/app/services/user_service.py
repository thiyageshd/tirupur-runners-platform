import re
import pyotp
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.models import User, MemberProfile
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.schemas import RegisterRequest


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.phone == phone))
        return result.scalar_one_or_none()

    async def get_by_identifier(self, identifier: str) -> Optional[User]:
        """Look up user by email or mobile number."""
        identifier = identifier.strip()
        # If it looks like a phone number (digits only, 10 digits), try phone first
        digits = identifier.replace("+91", "").replace(" ", "").replace("-", "")
        if digits.isdigit() and len(digits) >= 10:
            user = await self.get_by_phone(digits[-10:])
            if user:
                return user
        return await self.get_by_email(identifier.lower())

    async def get_by_id(self, user_id) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_or_create_profile(self, user_id) -> MemberProfile:
        result = await self.db.execute(
            select(MemberProfile).where(MemberProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            profile = MemberProfile(user_id=user_id)
            self.db.add(profile)
            await self.db.flush()
        return profile

    async def register(self, data: RegisterRequest) -> User:
        existing = await self.get_by_email(data.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        # Normalize phone to last 10 digits
        digits = re.sub(r'\D', '', data.phone)[-10:]
        existing_phone = await self.get_by_phone(digits)
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Phone number already registered",
            )
        user = User(
            full_name=data.full_name,
            email=data.email.lower(),
            phone=digits,
            age=data.age,
            gender=data.gender,
            address=data.address,
            emergency_contact=data.emergency_contact,
            emergency_phone=data.emergency_phone,
            emergency_contact_2=data.emergency_contact_2,
            emergency_phone_2=data.emergency_phone_2,
            t_shirt_size=data.t_shirt_size,
            hashed_password=hash_password(data.password) if data.password else None,
            otp_secret=pyotp.random_base32(),
            account_status="pending_approval",
            dob=data.dob,
            ec_ref_name=data.ec_ref_name,
            ec_ref_phone=data.ec_ref_phone,
            member_ref_name=data.member_ref_name,
            member_ref_phone=data.member_ref_phone,
        )
        self.db.add(user)
        await self.db.flush()
        # Create empty MemberProfile so relationship always exists
        profile = MemberProfile(user_id=user.id)
        self.db.add(profile)
        await self.db.flush()
        # Attach profile to user to avoid triggering a lazy load when serializing
        # (accessing `user.profile` would issue a sync DB load in async context)
        user.profile = profile
        return user

    async def login_password(self, identifier: str, password: str) -> str:
        user = await self.get_by_identifier(identifier)
        if not user or not user.hashed_password:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return create_access_token(user.email, user.is_admin)

    async def update_profile(self, user_id, data) -> User:
        user = await self.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(user, field, value)
        await self.db.flush()
        return user

    async def generate_otp(self, email: str) -> str:
        """Returns OTP string — caller sends it via email/SMS."""
        user = await self.get_by_email(email.lower())
        if not user:
            # Don't reveal whether email exists
            return "000000"
        totp = pyotp.TOTP(user.otp_secret, interval=300)  # 5-min window
        return totp.now()

    async def verify_otp(self, email: str, otp: str) -> str:
        user = await self.get_by_email(email.lower())
        if not user:
            raise HTTPException(status_code=401, detail="Invalid OTP")
        totp = pyotp.TOTP(user.otp_secret, interval=300)
        if not totp.verify(otp, valid_window=1):
            raise HTTPException(status_code=401, detail="Invalid or expired OTP")
        return create_access_token(user.email, user.is_admin)
