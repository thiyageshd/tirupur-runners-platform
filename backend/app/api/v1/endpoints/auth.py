import pyotp
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.schemas import (
    RegisterRequest, LoginRequest, OTPRequest,
    OTPVerifyRequest, TokenResponse, UserResponse, UpdateProfileRequest,
    MemberProfileResponse, MemberProfileUpdate,
    ForgotPasswordRequest, ResetPasswordRequest, PhotoUploadRequest,
    ChangePasswordRequest, AadharUploadRequest,
)
from app.services.user_service import UserService
from app.core.security import get_current_user, hash_password, verify_password
from app.utils.email import send_otp_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    svc = UserService(db)
    user = await svc.register(data)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    svc = UserService(db)
    token = await svc.login_password(data.identifier, data.password)
    return {"access_token": token}


@router.post("/otp/request")
async def request_otp(
    data: OTPRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    otp = await svc.generate_otp(data.email)
    background_tasks.add_task(send_otp_email, data.email, otp)
    return {"message": "OTP sent to your email"}


@router.post("/otp/verify", response_model=TokenResponse)
async def verify_otp(data: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    svc = UserService(db)
    token = await svc.verify_otp(data.email, data.otp)
    return {"access_token": token}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UpdateProfileRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    return await svc.update_profile(current_user.id, data)


@router.get("/me/profile", response_model=MemberProfileResponse)
async def get_my_profile(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    profile = await svc.get_or_create_profile(current_user.id)
    return profile


@router.put("/me/profile", response_model=MemberProfileResponse)
async def update_my_profile(
    data: MemberProfileUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    profile = await svc.get_or_create_profile(current_user.id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(profile, field, value)
    await db.flush()
    return profile


@router.put("/me/photo", response_model=MemberProfileResponse)
async def upload_photo(
    data: PhotoUploadRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not data.photo_data.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Invalid image format. Must be a base64 data URI.")
    # ~700KB base64 ≈ 500KB raw image
    if len(data.photo_data) > 716800:
        raise HTTPException(status_code=400, detail="Image too large. Maximum size is 500KB.")
    svc = UserService(db)
    profile = await svc.get_or_create_profile(current_user.id)
    profile.photo_url = data.photo_data
    await db.flush()
    return profile


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.hashed_password:
        raise HTTPException(status_code=400, detail="No password set on this account. Use OTP login.")
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(data.new_password)
    await db.flush()
    return {"message": "Password changed successfully"}


@router.put("/me/aadhar", response_model=MemberProfileResponse)
async def upload_aadhar(
    data: AadharUploadRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not (data.aadhar_data.startswith("data:image/") or data.aadhar_data.startswith("data:application/pdf")):
        raise HTTPException(status_code=400, detail="Invalid format. Must be a base64 image or PDF data URI.")
    # 2MB base64 ≈ 2_854_267 chars
    if len(data.aadhar_data) > 2_854_267:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 2MB.")
    svc = UserService(db)
    profile = await svc.get_or_create_profile(current_user.id)
    profile.aadhar_url = data.aadhar_data
    await db.flush()
    return profile


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    user = await svc.get_by_identifier(data.identifier)
    if user and user.otp_secret:
        otp = pyotp.TOTP(user.otp_secret, interval=300).now()
        background_tasks.add_task(send_otp_email, user.email, otp)
    return {"message": "If this account exists, an OTP has been sent to the registered email"}


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    user = await svc.get_by_identifier(data.identifier)
    if not user or not user.otp_secret:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    totp = pyotp.TOTP(user.otp_secret, interval=300)
    if not totp.verify(data.otp, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    user.hashed_password = hash_password(data.new_password)
    await db.flush()
    return {"message": "Password updated successfully"}
