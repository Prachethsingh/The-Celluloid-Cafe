"""Rate limiting middleware — Redis-backed sliding window with in-memory fallback."""
import time
from typing import Annotated

from fastapi import HTTPException, Request, status

from app.core.config import settings


class RateLimitMiddleware:
    """Sliding-window rate limiter keyed by client IP.

    Uses Redis when available; otherwise falls back to an in-memory dict.
    """

    def __init__(self, app) -> None:
        self.app = app
        self.limit = settings.RATE_LIMIT_PER_MINUTE
        self.window = 60
        self._fallback: dict[str, list[float]] = {}
        self._redis = None

    async def _get_redis(self):
        if self._redis is not None:
            return self._redis
        try:
            import redis.asyncio as aioredis  # type: ignore

            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            await self._redis.ping()
            return self._redis
        except Exception:  # noqa: BLE001
            self._redis = False
            return None

    async def _check(self, key: str) -> None:
        now = time.monotonic()
        redis = await self._get_redis()
        if redis:
            try:
                current = await redis.incr(key)
                if current == 1:
                    await redis.expire(key, self.window)
                if current > self.limit:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="rate limit exceeded",
                    )
                return
            except HTTPException:
                raise
            except Exception:  # noqa: BLE001
                pass
        window = self._fallback.setdefault(key, [])
        window[:] = [t for t in window if t > now - self.window]
        if len(window) >= self.limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="rate limit exceeded",
            )
        window.append(now)

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        client = scope.get("client")
        host = client[0] if client else "unknown"
        key = f"ratelimit:{host}:{scope['path']}"
        await self._check(key)
        await self.app(scope, receive, send)