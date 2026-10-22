import base64
import hashlib
import logging
from typing import Optional
from cryptography.fernet import Fernet
from app.config import settings

logger = logging.getLogger("security")

# Derive consistent 32-byte Fernet key from secret_key
_secret = (settings.secret_key or "").strip()
if not _secret or len(_secret) < 16:
    raise ValueError(
        "Invalid SECRET_KEY: A secure key of at least 16 characters must be configured in settings."
    )
_raw_hash = hashlib.sha256(_secret.encode()).digest()
_FERNET_KEY = base64.urlsafe_b64encode(_raw_hash)
_cipher = Fernet(_FERNET_KEY)

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
        encrypted_bytes = _cipher.encrypt(value.encode())
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
        token = value[len(ENC_PREFIX):].encode()
        decrypted_bytes = _cipher.decrypt(token)
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
