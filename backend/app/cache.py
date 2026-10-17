"""Redis-backed cache service with an in-memory fallback.

Provides a small async cache API used by the API layer to keep hot reads
(trending, genres, search, recommendations) out of PostgreSQL.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis = None
_fallback: dict[str, str] = {}
_fallback_enabled = False


async def _get_redis():
    """Lazily connect to Redis. Returns None if Redis is unavailable."""
    global _redis
    if _redis is not None:
        return _redis
    if _redis is False:
        return None
    try:
        import redis.asyncio as aioredis  # type: ignore

        _redis = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=1.0,
        )
        await asyncio.wait_for(_redis.ping(), timeout=1.0)
        return _redis
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis unavailable, falling back to in-memory cache: %s", exc)
        _redis = False
        return None


async def get_cached(key: str) -> Any | None:
    """Return a cached value (deserialized JSON) or None on a miss."""
    redis = await _get_redis()
    if redis is not None:
        try:
            raw = await redis.get(key)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Redis GET failed for %s: %s", key, exc)
            raw = None
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except Exception:  # noqa: BLE001
            return raw
    return _deserialize(_fallback.get(key))


async def set_cached(key: str, value: Any, ttl: int | None = None) -> None:
    """Store a value (JSON-serialized) in the cache."""
    ttl = ttl if ttl is not None else settings.REDIS_CACHE_TTL
    redis = await _get_redis()
    if redis is not None:
        try:
            await redis.set(key, json.dumps(value, default=str), ex=ttl)
            return
        except Exception as exc:  # noqa: BLE001
            logger.warning("Redis SET failed for %s: %s", key, exc)
    _fallback[key] = _serialize(value)


async def delete_cached(key: str) -> None:
    """Remove a key from the cache."""
    redis = await _get_redis()
    if redis is not None:
        try:
            await redis.delete(key)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Redis DEL failed for %s: %s", key, exc)
    _fallback.pop(key, None)


async def invalidate_prefix(prefix: str) -> None:
    """Delete all keys starting with `prefix`."""
    redis = await _get_redis()
    if redis is not None:
        try:
            keys = []
            async for key in redis.scan_iter(match=f"{prefix}*"):
                keys.append(key)
            if keys:
                await redis.delete(*keys)
            return
        except Exception as exc:  # noqa: BLE001
            logger.warning("Redis SCAN/DEL failed for prefix %s: %s", prefix, exc)
    for key in list(_fallback):
        if key.startswith(prefix):
            _fallback.pop(key, None)


def _serialize(value: Any) -> str:
    try:
        return json.dumps(value, default=str)
    except Exception:  # noqa: BLE001
        return str(value)


def _deserialize(raw: str | None) -> Any | None:
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except Exception:  # noqa: BLE001
        return raw