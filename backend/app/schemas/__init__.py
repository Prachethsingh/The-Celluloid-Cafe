"""Pydantic schemas — request/response models."""
from .auth import (
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
)
from .content import (
    AvailabilityResponse,
    CastResponse,
    EpisodeResponse,
    GenreResponse,
    MovieDetailResponse,
    MovieResponse,
    PersonResponse,
    PlatformResponse,
    SeasonResponse,
    SeriesDetailResponse,
    SeriesResponse,
)
from .user import (
    HistoryCreateRequest,
    HistoryResponse,
    WatchlistCreateRequest,
    WatchlistResponse,
)
from .notification import NotificationCreateRequest, NotificationResponse
from .playback import PlaybackSessionRequest, PlaybackSessionResponse
from .content import SearchResponse

__all__ = [
    "LoginRequest", "LoginResponse", "RefreshRequest", "RegisterRequest", "TokenPair",
    "MovieResponse", "MovieDetailResponse",
    "SeriesResponse", "SeriesDetailResponse",
    "SeasonResponse", "EpisodeResponse",
    "GenreResponse", "PlatformResponse", "AvailabilityResponse",
    "PersonResponse", "CastResponse",
    "SearchResponse",
    "NotificationCreateRequest", "NotificationResponse",
    "WatchlistResponse", "WatchlistCreateRequest",
    "HistoryResponse", "HistoryCreateRequest",
    "PlaybackSessionRequest", "PlaybackSessionResponse",
]