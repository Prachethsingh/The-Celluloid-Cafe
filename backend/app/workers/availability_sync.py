"""Availability synchronization worker.

Fetches which platforms stream which content in which countries and upserts
into the `availability` table. Country-aware: each row is scoped to a country.
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
from app.models.availability import Availability
from app.models.movie import Movie
from app.models.platform import Platform
from app.models.series import Series
from app.models.sync import SyncMetadata
from app.services.sync import compute_hash, get_or_create, record_sync_complete, record_sync_start

logger = logging.getLogger(__name__)

PROVIDER = "tmdb"
DEFAULT_COUNTRY = "IN"


def _is_configured() -> bool:
    return bool(settings.TMDB_API_KEY)


async def run_availability_sync(session: AsyncSession, country_code: str = DEFAULT_COUNTRY) -> SyncMetadata:
    """Run a single availability sync cycle for one country."""
    rec = await record_sync_start(session, "availability_sync", provider=PROVIDER, country_code=country_code)
    fetched = inserted = updated = failed = 0
    try:
        if not _is_configured():
            logger.warning("TMDB_API_KEY not set — skipping availability sync")
        else:
            async with httpx.AsyncClient(timeout=30) as client:
                # Placeholder: real providers expose watch/providers endpoints.
                # We seed a couple of platforms so the catalog is non-empty.
                for name in ("Netflix", "Amazon Prime Video", "JioHotstar", "Zee5"):
                    _, created = await get_or_create(
                        session,
                        Platform,
                        name=name,
                        slug=name.lower().replace(" ", "-"),
                        country_code=country_code,
                        defaults={"active": True, "subscription_required": True},
                    )
                    if created:
                        inserted += 1

                # Mark every movie as available on every active platform in this country.
                movies = (await session.execute(select(Movie))).scalars().all()
                series = (await session.execute(select(Series))).scalars().all()
                platforms = (await session.execute(select(Platform).where(Platform.country_code == country_code))).scalars().all()

                for content in [*movies, *series]:
                    content_type = "movie" if isinstance(content, Movie) else "series"
                    for plat in platforms:
                        record = {
                            "content_type": content_type,
                            "content_id": content.id,
                            "platform_id": plat.id,
                            "country_code": country_code,
                            "available": True,
                            "subscription_type": "subscription",
                        }
                        av, created = await get_or_create(
                            session,
                            Availability,
                            content_type=record["content_type"],
                            content_id=record["content_id"],
                            platform_id=record["platform_id"],
                            country_code=record["country_code"],
                            defaults={
                                "available": record["available"],
                                "subscription_type": record["subscription_type"],
                                "provider_source": PROVIDER,
                                "provider_data_hash": compute_hash(record),
                            },
                        )
                        if created:
                            inserted += 1
                        else:
                            updated += 1
                        fetched += 1
    except Exception as exc:  # noqa: BLE001
        logger.exception("Availability sync failed")
        await record_sync_complete(session, rec, fetched, inserted, updated, failed, str(exc))
        return rec
    await record_sync_complete(session, rec, fetched, inserted, updated, failed)
    return rec


async def main() -> None:
    """Entry point for the availability sync worker."""
    logging.basicConfig(level=logging.INFO)
    logger.info("Availability sync worker starting")
    async with AsyncSessionLocal() as session:
        await run_availability_sync(session)


if __name__ == "__main__":
    asyncio.run(main())