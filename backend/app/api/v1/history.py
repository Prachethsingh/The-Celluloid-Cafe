"""Watch history endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.watch_history import WatchHistory
from app.models.movie import Movie
from app.models.series import Series
from app.models.episode import Episode
from app.schemas.user import HistoryCreateRequest, HistoryResponse
from app.db.session import get_session

router = APIRouter()


@router.get("/", response_model=List[HistoryResponse])
async def get_history(
    user_id: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    limit: int = 20,
    offset: int = 0,
):
    """Get the current user's watch history."""
    # Verify user exists
    user_result = await session.execute(select(User).where(User.id == user_id))
    if not user_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")

    stmt = (
        select(WatchHistory)
        .where(WatchHistory.user_id == user_id)
        .order_by(WatchHistory.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await session.execute(stmt)
    history_items = result.scalars().all()

    # Enrich with title and thumbnail from movie/series/episode
    responses: List[HistoryResponse] = []
    for item in history_items:
        title = None
        thumbnail_url = None
        if item.content_type == "movie":
            movie_result = await session.execute(select(Movie).where(Movie.id == item.content_id))
            movie = movie_result.scalar_one_or_none()
            if movie:
                title = movie.title
                thumbnail_url = movie.poster_url
        elif item.content_type == "series":
            series_result = await session.execute(select(Series).where(Series.id == item.content_id))
            series = series_result.scalar_one_or_none()
            if series:
                title = series.title
                thumbnail_url = series.poster_url
        elif item.content_type == "episode":
            episode_result = await session.execute(select(Episode).where(Episode.id == item.content_id))
            episode = episode_result.scalar_one_or_none()
            if episode:
                title = episode.title
                thumbnail_url = episode.thumbnail_url

        responses.append(
            HistoryResponse(
                id=item.id,
                content_type=item.content_type,
                content_id=item.content_id,
                episode_id=item.episode_id,
                progress_seconds=item.progress_seconds,
                duration_seconds=item.duration_seconds,
                completed=item.completed,
                updated_at=item.updated_at,
                title=title,
                thumbnail_url=thumbnail_url,
            )
        )
    return responses


@router.post("/", response_model=HistoryResponse, status_code=status.HTTP_201_CREATED)
async def add_history(
    payload: HistoryCreateRequest,
    user_id: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Add or update a watch history entry."""
    # Verify user exists
    user_result = await session.execute(select(User).where(User.id == user_id))
    if not user_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")

    # Verify content exists (optional but good)
    if payload.content_type == "movie":
        content_result = await session.execute(select(Movie).where(Movie.id == payload.content_id))
    elif payload.content_type == "series":
        content_result = await session.execute(select(Series).where(Series.id == payload.content_id))
    else:  # episode
        content_result = await session.execute(select(Episode).where(Episode.id == payload.content_id))
    if not content_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="content not found")

    # Upsert: update if exists, else insert
    stmt = (
        select(WatchHistory)
        .where(
            WatchHistory.user_id == user_id,
            WatchHistory.content_type == payload.content_type,
            WatchHistory.content_id == payload.content_id,
            WatchHistory.episode_id == payload.episode_id,
        )
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        # Update
        existing.progress_seconds = payload.progress_seconds
        existing.duration_seconds = payload.duration_seconds
        existing.completed = payload.completed
        existing.updated_at = func.now()
        await session.commit()
        await session.refresh(existing)
        history_item = existing
    else:
        # Insert
        history_item = WatchHistory(
            user_id=user_id,
            content_type=payload.content_type,
            content_id=payload.content_id,
            episode_id=payload.episode_id,
            progress_seconds=payload.progress_seconds,
            duration_seconds=payload.duration_seconds,
            completed=payload.completed,
        )
        session.add(history_item)
        await session.commit()
        await session.refresh(history_item)

    return HistoryResponse(
        id=history_item.id,
        content_type=history_item.content_type,
        content_id=history_item.content_id,
        episode_id=history_item.episode_id,
        progress_seconds=history_item.progress_seconds,
        duration_seconds=history_item.duration_seconds,
        completed=history_item.completed,
        updated_at=history_item.updated_at,
        title=None,  # could enrich but we keep response light
        thumbnail_url=None,
    )


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_history_item(
    item_id: str = Path(...),
    user_id: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove a specific history entry."""
    stmt = delete(WatchHistory).where(
        WatchHistory.id == item_id,
        WatchHistory.user_id == user_id,
    )
    result = await session.execute(stmt)
    await session.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="history item not found")
    return None


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def clear_history(
    user_id: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Clear the entire watch history for the user."""
    stmt = delete(WatchHistory).where(WatchHistory.user_id == user_id)
    await session.execute(stmt)
    await session.commit()
    return None