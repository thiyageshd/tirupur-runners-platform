import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Tirupur Runners Club"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str  # e.g. postgresql+asyncpg://user:pass@host/db

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h

    # Razorpay
    RAZORPAY_KEY_ID: str
    RAZORPAY_KEY_SECRET: str
    RAZORPAY_WEBHOOK_SECRET: str
    MEMBERSHIP_AMOUNT_PAISE: int = 200000       # ₹2000 in paise (new members)
    MEMBERSHIP_NEW_AMOUNT_PAISE: int = 200000   # ₹2000 — first-time members
    MEMBERSHIP_RENEWAL_AMOUNT_PAISE: int = 150000  # ₹1500 — renewal for existing members

    # Admin
    ADMIN_EMAIL: str = "admin@tirupurrunners.com"

    # Email (Gmail SMTP)
    GMAIL_USER: str = ""        # e.g. tirupurrunnersmarathon@gmail.com
    GMAIL_APP_PASSWORD: str = ""  # 16-char Google App Password
    FROM_EMAIL: str = "noreply@tirupurrunners.com"

    # CORS
    FRONTEND_URL: str = "https://tirupurrunners.com"

    class Config:
        # Allow selecting env file via ENV_FILE env var:
        #   ENV_FILE=.env.dev uvicorn main:app --reload   → loads .env.dev
        #   ENV_FILE=.env.prod uvicorn main:app           → loads .env.prod
        #   (default)                                     → loads .env
        env_file = os.getenv("ENV_FILE", ".env")
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
