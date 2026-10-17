"""Episode synchronization worker.

Fetches season/episode metadata for series and upserts into PostgreSQL.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.episode import Episode
from app.models.season import Season
from app.models.series import Series
from app.models.sync import SyncMetadata
from app.services.sync import compute_hash, get_or_create, record_sync_complete, record_sync_start

logger = logging.getLogger(__name__)

PROVIDER = "tmdb"


def _is_configured() -> bool:
    return bool(settings.TMDB_API_KEY)


def _parse_date(value: str | None):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


async def run_episode_sync(session: AsyncSession, pages: int = 1) -> SyncMetadata:
    """Run a single episode sync cycle."""
    rec = await record_sync_start(session, "episode_sync", provider=PROVIDER)
    fetched = inserted = updated = failed = 0
    try:
        if not _is_configured():
            logger.warning("TMDB_API_KEY not set — skipping episode sync")
        else:
            async with httpx.AsyncClient(timeout=30) as client:
                series_result = await session.execute(select(Series))
                series = series_result.scalars().all()
                for s in series:
                    if not s.external_id:
                        continue
                    for season_num in range(1, 4):
                        url = f"{settings.TMDB_BASE_URL}/tv/{s.external_id}/season/{season_num}"
                        resp = await client.get(url, params={"api_key": settings.TMDB_API_KEY, "language": "en-US"})
                        if resp.status_code != 200:
                            continue
                        data = resp.json()
                        season, created = await get_or_create(
                            session,
                            Season,
                            series_id=s.id,
                            season_number=season_num,
                            defaults={
                                "title": data.get("name"),
                                "release_date": _parse_date(data.get("air_date")),
                                "poster_url": f"{settings.TMDB_IMAGE_BASE}{data.get('poster_path')}" if data.get("poster_path") else None,
                                "source": PROVIDER,
                                "data_hash": compute_hash({"name": data.get("name"), "air_date": data.get("air_date")}),
                            },
                        )
                        if created:
                            inserted += 1
                        for ep in data.get("episodes", []):
                            ep_record = {
                                "episode_number": ep.get("episode_number"),
                                "title": ep.get("name"),
                                "description": ep.get("overview"),
                                "release_date": _parse_date(ep.get("air_date")),
                                "runtime": ep.get("runtime"),
                                "thumbnail_url": f"{settings.TMDB_IMAGE_BASE}{ep.get('still_path')}" if ep.get("still_path") else None,
                                "has_subtitle": False,
                                "source": PROVIDER,
                                "data_hash": compute_hash({
                                    "name": ep.get("name"),
                                    "overview": ep.get("overview"),
                                    "air_date": ep.get("air_date"),
                                    "episode_number": ep.get("episode_number"),
                                }),
                            }
                            ep_obj, ep_created = await get_or_create(
                                session,
                                Episode,
                                season_id=season.id,
                                episode_number=ep_record["episode_number"],
                                defaults={k: v for k, v in ep_record.items() if k != "episode_number"},
                            )
                            if ep_created:
                                inserted += 1
                            else:
                                updated += 1
                            fetched += 1
    except Exception as exc:  # noqa: BLE001
        logger.exception("Episode sync failed")
        await record_sync_complete(session, rec, fetched, inserted, updated, failed, str(exc))
        return rec
    await record_sync_complete(session, rec, fetched, inserted, updated, failed)
    return rec


async def main() -> None:
    """Entry point for the episode sync worker."""
    logging.basicConfig(level=logging.INFO)
    logger.info("Episode sync worker starting")
    async with AsyncSessionLocal() as session:
        await run_episode_sync(session)


if __name__ == "__main__":
    asyncio.run(main())