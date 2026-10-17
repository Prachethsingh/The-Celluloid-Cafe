"""
Movie Platform Backend — Phase 1 MVP
Entry point for the FastAPI application.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

app = FastAPI(
    title="Movie Platform API",
    description="Unified movie & series discovery backend — Phase 1 MVP",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/openapi.json",
)

# CORS — restrict in production via settings.ALLOWED_HOSTS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

from app.api.v1 import auth, movies, series, seasons, episodes, genres, platforms, search, watchlist, history, playback, recommendations, notifications, admin

app.include_router(auth.router, prefix="/api/v1/auth")
app.include_router(movies.router, prefix="/api/v1/movies")
app.include_router(series.router, prefix="/api/v1/series")
app.include_router(seasons.router, prefix="/api/v1/seasons")
app.include_router(episodes.router, prefix="/api/v1/episodes")
app.include_router(genres.router, prefix="/api/v1/genres")
app.include_router(platforms.router, prefix="/api/v1/platforms")
app.include_router(search.router, prefix="/api/v1/search")
app.include_router(watchlist.router, prefix="/api/v1/watchlist")
app.include_router(history.router, prefix="/api/v1/history")
app.include_router(playback.router, prefix="/api/v1/playback")
app.include_router(recommendations.router, prefix="/api/v1/recommendations")
app.include_router(notifications.router, prefix="/api/v1/notifications")
app.include_router(admin.router, prefix="/api/v1/admin")


@app.on_event("startup")
async def startup():
    from app.db.session import engine, Base
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        print(f"Database initialization warning: {exc}")


@app.get("/health")
async def health() -> dict:
    """Liveness probe."""
    return {"status": "ok", "service": "movie-platform-api"}
