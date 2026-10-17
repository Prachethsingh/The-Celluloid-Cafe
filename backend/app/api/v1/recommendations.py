"""Recommendation endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user, optional_user
from app.schemas.content import SearchResponse
from app.services.recommendations import recommend, similar_titles
from app.db.session import get_session

router = APIRouter()


@router.get("/", response_model=List[SearchResponse])
async def get_recommendations(
    content_type: str | None = Query(None, pattern="^(movie|series)$"),
    limit: int = Query(20, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
    user_id: str | None = Depends(optional_user),
):
    """Get personalized recommendations for the current user."""
    user: dict = {}
    if user_id:
        from app.models.user import User

        result = await session.execute(select(User).where(User.id == user_id))
        u = result.scalar_one_or_none()
        if u:
            user = {
                "preferred_genres": [],
                "preferred_languages": [],
                "country_code": u.country_code,
            }
    return await recommend(session, user, content_type=content_type, limit=limit)


@router.get("/similar/{content_type}/{content_id}", response_model=List[SearchResponse])
async def get_similar(
    content_type: str,
    content_id: str,
    limit: int = Query(10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
):
    """Get titles similar to the given one."""
    return await similar_titles(session, content_type, content_id, limit=limit)


@router.get("/next/{content_type}/{content_id}", response_model=SearchResponse)
async def get_next_content(
    content_type: str,
    content_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get the next recommended content (for auto-play). Returns the top similar title."""
    similar = await similar_titles(session, content_type, content_id, limit=1)
    if not similar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No next content found")
    return similar[0]