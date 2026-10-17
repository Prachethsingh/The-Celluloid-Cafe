"""Person model — actors, directors, crew."""
import uuid
from datetime import datetime

import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class PersonRole(str, enum.Enum):
    """Normalized role for a person attached to content."""

    ACTOR = "actor"
    DIRECTOR = "director"
    WRITER = "writer"
    PRODUCER = "producer"
    COMPOSER = "composer"
    OTHER = "other"


person_movies = Table(
    "person_movies",
    Base.metadata,
    Column("person_id", String, ForeignKey("people.id", ondelete="CASCADE"), primary_key=True, nullable=False),
    Column("movie_id", String, ForeignKey("movies.id", ondelete="CASCADE"), primary_key=True, nullable=False),
    Column("role", String, nullable=True),
    Column("character", String, nullable=True),
)

person_series = Table(
    "person_series",
    Base.metadata,
    Column("person_id", String, ForeignKey("people.id", ondelete="CASCADE"), primary_key=True, nullable=False),
    Column("series_id", String, ForeignKey("series.id", ondelete="CASCADE"), primary_key=True, nullable=False),
    Column("role", String, nullable=True),
    Column("character", String, nullable=True),
)


class Person(Base):
    __tablename__ = "people"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    external_id = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, index=True, nullable=False)
    original_name = Column(String, nullable=True)
    birth_date = Column(DateTime(timezone=True), nullable=True)
    death_date = Column(DateTime(timezone=True), nullable=True)
    biography = Column(Text, nullable=True)
    profile_url = Column(String, nullable=True)
    known_for_department = Column(String, nullable=True)
    popularity = Column(Float, default=0.0)
    source = Column(String, nullable=True)
    data_hash = Column(String, nullable=True)
    last_checked = Column(DateTime(timezone=True), default=datetime.utcnow)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    movies = relationship("Movie", secondary=person_movies, back_populates="people")
    series = relationship("Series", secondary=person_series, back_populates="people")