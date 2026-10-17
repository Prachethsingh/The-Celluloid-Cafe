"""Search service tests."""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.genre import Genre
from app.models.movie import Movie
from app.models.series import Series
from app.services.search import autocomplete, run_search as search


@pytest.mark.asyncio
async def test_search_returns_matching_movies(session: AsyncSession):
    movie = Movie(
        external_id="tmdb-1",
        title="Interstellar",
        description="A space epic",
        popularity=90.0,
        rating=8.5,
    )
    session.add(movie)
    await session.commit()

    results = await search(session, "interstellar")
    assert len(results) == 1
    assert results[0]["content_type"] == "movie"
    assert results[0]["title"] == "Interstellar"


@pytest.mark.asyncio
async def test_search_returns_matching_series(session: AsyncSession):
    series = Series(
        external_id="tmdb-2",
        title="Stranger Things",
        description="A horror series",
        popularity=80.0,
        rating=8.0,
    )
    session.add(series)
    await session.commit()

    results = await search(session, "stranger")
    assert len(results) == 1
    assert results[0]["content_type"] == "series"


@pytest.mark.asyncio
async def test_search_with_content_type_filter(session: AsyncSession):
    session.add(Movie(external_id="m1", title="The Matrix", popularity=1.0))
    session.add(Series(external_id="s1", title="The Matrix Series", popularity=1.0))
    await session.commit()

    results = await search(session, "matrix", content_type="movie")
    assert all(r["content_type"] == "movie" for r in results)
    assert len(results) == 1


@pytest.mark.asyncio
async def test_search_empty_query_returns_nothing(session: AsyncSession):
    results = await search(session, "")
    assert results == []


@pytest.mark.asyncio
async def test_autocomplete_suggests_titles(session: AsyncSession):
    session.add(Movie(external_id="m1", title="Inception", popularity=1.0))
    session.add(Movie(external_id="m2", title="Interstellar", popularity=1.0))
    session.add(Series(external_id="s1", title="Invasion", popularity=1.0))
    await session.commit()

    suggestions = await autocomplete(session, "in")
    titles = {s["title"] for s in suggestions}
    assert "Inception" in titles
    assert "Interstellar" in titles
    assert "Invasion" in titles
    assert all(s["content_type"] in ("movie", "series") for s in suggestions)


@pytest.mark.asyncio
async def test_autocomplete_empty_query(session: AsyncSession):
    assert await autocomplete(session, "") == []


@pytest.mark.asyncio
async def test_search_genre_filter(session: AsyncSession):
    genre = Genre(name="Sci-Fi", slug="sci-fi", external_id="g1")
    movie = Movie(external_id="m1", title="Blade Runner", popularity=1.0)
    movie.genres = [genre]
    session.add_all([genre, movie])
    await session.commit()

    results = await search(session, "blade", genre="sci-fi")
    assert len(results) == 1
    assert results[0]["title"] == "Blade Runner"