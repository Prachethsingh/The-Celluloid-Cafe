"""Notification model — in-app notifications per user."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class NotificationType(str, enum.Enum):
    NEW_EPISODE = "new_episode"
    NEW_SEASON = "new_season"
    NEW_MOVIE = "new_movie"
    WATCHLIST_AVAILABILITY = "watchlist_availability"
    RECOMMENDATION = "recommendation"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    type = Column(Enum(NotificationType, name="notification_type"), nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    data = Column(JSON, nullable=True)  # JSON payload
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="notifications")