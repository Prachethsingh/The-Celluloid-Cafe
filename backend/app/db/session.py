"""
Async SQLAlchemy session and engine setup.
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.base import Base  # noqa: F401 — re-exported for tests/conftest

is_sqlite = "sqlite" in settings.POSTGRES_DSN
engine_kwargs = {"echo": settings.DEBUG}
if not is_sqlite:
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": 20,
        "max_overflow": 40,
    })

engine = create_async_engine(
    settings.POSTGRES_DSN,
    **engine_kwargs
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency — yields an async session."""
    async with AsyncSessionLocal() as session:
        yield session


# On startup we rely on Alembic for schema management.
# SQLModel models are defined for type-safety & schema generation.
