"""Sync metadata model — tracks each ingestion run."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Integer, String

from app.models.base import Base


class SyncStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class SyncMetadata(Base):
    __tablename__ = "sync_metadata"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    task_name = Column(String, index=True, nullable=False)  # e.g. "metadata_sync", "availability_sync"
    status = Column(Enum(SyncStatus, name="sync_status"), default=SyncStatus.PENDING)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    records_fetched = Column(Integer, default=0)
    records_inserted = Column(Integer, default=0)
    records_updated = Column(Integer, default=0)
    records_failed = Column(Integer, default=0)
    error_message = Column(String, nullable=True)
    provider = Column(String, nullable=True)  # e.g. "tmdb"
    country_code = Column(String, nullable=True)  # e.g. "IN"

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)