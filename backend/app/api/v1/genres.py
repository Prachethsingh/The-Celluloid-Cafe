"""Genre endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user, optional_user
from app.models.genre import Genre
from app.schemas.content import GenreResponse
from app.cache import get_cached, set_cached
from app.db.session import get_session  # noqa: F401

router = APIRouter()


@router.get("/", response_model=List[GenreResponse])
async def list_genres(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=250),
    session: AsyncSession = Depends(get_session),
):
    """Get a paginated list of genres."""
    cache_key = f"genres:{skip}:{limit}"
    cached = await get_cached(cache_key)
    if cached is not None:
        return cached

    stmt = select(Genre).offset(skip).limit(limit)
    result = await session.execute(stmt)
    genres = result.scalars().all()
    payload = [GenreResponse.model_validate(g.__dict__) for g in genres]
    await set_cached(cache_key, payload)
    return payload


@router.get("/{genre_id}", response_model=GenreResponse)
async def get_genre(
    genre_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get a single genre by internal id."""
    cache_key = f"genre:{genre_id}"
    cached = await get_cached(cache_key)
    if cached is not None:
        return cached

    result = await session.execute(select(Genre).where(Genre.id == genre_id))
    genre = result.scalar_one_or_none()
    if not genre:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="genre not found")
    payload = GenreResponse.model_validate(genre.__dict__)
    await set_cached(cache_key, payload)
    return payload