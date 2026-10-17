"""Auth dependencies for FastAPI."""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_user_id_from_token
from app.db.session import get_session

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> str:
    """Returns the authenticated user's id. Raises 401 if missing/invalid."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    return get_user_id_from_token(credentials.credentials)


async def optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> str | None:
    """Returns the user id if a valid token is present, otherwise None."""
    if credentials is None:
        return None
    try:
        return get_user_id_from_token(credentials.credentials)
    except HTTPException:
        return None