"""Search service — full-text, fuzzy, and autocomplete over movies & series.

Phase 1: PostgreSQL trigram similarity + ILIKE fallback.
Phase 2+: swap in an external search engine (Meilisearch/Typesense) behind
the same interface without touching the route handlers.
"""
from __future__ import annotations

import re
from typing import Any

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.movie import Movie
from app.models.series import Series


def _normalize(query: str) -> str:
    return re.sub(r"\s+", " ", (query or "").strip().lower())


def _trigram_similar(query: str, column: Any, session: AsyncSession) -> Any:
    """PostgreSQL trigram similarity — requires the pg_trgm extension.

    Only used when the dialect supports it; otherwise returns None so callers
    can fall back to ILIKE.
    """
    dialect_name = getattr(session.bind, "dialect", None)
    dialect_name = getattr(dialect_name, "name", None)
    if dialect_name != "postgresql":
        return None
    return func.greatest(
        func.similarity(column, query),
        func.similarity(func.lower(column), query),
    )


def _apply_filters(
    stmt: Select,
    model: Any,
    session: AsyncSession,
    q: str,
    content_type: str | None,
    genre: str | None,
    language: str | None,
    year: int | None,
    min_rating: float | None,
    platform: str | None,
) -> Select:
    """Apply search filters to an ORM select statement."""
    use_trigram = len(q) <= 40
    trigram = _trigram_similar(q, model.title, session) if use_trigram else None

    if trigram is not None:
        stmt = stmt.where(trigram > 0.1)
    else:
        stmt = stmt.where(model.title.ilike(f"%{q}%"))

    if genre:
        from app.models.genre import Genre

        stmt = stmt.join(Genre, model.genres).where(Genre.name.ilike(f"%{genre}%")).distinct()

    if language:
        stmt = stmt.where(model.language.ilike(f"%{language}%"))

    if year:
        date_col = model.release_date if hasattr(model, "release_date") else model.first_air_date
        stmt = stmt.where(func.extract("year", date_col) == year)

    if min_rating is not None:
        stmt = stmt.where(model.rating >= min_rating)

    if platform:
        from app.models.availability import Availability

        content_type_val = "movie" if model is Movie else "series"
        stmt = (
            stmt.join(Availability, model.id == Availability.content_id)
            .where(Availability.content_type == content_type_val)
            .distinct()
        )

    return stmt


async def run_search(session: AsyncSession, query: str, **filters: Any) -> list[dict]:
    """Execute a search and return a flat list of result dicts."""
    q = _normalize(query)
    if not q:
        return []

    content_type = filters.get("content_type")
    results: list[dict] = []

    if content_type in (None, "movie"):
        stmt = (
            select(Movie)
            .options(selectinload(Movie.genres))
            .where(Movie.title.ilike(f"%{q}%"))
        )
        stmt = _apply_filters(stmt, Movie, session, q, content_type, filters.get("genre"), filters.get("language"), filters.get("year"), filters.get("min_rating"), filters.get("platform"))
        movies = (await session.execute(stmt)).scalars().unique().all()
        for m in movies:
            results.append(
                {
                    "id": m.id,
                    "content_type": "movie",
                    "title": m.title,
                    "year": m.release_date.year if m.release_date else None,
                    "poster_url": m.poster_url,
                    "rating": m.rating,
                    "genres": [],
                    "available_on": [],
                    "match_score": 1.0,
                }
            )

    if content_type in (None, "series"):
        stmt = (
            select(Series)
            .options(selectinload(Series.genres))
            .where(Series.title.ilike(f"%{q}%"))
        )
        stmt = _apply_filters(stmt, Series, session, q, content_type, filters.get("genre"), filters.get("language"), filters.get("year"), filters.get("min_rating"), filters.get("platform"))
        series = (await session.execute(stmt)).scalars().unique().all()
        for s in series:
            results.append(
                {
                    "id": s.id,
                    "content_type": "series",
                    "title": s.title,
                    "year": s.first_air_date.year if s.first_air_date else None,
                    "poster_url": s.poster_url,
                    "rating": s.rating,
                    "genres": [],
                    "available_on": [],
                    "match_score": 1.0,
                }
            )

    return results


async def autocomplete(session: AsyncSession, query: str, limit: int = 8) -> list[dict]:
    """Return title suggestions for autocomplete widgets."""
    q = _normalize(query)
    if not q:
        return []

    movie_stmt = (
        select(Movie.id, Movie.title, Movie.poster_url, Movie.release_date)
        .where(Movie.title.ilike(f"%{q}%"))
        .order_by(Movie.title)
        .limit(limit)
    )
    series_stmt = (
        select(Series.id, Series.title, Series.poster_url, Series.first_air_date)
        .where(Series.title.ilike(f"%{q}%"))
        .order_by(Series.title)
        .limit(limit)
    )

    movie_result = await session.execute(movie_stmt)
    series_result = await session.execute(series_stmt)

    suggestions: list[dict] = []
    for row in movie_result.all():
        suggestions.append(
            {
                "id": row[0],
                "content_type": "movie",
                "title": row[1],
                "poster_url": row[2],
                "year": row[3].year if row[3] else None,
            }
        )
    for row in series_result.all():
        suggestions.append(
            {
                "id": row[0],
                "content_type": "series",
                "title": row[1],
                "poster_url": row[2],
                "year": row[3].year if row[3] else None,
            }
        )
    return suggestions[:limit]