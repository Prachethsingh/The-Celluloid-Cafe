"""Genre model — normalized taxonomy."""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class Genre(Base):
    __tablename__ = "genres"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    external_id = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, unique=True, index=True, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    movies = relationship("Movie", secondary="movie_genres", back_populates="genres")
    series = relationship("Series", secondary="series_genres", back_populates="genres")