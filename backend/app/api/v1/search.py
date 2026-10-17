"""Search endpoints."""
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user, optional_user
from app.models.movie import Movie
from app.models.series import Series
from app.models.genre import Genre
from app.models.platform import Platform
from app.models.availability import Availability
from app.schemas.content import SearchResponse
from app.services.search import autocomplete as autocomplete_service, run_search as search_service
from app.db.session import get_session

router = APIRouter()


@router.get("/autocomplete", response_model=List[dict])
async def get_autocomplete(
    q: str = Query(..., min_length=1),
    limit: int = Query(8, ge=1, le=25),
    session: AsyncSession = Depends(get_session),
):
    """Return title suggestions for autocomplete widgets."""
    return await autocomplete_service(session, q, limit=limit)


@router.get("/", response_model=List[SearchResponse])
async def search(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    content_type: str | None = Query(None, pattern="^(movie|series)$"),
    genre: str | None = Query(None),
    language: str | None = Query(None),
    year: int | None = Query(None, ge=1900, le=2100),
    min_rating: float | None = Query(None, ge=0, le=10),
    session: AsyncSession = Depends(get_session),
    user_id: str | None = Depends(optional_user),
):
    """Search movies & series with filters (type, genre, language, year, rating)."""
    results = await search_service(
        session,
        q,
        content_type=content_type,
        genre=genre,
        language=language,
        year=year,
        min_rating=min_rating,
    )
    return results[:limit]