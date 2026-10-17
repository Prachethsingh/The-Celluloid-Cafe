"""Platform (streaming service) model."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class Platform(Base):
    __tablename__ = "platforms"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    external_id = Column(String, unique=True, nullable=True)
    name = Column(String, index=True, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    logo_url = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    subscription_required = Column(Boolean, default=False)
    supported_languages = Column(String, nullable=True)  # JSON array as string
    country_code = Column(String, index=True, nullable=True)  # primary country ISO code
    country_codes = Column(String, nullable=True)  # comma-separated ISO codes
    active = Column(Boolean, default=True)
    playback_config = Column(Text, nullable=True)  # JSON: auth, manifest info
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    availability = relationship("Availability", back_populates="platform", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("name", "country_code", name="_platform_country_uc"),)