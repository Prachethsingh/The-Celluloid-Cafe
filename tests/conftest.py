"""Pytest configuration and fixtures."""
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import Settings, get_settings
from app.db.session import Base, get_session
from app.main import app


@pytest.fixture(name="settings")
def settings_fixture():
    return Settings(
        POSTGRES_DSN="sqlite+aiosqlite:///:memory:",
        DEBUG=True,
        JWT_SECRET_KEY="test-secret-key",
    )


@pytest_asyncio.fixture(name="engine")
async def engine_fixture(settings):
    engine = create_async_engine(
        settings.POSTGRES_DSN,
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(name="session")
async def session_fixture(engine):
    async_session = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture(name="client")
async def client_fixture(settings, session):
    def override_get_session():
        return session

    def override_get_settings():
        return settings

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_settings] = override_get_settings

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()