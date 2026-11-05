import base64
import hashlib
import logging
import functools
from typing import Optional
from cryptography.fernet import Fernet
from app.config import settings

logger = logging.getLogger("security")


@functools.lru_cache(maxsize=1)
def _get_cipher() -> Fernet:
    """
    Returns a cached Fernet cipher instance.

    Key selection priority:
    1. settings.fernet_key — if set and non-empty, use it directly (must be a valid
       44-character URL-safe base64 Fernet key).
    2. Fallback — derive key from sha256(settings.secret_key) for backward compatibility
       with existing encrypted values in dev environments.
    """
    fernet_key_str = (settings.fernet_key or "").strip()
    if fernet_key_str:
        # Validate it looks like a proper Fernet key (44 URL-safe base64 chars)
        if len(fernet_key_str) != 44:
            raise ValueError(
                f"FERNET_KEY must be a valid 44-character URL-safe base64 Fernet key "
                f"(got {len(fernet_key_str)} chars). Generate one with: "
                "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        try:
            return Fernet(fernet_key_str.encode())
        except Exception as exc:
            raise ValueError(f"FERNET_KEY is not a valid Fernet key: {exc}") from exc

    # Fallback: derive from secret_key (backward compat for dev / existing encrypted values)
    secret = (settings.secret_key or "").strip()
    if not secret or len(secret) < 16:
        raise ValueError(
            "Invalid SECRET_KEY: A secure key of at least 16 characters must be configured in settings."
        )
    raw_hash = hashlib.sha256(secret.encode()).digest()
    derived_key = base64.urlsafe_b64encode(raw_hash)
    logger.debug("Fernet key derived from SECRET_KEY (dev fallback). Set FERNET_KEY in production.")
    return Fernet(derived_key)

ENC_PREFIX = "enc:"


def encrypt_credential(value: Optional[str]) -> Optional[str]:
    """
    Encrypts sensitive data (PIN, TOTP Secret, API Key) using Fernet.
    Avoids double-encryption by checking the prefix.
    """
    if not value or not isinstance(value, str):
        return value
    if value.startswith(ENC_PREFIX):
        return value  # Already encrypted
    try:
        cipher = _get_cipher()
        encrypted_bytes = cipher.encrypt(value.encode())
        return f"{ENC_PREFIX}{encrypted_bytes.decode()}"
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return value


def decrypt_credential(value: Optional[str]) -> Optional[str]:
    """
    Decrypts sensitive data using Fernet.
    If the value does not have the enc: prefix, treats it as plaintext for backward compatibility.
    """
    if not value or not isinstance(value, str):
        return value
    if not value.startswith(ENC_PREFIX):
        return value  # Plaintext / legacy format
    try:
        cipher = _get_cipher()
        token = value[len(ENC_PREFIX):].encode()
        decrypted_bytes = cipher.decrypt(token)
        return decrypted_bytes.decode()
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return value


def mask_secret(value: Optional[str]) -> str:
    """
    Masks sensitive secrets for safe API response transmission.
    Example: 'gsk_sample_secret_key_1234' -> 'gsk_...1234'
    """
    if not value or not isinstance(value, str):
        return ""
    decrypted = decrypt_credential(value)
    if not decrypted:
        return ""
    if len(decrypted) <= 8:
        return "********"
    return f"{decrypted[:4]}...{decrypted[-4:]}"
