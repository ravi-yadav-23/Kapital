import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.utils.security import encrypt_credential, decrypt_credential, mask_secret
from app.routers.settings import save_app_settings, get_app_settings, get_decrypted_setting


def test_encryption_and_decryption():
    secret_key = "gsk_dummy_test_mock_key_abcdef1234567890xyz"
    encrypted = encrypt_credential(secret_key)
    assert encrypted.startswith("enc:")
    assert encrypted != secret_key

    # Avoid double encryption
    assert encrypt_credential(encrypted) == encrypted

    decrypted = decrypt_credential(encrypted)
    assert decrypted == secret_key


def test_mask_secret():
    secret = "gsk_dummy_test_mock_key_abcdef1234567890xyz"
    masked = mask_secret(secret)
    assert masked.startswith("gsk_...")
    assert masked.endswith("0xyz")
    assert "abcdef" not in masked

    # Encrypted value mask
    enc = encrypt_credential(secret)
    masked_enc = mask_secret(enc)
    assert masked_enc.startswith("gsk_...")


@pytest.mark.asyncio
async def test_settings_encryption_and_masking(db_session: AsyncSession, seed_data):
    raw_key = "gsk_live_groq_key_999988887777"
    save_payload = {
        "groq_api_key": raw_key,
        "ai_provider": "groq",
    }

    # 1. Save settings
    saved = await save_app_settings(save_payload, db_session)
    assert saved["success"] is True
    assert "..." in saved["settings"]["groq_api_key"]
    assert raw_key not in saved["settings"]["groq_api_key"]

    # 2. Retrieve settings via API (must be masked)
    retrieved = await get_app_settings(db_session)
    assert "..." in retrieved["groq_api_key"]
    assert raw_key not in retrieved["groq_api_key"]

    # 3. Decrypt internally for AI agent execution
    decrypted_internal = await get_decrypted_setting(db_session, "groq_api_key")
    assert decrypted_internal == raw_key
