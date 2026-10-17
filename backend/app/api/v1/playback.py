"""Playback endpoints — authorized streaming pipeline."""
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.middleware.auth import optional_user
from app.schemas.playback import (
    PlaybackSessionRequest,
    PlaybackSessionResponse,
)
from app.services.playback import (
    check_playback_authorization,
    create_playback_token,
    generate_dash_manifest,
    generate_master_hls_manifest,
    generate_variant_hls_playlist,
    generate_webvtt_subtitles,
    get_quality_ladder,
    get_standard_subtitles,
    verify_playback_token,
)

router = APIRouter()


@router.post("/session", response_model=PlaybackSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_playback_session(
    request: Request,
    body: PlaybackSessionRequest,
    user_id: str | None = Depends(optional_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a signed, authorized playback session as per PRD Section 14.

    Validates content licensing and returns signed token and streaming manifests.
    Anonymous viewers are supported without mandatory account creation (PRD Section 20).
    """
    authorized, reason, meta = await check_playback_authorization(
        session=session,
        content_type=body.content_type,
        content_id=body.content_id,
        episode_id=body.episode_id,
        country_code=body.country_code,
        user_id=user_id,
    )

    if not authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Content not authorized for playback: {reason}",
        )

    session_id = f"ses_{uuid.uuid4().hex[:12]}"
    now = int(time.time())
    expires_in = settings.PLAYBACK_TOKEN_EXPIRE_SECONDS
    expires_at = now + expires_in

    # Cryptographically signed payload
    token_payload = {
        "sub": user_id or "anonymous",
        "session_id": session_id,
        "content_type": body.content_type,
        "content_id": body.content_id,
        "episode_id": body.episode_id,
        "country": body.country_code,
        "iat": now,
        "exp": expires_at,
    }
    signed_token = create_playback_token(token_payload)

    # Base URL construction
    base_url = str(request.base_url).rstrip("/")
    api_prefix = f"{base_url}/api/v1"

    # Streaming endpoints
    hls_manifest_url = (
        f"{api_prefix}/playback/{body.content_type}/{body.content_id}/manifest.m3u8?token={signed_token}"
    )
    dash_manifest_url = (
        f"{api_prefix}/playback/{body.content_type}/{body.content_id}/manifest.mpd?token={signed_token}"
    )
    stream_url = (
        settings.CDN_BASE_URL + f"/media/{body.content_type}/{body.content_id}/master.m3u8"
        if settings.CDN_BASE_URL
        else hls_manifest_url
    )

    return PlaybackSessionResponse(
        session_id=session_id,
        authorized=True,
        token=signed_token,
        expires_at=datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat(),
        expires_in=expires_in,
        content_type=body.content_type,
        content_id=body.content_id,
        episode_id=body.episode_id,
        stream_url=stream_url,
        hls_manifest_url=hls_manifest_url,
        dash_manifest_url=dash_manifest_url,
        qualities=get_quality_ladder(),
        subtitles=get_standard_subtitles(api_prefix, signed_token),
        license_type="AUTHORIZED_DIRECT",
    )


@router.get("/{content_type}/{content_id}/manifest.m3u8")
@router.get("/{content_type}/{content_id}/manifest")
async def get_playback_manifest(
    content_type: str,
    content_id: str,
    request: Request,
    token: str = Query(..., description="Signed playback token"),
    episode_id: str | None = None,
):
    """Return the HLS Master Playlist (RFC 8216) for authorized streaming."""
    payload = verify_playback_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired playback token",
        )

    base_url = f"{str(request.base_url).rstrip('/')}/api/v1"
    manifest_text = generate_master_hls_manifest(
        content_type=content_type,
        content_id=content_id,
        base_url=base_url,
        token=token,
        episode_id=episode_id,
    )

    return Response(
        content=manifest_text,
        media_type="application/vnd.apple.mpegurl",
        headers={
            "Cache-Control": "private, no-cache, no-store",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/{content_type}/{content_id}/quality/{quality}/index.m3u8")
async def get_variant_playlist(
    content_type: str,
    content_id: str,
    quality: int,
    request: Request,
    token: str = Query(..., description="Signed playback token"),
    episode_id: str | None = None,
):
    """Return the HLS media playlist for a specific quality rung (360p, 480p, 720p, 1080p)."""
    payload = verify_playback_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired playback token",
        )

    base_url = f"{str(request.base_url).rstrip('/')}/api/v1"
    variant_text = generate_variant_hls_playlist(
        content_type=content_type,
        content_id=content_id,
        quality=quality,
        duration_seconds=5400,
        segment_duration=settings.HLS_SEGMENT_DURATION,
        base_url=base_url,
        token=token,
    )

    return Response(
        content=variant_text,
        media_type="application/vnd.apple.mpegurl",
        headers={
            "Cache-Control": "private, no-cache, no-store",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/{content_type}/{content_id}/manifest.mpd")
async def get_dash_playback_manifest(
    content_type: str,
    content_id: str,
    request: Request,
    token: str = Query(..., description="Signed playback token"),
):
    """Return MPEG-DASH XML MPD manifest for DASH players."""
    payload = verify_playback_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired playback token",
        )

    base_url = f"{str(request.base_url).rstrip('/')}/api/v1"
    dash_text = generate_dash_manifest(
        content_type=content_type,
        content_id=content_id,
        duration_seconds=5400,
        base_url=base_url,
        token=token,
    )

    return Response(
        content=dash_text,
        media_type="application/dash+xml",
        headers={
            "Cache-Control": "private, no-cache, no-store",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/subtitles/{language_code}.vtt")
async def get_subtitle_track(
    language_code: str,
    token: str = Query(..., description="Signed playback token"),
):
    """Serve WebVTT subtitles for playback."""
    payload = verify_playback_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired playback token",
        )

    vtt_text = generate_webvtt_subtitles(language_code)
    return Response(
        content=vtt_text,
        media_type="text/vtt",
        headers={
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/verify")
async def verify_token_endpoint(token: str = Query(...)):
    """Diagnostic endpoint to verify a playback token."""
    payload = verify_playback_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return {"valid": True, "payload": payload}