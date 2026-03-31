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
    ADMIN_EMAIL: str = "tirupurrunners@gmail.com"
    # Comma-separated admin emails permitted to delete users
    PROTECTED_ADMIN_EMAILS: str = "thiyagesh.d@gmail.com"

    # Email — Gmail SMTP — reserved for future use
    GMAIL_USER: str = "tirupurrunners@gmail.com"        # e.g. tirupurrunners@gmail.com
    GMAIL_APP_PASSWORD: str = "ylzzpldrdptecljc"  # 16-char Google App Password
    FROM_EMAIL: str = "noreply@tirupurrunners.com"
    RESEND_API_KEY: str = "re_Bw22ZR6j_LaP2gjM7xwSA1xyiZxw8ecxr"

    # CORS + Email links (override per environment)
    # localhost:  http://localhost:5173
    # dev:        https://tirupur-runners-web-dev.onrender.com
    # prod:       https://tirupurrunners.com
    FRONTEND_URL: str = "http://localhost:5173"

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
