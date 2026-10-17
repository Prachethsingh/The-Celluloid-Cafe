"""Sync engine tests."""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movie import Movie
from app.services.sync import compute_hash, get_or_create, upsert_with_change_detection


def test_compute_hash_is_stable():
    a = {"title": "X", "year": 2020}
    b = {"year": 2020, "title": "X"}
    assert compute_hash(a) == compute_hash(b)
    assert compute_hash(a) != compute_hash({"title": "Y", "year": 2020})


@pytest.mark.asyncio
async def test_get_or_create_creates_new(session: AsyncSession):
    movie, created = await get_or_create(
        session,
        Movie,
        external_id="tmdb-1",
        title="New Movie",
        defaults={"popularity": 1.0},
    )
    assert created is True
    assert movie.title == "New Movie"

    movie2, created2 = await get_or_create(
        session,
        Movie,
        external_id="tmdb-1",
        title="New Movie",
        defaults={"popularity": 1.0},
    )
    assert created2 is False
    assert movie2.id == movie.id


@pytest.mark.asyncio
async def test_upsert_change_detection_inserts(session: AsyncSession):
    result = await upsert_with_change_detection(
        session,
        Movie,
        "external_id",
        {"external_id": "tmdb-x", "title": "Fresh"},
        ["title"],
    )
    assert result == "inserted"


@pytest.mark.asyncio
async def test_upsert_change_detection_skips_unchanged(session: AsyncSession):
    record = {"external_id": "tmdb-y", "title": "Same"}
    session.add(Movie(external_id="tmdb-y", title="Same", data_hash=compute_hash(record)))
    await session.commit()

    result = await upsert_with_change_detection(
        session,
        Movie,
        "external_id",
        record,
        ["title"],
    )
    assert result == "unchanged"


@pytest.mark.asyncio
async def test_upsert_change_detection_updates_changed(session: AsyncSession):
    session.add(Movie(external_id="tmdb-z", title="Old", data_hash=compute_hash({"title": "Old"})))
    await session.commit()

    result = await upsert_with_change_detection(
        session,
        Movie,
        "external_id",
        {"external_id": "tmdb-z", "title": "New"},
        ["title"],
    )
    assert result == "updated"