"""VideoFile model — encoded renditions for authorized playback.

Each row represents one quality ladder rung for a piece of content on a
platform: the HLS/DASH manifest path, bitrate, codec, and subtitle tracks.
The playback service reads these rows to build signed manifests.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class VideoContainer(str, enum.Enum):
    MP4 = "mp4"
    MKV = "mkv"
    WEBM = "webm"


class VideoCodec(str, enum.Enum):
    H264 = "h264"
    H265 = "h265"
    AV1 = "av1"


class SubtitleKind(str, enum.Enum):
    CAPTIONS = "captions"
    SUBTITLES = "subtitles"
    FORCED = "forced"
    COMMENTARY = "commentary"


class VideoFile(Base):
    __tablename__ = "video_files"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    content_type = Column(String, nullable=False, index=True)  # movie | series | episode
    content_id = Column(String, nullable=False, index=True)
    platform_id = Column(String, ForeignKey("platforms.id", ondelete="CASCADE"), nullable=False, index=True)
    episode_id = Column(String, ForeignKey("episodes.id", ondelete="SET NULL"), nullable=True, index=True)

    quality = Column(Integer, nullable=False, index=True)  # 360, 480, 720, 1080
    codec = Column(String, default=VideoCodec.H264.value)
    container = Column(String, default=VideoContainer.MP4.value)
    bitrate = Column(Integer, nullable=False)  # bits per second
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    # Filesystem / CDN paths
    hls_path = Column(String, nullable=True)  # e.g. /media/movie/123/720/index.m3u8
    dash_path = Column(String, nullable=True)  # e.g. /media/movie/123/720/manifest.mpd
    storage_provider = Column(String, default="local")  # local | s3 | gcs
    storage_bucket = Column(String, nullable=True)
    storage_key = Column(String, nullable=True)

    # Subtitles: JSON list of {"language": "en", "kind": "subtitles", "path": "..."}
    subtitle_tracks = Column(Text, nullable=True)

    # DRM / protection
    playready = Column(Boolean, default=False)
    widevine = Column(Boolean, default=False)
    fairplay = Column(Boolean, default=False)

    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    platform = relationship("Platform")
    episode = relationship("Episode")
    subtitle_tracks = relationship("SubtitleTrack", back_populates="video_file", cascade="all, delete-orphan")

    __table_args__ = ({"extend_existing": True},)


class SubtitleTrack(Base):
    __tablename__ = "subtitle_tracks"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    video_file_id = Column(String, ForeignKey("video_files.id", ondelete="CASCADE"), nullable=False, index=True)
    language_code = Column(String, nullable=False, index=True)
    kind = Column(String, default=SubtitleKind.SUBTITLES.value)
    label = Column(String, nullable=True)  # display label, e.g. "English (CC)"
    vtt_path = Column(String, nullable=True)
    storage_provider = Column(String, default="local")
    storage_bucket = Column(String, nullable=True)
    storage_key = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    video_file = relationship("VideoFile", back_populates="subtitle_tracks")