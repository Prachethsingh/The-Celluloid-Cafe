"""Tests for the authorized playback pipeline (tokens, manifests, API endpoints)."""
import time
import pytest
from httpx import AsyncClient

from app.models.movie import Movie
from app.models.platform import Platform
from app.models.availability import Availability
from app.services.playback import (
    create_playback_token,
    verify_playback_token,
    generate_master_hls_manifest,
    generate_variant_hls_playlist,
    generate_dash_manifest,
    generate_webvtt_subtitles,
    get_quality_ladder,
)


def test_token_signing_and_verification():
    payload = {
        "sub": "user-123",
        "session_id": "ses-abc",
        "content_id": "mov-1",
        "exp": int(time.time()) + 3600,
    }
    token = create_playback_token(payload)
    assert token is not None
    assert len(token.split(".")) == 3

    verified = verify_playback_token(token)
    assert verified is not None
    assert verified["sub"] == "user-123"
    assert verified["content_id"] == "mov-1"

    # Corrupt token
    corrupt = token[:-4] + "xxxx"
    assert verify_playback_token(corrupt) is None

    # Expired token
    expired_payload = {
        "sub": "user-123",
        "exp": int(time.time()) - 10,
    }
    expired_token = create_playback_token(expired_payload)
    assert verify_playback_token(expired_token) is None


def test_hls_master_manifest_generation():
    token = "test.token.sig"
    manifest = generate_master_hls_manifest(
        content_type="movie",
        content_id="test-movie-123",
        base_url="http://testserver/api/v1",
        token=token,
    )
    assert "#EXTM3U" in manifest
    assert "#EXT-X-VERSION:4" in manifest
    assert '#EXT-X-MEDIA:TYPE=SUBTITLES' in manifest
    assert 'BANDWIDTH=5000000' in manifest  # 1080p
    assert 'RESOLUTION=1920x1080' in manifest
    assert 'RESOLUTION=640x360' in manifest
    assert "token=test.token.sig" in manifest


def test_hls_variant_playlist_generation():
    token = "test.token.sig"
    variant = generate_variant_hls_playlist(
        content_type="movie",
        content_id="test-movie-123",
        quality=720,
        duration_seconds=120,
        segment_duration=6,
        token=token,
    )
    assert "#EXTM3U" in variant
    assert "#EXT-X-TARGETDURATION:6" in variant
    assert "#EXTINF:6.000," in variant
    assert "segment_720p_0000.ts?token=test.token.sig" in variant
    assert "#EXT-X-ENDLIST" in variant


def test_dash_manifest_generation():
    token = "test.token.sig"
    mpd = generate_dash_manifest(
        content_type="movie",
        content_id="test-movie-123",
        duration_seconds=120,
        base_url="http://testserver/api/v1",
        token=token,
    )
    assert "<MPD" in mpd
    assert '<Representation id="1080p"' in mpd
    assert '<Representation id="720p"' in mpd
    assert "audio/mp4" in mpd


def test_webvtt_subtitles():
    vtt = generate_webvtt_subtitles("en", "Interstellar")
    assert "WEBVTT" in vtt
    assert "Language: en" in vtt
    assert "00:00:01.000 --> 00:00:04.500" in vtt


@pytest.mark.asyncio
async def test_playback_session_and_manifest_api(client, session):
    # Setup test movie and availability
    movie = Movie(
        id="play-mov-1",
        external_id="tmdb-play-1",
        title="Authorized Streaming Movie",
        runtime=100,
    )
    platform = Platform(
        id="plat-play-1",
        name="Direct Stream",
        slug="direct-stream",
        country_code="US",
    )
    avail = Availability(
        id="avail-play-1",
        content_type="movie",
        content_id="play-mov-1",
        platform_id="plat-play-1",
        country_code="US",
        available=True,
    )
    session.add(movie)
    session.add(platform)
    session.add(avail)
    await session.commit()

    # 1. Anonymous user creates playback session (PRD Section 20)
    res = client.post(
        "/api/v1/playback/session",
        json={
            "content_type": "movie",
            "content_id": "play-mov-1",
            "country_code": "US",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["authorized"] is True
    assert data["session_id"].startswith("ses_")
    token = data["token"]
    assert token is not None
    assert len(data["qualities"]) == 4  # 360, 480, 720, 1080
    assert len(data["subtitles"]) >= 1

    # 2. Fetch Master HLS manifest
    hls_res = client.get(
        f"/api/v1/playback/movie/play-mov-1/manifest.m3u8?token={token}"
    )
    assert hls_res.status_code == 200
    assert "application/vnd.apple.mpegurl" in hls_res.headers["content-type"]
    assert "#EXTM3U" in hls_res.text
    assert "1920x1080" in hls_res.text

    # 3. Fetch Variant Playlist for 720p
    var_res = client.get(
        f"/api/v1/playback/movie/play-mov-1/quality/720/index.m3u8?token={token}"
    )
    assert var_res.status_code == 200
    assert "#EXTINF" in var_res.text

    # 4. Fetch DASH manifest
    dash_res = client.get(
        f"/api/v1/playback/movie/play-mov-1/manifest.mpd?token={token}"
    )
    assert dash_res.status_code == 200
    assert "<MPD" in dash_res.text

    # 5. Fetch Subtitles
    sub_res = client.get(
        f"/api/v1/playback/subtitles/en.vtt?token={token}"
    )
    assert sub_res.status_code == 200
    assert "WEBVTT" in sub_res.text

    # 6. Invalid token rejection
    bad_res = client.get(
        "/api/v1/playback/movie/play-mov-1/manifest.m3u8?token=invalid.token.here"
    )
    assert bad_res.status_code == 403
