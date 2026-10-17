"""Notification service tests."""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services import notifications as notification_service


async def _make_user(session: AsyncSession) -> User:
    user = User(email="n@example.com", password_hash="x", display_name="Notif")
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_create_and_list_notification(session: AsyncSession):
    user = await _make_user(session)
    await notification_service.create_notification(
        session,
        user.id,
        notification_service.NotificationType.NEW_MOVIE,
        "New movie",
        "A new movie dropped",
        {"movie_id": "abc"},
    )
    notifs = await notification_service.list_notifications(session, user.id)
    assert len(notifs) == 1
    assert notifs[0]["title"] == "New movie"
    assert notifs[0]["read"] is False
    assert notifs[0]["data"]["movie_id"] == "abc"


@pytest.mark.asyncio
async def test_unread_count(session: AsyncSession):
    user = await _make_user(session)
    await notification_service.create_notification(
        session, user.id, notification_service.NotificationType.NEW_EPISODE, "New ep", "body"
    )
    await notification_service.create_notification(
        session, user.id, notification_service.NotificationType.NEW_SEASON, "New season", "body"
    )
    assert await notification_service.get_unread_count(session, user.id) == 2

    await notification_service.mark_read(session, user.id, (await notification_service.list_notifications(session, user.id))[0]["id"])
    assert await notification_service.get_unread_count(session, user.id) == 1


@pytest.mark.asyncio
async def test_mark_all_read(session: AsyncSession):
    user = await _make_user(session)
    await notification_service.create_notification(
        session, user.id, notification_service.NotificationType.NEW_MOVIE, "A", "b"
    )
    await notification_service.create_notification(
        session, user.id, notification_service.NotificationType.NEW_MOVIE, "B", "b"
    )
    count = await notification_service.mark_all_read(session, user.id)
    assert count == 2
    assert await notification_service.get_unread_count(session, user.id) == 0


@pytest.mark.asyncio
async def test_delete_notification(session: AsyncSession):
    user = await _make_user(session)
    created = await notification_service.create_notification(
        session, user.id, notification_service.NotificationType.NEW_MOVIE, "A", "b"
    )
    ok = await notification_service.delete_notification(session, user.id, created["id"])
    assert ok is True
    assert await notification_service.list_notifications(session, user.id) == []

    ok = await notification_service.delete_notification(session, user.id, "nonexistent")
    assert ok is False