"""Watchlist model — user's saved titles."""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class Watchlist(Base):
    __tablename__ = "watchlists"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content_type = Column(String, nullable=False)  # "movie" or "series"
    content_id = Column(String, nullable=False)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        {"extend_existing": True},
    )

    # Relationship to avoid ambiguous foreign key resolution
    user = relationship("User", back_populates="watchlists")