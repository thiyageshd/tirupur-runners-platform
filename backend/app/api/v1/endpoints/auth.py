from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.schemas import (
    RegisterRequest, LoginRequest, OTPRequest,
    OTPVerifyRequest, TokenResponse, UserResponse
)
from app.services.user_service import UserService
from app.core.security import get_current_user
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
    token = await svc.login_password(data.email, data.password)
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
