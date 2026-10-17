"""Season model — belongs to a Series."""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class Season(Base):
    __tablename__ = "seasons"
    __table_args__ = ({"extend_existing": True},)

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    series_id = Column(String, ForeignKey("series.id", ondelete="CASCADE"), index=True, nullable=False)
    season_number = Column(Integer, nullable=False)
    title = Column(String, nullable=True)
    release_date = Column(DateTime(timezone=True), nullable=True)
    poster_url = Column(String, nullable=True)
    source = Column(String, nullable=True)
    data_hash = Column(String, nullable=True)
    last_checked = Column(DateTime(timezone=True), default=datetime.utcnow)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    series = relationship("Series", back_populates="seasons")
    episodes = relationship("Episode", back_populates="season", cascade="all, delete-orphan")