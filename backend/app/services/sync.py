"""Shared synchronization engine.

Implements the PRD's fetch → validate → normalize → duplicate-check →
change-detect → update pipeline. Workers call into this so the logic lives
in one place and can be unit-tested without network access.
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sync import SyncMetadata, SyncStatus

logger = logging.getLogger(__name__)


def compute_hash(record: dict) -> str:
    """Stable hash for change detection — order-independent over keys."""
    canonical = repr(sorted((k, str(v)) for k, v in record.items()))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def record_sync_start(
    session: AsyncSession,
    task_name: str,
    provider: str | None = None,
    country_code: str | None = None,
) -> SyncMetadata:
    """Insert a RUNNING sync record and return it."""
    rec = SyncMetadata(
        task_name=task_name,
        status=SyncStatus.RUNNING,
        started_at=datetime.now(timezone.utc),
        provider=provider,
        country_code=country_code,
    )
    session.add(rec)
    await session.commit()
    await session.refresh(rec)
    return rec


async def record_sync_complete(
    session: AsyncSession,
    rec: SyncMetadata,
    fetched: int,
    inserted: int,
    updated: int,
    failed: int,
    error_message: str | None = None,
) -> None:
    """Mark a sync record COMPLETED/FAILED with counters."""
    rec.records_fetched = fetched
    rec.records_inserted = inserted
    rec.records_updated = updated
    rec.records_failed = failed
    rec.error_message = error_message
    rec.status = SyncStatus.FAILED if error_message else SyncStatus.COMPLETED
    rec.completed_at = datetime.now(timezone.utc)
    await session.commit()


async def upsert_with_change_detection(
    session: AsyncSession,
    model_cls: Any,
    external_id_field: str,
    record: dict,
    update_fields: Iterable[str],
) -> str:
    """Insert or update a record, returning 'inserted' | 'updated' | 'unchanged'.

    Uses a data_hash on the model to skip unchanged records (PRD §22).
    """
    ext_id = record[external_id_field]
    existing = await session.execute(
        select(model_cls).where(getattr(model_cls, external_id_field) == ext_id)
    )
    obj = existing.scalar_one_or_none()
    new_hash = compute_hash(record)

    if obj is None:
        obj = model_cls(id=record.get("id"), **{
            external_id_field: ext_id,
            **{f: record.get(f) for f in update_fields},
            "data_hash": new_hash,
            "last_checked": datetime.now(timezone.utc),
        })
        session.add(obj)
        await session.commit()
        return "inserted"

    if getattr(obj, "data_hash", None) == new_hash:
        return "unchanged"

    for f in update_fields:
        if hasattr(obj, f):
            setattr(obj, f, record.get(f))
    obj.data_hash = new_hash
    obj.last_checked = datetime.now(timezone.utc)
    if hasattr(obj, "updated_at"):
        obj.updated_at = datetime.now(timezone.utc)
    await session.commit()
    return "updated"


async def get_or_create(
    session: AsyncSession,
    model_cls: Any,
    defaults: dict | None = None,
    **kwargs: Any,
) -> tuple[Any, bool]:
    """Get an existing row or create it. Returns (instance, created)."""
    conditions = [getattr(model_cls, k) == v for k, v in kwargs.items()]
    existing = await session.execute(select(model_cls).where(*conditions))
    obj = existing.scalar_one_or_none()
    if obj is not None:
        return obj, False
    obj = model_cls(**{**(defaults or {}), **kwargs})
    session.add(obj)
    await session.commit()
    await session.refresh(obj)
    return obj, True