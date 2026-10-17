"""
Core configuration — pydantic-settings based, reads from environment / .env.
"""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── App ──────────────────────────────────────────────────────────────
    APP_NAME: str = "Movie Platform"
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"
    DEBUG: bool = False

    # ── Server ───────────────────────────────────────────────────────────
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    # ── Database ────────────────────────────────────────────────────────
    POSTGRES_DSN: str = "postgresql+asyncpg://mp:mp@localhost:5432/movie_platform"

    # ── Redis ───────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 3600  # seconds

    # ── Cors ────────────────────────────────────────────────────────────
    ALLOWED_HOSTS: list[str] = ["*"]

    # ── Auth ────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    JWT_AUDIENCE: str = "movie-platform:app"

    # ── Password ────────────────────────────────────────────────────────
    BCRYPT_ROUNDS: int = 12

    # ── Data providers (Phase 2+) ───────────────────────────────────────
    TMDB_API_KEY: str | None = None
    TMDB_BASE_URL: str = "https://api.themoviedb.org/3"
    TMDB_IMAGE_BASE: str = "https://image.tmdb.org/t/p/original"

    # ── Rate limiting ───────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 120

    # ── Sync ────────────────────────────────────────────────────────────
    SYNC_LOCK_TTL: int = 600  # seconds — prevents overlapping sync runs

    # ── Playback / CDN ──────────────────────────────────────────────────
    PLAYBACK_SIGNING_KEY: str = "playback-secret-change-me"
    PLAYBACK_TOKEN_EXPIRE_SECONDS: int = 3600
    HLS_SEGMENT_DURATION: int = 6  # seconds
    HLS_QUALITY_LADDER: list[int] = [360, 480, 720, 1080]
    HLS_BANDWIDTHS: dict[int, int] = {
        360: 800_000,
        480: 1_400_000,
        720: 2_800_000,
        1080: 5_000_000,
    }
    CDN_BASE_URL: str | None = None
    MEDIA_STORAGE_PATH: str = "/media"
    SUBTITLE_LANGS: dict[str, str] = {"en": "English", "hi": "Hindi"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
