"""Episode model."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class Episode(Base):
    __tablename__ = "episodes"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    season_id = Column(String, ForeignKey("seasons.id", ondelete="CASCADE"), index=True, nullable=False)
    episode_number = Column(Integer, nullable=False)
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    release_date = Column(DateTime(timezone=True), nullable=True)
    runtime = Column(Integer, nullable=True)  # minutes
    thumbnail_url = Column(String, nullable=True)
    air_date = Column(DateTime(timezone=True), nullable=True)
    has_subtitle = Column(Boolean, default=False)
    subtitle_languages = Column(String, nullable=True)  # comma-separated codes like "en,hi"
    source = Column(String, nullable=True)
    data_hash = Column(String, nullable=True)
    last_checked = Column(DateTime(timezone=True), default=datetime.utcnow)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    season = relationship("Season", back_populates="episodes")
    __table_args__ = ({"extend_existing": True},)