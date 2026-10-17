"""extend schema — roles, notifications, FKs, platform country_code

Revision ID: 0002_extend
Revises: 0001_initial
Create Date: 2026-10-04
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0002_extend"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users.role ─────────────────────────────────────────────────────
    op.add_column(
        "users",
        sa.Column("role", sa.String(), server_default="user", nullable=False),
    )
    op.create_index("ix_users_role", "users", ["role"])

    # ── notifications ──────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("type", sa.Enum("new_episode", "new_season", "new_movie", "watchlist_availability", "recommendation", name="notification_type"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("data", sa.Text(), nullable=True),
        sa.Column("read", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_read", "notifications", ["user_id", "read", sa.text("created_at DESC")])

    # ── availability.episode_id ────────────────────────────────────────
    op.add_column(
        "availability",
        sa.Column("episode_id", sa.String(), sa.ForeignKey("episodes.id", ondelete="SET NULL"), nullable=True, index=True),
    )

    # ── platform.country_code ──────────────────────────────────────────
    op.add_column(
        "platforms",
        sa.Column("country_code", sa.String(), nullable=True, index=True),
    )

    # ── association-table FKs (person_movies / person_series) ──────────
    op.create_foreign_key(
        "fk_person_movies_people", "person_movies", "people", ["person_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_person_movies_movies", "person_movies", "movies", ["movie_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_person_series_people", "person_series", "people", ["person_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_person_series_series", "person_series", "series", ["series_id"], ["id"], ondelete="CASCADE",
    )

    # ── association-table enrichment columns ───────────────────────────
    op.add_column("person_movies", sa.Column("role", sa.String(), nullable=True))
    op.add_column("person_movies", sa.Column("character", sa.String(), nullable=True))
    op.add_column("person_series", sa.Column("role", sa.String(), nullable=True))
    op.add_column("person_series", sa.Column("character", sa.String(), nullable=True))

    # ── season.series_id FK ────────────────────────────────────────────
    op.create_foreign_key(
        "fk_seasons_series", "seasons", "series", ["series_id"], ["id"], ondelete="CASCADE",
    )

    # ── episode.season_id FK ───────────────────────────────────────────
    op.create_foreign_key(
        "fk_episodes_season", "episodes", "seasons", ["season_id"], ["id"], ondelete="CASCADE",
    )

    # ── movie_genres / series_genres FKs ───────────────────────────────
    op.create_foreign_key(
        "fk_movie_genres_movies", "movie_genres", "movies", ["movie_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_movie_genres_genres", "movie_genres", "genres", ["genre_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_series_genres_series", "series_genres", "series", ["series_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_series_genres_genres", "series_genres", "genres", ["genre_id"], ["id"], ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_series_genres_genres", "series_genres", type_="foreignkey")
    op.drop_constraint("fk_series_genres_series", "series_genres", type_="foreignkey")
    op.drop_constraint("fk_movie_genres_genres", "movie_genres", type_="foreignkey")
    op.drop_constraint("fk_movie_genres_movies", "movie_genres", type_="foreignkey")
    op.drop_constraint("fk_episodes_season", "episodes", type_="foreignkey")
    op.drop_constraint("fk_seasons_series", "seasons", type_="foreignkey")
    op.drop_column("person_series", "character")
    op.drop_column("person_series", "role")
    op.drop_column("person_movies", "character")
    op.drop_column("person_movies", "role")
    op.drop_constraint("fk_person_series_series", "person_series", type_="foreignkey")
    op.drop_constraint("fk_person_series_people", "person_series", type_="foreignkey")
    op.drop_constraint("fk_person_movies_movies", "person_movies", type_="foreignkey")
    op.drop_constraint("fk_person_movies_people", "person_movies", type_="foreignkey")
    op.drop_column("platforms", "country_code")
    op.drop_column("availability", "episode_id")
    op.drop_index("ix_notifications_user_read", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "role")