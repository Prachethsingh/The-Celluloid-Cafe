"""Episode endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user, optional_user
from app.models.episode import Episode
from app.models.availability import Availability
from app.models.platform import Platform
from app.schemas.content import EpisodeResponse, AvailabilityResponse, PlatformResponse
from app.db.session import get_session

router = APIRouter()


@router.get("/", response_model=List[EpisodeResponse])
async def list_episodes(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    season_id: str | None = None,
    series_id: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    """Get a paginated list of episodes with optional filters."""
    stmt = select(Episode).distinct()
    if season_id:
        stmt = stmt.where(Episode.season_id == season_id)
    if series_id:
        # Join through season to series
        from app.models.season import Season
        stmt = stmt.join(Season, Episode.season_id == Season.id).where(Season.series_id == series_id)

    stmt = stmt.offset(skip).limit(limit)
    result = await session.execute(stmt)
    episodes = result.scalars().all()

    return [
        EpisodeResponse(
            id=ep.id,
            episode_number=ep.episode_number,
            title=ep.title,
            description=ep.description,
            release_date=ep.release_date,
            runtime=ep.runtime,
            thumbnail_url=ep.thumbnail_url,
            has_subtitle=ep.has_subtitle,
            subtitle_languages=[] if not ep.subtitle_languages else ep.subtitle_languages.split(","),
        )
        for ep in episodes
    ]


@router.get("/{episode_id}", response_model=EpisodeResponse)
async def get_episode(
    episode_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str | None = Depends(optional_user),
):
    """Get a single episode by internal id."""
    result = await session.execute(select(Episode).where(Episode.id == episode_id))
    episode = result.scalar_one_or_none()
    if not episode:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="episode not found")

    return EpisodeResponse(
        id=episode.id,
        episode_number=episode.episode_number,
        title=episode.title,
        description=episode.description,
        release_date=episode.release_date,
        runtime=episode.runtime,
        thumbnail_url=episode.thumbnail_url,
        has_subtitle=episode.has_subtitle,
        subtitle_languages=[] if not episode.subtitle_languages else episode.subtitle_languages.split(","),
    )


@router.get("/{episode_id}/availability", response_model=List[AvailabilityResponse])
async def get_episode_availability(
    episode_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get where an episode is available."""
    result = await session.execute(
        select(Availability, Platform)
        .join(Platform, Availability.platform_id == Platform.id)
        .where(Availability.content_type == "episode", Availability.content_id == episode_id)
    )
    return [
        AvailabilityResponse(
            id=av.id,
            content_type=av.content_type,
            content_id=av.content_id,
            platform_id=av.platform_id,
            platform=PlatformResponse.model_validate(plat.__dict__) if plat else None,
            country_code=av.country_code,
            available=av.available,
            subscription_type=av.subscription_type,
            quality=av.quality,
            subtitle_available=av.subtitle_available,
            start_date=av.start_date,
            end_date=av.end_date,
            last_checked=av.last_checked,
        )
        for av, plat in result
    ]


@router.get("/{episode_id}/playback")
async def get_episode_playback(
    episode_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    """Check if the user is allowed to play this episode and return playback info."""
    # For MVP, we just check availability in the user's country (we don't have user country in token yet)
    # In a real app, we would get the user's country from their profile and check availability.
    # We'll return a placeholder for now.
    from app.models.user import User

    # Get user to know country
    user_result = await session.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")

    # Check availability in user's country
    avail_stmt = (
        select(Availability, Platform)
        .join(Platform, Availability.platform_id == Platform.id)
        .where(
            Availability.content_type == "episode",
            Availability.content_id == episode_id,
            Availability.country_code == user.country_code,
            Availability.available == True,  # noqa: E712
        )
    )
    avail_result = await session.execute(avail_stmt)
    availability = avail_result.first()
    if not availability:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="content not available in your region")

    av, plat = availability
    # In a real app, we would generate a signed URL or token for playback.
    # For MVP, we return a placeholder.
    return {
        "episode_id": episode_id,
        "message": "Playback authorized (placeholder). In a real app, this would return a signed URL or token.",
        "platform": plat.name if plat else None,
        "country": user.country_code,
    }