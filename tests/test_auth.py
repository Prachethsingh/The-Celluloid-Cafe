"""Auth endpoint tests."""
from fastapi import status


def test_register_and_login(client):
    # Register a new user
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com", "password": "secret123", "display_name": "Tester"},
    )
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert "tokens" in data
    assert "access_token" in data["tokens"]
    access_token = data["tokens"]["access_token"]

    # Login with the same credentials
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "secret123"},
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    # Login issues a fresh token; verify it decodes to the same user id.
    from app.security.token import decode_token

    login_user_id = decode_token(data["tokens"]["access_token"])["sub"]
    register_user_id = decode_token(access_token)["sub"]
    assert login_user_id == register_user_id


def test_login_fails_with_wrong_password(client):
    # First create a user
    client.post(
        "/api/v1/auth/register",
        json={"email": "test2@example.com", "password": "secret123", "display_name": "Tester2"},
    )
    # Try wrong password
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "test2@example.com", "password": "wrong"},
    )
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


def test_refresh_token(client):
    # Register and login to get a refresh token
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "test3@example.com", "password": "secret123", "display_name": "Tester3"},
    )
    assert resp.status_code == status.HTTP_201_CREATED
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "test3@example.com", "password": "secret123"},
    )
    assert resp.status_code == status.HTTP_200_OK
    refresh_token = resp.json()["tokens"]["refresh_token"]

    # Use refresh token to get new access token
    resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"