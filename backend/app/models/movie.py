"""Movie model."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship

from app.models.base import Base


# Association table: movie ↔ genre
movie_genres = Table(
    "movie_genres",
    Base.metadata,
    Column("movie_id", String, ForeignKey("movies.id", ondelete="CASCADE"), primary_key=True, nullable=False),
    Column("genre_id", String, ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True, nullable=False),
)


class Movie(Base):
    __tablename__ = "movies"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    external_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, index=True, nullable=False)
    original_title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    release_date = Column(DateTime(timezone=True), nullable=True)
    runtime = Column(Integer, nullable=True)  # minutes
    language = Column(String, nullable=True)
    country = Column(String, nullable=True)
    rating = Column(Float, nullable=True)  # 0–10
    rating_source = Column(String, nullable=True)
    poster_url = Column(String, nullable=True)
    backdrop_url = Column(String, nullable=True)
    trailer_url = Column(String, nullable=True)
    popularity = Column(Float, default=0.0)
    source = Column(String, nullable=True)  # e.g. "tmdb"
    source_last_modified = Column(DateTime(timezone=True), nullable=True)
    data_hash = Column(String, nullable=True)
    last_checked = Column(DateTime(timezone=True), default=datetime.utcnow)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    genres = relationship("Genre", secondary=movie_genres, back_populates="movies")
    people = relationship("Person", secondary="person_movies", back_populates="movies")