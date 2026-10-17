"""Platform endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user, optional_user
from app.models.platform import Platform
from app.schemas.content import PlatformResponse
from app.db.session import get_session

router = APIRouter()


@router.get("/", response_model=List[PlatformResponse])
async def list_platforms(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    active: bool | None = None,
    session: AsyncSession = Depends(get_session),
):
    """Get a paginated list of platforms."""
    stmt = select(Platform)
    if active is not None:
        stmt = stmt.where(Platform.active == active)
    stmt = stmt.offset(skip).limit(limit)
    result = await session.execute(stmt)
    platforms = result.scalars().all()
    return [PlatformResponse.model_validate(p.__dict__) for p in platforms]


@router.get("/{platform_id}", response_model=PlatformResponse)
async def get_platform(
    platform_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get a single platform by internal id."""
    result = await session.execute(select(Platform).where(Platform.id == platform_id))
    platform = result.scalar_one_or_none()
    if not platform:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="platform not found")
    return PlatformResponse.model_validate(platform.__dict__)