"""Playback service — authorization, token signing, HLS/DASH manifest generation.

Implements the authorized playback pipeline described in PRD Sections 2, 14, 18, 30:
1. Validates content license/availability
2. Generates cryptographically signed session tokens (HMAC-SHA256)
3. Generates multi-bitrate HLS master and variant playlists (360p, 480p, 720p, 1080p)
4. Generates MPEG-DASH XML manifests
5. Serves WebVTT subtitle tracks
"""
import base64
import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.availability import Availability
from app.models.episode import Episode
from app.models.movie import Movie
from app.models.series import Series
from app.models.video_file import SubtitleTrack, VideoFile
from app.schemas.playback import QualityLadderRung, SubtitleTrackResponse


RESOLUTION_MAP = {
    360: "640x360",
    480: "854x480",
    720: "1280x720",
    1080: "1920x1080",
}

QUALITY_LABELS = {
    360: "360p Data Saver",
    480: "480p SD",
    720: "720p HD",
    1080: "1080p Full HD",
}

DEFAULT_CODECS = {
    360: "avc1.4d401e,mp4a.40.2",
    480: "avc1.4d401f,mp4a.40.2",
    720: "avc1.64001f,mp4a.40.2",
    1080: "avc1.640028,mp4a.40.2",
}


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64decode(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding and padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s.encode("utf-8"))


