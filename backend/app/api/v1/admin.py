"""Admin endpoints — restricted to admin/moderator roles."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.middleware.auth import get_current_user
from app.models.movie import Movie
from app.models.series import Series
from app.models.episode import Episode
from app.models.user import User, UserRole
from app.models.sync import SyncMetadata

router = APIRouter()


async def get_admin_user(
    user_id: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> str:
    """Dependency that requires an admin or moderator role."""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    if user.role not in (UserRole.ADMIN.value, UserRole.MODERATOR.value):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin access required")
    return user_id


@router.post("/sync/{task_name}", status_code=status.HTTP_202_ACCEPTED)
async def trigger_sync(
    task_name: str,
    session: AsyncSession = Depends(get_session),
    admin_user_id: str = Depends(get_admin_user),
):
    """Trigger a sync task (metadata, availability, episode)."""
    if task_name not in ("metadata", "availability", "episode"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid task name")

    if task_name == "metadata":
        from app.workers.metadata_sync import run_metadata_sync

        await run_metadata_sync(session)
    elif task_name == "availability":
        from app.workers.availability_sync import run_availability_sync

        await run_availability_sync(session)
    elif task_name == "episode":
        from app.workers.episode_sync import run_episode_sync

        await run_episode_sync(session)

    return {"message": f"{task_name} sync triggered"}


@router.get("/sync/status")
async def get_sync_status(
    session: AsyncSession = Depends(get_session),
    admin_user_id: str = Depends(get_admin_user),
):
    """Get the status of recent sync runs."""
    stmt = select(SyncMetadata).order_by(desc(SyncMetadata.created_at)).limit(20)
    result = await session.execute(stmt)
    sync_records = result.scalars().all()
    return [
        {
            "id": rec.id,
            "task_name": rec.task_name,
            "status": rec.status.value if hasattr(rec.status, "value") else rec.status,
            "started_at": rec.started_at,
            "completed_at": rec.completed_at,
            "records_fetched": rec.records_fetched,
            "records_inserted": rec.records_inserted,
            "records_updated": rec.records_updated,
            "records_failed": rec.records_failed,
            "error_message": rec.error_message,
        }
        for rec in sync_records
    ]


@router.get("/system/status")
async def get_system_status(
    session: AsyncSession = Depends(get_session),
    admin_user_id: str = Depends(get_admin_user),
):
    """Get overall system health."""
    movie_count = await session.execute(select(func.count()).select_from(Movie))
    series_count = await session.execute(select(func.count()).select_from(Series))
    episode_count = await session.execute(select(func.count()).select_from(Episode))
    user_count = await session.execute(select(func.count()).select_from(User))

    latest_sync_stmt = select(SyncMetadata).order_by(desc(SyncMetadata.created_at)).limit(1)
    latest_sync_result = await session.execute(latest_sync_stmt)
    latest_sync = latest_sync_result.scalar_one_or_none()

    return {
        "movies": movie_count.scalar_one(),
        "series": series_count.scalar_one(),
        "episodes": episode_count.scalar_one(),
        "users": user_count.scalar_one(),
        "latest_sync": {
            "task_name": latest_sync.task_name if latest_sync else None,
            "status": latest_sync.status.value if latest_sync and hasattr(latest_sync.status, "value") else (latest_sync.status if latest_sync else None),
            "completed_at": latest_sync.completed_at if latest_sync else None,
        }
        if latest_sync
        else None,
    }


@router.get("/users")
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    admin_user_id: str = Depends(get_admin_user),
):
    """List users (admin only)."""
    stmt = select(User).offset(skip).limit(limit)
    result = await session.execute(stmt)
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "display_name": u.display_name,
            "role": u.role,
            "language": u.language,
            "country_code": u.country_code,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str = Query(..., pattern="^(user|admin|moderator)$"),
    session: AsyncSession = Depends(get_session),
    admin_user_id: str = Depends(get_admin_user),
):
    """Update a user's role (admin only)."""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    user.role = role
    await session.commit()
    return {"id": user.id, "role": user.role}