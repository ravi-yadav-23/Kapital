import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import _get_secret_key
from app.services.allotment_service import allotment_service
from app.tasks.order_tasks import clean_expired_asba_locks, sync_expired_asba_locks
from app.services.account_service import account_service
from app.models.account import FamilyAccount


def test_auth_secret_key_validation():
    """Test that auth.py enforces secure secret key and rejects empty or short keys."""
    with patch("app.middleware.auth.settings.secret_key", "short_key"):
        with pytest.raises(ValueError, match="Invalid SECRET_KEY"):
            _get_secret_key()

    with patch("app.middleware.auth.settings.secret_key", ""):
        with pytest.raises(ValueError, match="Invalid SECRET_KEY"):
            _get_secret_key()

    with patch("app.middleware.auth.settings.secret_key", "a_very_long_valid_secret_key_123456789"):
        assert _get_secret_key() == "a_very_long_valid_secret_key_123456789"


@pytest.mark.asyncio
async def test_auto_detect_allotments_executes_without_import_error(db_session: AsyncSession):
    """Test that auto_detect_allotments does not fail with cannot import name 'Order'."""
    result = await allotment_service.auto_detect_allotments(db_session)
    assert isinstance(result, dict)
    assert "allotted" in result
    assert "not_allotted" in result
    assert "pending" in result


@pytest.mark.asyncio
async def test_clean_expired_asba_locks_celery_wrapper():
    """Test that clean_expired_asba_locks is exported and manages its own session."""
    with patch("app.tasks.order_tasks.sync_expired_asba_locks", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = 0
        res = await clean_expired_asba_locks()
        assert res == 0
        mock_sync.assert_called_once()


@pytest.mark.asyncio
async def test_sync_live_balance_calls_get_rms_limits(db_session: AsyncSession):
    """Test that sync_live_balance calls get_rms_limits and maps availablecash properly."""
    # Seed an account
    acc = FamilyAccount(
        id="acc-test-rms",
        name="RMS Test User",
        relation="Self",
        angel_client_id="R112233",
        angel_api_key="enc:dummy_key",
        total_demat_balance=0.0,
        available_liquid_balance=0.0,
        locked_asba_balance=0.0,
        is_active=True,
    )
    db_session.add(acc)
    await db_session.commit()

    mock_rms = {
        "net": 50000.0,
        "availablecash": 45000.0,
        "collateral": 0.0,
    }

    with patch("app.services.angel_service.angel_service.get_rms_limits", new_callable=AsyncMock) as mock_limits:
        mock_limits.return_value = mock_rms
        updated = await account_service.sync_live_balance(db_session, "R112233")
        assert updated is not None
        assert updated.total_balance == 50000.0
        assert updated.available_balance == 45000.0


@pytest.mark.asyncio
async def test_upsert_account_from_env_idempotency(db_session: AsyncSession):
    """Test that restarting server does not double-encrypt or alter unchanged credentials."""
    from app.utils.security import decrypt_credential

    env_acc = {
        "client_id": "TEST_IDEMPOTENT_01",
        "name": "Idempotent User",
        "relation": "Self",
        "api_key": "my_raw_api_key_123",
        "totp_secret": "my_raw_totp_secret_456",
        "pin": "1234",
    }

    # 1. First upsert (seeding)
    acc1 = await account_service.upsert_account_from_env(db_session, env_acc)
    stored_enc_key_1 = acc1.angel_api_key
    assert decrypt_credential(stored_enc_key_1) == "my_raw_api_key_123"

    # 2. Second upsert (simulating server restart with same credentials)
    acc2 = await account_service.upsert_account_from_env(db_session, env_acc)
    stored_enc_key_2 = acc2.angel_api_key

    # Should retain the exact same ciphertext without re-encrypting or corrupting
    assert stored_enc_key_1 == stored_enc_key_2
    assert decrypt_credential(stored_enc_key_2) == "my_raw_api_key_123"


def test_parse_ipowatch_dates_with_explicit_year():
    """Test that _parse_ipowatch_dates recognizes explicit 4-digit years."""
    from app.tasks.ipo_tasks import _parse_ipowatch_dates

    open_dt, close_dt = _parse_ipowatch_dates("Dec 28 - Jan 2 2025")
    # Should use the explicit 2025 year
    assert open_dt is not None
    assert "2025" in open_dt or "2025" in close_dt

    open_dt, close_dt = _parse_ipowatch_dates("Nov 4-6 2026")
    assert open_dt == "2026-11-04"
    assert close_dt == "2026-11-06"
