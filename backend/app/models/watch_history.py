"""Watch history model — tracking what users have watched."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Float,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.models.base import Base


class WatchHistory(Base):
    __tablename__ = "watch_history"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content_type = Column(String, nullable=False)  # "movie" or "series" or "episode"
    content_id = Column(String, nullable=False)
    episode_id = Column(String, ForeignKey("episodes.id"), nullable=True)
    progress_seconds = Column(Integer, default=0)
    duration_seconds = Column(Integer, nullable=True)
    completed = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="history")