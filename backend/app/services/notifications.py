"""Notification service — builds and dispatches user notifications.

Notifications are stored in PostgreSQL and pushed via the platform's push
channel (FCM/APNs). The worker consumes this queue asynchronously.
"""
from __future__ import annotations

import enum
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

logger = logging.getLogger(__name__)


class NotificationType(str, enum.Enum):
    NEW_EPISODE = "new_episode"
    NEW_SEASON = "new_season"
    NEW_MOVIE = "new_movie"
    WATCHLIST_AVAILABILITY = "watchlist_availability"
    RECOMMENDATION = "recommendation"


async def create_notification(
    session: AsyncSession,
    user_id: str,
    ntype: NotificationType,
    title: str,
    body: str,
    data: dict | None = None,
) -> dict:
    """Persist a notification for a user."""
    from app.models.notification import Notification

    notif = Notification(
        id=uuid.uuid4().hex,
        user_id=user_id,
        type=NotificationType(ntype),
        title=title,
        body=body,
        data=data or {},
        read=False,
    )
    session.add(notif)
    await session.commit()
    await session.refresh(notif)
    return {
        "id": notif.id,
        "user_id": notif.user_id,
        "type": notif.type.value,
        "title": notif.title,
        "body": notif.body,
        "data": notif.data,
        "read": notif.read,
        "created_at": notif.created_at,
    }


async def list_notifications(
    session: AsyncSession,
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False,
) -> list[dict]:
    """List notifications for a user, newest first."""
    from app.models.notification import Notification

    stmt = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.read == False)  # noqa: E712
    stmt = stmt.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(stmt)
    notifs = result.scalars().all()
    return [
        {
            "id": n.id,
            "user_id": n.user_id,
            "type": n.type.value,
            "title": n.title,
            "body": n.body,
            "data": n.data,
            "read": n.read,
            "created_at": n.created_at,
        }
        for n in notifs
    ]


async def mark_read(session: AsyncSession, user_id: str, notification_id: str) -> bool:
    """Mark a single notification as read."""
    from app.models.notification import Notification

    result = await session.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        return False
    notif.read = True
    notif.updated_at = datetime.now(timezone.utc)
    await session.commit()
    return True


async def mark_all_read(session: AsyncSession, user_id: str) -> int:
    """Mark all of a user's notifications as read. Returns count updated."""
    from app.models.notification import Notification

    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id, Notification.read == False)  # noqa: E712
    )
    result = await session.execute(stmt)
    notifs = result.scalars().all()
    now = datetime.now(timezone.utc)
    for n in notifs:
        n.read = True
        n.updated_at = now
    await session.commit()
    return len(notifs)


async def delete_notification(session: AsyncSession, user_id: str, notification_id: str) -> bool:
    """Delete a single notification."""
    from app.models.notification import Notification

    stmt = delete(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == user_id,
    )
    result = await session.execute(stmt)
    await session.commit()
    return result.rowcount > 0


async def get_unread_count(session: AsyncSession, user_id: str) -> int:
    """Return the number of unread notifications for a user."""
    from app.models.notification import Notification

    from sqlalchemy import func as sqlfunc

    stmt = select(sqlfunc.count()).select_from(Notification).where(
        Notification.user_id == user_id,
        Notification.read == False,  # noqa: E712
    )
    result = await session.execute(stmt)
    return result.scalar_one()