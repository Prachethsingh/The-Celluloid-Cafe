"""Watchlist endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.watchlist import Watchlist
from app.models.movie import Movie
from app.models.series import Series
from app.schemas.user import WatchlistCreateRequest, WatchlistResponse
from app.db.session import get_session

router = APIRouter()


@router.get("/", response_model=List[WatchlistResponse])
async def get_watchlist(
    user_id: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get the current user's watchlist."""
    # Verify user exists (optional, but good practice)
    user_result = await session.execute(select(User).where(User.id == user_id))
    if not user_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")

    stmt = select(Watchlist).where(Watchlist.user_id == user_id)
    result = await session.execute(stmt)
    watchlist_items = result.scalars().all()

    # Enrich with title and poster from movie/series
    responses: List[WatchlistResponse] = []
    for item in watchlist_items:
        title = None
        poster_url = None
        if item.content_type == "movie":
            movie_result = await session.execute(select(Movie).where(Movie.id == item.content_id))
            movie = movie_result.scalar_one_or_none()
            if movie:
                title = movie.title
                poster_url = movie.poster_url
        elif item.content_type == "series":
            series_result = await session.execute(select(Series).where(Series.id == item.content_id))
            series = series_result.scalar_one_or_none()
            if series:
                title = series.title
                poster_url = series.poster_url

        responses.append(
            WatchlistResponse(
                id=item.id,
                content_type=item.content_type,
                content_id=item.content_id,
                created_at=item.created_at,
                title=title,
                poster_url=poster_url,
            )
        )
    return responses


@router.post("/", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    payload: WatchlistCreateRequest,
    user_id: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Add a movie or series to the user's watchlist."""
    # Verify user exists
    user_result = await session.execute(select(User).where(User.id == user_id))
    if not user_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")

    # Verify content exists (optional but good)
    if payload.content_type == "movie":
        content_result = await session.execute(select(Movie).where(Movie.id == payload.content_id))
    else:  # series
        content_result = await session.execute(select(Series).where(Series.id == payload.content_id))
    if not content_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="content not found")

    # Check if already in watchlist
    stmt = select(Watchlist).where(
        Watchlist.user_id == user_id,
        Watchlist.content_type == payload.content_type,
        Watchlist.content_id == payload.content_id,
    )
    existing = await session.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="already in watchlist")

    # Create new watchlist entry
    watchlist = Watchlist(
        user_id=user_id,
        content_type=payload.content_type,
        content_id=payload.content_id,
    )
    session.add(watchlist)
    await session.commit()
    await session.refresh(watchlist)

    return WatchlistResponse(
        id=watchlist.id,
        content_type=watchlist.content_type,
        content_id=watchlist.content_id,
        created_at=watchlist.created_at,
        title=None,  # could enrich but we return minimal for now
        poster_url=None,
    )


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(
    item_id: str = Path(...),
    user_id: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove an item from the user's watchlist."""
    stmt = delete(Watchlist).where(
        Watchlist.id == item_id,
        Watchlist.user_id == user_id,
    )
    result = await session.execute(stmt)
    await session.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="watchlist item not found")
    return None