import pytest
from app.middleware.auth import hash_password, verify_password, create_access_token, decode_access_token


def test_password_hashing():
    raw_pin = "7090"
    hashed = hash_password(raw_pin)
    assert hashed != raw_pin
    assert verify_password(raw_pin, hashed) is True
    assert verify_password("0000", hashed) is False


def test_jwt_token_lifecycle():
    user_payload = {"sub": "user-42", "username": "ravi", "role": "ADMIN"}
    token = create_access_token(user_payload)
    assert isinstance(token, str)
    assert len(token) > 20

    decoded = decode_access_token(token)
    assert decoded["sub"] == "user-42"
    assert decoded["username"] == "ravi"
    assert decoded["role"] == "ADMIN"
    assert "exp" in decoded
