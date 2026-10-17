"""Series model."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship

from app.models.base import Base


series_genres = Table(
    "series_genres",
    Base.metadata,
    Column("series_id", String, ForeignKey("series.id", ondelete="CASCADE"), primary_key=True, nullable=False),
    Column("genre_id", String, ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True, nullable=False),
)


class Series(Base):
    __tablename__ = "series"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    external_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    first_air_date = Column(DateTime(timezone=True), nullable=True)
    last_air_date = Column(DateTime(timezone=True), nullable=True)
    language = Column(String, nullable=True)
    country = Column(String, nullable=True)
    rating = Column(Float, nullable=True)
    rating_source = Column(String, nullable=True)
    poster_url = Column(String, nullable=True)
    backdrop_url = Column(String, nullable=True)
    popularity = Column(Float, default=0.0)
    source = Column(String, nullable=True)
    source_last_modified = Column(DateTime(timezone=True), nullable=True)
    data_hash = Column(String, nullable=True)
    last_checked = Column(DateTime(timezone=True), default=datetime.utcnow)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    genres = relationship("Genre", secondary=series_genres, back_populates="series")
    people = relationship("Person", secondary="person_series", back_populates="series")
    seasons = relationship("Season", back_populates="series", cascade="all, delete-orphan")