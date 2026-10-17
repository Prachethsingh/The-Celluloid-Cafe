"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-04
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column("language", sa.String(), server_default="en"),
        sa.Column("country_code", sa.String(), server_default="IN"),
        sa.Column("notification_enabled", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── genres ───────────────────────────────────────────────────────
    op.create_table(
        "genres",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("slug", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── movies ────────────────────────────────────────────────────────
    op.create_table(
        "movies",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("external_id", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("title", sa.String(), nullable=False, index=True),
        sa.Column("original_title", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("release_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("runtime", sa.Integer(), nullable=True),
        sa.Column("language", sa.String(), nullable=True),
        sa.Column("country", sa.String(), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("rating_source", sa.String(), nullable=True),
        sa.Column("poster_url", sa.String(), nullable=True),
        sa.Column("backdrop_url", sa.String(), nullable=True),
        sa.Column("trailer_url", sa.String(), nullable=True),
        sa.Column("popularity", sa.Float(), server_default="0"),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("source_last_modified", sa.DateTime(timezone=True), nullable=True),
        sa.Column("data_hash", sa.String(), nullable=True),
        sa.Column("last_checked", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_movies_popularity", "movies", ["popularity"])
    op.create_index("ix_movies_release_date", "movies", ["release_date"])

    # ── movie_genres join ─────────────────────────────────────────────
    op.create_table(
        "movie_genres",
        sa.Column("movie_id", sa.String(), sa.ForeignKey("movies.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("genre_id", sa.String(), sa.ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True),
    )

    # ── series ────────────────────────────────────────────────────────
    op.create_table(
        "series",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("external_id", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("title", sa.String(), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("first_air_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_air_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("language", sa.String(), nullable=True),
        sa.Column("country", sa.String(), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("rating_source", sa.String(), nullable=True),
        sa.Column("poster_url", sa.String(), nullable=True),
        sa.Column("backdrop_url", sa.String(), nullable=True),
        sa.Column("popularity", sa.Float(), server_default="0"),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("source_last_modified", sa.DateTime(timezone=True), nullable=True),
        sa.Column("data_hash", sa.String(), nullable=True),
        sa.Column("last_checked", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_series_popularity", "series", ["popularity"])
    op.create_index("ix_series_first_air_date", "series", ["first_air_date"])

    # ── series_genres join ───────────────────────────────────────────
    op.create_table(
        "series_genres",
        sa.Column("series_id", sa.String(), sa.ForeignKey("series.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("genre_id", sa.String(), sa.ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True),
    )

    # ── people ────────────────────────────────────────────────────────
    op.create_table(
        "people",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("external_id", sa.String(), unique=True, index=True),
        sa.Column("name", sa.String(), nullable=False, index=True),
        sa.Column("original_name", sa.String(), nullable=True),
        sa.Column("birth_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("death_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("biography", sa.Text(), nullable=True),
        sa.Column("profile_url", sa.String(), nullable=True),
        sa.Column("known_for_department", sa.String(), nullable=True),
        sa.Column("popularity", sa.Float(), server_default="0"),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("data_hash", sa.String(), nullable=True),
        sa.Column("last_checked", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "person_movies",
        sa.Column("person_id", sa.String(), sa.ForeignKey("people.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("movie_id", sa.String(), sa.ForeignKey("movies.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "person_series",
        sa.Column("person_id", sa.String(), sa.ForeignKey("people.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("series_id", sa.String(), sa.ForeignKey("series.id", ondelete="CASCADE"), primary_key=True),
    )

    # ── seasons ──────────────────────────────────────────────────────
    op.create_table(
        "seasons",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("series_id", sa.String(), sa.ForeignKey("series.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("season_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("release_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("poster_url", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("data_hash", sa.String(), nullable=True),
        sa.Column("last_checked", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("series_id", "season_number", name="uq_series_season"),
    )

    # ── episodes ──────────────────────────────────────────────────────
    op.create_table(
        "episodes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("season_id", sa.String(), sa.ForeignKey("seasons.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("episode_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("release_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("runtime", sa.Integer(), nullable=True),
        sa.Column("thumbnail_url", sa.String(), nullable=True),
        sa.Column("has_subtitle", sa.Boolean(), server_default=sa.false()),
        sa.Column("subtitle_languages", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("data_hash", sa.String(), nullable=True),
        sa.Column("last_checked", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("season_id", "episode_number", name="uq_season_episode"),
    )

    # ── platforms ────────────────────────────────────────────────────
    op.create_table(
        "platforms",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("external_id", sa.String(), unique=True),
        sa.Column("name", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("slug", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("logo_url", sa.String(), nullable=True),
        sa.Column("website_url", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("subscription_required", sa.Boolean(), server_default=sa.false()),
        sa.Column("supported_languages", sa.String(), nullable=True),
        sa.Column("country_codes", sa.String(), nullable=True),
        sa.Column("active", sa.Boolean(), server_default=sa.true()),
        sa.Column("playback_config", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── availability ─────────────────────────────────────────────────
    op.create_table(
        "availability",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("content_type", sa.String(), nullable=False, index=True),
        sa.Column("content_id", sa.String(), nullable=False, index=True),
        sa.Column("platform_id", sa.String(), sa.ForeignKey("platforms.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("country_code", sa.String(), nullable=False, index=True),
        sa.Column("available", sa.Boolean(), server_default=sa.true()),
        sa.Column("subscription_type", sa.String(), nullable=False, server_default="subscription"),
        sa.Column("quality", sa.Integer(), server_default="1080"),
        sa.Column("subtitle_available", sa.Boolean(), server_default=sa.false()),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_checked", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("provider_source", sa.String(), nullable=True),
        sa.Column("provider_data_hash", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("content_type", "content_id", "platform_id", "country_code", name="uq_availability"),
    )

    # ── watchlists ────────────────────────────────────────────────────
    op.create_table(
        "watchlists",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("content_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "content_type", "content_id", name="uq_watchlist_entry"),
    )

    # ── watch_history ─────────────────────────────────────────────────
    op.create_table(
        "watch_history",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("content_id", sa.String(), nullable=False),
        sa.Column("episode_id", sa.String(), sa.ForeignKey("episodes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("progress_seconds", sa.Integer(), server_default="0"),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("completed", sa.Boolean(), server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── sync_metadata ─────────────────────────────────────────────────
    op.create_table(
        "sync_metadata",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("task_name", sa.String(), nullable=False, index=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("records_fetched", sa.Integer(), server_default="0"),
        sa.Column("records_inserted", sa.Integer(), server_default="0"),
        sa.Column("records_updated", sa.Integer(), server_default="0"),
        sa.Column("records_failed", sa.Integer(), server_default="0"),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column("provider", sa.String(), nullable=True),
        sa.Column("country_code", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("sync_metadata")
    op.drop_table("watch_history")
    op.drop_table("watchlists")
    op.drop_table("availability")
    op.drop_table("platforms")
    op.drop_table("episodes")
    op.drop_table("seasons")
    op.drop_table("person_series")
    op.drop_table("person_movies")
    op.drop_table("people")
    op.drop_table("series_genres")
    op.drop_table("series")
    op.drop_table("movie_genres")
    op.drop_table("movies")
    op.drop_table("genres")
    op.drop_table("users")
