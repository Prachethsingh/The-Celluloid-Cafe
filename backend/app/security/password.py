"""Password hashing — Argon2 with bcrypt fallback."""
from passlib.hash import bcrypt

# Argon2 is preferred; bcrypt is the widely-supported fallback.
try:
    from passlib.hash import argon2

    def hash_password(password: str) -> str:
        return argon2.hash(password)

    def verify_password(password: str, hashed: str) -> bool:
        return argon2.verify(password, hashed)
except Exception:  # pragma: no cover
    def hash_password(password: str) -> str:
        return bcrypt.hash(password)

    def verify_password(password: str, hashed: str) -> bool:
        return bcrypt.verify(password, hashed)