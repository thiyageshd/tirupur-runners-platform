import ssl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _make_engine():
    url = settings.DATABASE_URL
    kwargs: dict = dict(
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        echo=settings.DEBUG,
    )
    # asyncpg cannot parse ssl/sslmode from the query string — strip it and
    # pass an ssl context via connect_args instead.
    needs_ssl = any(p in url for p in ("ssl=require", "sslmode=require"))
    for p in ("?ssl=require", "&ssl=require", "?sslmode=require", "&sslmode=require"):
        url = url.replace(p, "")
    if needs_ssl:
        kwargs["connect_args"] = {"ssl": ssl.create_default_context()}
    return create_async_engine(url, **kwargs)


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
