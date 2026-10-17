"""Content schemas — movies, series, episodes, genres, platforms, availability."""
from datetime import datetime

from pydantic import BaseModel


class GenreResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None = None


class PlatformResponse(BaseModel):
    id: str
    name: str
    slug: str
    logo_url: str | None = None
    website_url: str | None = None
    subscription_required: bool = False
    supported_languages: list[str] = []
    country_codes: list[str] = []
    active: bool = True


class AvailabilityResponse(BaseModel):
    id: str
    content_type: str
    content_id: str
    platform_id: str
    platform: PlatformResponse | None = None
    country_code: str
    available: bool
    subscription_type: str = "subscription"
    quality: int = 1080
    subtitle_available: bool = False
    start_date: datetime | None = None
    end_date: datetime | None = None
    last_checked: datetime | None = None


class PersonResponse(BaseModel):
    id: str
    name: str
    original_name: str | None = None
    profile_url: str | None = None
    known_for_department: str | None = None


class CastResponse(PersonResponse):
    role: str | None = None
    character: str | None = None


class MovieResponse(BaseModel):
    id: str
    external_id: str
    title: str
    original_title: str | None = None
    description: str | None = None
    release_date: datetime | None = None
    runtime: int | None = None
    language: str | None = None
    country: str | None = None
    rating: float | None = None
    rating_source: str | None = None
    poster_url: str | None = None
    backdrop_url: str | None = None
    trailer_url: str | None = None
    popularity: float = 0.0
    genres: list[GenreResponse] = []
    cast: list[CastResponse] = []


class MovieDetailResponse(MovieResponse):
    availability: list[AvailabilityResponse] = []


class SeriesResponse(BaseModel):
    id: str
    external_id: str
    title: str
    description: str | None = None
    first_air_date: datetime | None = None
    last_air_date: datetime | None = None
    language: str | None = None
    country: str | None = None
    rating: float | None = None
    rating_source: str | None = None
    poster_url: str | None = None
    backdrop_url: str | None = None
    popularity: float = 0.0
    genres: list[GenreResponse] = []
    cast: list[CastResponse] = []


class SeriesDetailResponse(SeriesResponse):
    availability: list[AvailabilityResponse] = []
    seasons: list["SeasonResponse"] = []


class SeasonResponse(BaseModel):
    id: str
    season_number: int
    title: str | None = None
    release_date: datetime | None = None
    poster_url: str | None = None
    episodes: list["EpisodeResponse"] = []


class EpisodeResponse(BaseModel):
    id: str
    episode_number: int
    title: str | None = None
    description: str | None = None
    release_date: datetime | None = None
    runtime: int | None = None
    thumbnail_url: str | None = None
    has_subtitle: bool = False
    subtitle_languages: list[str] = []
    availability: list[AvailabilityResponse] = []


SeriesDetailResponse.model_rebuild()


class SearchResponse(BaseModel):
    id: str
    content_type: str  # "movie" | "series"
    title: str
    year: int | None = None
    poster_url: str | None = None
    rating: float | None = None
    genres: list[str] = []
    available_on: list[str] = []  # platform names
    match_score: float = 0.0