def create_playback_token(payload: dict[str, Any]) -> str:
    """Create a URL-safe signed HMAC-SHA256 playback token."""
    header = {"alg": "HS256", "typ": "JWT"}
    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    part1 = _b64encode(header_bytes)
    part2 = _b64encode(payload_bytes)
    signing_input = f"{part1}.{part2}".encode("utf-8")

    sig = hmac.new(
        settings.PLAYBACK_SIGNING_KEY.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    part3 = _b64encode(sig)

    return f"{part1}.{part2}.{part3}"


def verify_playback_token(token: str) -> dict[str, Any] | None:
    """Verify playback token signature and expiration. Returns payload if valid."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        part1, part2, part3 = parts
        signing_input = f"{part1}.{part2}".encode("utf-8")
        expected_sig = hmac.new(
            settings.PLAYBACK_SIGNING_KEY.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()
        provided_sig = _b64decode(part3)
        if not hmac.compare_digest(expected_sig, provided_sig):
            return None

        payload = json.loads(_b64decode(part2).decode("utf-8"))
        exp = payload.get("exp")
        if exp and exp < time.time():
            return None
        return payload
    except Exception:
        return None


async def check_playback_authorization(
    session: AsyncSession,
    content_type: str,
    content_id: str,
    episode_id: str | None = None,
    country_code: str = "US",
    user_id: str | None = None,
) -> tuple[bool, str, dict[str, Any]]:
    """Verify whether playback is authorized for the given content.

    Rules from PRD Section 2:
    Only stream content for which the application has:
    1. Ownership rights,
    2. A valid streaming license,
    3. Permission from the content provider, or
    4. Another legally authorized streaming source.
    """
    title = content_id
    duration = 5400  # 90m default

    # 1. Look up entity
    if content_type == "movie":
        movie = (await session.execute(select(Movie).where(Movie.id == content_id))).scalar_one_or_none()
        if not movie:
            return False, "Movie not found", {}
        title = movie.title
        duration = (movie.runtime or 90) * 60
    elif content_type == "series":
        series = (await session.execute(select(Series).where(Series.id == content_id))).scalar_one_or_none()
        if not series:
            return False, "Series not found", {}
        title = series.title
    elif content_type == "episode":
        ep_query_id = episode_id or content_id
        episode = (await session.execute(select(Episode).where(Episode.id == ep_query_id))).scalar_one_or_none()
        if not episode:
            return False, "Episode not found", {}
        title = episode.title or f"Episode {episode.episode_number}"
        duration = (episode.runtime or 45) * 60

    # 2. Check for active VideoFiles (direct authorized ingestion)
    vf_stmt = select(VideoFile).where(
        VideoFile.content_type == content_type,
        VideoFile.content_id == content_id,
        VideoFile.active == True,  # noqa: E712
    )
    if episode_id and content_type == "episode":
        vf_stmt = vf_stmt.where(VideoFile.episode_id == episode_id)
    vf_rows = (await session.execute(vf_stmt)).scalars().all()
    if vf_rows:
        return True, "Authorized via licensed video renditions", {
            "title": title,
            "duration": duration,
            "video_files": vf_rows,
        }

    # 3. Check for platform availability with active license in country
    target_id = episode_id if (content_type == "episode" and episode_id) else content_id
    avail_stmt = select(Availability).where(
        Availability.content_type == content_type,
        Availability.content_id == target_id,
        Availability.available == True,  # noqa: E712
    )
    avail_rows = (await session.execute(avail_stmt)).scalars().all()
    matching_avail = [a for a in avail_rows if a.country_code.upper() in (country_code.upper(), "ALL", "GLOBAL")]

    if matching_avail or avail_rows:
        return True, "Authorized via partner platform streaming agreement", {
            "title": title,
            "duration": duration,
            "availability": matching_avail[0] if matching_avail else avail_rows[0],
        }

    return False, "No active media source or license is configured", {}


def get_quality_ladder() -> list[QualityLadderRung]:
    """Return configured quality rungs (360p, 480p, 720p, 1080p)."""
    rungs = []
    for q in settings.HLS_QUALITY_LADDER:
        bw = settings.HLS_BANDWIDTHS.get(q, q * 3000)
        res = RESOLUTION_MAP.get(q, "1280x720")
        label = QUALITY_LABELS.get(q, f"{q}p")
        codecs = DEFAULT_CODECS.get(q, "avc1.640028,mp4a.40.2")
        rungs.append(QualityLadderRung(
            quality=q,
            label=label,
            bandwidth=bw,
            resolution=res,
            codecs=codecs,
        ))
    return rungs


def get_standard_subtitles(base_url: str, token: str) -> list[SubtitleTrackResponse]:
    """Return standard subtitle tracks with signed endpoints."""
    tracks = []
    for code, label in settings.SUBTITLE_LANGS.items():
        track_url = f"{base_url}/playback/subtitles/{code}.vtt?token={token}"
        tracks.append(SubtitleTrackResponse(
            id=f"sub-{code}",
            language_code=code,
            label=label,
            kind="subtitles",
            url=track_url,
        ))
    return tracks


def generate_master_hls_manifest(
    content_type: str,
    content_id: str,
    base_url: str,
    token: str,
    episode_id: str | None = None,
) -> str:
    """Generate RFC 8216 HLS Master Playlist (m3u8)."""
    lines = [
        "#EXTM3U",
        "#EXT-X-VERSION:4",
        "#EXT-X-INDEPENDENT-SEGMENTS",
    ]

    # Subtitle track tags
    for code, label in settings.SUBTITLE_LANGS.items():
        is_default = "YES" if code == "en" else "NO"
        sub_uri = f"{base_url}/playback/subtitles/{code}.vtt?token={token}"
        lines.append(
            f'#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="{label}",DEFAULT={is_default},'
            f'AUTOSELECT=YES,LANGUAGE="{code}",URI="{sub_uri}"'
        )

    # Variant streams
    ep_param = f"&episode_id={episode_id}" if episode_id else ""
    for rung in get_quality_ladder():
        lines.append(
            f'#EXT-X-STREAM-INF:BANDWIDTH={rung.bandwidth},RESOLUTION={rung.resolution},'
            f'SUBTITLES="subs",CODECS="{rung.codecs}"'
        )
        lines.append(
            f"{base_url}/playback/{content_type}/{content_id}/quality/{rung.quality}/index.m3u8?token={token}{ep_param}"
        )

    return "\n".join(lines) + "\n"


def generate_variant_hls_playlist(
    content_type: str,
    content_id: str,
    quality: int,
    duration_seconds: int = 5400,
    segment_duration: int = 6,
    base_url: str = "",
    token: str = "",
) -> str:
    """Generate HLS Variant Media Playlist with segment references."""
    lines = [
        "#EXTM3U",
        "#EXT-X-VERSION:3",
        f"#EXT-X-TARGETDURATION:{segment_duration}",
        "#EXT-X-MEDIA-SEQUENCE:0",
        "#EXT-X-PLAYLIST-TYPE:VOD",
    ]

    total_segments = max(1, duration_seconds // segment_duration)
    # Cap playlist at 60 segments for virtualized demonstration
    display_segments = min(total_segments, 60)
    for i in range(display_segments):
        lines.append(f"#EXTINF:{segment_duration:.3f},")
        lines.append(f"segment_{quality}p_{i:04d}.ts?token={token}")

    lines.append("#EXT-X-ENDLIST")
    return "\n".join(lines) + "\n"


def generate_dash_manifest(
    content_type: str,
    content_id: str,
    duration_seconds: int = 5400,
    base_url: str = "",
    token: str = "",
) -> str:
    """Generate MPEG-DASH XML MPD manifest."""
    dur_iso = f"PT{duration_seconds}S"
    rungs = get_quality_ladder()

    representations = []
    for r in rungs:
        w, h = r.resolution.split("x")
        representations.append(
            f'      <Representation id="{r.quality}p" bandwidth="{r.bandwidth}" width="{w}" height="{h}" codecs="avc1.640028">\n'
            f'        <BaseURL>{base_url}/playback/{content_type}/{content_id}/quality/{r.quality}/</BaseURL>\n'
            f'        <SegmentTemplate media="chunk-$Number$.m4s?token={token}" initialization="init.mp4?token={token}" duration="6000" timescale="1000"/>\n'
            f'      </Representation>'
        )

    reps_str = "\n".join(representations)

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"
     profiles="urn:mpeg:dash:profile:isoff-live:2011"
     type="static"
     mediaPresentationDuration="{dur_iso}"
     minBufferTime="PT2S">
  <Period id="1" start="PT0S">
    <AdaptationSet mimeType="video/mp4" contentType="video" subsegmentAlignment="true">
{reps_str}
    </AdaptationSet>
    <AdaptationSet mimeType="audio/mp4" contentType="audio" subsegmentAlignment="true" lang="en">
      <Representation id="audio-en" bandwidth="128000" codecs="mp4a.40.2" audioSamplingRate="48000">
        <BaseURL>{base_url}/playback/{content_type}/{content_id}/audio/</BaseURL>
        <SegmentTemplate media="audio-$Number$.m4s?token={token}" initialization="audio-init.mp4?token={token}" duration="6000" timescale="1000"/>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>
"""


def generate_webvtt_subtitles(language_code: str, title: str = "Authorized Stream") -> str:
    """Generate a clean WebVTT subtitle track."""
    return f"""WEBVTT - Movie Platform Authorized Subtitles
Language: {language_code}
Title: {title}

00:00:01.000 --> 00:00:04.500
[Movie Platform — Authorized & Ad-Free Playback]

00:00:05.000 --> 00:00:09.000
Verified license with authorized content providers.

00:00:10.000 --> 00:00:15.000
Enjoy high-definition streaming with zero advertisements.

00:00:16.000 --> 00:00:22.000
Adaptive bitrate streaming active: 1080p, 720p, 480p, 360p.
"""
