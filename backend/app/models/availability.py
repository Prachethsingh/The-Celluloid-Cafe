"""Availability model — which platforms stream content in which countries.

Availability is intentionally decoupled from the specific content type:
content_id is a UUID, content_type is "movie" | "series" | "episode".
This keeps the schema simple and lets the sync engine write availability
without needing FK joins to three separate tables.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.models.base import Base


class SubscriptionType(str, Enum):
    FREE = "free"
    SUBSCRIPTION = "subscription"
    PAY_PER_VIEW = "ppv"
    RENTAL = "rental"


class Availability(Base):
    __tablename__ = "availability"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    content_type = Column(String, nullable=False, index=True)  # movie | series | episode
    content_id = Column(String, index=True, nullable=False)
    episode_id = Column(String, ForeignKey("episodes.id", ondelete="SET NULL"), nullable=True, index=True)
    platform_id = Column(String, ForeignKey("platforms.id", ondelete="CASCADE"), nullable=False, index=True)
    country_code = Column(String, index=True, nullable=False)
    available = Column(Boolean, default=True)
    subscription_type = Column(String, nullable=False, default="subscription")
    quality = Column(Integer, default=1080)  # max supported quality
    subtitle_available = Column(Boolean, default=False)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    last_checked = Column(DateTime(timezone=True), default=datetime.utcnow)
    provider_source = Column(String, nullable=True)  # which external API provided this data
    provider_data_hash = Column(String, nullable=True)  # for change detection

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    platform = relationship("Platform", back_populates="availability")