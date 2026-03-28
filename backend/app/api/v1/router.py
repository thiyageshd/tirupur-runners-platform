from fastapi import APIRouter
from app.api.v1.endpoints import auth, memberships, payments, admin, settings

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(memberships.router)
api_router.include_router(payments.router)
api_router.include_router(admin.router)
api_router.include_router(settings.router)
