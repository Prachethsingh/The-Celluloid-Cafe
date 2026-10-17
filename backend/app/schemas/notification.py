"""Notification request/response schemas."""
from datetime import datetime

from pydantic import BaseModel


class NotificationType(str):
    NEW_EPISODE = "new_episode"
    NEW_SEASON = "new_season"
    NEW_MOVIE = "new_movie"
    WATCHLIST_AVAILABILITY = "watchlist_availability"
    RECOMMENDATION = "recommendation"


class NotificationCreateRequest(BaseModel):
    type: str
    title: str
    body: str
    data: dict | None = None


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    body: str
    data: dict | None = None
    read: bool
    created_at: datetime | None = None