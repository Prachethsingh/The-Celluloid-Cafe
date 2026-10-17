"""Recommendation service — Phase 1 heuristic.

Scores titles by genre overlap, language match, rating, popularity and recency.
Phase 2+ will layer in collaborative filtering / embeddings on top.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.episode import Episode
from app.models.movie import Movie
from app.models.person import Person
from app.models.season import Season
from app.models.series import Series


def _score(movie: Movie | None, series: Series | None, user: dict) -> float:
    """Compute a 0-1 heuristic score for a title given user preferences."""
    title = movie or series
    score = 0.0

    preferred_genres = {g.lower() for g in (user.get("preferred_genres") or [])}
    preferred_languages = {l.lower() for l in (user.get("preferred_languages") or [])}
    country = user.get("country_code")

    title_genres = {g.name.lower() for g in (title.genres or [])}
    overlap = len(preferred_genres & title_genres)
    if preferred_genres:
        score += 0.4 * (overlap / len(preferred_genres))
    else:
        score += 0.2

    if title.language and title.language.lower() in preferred_languages:
        score += 0.2
    elif preferred_languages:
        score += 0.0

    if country and title.country and title.country.lower() == country.lower():
        score += 0.1

    rating = title.rating or 0.0
    score += 0.2 * min(rating / 10.0, 1.0)

    popularity = getattr(title, "popularity", 0.0) or 0.0
    score += 0.1 * min(popularity / 100.0, 1.0)

    return round(min(score, 1.0), 4)


async def recommend(
    session: AsyncSession,
    user: dict,
    content_type: str | None = None,
    limit: int = 20,
    exclude_ids: set[str] | None = None,
) -> list[dict]:
    """Return personalized recommendations for a user."""
    exclude_ids = exclude_ids or set()

    movies: list[Movie] = []
    series: list[Series] = []

    if content_type in (None, "movie"):
        stmt: Select = (
            select(Movie)
            .options(selectinload(Movie.genres))
            .order_by(Movie.popularity.desc())
            .limit(100)
        )
        movies = (await session.execute(stmt)).scalars().unique().all()
    if content_type in (None, "series"):
        stmt = (
            select(Series)
            .options(selectinload(Series.genres))
            .order_by(Series.popularity.desc())
            .limit(100)
        )
        series = (await session.execute(stmt)).scalars().unique().all()

    scored: list[tuple[float, Movie | Series]] = []
    for title in [*movies, *series]:
        if title.id in exclude_ids:
            continue
        if isinstance(title, Movie):
            movie_obj, series_obj = title, None
        else:
            movie_obj, series_obj = None, title
        scored.append((_score(movie_obj, series_obj, user), title))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:limit]

    out: list[dict] = []
    for s, title in top:
        if isinstance(title, Movie):
            out.append(
                {
                    "id": title.id,
                    "content_type": "movie",
                    "title": title.title,
                    "poster_url": title.poster_url,
                    "rating": title.rating,
                    "year": title.release_date.year if title.release_date else None,
                    "score": s,
                }
            )
        else:
            out.append(
                {
                    "id": title.id,
                    "content_type": "series",
                    "title": title.title,
                    "poster_url": title.poster_url,
                    "rating": title.rating,
                    "year": title.first_air_date.year if title.first_air_date else None,
                    "score": s,
                }
            )
    return out


async def similar_titles(
    session: AsyncSession,
    content_type: str,
    content_id: str,
    limit: int = 10,
) -> list[dict]:
    """Return titles similar to the given one by genre and language."""
    if content_type == "movie":
        result = await session.execute(
            select(Movie).options(selectinload(Movie.genres)).where(Movie.id == content_id)
        )
        title = result.scalar_one_or_none()
        if not title:
            return []
        title_genres = {g.id for g in (title.genres or [])}
        stmt = select(Movie).options(selectinload(Movie.genres)).where(Movie.id != content_id).limit(100)
        candidates = (await session.execute(stmt)).scalars().unique().all()
    else:
        result = await session.execute(
            select(Series).options(selectinload(Series.genres)).where(Series.id == content_id)
        )
        title = result.scalar_one_or_none()
        if not title:
            return []
        title_genres = {g.id for g in (title.genres or [])}
        stmt = (
            select(Series)
            .options(selectinload(Series.genres))
            .where(Series.id != content_id)
            .limit(100)
        )
        candidates = (await session.execute(stmt)).scalars().unique().all()

    scored: list[tuple[int, Movie | Series]] = []
    for cand in candidates:
        cand_genres = {g.id for g in (cand.genres or [])}
        overlap = len(title_genres & cand_genres)
        lang_match = 1 if cand.language and cand.language == title.language else 0
        score = overlap * 2 + lang_match
        if score > 0:
            scored.append((score, cand))

    scored.sort(key=lambda x: x[0], reverse=True)
    out: list[dict] = []
    for _, cand in scored[:limit]:
        if isinstance(cand, Movie):
            out.append(
                {
                    "id": cand.id,
                    "content_type": "movie",
                    "title": cand.title,
                    "poster_url": cand.poster_url,
                    "rating": cand.rating,
                    "year": cand.release_date.year if cand.release_date else None,
                }
            )
        else:
            out.append(
                {
                    "id": cand.id,
                    "content_type": "series",
                    "title": cand.title,
                    "poster_url": cand.poster_url,
                    "rating": cand.rating,
                    "year": cand.first_air_date.year if cand.first_air_date else None,
                }
            )
    return out