from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _make_engine():
    url = settings.DATABASE_URL

    # Normalise plain mysql:// → mysql+aiomysql://
    if url.startswith("mysql://"):
        url = "mysql+aiomysql://" + url[len("mysql://"):]

    return create_async_engine(
        url,
        pool_pre_ping=True,
        echo=settings.DEBUG,
    )


engine = _make_engine()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
