"""Notification endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.schemas.notification import (
    NotificationCreateRequest,
    NotificationResponse,
)
from app.services import notifications as notification_service
from app.db.session import get_session

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
async def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    """List notifications for the current user."""
    return await notification_service.list_notifications(
        session, user_id, limit=limit, offset=offset, unread_only=unread_only
    )


@router.get("/unread-count")
async def unread_count(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    """Return the number of unread notifications."""
    count = await notification_service.get_unread_count(session, user_id)
    return {"unread_count": count}


@router.post("/", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_notification(
    payload: NotificationCreateRequest,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    """Create a notification for the current user."""
    return await notification_service.create_notification(
        session,
        user_id,
        payload.type,
        payload.title,
        payload.body,
        payload.data,
    )


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: str = Path(...),
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    """Mark a notification as read."""
    ok = await notification_service.mark_read(session, user_id, notification_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="notification not found")
    notifs = await notification_service.list_notifications(session, user_id, limit=1)
    return notifs[0] if notifs else {}


@router.patch("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    """Mark all notifications as read."""
    await notification_service.mark_all_read(session, user_id)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str = Path(...),
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    """Delete a notification."""
    ok = await notification_service.delete_notification(session, user_id, notification_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="notification not found")