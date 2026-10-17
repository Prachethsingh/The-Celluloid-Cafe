"""Movie endpoint tests."""
from fastapi import status


def test_list_movies_empty(client):
    resp = client.get("/api/v1/movies/")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json() == []  # no movies yet


def test_get_movie_not_found(client):
    resp = client.get("/api/v1/movies/nonexistent-id")
    assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_trending_movies_empty(client):
    resp = client.get("/api/v1/movies/trending")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json() == []


def test_popular_movies_empty(client):
    resp = client.get("/api/v1/movies/popular")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json() == []


def test_new_movies_empty(client):
    resp = client.get("/api/v1/movies/new")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json() == []