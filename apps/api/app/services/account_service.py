from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.account import FamilyAccount
from app.schemas.account import AccountCreate, AccountUpdate, AccountResponse
import uuid

# ── Thin in-memory cache (populated from DB on startup, kept for fast reads) ──
# This is NOT the source of truth — PostgreSQL is. This cache is refreshed
# on startup and after each write operation.
_accounts_cache: List[dict] = []
MOCK_ACCOUNTS_STORE = _accounts_cache  # backward-compat alias — remove after callers updated


def _invalidate_accounts_cache() -> None:
    """Clear the in-memory cache so subsequent reads reload fresh balances from DB."""
    global _accounts_cache
    _accounts_cache.clear()


def _invalidate_cache(angel_client_id: Optional[str] = None) -> None:
    """Remove a specific account or clear in-memory cache.
    Called after any write that changes account balances or preferences,
    so the optimizer always reads current data from the DB on the next request."""
    global _accounts_cache
    if angel_client_id:
        _accounts_cache[:] = [a for a in _accounts_cache if a.get("angel_client_id") != angel_client_id]
    else:
        _accounts_cache.clear()


def _model_to_response(acc: FamilyAccount) -> AccountResponse:
    """Convert ORM model → Pydantic response schema."""
    return AccountResponse(
        id=acc.id,
        name=acc.name,
        relation=acc.relation,
        angel_client_id=acc.angel_client_id,
        total_balance=acc.total_demat_balance or 0.0,
        available_balance=acc.available_liquid_balance or 0.0,
        locked_balance=acc.locked_asba_balance or 0.0,
        total_applied_ipos=acc.total_bids_placed or 0,
        total_allotments=acc.total_allotments_won or 0,
        total_realized_pnl=acc.total_realized_pnl or 0.0,
        allotment_rate=round(
            (acc.total_allotments_won / acc.total_bids_placed * 100.0)
            if acc.total_bids_placed and acc.total_bids_placed > 0
            else 0.0,
            1,
        ),
        preferred_category=acc.default_category_preference or "RETAIL",
        is_active=acc.is_active,
    )


def _model_to_dict(acc: FamilyAccount) -> dict:
    """Convert ORM model → dict for the in-memory store (used by optimizer)."""
    return {
        "id": acc.id,
        "name": acc.name,
        "relation": acc.relation,
        "angel_client_id": acc.angel_client_id,
        "total_balance": acc.total_demat_balance or 0.0,
        "available_balance": acc.available_liquid_balance or 0.0,
        "available_liquid_balance": acc.available_liquid_balance or 0.0,
        "locked_balance": acc.locked_asba_balance or 0.0,
        "locked_asba_balance": acc.locked_asba_balance or 0.0,
        "total_demat_balance": acc.total_demat_balance or 0.0,
        "total_applied_ipos": acc.total_bids_placed or 0,
        "total_bids_placed": acc.total_bids_placed or 0,
        "total_allotments": acc.total_allotments_won or 0,
        "total_allotments_won": acc.total_allotments_won or 0,
        "total_realized_pnl": acc.total_realized_pnl or 0.0,
        "allotment_rate": 0.0,
        "preferred_category": acc.default_category_preference or "RETAIL",
        "is_active": acc.is_active,
    }


