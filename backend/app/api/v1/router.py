"""API v1 router — mounts all sub-routers."""
from fastapi import APIRouter

from . import (
    admin,
    auth,
    episodes,
    genres,
    history,
    movies,
    platforms,
    playback,
    search,
    seasons,
    series,
    watchlist,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(movies.router, prefix="/movies", tags=["movies"])
api_router.include_router(series.router, prefix="/series", tags=["series"])
api_router.include_router(seasons.router, prefix="/seasons", tags=["seasons"])
api_router.include_router(episodes.router, prefix="/episodes", tags=["episodes"])
api_router.include_router(genres.router, prefix="/genres", tags=["genres"])
api_router.include_router(platforms.router, prefix="/platforms", tags=["platforms"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(watchlist.router, prefix="/watchlist", tags=["watchlist"])
api_router.include_router(history.router, prefix="/history", tags=["history"])
api_router.include_router(playback.router, prefix="/playback", tags=["playback"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])