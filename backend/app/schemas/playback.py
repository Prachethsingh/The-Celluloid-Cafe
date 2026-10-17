"""Playback schemas for authorized streaming sessions and manifests."""
from pydantic import BaseModel, Field


class PlaybackSessionRequest(BaseModel):
    content_type: str = Field(..., pattern="^(movie|series|episode)$")
    content_id: str
    episode_id: str | None = None
    country_code: str = "US"


class SubtitleTrackResponse(BaseModel):
    id: str
    language_code: str
    label: str
    kind: str = "subtitles"
    url: str


class QualityLadderRung(BaseModel):
    quality: int
    label: str
    bandwidth: int
    resolution: str
    codecs: str


class PlaybackSessionResponse(BaseModel):
    session_id: str
    authorized: bool = True
    token: str
    expires_at: str
    expires_in: int
    content_type: str
    content_id: str
    episode_id: str | None = None
    stream_url: str
    hls_manifest_url: str
    dash_manifest_url: str
    qualities: list[QualityLadderRung] = []
    subtitles: list[SubtitleTrackResponse] = []
    license_type: str = "AUTHORIZED_DIRECT"