class AccountService:

    @staticmethod
    def cache_account(acc: FamilyAccount) -> None:
        """Add or update an account in the in-memory cache."""
        acc_dict = _model_to_dict(acc)
        _invalidate_cache(acc.angel_client_id)
        _accounts_cache.append(acc_dict)

    @staticmethod
    async def get_all_accounts(db: AsyncSession) -> List[AccountResponse]:
        """Fetch all family accounts from PostgreSQL."""
        result = await db.execute(select(FamilyAccount).order_by(FamilyAccount.created_at))
        accounts = result.scalars().all()
        # Refresh in-memory cache
        _accounts_cache.clear()
        _accounts_cache.extend(_model_to_dict(a) for a in accounts)
        return [_model_to_response(a) for a in accounts]

    @staticmethod
    async def get_account_by_client_id(db: AsyncSession, client_id: str) -> Optional[FamilyAccount]:
        """Look up a single account by Angel One client ID."""
        result = await db.execute(
            select(FamilyAccount).where(FamilyAccount.angel_client_id == client_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_account(db: AsyncSession, data: AccountCreate) -> AccountResponse:
        """Insert a new family account into PostgreSQL with encrypted secrets."""
        from app.utils.security import encrypt_credential

        acc = FamilyAccount(
            id=str(uuid.uuid4()),
            name=data.name,
            relation=data.relation,
            angel_client_id=data.angel_client_id,
            angel_api_key=encrypt_credential(data.angel_api_key),
            totp_secret=encrypt_credential(data.totp_secret),
            pin=encrypt_credential(data.pin),
            total_demat_balance=data.total_balance or 0.0,
            available_liquid_balance=data.available_balance or 0.0,
            locked_asba_balance=0.0,
            total_bids_placed=0,
            total_allotments_won=0,
            total_realized_pnl=0.0,
            default_category_preference=data.preferred_category or "RETAIL",
            is_active=True,
        )
        db.add(acc)
        await db.flush()   # write to DB within transaction
        await db.refresh(acc)
        _invalidate_accounts_cache()
        return _model_to_response(acc)

    @staticmethod
    async def upsert_account_from_env(db: AsyncSession, env_acc: dict) -> FamilyAccount:
        """
        Upsert an account from ANGEL_ACCOUNTS_JSON into the DB with encrypted credentials.
        If the client_id already exists, updates secrets safely.
        """
        from app.utils.security import encrypt_credential

        client_id = env_acc.get("client_id", "")
        result = await db.execute(
            select(FamilyAccount).where(FamilyAccount.angel_client_id == client_id)
        )
        existing = result.scalar_one_or_none()

        enc_key = encrypt_credential(env_acc.get("api_key"))
        enc_totp = encrypt_credential(env_acc.get("totp_secret"))
        enc_pin = encrypt_credential(env_acc.get("pin"))

        if existing:
            existing.angel_api_key = enc_key
            existing.totp_secret = enc_totp
            existing.pin = enc_pin
            await db.flush()
            return existing

        acc = FamilyAccount(
            id=str(uuid.uuid4()),
            name=env_acc.get("name", "Unknown"),
            relation=env_acc.get("relation", "Self"),
            angel_client_id=client_id,
            angel_api_key=enc_key,
            totp_secret=enc_totp,
            pin=enc_pin,
            total_demat_balance=0.0,
            available_liquid_balance=0.0,
            locked_asba_balance=0.0,
            total_bids_placed=0,
            total_allotments_won=0,
            total_realized_pnl=0.0,
            default_category_preference="RETAIL",
            is_active=True,
        )
        db.add(acc)
        await db.flush()
        await db.refresh(acc)
        return acc

    @staticmethod
    async def update_account(db: AsyncSession, acc_id: str, data: AccountUpdate) -> Optional[AccountResponse]:
        """Patch an existing account's mutable fields."""
        result = await db.execute(
            select(FamilyAccount).where(FamilyAccount.id == acc_id)
        )
        acc = result.scalar_one_or_none()
        if not acc:
            return None

        if data.name is not None:
            acc.name = data.name
        if data.relation is not None:
            acc.relation = data.relation
        if data.available_balance is not None:
            acc.available_liquid_balance = data.available_balance
        if data.preferred_category is not None:
            acc.default_category_preference = data.preferred_category
        if data.is_active is not None:
            acc.is_active = data.is_active

        await db.flush()
        await db.refresh(acc)
        _invalidate_accounts_cache()  # force re-read on next optimizer call
        return _model_to_response(acc)

    @staticmethod
    async def update_balance(db: AsyncSession, client_id: str, total: float, available: float, locked: float) -> None:
        """Called after fetching live balance from Angel One RMS API."""
        await db.execute(
            update(FamilyAccount)
            .where(FamilyAccount.angel_client_id == client_id)
            .values(
                total_demat_balance=total,
                available_liquid_balance=available,
                locked_asba_balance=locked,
            )
        )
        await db.flush()
        _invalidate_accounts_cache()

    @staticmethod
    async def sync_live_balance(db: AsyncSession, client_id: str) -> Optional[AccountResponse]:
        """
        Query Angel One getRMS API, update balances in PostgreSQL, and refresh cache.
        """
        from app.services.angel_service import angel_service

        result = await db.execute(
            select(FamilyAccount).where(FamilyAccount.angel_client_id == client_id)
        )
        acc = result.scalar_one_or_none()
        if not acc:
            return None

        # Fetch RMS from Angel One
        try:
            from app.utils.security import decrypt_credential
            real_key = decrypt_credential(acc.angel_api_key)
            rms = await angel_service.get_rms_limits(client_id=client_id, api_key=real_key)
            net = float(rms.get("net", 0.0))
            avail = float(rms.get("availablecash") or rms.get("available_cash") or rms.get("available_margin") or 0.0)

            acc.total_demat_balance = net
            acc.available_liquid_balance = avail
            await db.flush()
            await db.refresh(acc)

            # Invalidate stale cache entry so optimizer reads live balance
            _invalidate_accounts_cache()

            return _model_to_response(acc)
        except Exception as e:
            logger.error(f"[{client_id}] RMS balance sync failed: {e}")
            return _model_to_response(acc)


account_service = AccountService()
