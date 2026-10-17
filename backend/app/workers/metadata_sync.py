"""Metadata synchronization worker.

Fetches movie/series metadata from configured providers (TMDB) and upserts
into PostgreSQL using the shared sync engine's change-detection pipeline.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.genre import Genre
from app.models.movie import Movie, movie_genres
from app.models.person import Person, PersonRole, person_movies
from app.models.series import Series, series_genres
from app.models.sync import SyncMetadata, SyncStatus
from app.services.sync import compute_hash, get_or_create, record_sync_complete, record_sync_start

logger = logging.getLogger(__name__)

PROVIDER = "tmdb"


def _is_configured() -> bool:
    return bool(settings.TMDB_API_KEY)


async def _fetch_tmdb(session: AsyncSession, endpoint: str, params: dict) -> dict | None:
    if not _is_configured():
        return None
    url = f"{settings.TMDB_BASE_URL}{endpoint}"
    params = {"api_key": settings.TMDB_API_KEY, "language": "en-US", **params}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()


async def _sync_genres(session: AsyncSession) -> int:
    data = await _fetch_tmdb(session, "/genre/movie/list", {})
    if not data:
        return 0
    inserted = 0
    for g in data.get("genres", []):
        _, created = await get_or_create(
            session,
            Genre,
            external_id=str(g["id"]),
            name=g["name"],
            slug=g["name"].lower().replace(" ", "-"),
        )
        if created:
            inserted += 1
    return inserted


def _movie_record(item: dict) -> dict:
    return {
        "external_id": str(item["id"]),
        "title": item.get("title") or item.get("name") or "",
        "original_title": item.get("original_title") or item.get("original_name"),
        "description": item.get("overview"),
        "release_date": _parse_date(item.get("release_date") or item.get("first_air_date")),
        "runtime": item.get("runtime"),
        "language": item.get("original_language"),
        "country": (item.get("origin_country") or [None])[0] if item.get("origin_country") else None,
        "rating": item.get("vote_average"),
        "rating_source": "tmdb",
        "poster_url": _poster_url(item.get("poster_path")),
        "backdrop_url": _poster_url(item.get("backdrop_path"), original=True),
        "trailer_url": None,
        "popularity": item.get("popularity", 0.0),
        "source": PROVIDER,
        "data_hash": compute_hash({
            "title": item.get("title") or item.get("name"),
            "overview": item.get("overview"),
            "vote_average": item.get("vote_average"),
            "runtime": item.get("runtime"),
        }),
    }


def _series_record(item: dict) -> dict:
    return {
        "external_id": str(item["id"]),
        "title": item.get("name") or item.get("title") or "",
        "description": item.get("overview"),
        "first_air_date": _parse_date(item.get("first_air_date")),
        "last_air_date": _parse_date(item.get("last_air_date")),
        "language": item.get("original_language"),
        "country": (item.get("origin_country") or [None])[0] if item.get("origin_country") else None,
        "rating": item.get("vote_average"),
        "rating_source": "tmdb",
        "poster_url": _poster_url(item.get("poster_path")),
        "backdrop_url": _poster_url(item.get("backdrop_path"), original=True),
        "popularity": item.get("popularity", 0.0),
        "source": PROVIDER,
        "data_hash": compute_hash({
            "name": item.get("name"),
            "overview": item.get("overview"),
            "vote_average": item.get("vote_average"),
        }),
    }


def _poster_url(path: str | None, original: bool = False) -> str | None:
    if not path:
        return None
    base = settings.TMDB_IMAGE_BASE if not original else settings.TMDB_IMAGE_BASE
    return f"{base}{path}"


def _parse_date(value: str | None):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


async def _sync_movies(session: AsyncSession, page: int = 1) -> tuple[int, int, int]:
    data = await _fetch_tmdb(session, "/movie/popular", {"page": page})
    if not data:
        return 0, 0, 0
    inserted = updated = 0
    for item in data.get("results", []):
        record = _movie_record(item)
        movie, created = await get_or_create(
            session,
            Movie,
            external_id=record["external_id"],
            defaults={k: v for k, v in record.items() if k != "external_id"},
        )
        if created:
            inserted += 1
        else:
            updated += 1
    return len(data.get("results", [])), inserted, updated


async def _sync_series(session: AsyncSession, page: int = 1) -> tuple[int, int, int]:
    data = await _fetch_tmdb(session, "/tv/popular", {"page": page})
    if not data:
        return 0, 0, 0
    inserted = updated = 0
    for item in data.get("results", []):
        record = _series_record(item)
        series, created = await get_or_create(
            session,
            Series,
            external_id=record["external_id"],
            defaults={k: v for k, v in record.items() if k != "external_id"},
        )
        if created:
            inserted += 1
        else:
            updated += 1
    return len(data.get("results", [])), inserted, updated


async def run_metadata_sync(session: AsyncSession, pages: int = 1) -> SyncMetadata:
    """Run a single metadata sync cycle."""
    rec = await record_sync_start(session, "metadata_sync", provider=PROVIDER)
    fetched = inserted = updated = failed = 0
    try:
        if not _is_configured():
            logger.warning("TMDB_API_KEY not set — skipping metadata sync")
        else:
            await _sync_genres(session)
            for page in range(1, pages + 1):
                f, i, u = await _sync_movies(session, page)
                fetched += f
                inserted += i
                updated += u
                f, i, u = await _sync_series(session, page)
                fetched += f
                inserted += i
                updated += u
    except Exception as exc:  # noqa: BLE001
        logger.exception("Metadata sync failed")
        failed += 1
        await record_sync_complete(session, rec, fetched, inserted, updated, failed, str(exc))
        return rec
    await record_sync_complete(session, rec, fetched, inserted, updated, failed)
    return rec


async def main() -> None:
    """Entry point for the metadata sync worker."""
    logging.basicConfig(level=logging.INFO)
    logger.info("Metadata sync worker starting")
    async with AsyncSessionLocal() as session:
        await run_metadata_sync(session)


if __name__ == "__main__":
    asyncio.run(main())