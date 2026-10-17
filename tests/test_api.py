"""API endpoint tests for the new surfaces (recommendations, notifications, admin)."""
import pytest
from fastapi import status
from sqlalchemy import select

from app.models.movie import Movie
from app.models.user import User


def _register_and_login(client, email="api@example.com", password="secret123"):
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": "API"},
    )
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return resp.json()["tokens"]["access_token"]


def test_recommendations_endpoint(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "rec@example.com", "password": "secret123", "display_name": "Rec"},
    )
    resp = client.get("/api/v1/recommendations/")
    assert resp.status_code == status.HTTP_200_OK
    assert isinstance(resp.json(), list)


def test_recommendations_with_content(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "rec2@example.com", "password": "secret123", "display_name": "Rec2"},
    )
    resp = client.get("/api/v1/recommendations/", params={"content_type": "movie", "limit": 5})
    assert resp.status_code == status.HTTP_200_OK


def test_similar_endpoint(client):
    resp = client.get("/api/v1/recommendations/similar/movie/nonexistent-id")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json() == []


def test_notifications_unauthorized(client):
    resp = client.get("/api/v1/notifications/")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


def test_notifications_flow(client):
    token = _register_and_login(client, email="notif@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/notifications/", headers=headers)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json() == []

    resp = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json() == {"unread_count": 0}

    resp = client.post(
        "/api/v1/notifications/",
        json={
            "type": "new_movie",
            "title": "Test",
            "body": "Body",
            "data": {"movie_id": "m1"},
        },
        headers=headers,
    )
    assert resp.status_code == status.HTTP_201_CREATED
    notif = resp.json()
    assert notif["title"] == "Test"
    assert notif["read"] is False

    resp = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert resp.json() == {"unread_count": 1}

    resp = client.patch(f"/api/v1/notifications/{notif['id']}/read", headers=headers)
    assert resp.status_code == status.HTTP_200_OK

    resp = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert resp.json() == {"unread_count": 0}

    resp = client.delete(f"/api/v1/notifications/{notif['id']}", headers=headers)
    assert resp.status_code == status.HTTP_204_NO_CONTENT


def test_admin_requires_role(client):
    token = _register_and_login(client, email="plain@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/admin/system/status", headers=headers)
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_admin_can_access_after_role_promotion(client, session):
    # Register + promote via direct DB update (admin-only path in prod)
    token = _register_and_login(client, email="admin@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Promote the user to admin directly in the DB.
    from app.models.user import User

    result = await session.execute(select(User).where(User.email == "admin@example.com"))
    user = result.scalar_one_or_none()
    assert user is not None
    user.role = "admin"
    await session.commit()

    resp = client.get("/api/v1/admin/system/status", headers=headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert "movies" in data
    assert "series" in data
    assert "episodes" in data
    assert "users" in data


def test_genres_endpoint_cached(client):
    resp = client.get("/api/v1/genres/")
    assert resp.status_code == status.HTTP_200_OK
    assert isinstance(resp.json(), list)


def test_search_endpoint(client):
    resp = client.get("/api/v1/search/", params={"q": "matrix"})
    assert resp.status_code == status.HTTP_200_OK
    assert isinstance(resp.json(), list)


def test_search_autocomplete_endpoint(client):
    resp = client.get("/api/v1/search/autocomplete", params={"q": "in"})
    assert resp.status_code == status.HTTP_200_OK
    assert isinstance(resp.json(), list)