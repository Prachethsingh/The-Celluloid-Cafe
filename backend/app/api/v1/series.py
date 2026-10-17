"""Series endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user, optional_user
from app.models.series import Series
from app.models.availability import Availability
from app.models.genre import Genre
from app.models.platform import Platform
from app.models.season import Season
from app.schemas.content import SeriesResponse, SeriesDetailResponse, PlatformResponse, AvailabilityResponse
from app.db.session import get_session

router = APIRouter()


@router.get("/trending", response_model=List[SeriesResponse])
async def trending_series(
    limit: int = Query(10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
):
    """Get trending series (ordered by popularity desc)."""
    stmt = select(Series).order_by(Series.popularity.desc()).limit(limit)
    result = await session.execute(stmt)
    series = result.scalars().all()
    return [_series_response(s) for s in series]


@router.get("/popular", response_model=List[SeriesResponse])
async def popular_series(
    limit: int = Query(10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
):
    """Alias for trending for now."""
    return await trending_series(limit=limit, session=session)


@router.get("/new", response_model=List[SeriesResponse])
async def new_series(
    limit: int = Query(10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
):
    """Get recently added/released series."""
    stmt = select(Series).order_by(Series.created_at.desc()).limit(limit)
    result = await session.execute(stmt)
    series = result.scalars().all()
    return [_series_response(s) for s in series]


@router.get("/", response_model=List[SeriesResponse])
async def list_series(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    genre: str | None = None,
    country: str | None = None,
    year: int | None = None,
    session: AsyncSession = Depends(get_session),
):
    """Get a paginated list of series with optional filters."""
    stmt = select(Series).distinct()
    if genre:
        stmt = stmt.join(Genre, Series.genres).where(Genre.name.ilike(f"%{genre}%"))
    if country:
        stmt = stmt.where(Series.country.ilike(f"%{country}%"))
    if year:
        stmt = stmt.where(func.extract("year", Series.first_air_date) == year)

    stmt = stmt.offset(skip).limit(limit)
    result = await session.execute(stmt)
    series = result.scalars().all()
    return [_series_response(s) for s in series]


@router.get("/{series_id}", response_model=SeriesDetailResponse)
async def get_series(
    series_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str | None = Depends(optional_user),
):
    """Get a single series by internal id."""
    result = await session.execute(select(Series).where(Series.id == series_id))
    series = result.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="series not found")

    # Load availability with platform info
    avail_stmt = (
        select(Availability, Platform)
        .join(Platform, Availability.platform_id == Platform.id)
        .where(Availability.content_type == "series", Availability.content_id == series.id)
    )
    avail_result = await session.execute(avail_stmt)
    availability = [
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
        for av, plat in avail_result
    ]

    # Load seasons (without episodes for now to avoid N+1)
    seasons_stmt = (
        select(Season)
        .where(Season.series_id == series.id)
        .order_by(Season.season_number)
    )
    seasons_result = await session.execute(seasons_stmt)
    seasons = seasons_result.scalars().all()

    return SeriesDetailResponse(
        id=series.id,
        external_id=series.external_id,
        title=series.title,
        description=series.description,
        first_air_date=series.first_air_date,
        last_air_date=series.last_air_date,
        language=series.language,
        country=series.country,
        rating=series.rating,
        rating_source=series.rating_source,
        poster_url=series.poster_url,
        backdrop_url=series.backdrop_url,
        popularity=series.popularity,
        genres=[],
        cast=[],
        availability=availability,
        seasons=[
            {
                "id": s.id,
                "season_number": s.season_number,
                "title": s.title,
                "release_date": s.release_date,
                "poster_url": s.poster_url,
                "episodes": [],
            }
            for s in seasons
        ],
    )


@router.get("/{series_id}/seasons", response_model=List[dict])
async def get_series_seasons(
    series_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get all seasons for a series."""
    stmt = select(Season).where(Season.series_id == series_id).order_by(Season.season_number)
    result = await session.execute(stmt)
    seasons = result.scalars().all()
    return [
        {
            "id": s.id,
            "season_number": s.season_number,
            "title": s.title,
            "release_date": s.release_date,
            "poster_url": s.poster_url,
        }
        for s in seasons
    ]


def _series_response(s: Series) -> SeriesResponse:
    return SeriesResponse(
        id=s.id,
        external_id=s.external_id,
        title=s.title,
        description=s.description,
        first_air_date=s.first_air_date,
        last_air_date=s.last_air_date,
        language=s.language,
        country=s.country,
        rating=s.rating,
        rating_source=s.rating_source,
        poster_url=s.poster_url,
        backdrop_url=s.backdrop_url,
        popularity=s.popularity,
        genres=[],
        cast=[],
    )