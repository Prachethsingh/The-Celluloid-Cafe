"""Recommendation service tests."""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movie import Movie
from app.models.series import Series
from app.services.recommendations import recommend, similar_titles


@pytest.mark.asyncio
async def test_recommend_returns_ranked_results(session: AsyncSession):
    session.add(Movie(external_id="m1", title="A", popularity=10.0, rating=9.0))
    session.add(Movie(external_id="m2", title="B", popularity=1.0, rating=2.0))
    await session.commit()

    results = await recommend(session, {"preferred_genres": [], "preferred_languages": [], "country_code": None})
    assert len(results) == 2
    # Higher-rated / more popular first
    assert results[0]["title"] == "A"
    assert results[0]["score"] >= results[1]["score"]


@pytest.mark.asyncio
async def test_recommend_excludes_ids(session: AsyncSession):
    movie = Movie(external_id="m1", title="A", popularity=10.0)
    session.add(movie)
    await session.commit()
    await session.refresh(movie)

    results = await recommend(
        session,
        {"preferred_genres": [], "preferred_languages": [], "country_code": None},
        exclude_ids={movie.id},
    )
    assert results == []


@pytest.mark.asyncio
async def test_similar_titles_by_genre(session: AsyncSession):
    from app.models.genre import Genre

    g = Genre(name="Comedy", slug="comedy", external_id="g1")
    m1 = Movie(external_id="m1", title="Funny Movie", language="en", popularity=1.0)
    m2 = Movie(external_id="m2", title="Another Funny", language="en", popularity=1.0)
    m1.genres = [g]
    m2.genres = [g]
    session.add_all([g, m1, m2])
    await session.commit()

    similar = await similar_titles(session, "movie", m1.id, limit=5)
    titles = [s["title"] for s in similar]
    assert "Another Funny" in titles