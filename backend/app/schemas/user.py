"""User-related schemas — watchlist and history."""
from datetime import datetime

from pydantic import BaseModel


class WatchlistCreateRequest(BaseModel):
    content_type: str  # "movie" | "series"
    content_id: str


class WatchlistResponse(BaseModel):
    id: str
    content_type: str
    content_id: str
    created_at: datetime | None = None
    title: str | None = None
    poster_url: str | None = None


class HistoryCreateRequest(BaseModel):
    content_type: str  # "movie" | "series" | "episode"
    content_id: str
    episode_id: str | None = None
    progress_seconds: int = 0
    duration_seconds: int | None = None
    completed: bool = False


class HistoryResponse(BaseModel):
    id: str
    content_type: str
    content_id: str
    episode_id: str | None = None
    progress_seconds: int
    duration_seconds: int | None = None
    completed: bool
    updated_at: datetime | None = None
    title: str | None = None
    thumbnail_url: str | None = None