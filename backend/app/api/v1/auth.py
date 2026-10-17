"""Authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import login as auth_login, register as auth_register, refresh as auth_refresh
from app.security.token import create_access_token, create_refresh_token
from app.core.config import settings
from app.db.session import get_session
from app.schemas.auth import LoginRequest, LoginResponse, RefreshRequest, RegisterRequest, TokenPair

router = APIRouter()


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_session),
):
    """Register a new user."""
    user = await auth_register(session, payload.email, payload.password, payload.display_name)
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    return LoginResponse(
        user={"id": user.id, "email": user.email, "display_name": user.display_name},
        tokens=TokenPair(access_token=access_token, refresh_token=refresh_token, expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60),
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    """Log in a user."""
    user, tokens = await auth_login(session, payload.email, payload.password)
    return LoginResponse(
        user={"id": user.id, "email": user.email, "display_name": user.display_name},
        tokens=TokenPair(**tokens),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh_token(
    payload: RefreshRequest,
    session: AsyncSession = Depends(get_session),
):
    """Refresh an access token."""
    new_token = await auth_refresh(session, payload.refresh_token)
    return TokenPair(access_token=new_token["access_token"], refresh_token=payload.refresh_token, expires_in=new_token["expires_in"])


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout():
    """Log out — client should discard tokens."""
    return None