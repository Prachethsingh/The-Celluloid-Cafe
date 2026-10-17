"""Season endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user, optional_user
from app.models.season import Season
from app.models.episode import Episode
from app.models.availability import Availability
from app.models.platform import Platform
from app.schemas.content import AvailabilityResponse, EpisodeResponse, PlatformResponse
from app.db.session import get_session

router = APIRouter()


@router.get("/{season_id}", response_model=dict)
async def get_season(
    season_id: str = Path(...),
    session: AsyncSession = Depends(get_session),
    user_id: str | None = Depends(optional_user),
):
    """Get a single season by internal id."""
    result = await session.execute(select(Season).where(Season.id == season_id))
    season = result.scalar_one_or_none()
    if not season:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="season not found")

    # Load episodes for this season (without availability for speed)
    eps_stmt = select(Episode).where(Episode.season_id == season.id).order_by(Episode.episode_number)
    eps_result = await session.execute(eps_stmt)
    episodes = eps_result.scalars().all()

    episode_list = [
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

    return {
        "id": season.id,
        "season_number": season.season_number,
        "title": season.title,
        "release_date": season.release_date,
        "poster_url": season.poster_url,
        "episodes": episode_list,
    }


@router.get("/{season_id}/episodes", response_model=List[EpisodeResponse])
async def get_season_episodes(
    season_id: str = Path(...),
    session: AsyncSession = Depends(get_session),
):
    """Get all episodes for a season."""
    from app.models.episode import Episode

    stmt = select(Episode).where(Episode.season_id == season_id).order_by(Episode.episode_number)
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


@router.get("/{season_id}/episodes/{episode_id}/availability", response_model=List[AvailabilityResponse])
async def get_episode_availability(
    season_id: str = Path(...),
    episode_id: str = Path(...),
    session: AsyncSession = Depends(get_session),
):
    """Get where an episode is available."""
    result = await session.execute(
        select(Availability, Platform)
        .join(Platform, Availability.platform_id == Platform.id)
        .where(
            Availability.content_type == "episode",
            Availability.content_id == episode_id,
        )
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