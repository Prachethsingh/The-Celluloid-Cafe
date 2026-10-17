"""Movie endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user, optional_user
from app.models.movie import Movie
from app.models.availability import Availability
from app.models.genre import Genre
from app.models.platform import Platform
from app.schemas.content import MovieResponse, MovieDetailResponse, AvailabilityResponse, PlatformResponse, SearchResponse
from app.db.session import get_session

router = APIRouter()


@router.get("/trending", response_model=List[MovieResponse])
async def trending_movies(
    limit: int = Query(10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
):
    """Get trending movies (ordered by popularity desc)."""
    stmt = select(Movie).order_by(Movie.popularity.desc()).limit(limit)
    result = await session.execute(stmt)
    movies = result.scalars().all()
    return [_movie_response(m) for m in movies]


@router.get("/popular", response_model=List[MovieResponse])
async def popular_movies(
    limit: int = Query(10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
):
    """Alias for trending for now."""
    return await trending_movies(limit=limit, session=session)


@router.get("/new", response_model=List[MovieResponse])
async def new_movies(
    limit: int = Query(10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
):
    """Get recently added/released movies."""
    stmt = select(Movie).order_by(Movie.created_at.desc()).limit(limit)
    result = await session.execute(stmt)
    movies = result.scalars().all()
    return [_movie_response(m) for m in movies]


@router.get("/", response_model=List[MovieResponse])
async def list_movies(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    genre: str | None = None,
    country: str | None = None,
    year: int | None = None,
    session: AsyncSession = Depends(get_session),
):
    """Get a paginated list of movies with optional filters."""
    stmt = select(Movie).distinct()
    if genre:
        stmt = stmt.join(Genre, Movie.genres).where(Genre.name.ilike(f"%{genre}%"))
    if country:
        stmt = stmt.where(Movie.country.ilike(f"%{country}%"))
    if year:
        stmt = stmt.where(func.extract("year", Movie.release_date) == year)

    stmt = stmt.offset(skip).limit(limit)
    result = await session.execute(stmt)
    movies = result.scalars().all()
    return [_movie_response(m) for m in movies]


@router.get("/{movie_id}", response_model=MovieDetailResponse)
async def get_movie(
    movie_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str | None = Depends(optional_user),
):
    """Get a single movie by internal id."""
    result = await session.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="movie not found")

    # Load availability with platform info
    avail_stmt = (
        select(Availability, Platform)
        .join(Platform, Availability.platform_id == Platform.id)
        .where(Availability.content_type == "movie", Availability.content_id == movie.id)
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

    return MovieDetailResponse(
        id=movie.id,
        external_id=movie.external_id,
        title=movie.title,
        original_title=movie.original_title,
        description=movie.description,
        release_date=movie.release_date,
        runtime=movie.runtime,
        language=movie.language,
        country=movie.country,
        rating=movie.rating,
        rating_source=movie.rating_source,
        poster_url=movie.poster_url,
        backdrop_url=movie.backdrop_url,
        trailer_url=movie.trailer_url,
        popularity=movie.popularity,
        genres=[],
        cast=[],
        availability=availability,
    )


@router.get("/{movie_id}/availability", response_model=List[AvailabilityResponse])
async def get_movie_availability(
    movie_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get where a movie is available."""
    result = await session.execute(
        select(Availability, Platform)
        .join(Platform, Availability.platform_id == Platform.id)
        .where(Availability.content_type == "movie", Availability.content_id == movie_id)
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


@router.get("/{movie_id}/providers", response_model=List[SearchResponse])
async def check_movie_providers(
    movie_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Check which providers have this movie available (triggers availability sync)."""
    # Verify movie exists
    movie_result = await session.execute(select(Movie).where(Movie.id == movie_id))
    movie = movie_result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="movie not found")

    # Get availability with platform info
    result = await session.execute(
        select(Availability, Platform)
        .join(Platform, Availability.platform_id == Platform.id)
        .where(Availability.content_type == "movie", Availability.content_id == movie_id)
    )
    
    available_platforms = []
    for av, plat in result:
        if av.available:
            available_platforms.append(plat.name)
    
    return [
        SearchResponse(
            id=movie.id,
            content_type="movie",
            title=movie.title,
            year=movie.release_date.year if movie.release_date else None,
            poster_url=movie.poster_url,
            rating=movie.rating,
            genres=[],
            available_on=available_platforms,
            match_score=1.0,
        )
    ]


def _movie_response(m: Movie) -> MovieResponse:
    return MovieResponse(
        id=m.id,
        external_id=m.external_id,
        title=m.title,
        original_title=m.original_title,
        description=m.description,
        release_date=m.release_date,
        runtime=m.runtime,
        language=m.language,
        country=m.country,
        rating=m.rating,
        rating_source=m.rating_source,
        poster_url=m.poster_url,
        backdrop_url=m.backdrop_url,
        trailer_url=m.trailer_url,
        popularity=m.popularity,
        genres=[],
        cast=[],
    )