"""Authentication service — register/login/refresh."""
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.security.password import hash_password, verify_password
from app.security.token import create_access_token, create_refresh_token, decode_token


async def register(session: AsyncSession, email: str, password: str, display_name: str | None = None) -> User:
    """Create a new user. Raises if the email is already taken."""
    from sqlalchemy import select

    existing = await session.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        display_name=display_name,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def login(session: AsyncSession, email: str, password: str) -> tuple[User, dict]:
    """Authenticate a user. Raises 401 on bad credentials."""
    from sqlalchemy import select

    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    return user, {
        "access_token": access,
        "refresh_token": refresh,
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


async def refresh(session: AsyncSession, refresh_token: str) -> dict:
    """Issue a new access token from a valid refresh token."""
    try:
        payload = decode_token(refresh_token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid refresh token") from exc

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not a refresh token")

    access = create_access_token(payload["sub"])
    return {"access_token": access, "token_type": "bearer", "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60}


def get_user_id_from_token(token: str) -> str:
    """Decode a JWT and return the subject (user id)."""
    try:
        payload = decode_token(token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token") from exc
    return payload["sub"]