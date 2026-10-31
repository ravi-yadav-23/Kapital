import pyotp
import httpx
import logging
import json
import os
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from app.config import settings

logger = logging.getLogger("angel_service")

SESSION_CACHE_FILE = os.path.join(os.path.dirname(__file__), "..", "..", ".angel_sessions.json")


class AngelOneSmartApiService:
    """
    Production service for Angel One SmartAPI authentication, multi-account session management,
    live RMS balance synchronization, ASBA IPO order staging, and listing-day pre-market execution.
    """

    BASE_URL = "https://apiconnect.angelbroking.com"
    _instrument_cache: Dict[str, str] = {}
    _instrument_cache_loaded: bool = False
    _last_scrip_refresh: Optional[datetime] = None

    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = self._load_persisted_sessions()

    def _load_persisted_sessions(self) -> Dict[str, Dict[str, Any]]:
        """Loads cached Angel One sessions from disk on process startup."""
        if not os.path.exists(SESSION_CACHE_FILE):
            return {}
        try:
            with open(SESSION_CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                valid = {}
                now = datetime.now(timezone.utc).timestamp()
                for cid, sess in data.items():
                    exp = sess.get("expires_at", 0)
                    if exp > now:
                        valid[cid] = sess
                logger.info(f"Loaded {len(valid)} active Angel One sessions from session cache")
                return valid
        except Exception as e:
            logger.warning(f"Could not load persisted Angel One sessions: {e}")
            return {}

    def _persist_sessions(self):
        """Saves active sessions to disk and attempts Redis persistence to survive restarts."""
        try:
            with open(SESSION_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(self.sessions, f)
        except Exception as e:
            logger.warning(f"Could not persist Angel One sessions to disk: {e}")

        # Async best-effort persistence to Redis if loop is running
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._persist_sessions_to_redis())
        except RuntimeError:
            pass

    async def _persist_sessions_to_redis(self):
        try:
            from app.db.redis import get_redis_pool
            redis = await get_redis_pool()
            if redis:
                await redis.set("angel_sessions", json.dumps(self.sessions), ex=24 * 3600)
        except Exception as e:
            logger.debug(f"Redis session persistence skipped/failed: {e}")

    async def refresh_scrip_master(self, force: bool = False) -> int:
        """
        Refreshes OpenAPI Scrip Master instruments from Angel One.
        Auto-skips if loaded within the last 12 hours unless force=True.
        """
        now = datetime.now(timezone.utc)
        if not force and self._instrument_cache_loaded and self._last_scrip_refresh:
            elapsed = (now - self._last_scrip_refresh).total_seconds()
            if elapsed < 43200:  # 12 hours
                return len(self._instrument_cache)

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.get(
                    "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
                )
                if res.status_code == 200:
                    data = res.json()
                    new_cache: Dict[str, str] = {}
                    for item in data:
                        exch = item.get("exch_seg")
                        tsym = item.get("name") or item.get("symbol", "")
                        token = item.get("token")
                        if exch and tsym and token:
                            new_cache[f"{exch}:{tsym.upper().strip()}"] = str(token)
                            if item.get("symbol"):
                                new_cache[f"{exch}:{item['symbol'].upper().strip()}"] = str(token)
                    self._instrument_cache = new_cache
                    self._instrument_cache_loaded = True
                    self._last_scrip_refresh = now
                    logger.info(f"Refreshed {len(self._instrument_cache)} Angel One instruments into cache")
                    return len(self._instrument_cache)
        except Exception as ex:
            logger.warning(f"Failed to fetch Angel One instrument master: {ex}")

        return len(self._instrument_cache)

    async def get_symbol_token(self, symbol: str, exchange: str = "NSE") -> Optional[str]:
        """
        Retrieves the exact Angel One scrip token from OpenAPI Scrip Master.
        Refreshes scrip master on-demand if token is missing.
        """
        clean_symbol = symbol.upper().replace("-EQ", "").strip()
        cache_key = f"{exchange}:{clean_symbol}"

        if not self._instrument_cache_loaded:
            await self.refresh_scrip_master(force=True)

        token = self._instrument_cache.get(cache_key) or self._instrument_cache.get(f"{exchange}:{clean_symbol}-EQ")

        # If missing and cache is over 30 mins old, refresh once on-demand for newly listed IPOs
        if not token and self._last_scrip_refresh:
            if (datetime.now(timezone.utc) - self._last_scrip_refresh).total_seconds() > 1800:
                logger.info(f"Symbol '{clean_symbol}' not found in cache. Refreshing scrip master...")
                await self.refresh_scrip_master(force=True)
                token = self._instrument_cache.get(cache_key) or self._instrument_cache.get(f"{exchange}:{clean_symbol}-EQ")

        if not token:
            logger.error(f"Instrument token NOT found for {cache_key} in Angel One master scrip list.")
            return None

        return token

    def generate_totp(self, totp_secret: str) -> str:
        """Generate 6-digit TOTP for Angel One login."""
        totp = pyotp.TOTP(totp_secret)
        return totp.now()

    def _get_common_headers(self, api_key: str, jwt_token: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-UserType": "USER",
            "X-SourceID": "WEB",
            "X-ClientLocalIP": getattr(settings, "client_local_ip", "127.0.0.1") or "127.0.0.1",
            "X-ClientPublicIP": settings.static_ip or "127.0.0.1",
            "X-MACAddress": getattr(settings, "static_mac", "fe80::216e:6507:4b9c:9045") or "fe80::216e:6507:4b9c:9045",
            "X-PrivateKey": api_key,
        }
        if jwt_token:
            headers["Authorization"] = f"Bearer {jwt_token}"
        return headers

    async def login_account(
        self,
        client_id: str,
        api_key: str,
        pin: str,
        totp_secret: str,
    ) -> Dict[str, Any]:
        """
        Authenticates a client account via SmartAPI v3 TOTP flow.
        Stores JWT token and refresh token in active session memory.
        """
        from app.utils.security import decrypt_credential

        clean_key = decrypt_credential(api_key) or api_key
        clean_pin = decrypt_credential(pin) or pin
        clean_totp = decrypt_credential(totp_secret) or totp_secret

        totp_code = self.generate_totp(clean_totp)
        headers = self._get_common_headers(api_key=clean_key)
        payload = {
            "clientcode": client_id,
            "password": clean_pin,
            "totp": totp_code,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    f"{self.BASE_URL}/rest/auth/angelbroking/user/v1/loginByPassword",
                    json=payload,
                    headers=headers,
                )
                data = res.json()
                if data.get("status") and data.get("data"):
                    jwt_token = data["data"]["jwtToken"]
                    refresh_token = data["data"]["refreshToken"]
                    feed_token = data["data"].get("feedToken")

                    # Session valid for ~24 hours
                    exp_timestamp = datetime.now(timezone.utc).timestamp() + (24 * 3600)
                    self.sessions[client_id] = {
                        "jwtToken": jwt_token,
                        "refreshToken": refresh_token,
                        "feedToken": feed_token,
                        "api_key": api_key,
                        "logged_in_at": datetime.now(timezone.utc).isoformat(),
                        "expires_at": exp_timestamp,
                    }
                    self._persist_sessions()
                    logger.info(f"[{client_id}] SmartAPI login successful. Session active and persisted.")
                    return {"success": True, "jwtToken": jwt_token}
                else:
                    error_msg = data.get("message", "Login failed")
                    logger.error(f"[{client_id}] SmartAPI login rejected: {error_msg}")
                    return {"success": False, "error": error_msg}
        except Exception as e:
            logger.error(f"[{client_id}] SmartAPI connection failed: {e}")
            return {"success": False, "error": str(e)}

    async def get_rms_limits(self, client_id: str, api_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Fetches live RMS (Risk Management System) available cash balance and total demat balance.
        Endpoint: /rest/secure/angelbroking/user/v1/getRMS
        """
        session = self.sessions.get(client_id)
        if not session or not session.get("jwtToken"):
            logger.warning(f"No active session for {client_id}. Return default values.")
            return {"net": 0.0, "availablecash": 0.0}

        jwt_token = session["jwtToken"]
        key = api_key or session.get("api_key") or ""
        headers = self._get_common_headers(api_key=key, jwt_token=jwt_token)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    f"{self.BASE_URL}/rest/secure/angelbroking/user/v1/getRMS",
                    headers=headers,
                )
                data = res.json()
                if data.get("status") and data.get("data"):
                    rms_data = data["data"]
                    net_balance = float(rms_data.get("net", 0.0))
                    available_cash = float(rms_data.get("availablecash", 0.0))
                    return {
                        "net": net_balance,
                        "availablecash": available_cash,
                        "available_cash": available_cash,
                        "collateral": float(rms_data.get("collateral", 0.0)),
                    }
                else:
                    logger.warning(f"[{client_id}] RMS limit fetch returned: {data.get('message')}")
                    return {"net": 0.0, "availablecash": 0.0, "available_cash": 0.0}
        except Exception as e:
            logger.error(f"[{client_id}] Failed to fetch RMS limits: {e}")
            return {"net": 0.0, "availablecash": 0.0, "available_cash": 0.0}

    # Backward-compatible alias
    get_rms_funds = get_rms_limits

    async def get_all_holdings(self, client_id: str, api_key: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetches active demat portfolio holdings for a client.
        Endpoint: /rest/secure/angelbroking/portfolio/v1/getAllHolding
        Used for automated IPO allotment detection on allotment/listing day.
        """
        session = self.sessions.get(client_id)
        if not session or not session.get("jwtToken"):
            matching_acc = next((a for a in settings.angel_accounts if a.get("client_id") == client_id), None)
            if not matching_acc:
                try:
                    from app.db.database import AsyncSessionLocal
                    from app.models.account import FamilyAccount
                    from sqlalchemy import select
                    async with AsyncSessionLocal() as db:
                        res = await db.execute(select(FamilyAccount).where(FamilyAccount.angel_client_id == client_id))
                        db_acc = res.scalar_one_or_none()
                        if db_acc:
                            matching_acc = {
                                "client_id": db_acc.angel_client_id,
                                "api_key": db_acc.angel_api_key or "",
                                "pin": db_acc.pin or "",
                                "totp_secret": db_acc.totp_secret or "",
                            }
                except Exception:
                    pass

            if matching_acc:
                await self.login_account(
                    client_id=client_id,
                    api_key=matching_acc.get("api_key", ""),
                    pin=matching_acc.get("pin", ""),
                    totp_secret=matching_acc.get("totp_secret", ""),
                )
                session = self.sessions.get(client_id)

        if not session or not session.get("jwtToken"):
            logger.warning(f"No active session for {client_id}. Cannot fetch holdings.")
            return []

        jwt_token = session["jwtToken"]
        key = api_key or session.get("api_key") or ""
        headers = self._get_common_headers(api_key=key, jwt_token=jwt_token)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    f"{self.BASE_URL}/rest/secure/angelbroking/portfolio/v1/getAllHolding",
                    headers=headers,
                )
                data = res.json()
                if data.get("status") and data.get("data"):
                    raw = data["data"]
                    if isinstance(raw, dict):
                        return raw.get("holdings", []) or []
                    elif isinstance(raw, list):
                        return raw
                return []
        except Exception as e:
            logger.error(f"[{client_id}] Failed to fetch demat holdings: {e}")
            return []

    async def stage_listing_sell_order(
        self,
        client_id: str,
        symbol: str,
        shares: int,
        limit_price: float,
        api_key: Optional[str] = None,
        exchange: str = "NSE",
    ) -> Dict[str, Any]:
        """
        Dispatches 09:00:00 AM IST pre-market limit sell order on listing day via SmartAPI placeOrder endpoint.
        Supports NSE and BSE (for SME / BSE-exclusive issues) with automatic fallback.
        Endpoint: /rest/secure/angelbroking/order/v1/placeOrder
        """
        actual_exchange = (exchange or "NSE").upper()
        token = await self.get_symbol_token(symbol, exchange=actual_exchange)
        if not token:
            alt_exchange = "BSE" if actual_exchange == "NSE" else "NSE"
            token = await self.get_symbol_token(symbol, exchange=alt_exchange)
            if token:
                actual_exchange = alt_exchange

        if not token:
            logger.error(f"Cannot stage pre-market sell: symbol token for '{symbol}' not found on {actual_exchange} in Angel One instrument master.")
            return {
                "success": False,
                "status": "TOKEN_NOT_FOUND",
                "message": f"Instrument token for '{symbol}' not found in Angel One master scrip file. Listing may not be active yet.",
            }

        session = self.sessions.get(client_id)
        if not session or not session.get("jwtToken"):
            logger.info(f"Session not in memory for {client_id}. Attempting auto-login from configured credentials...")
            matching_acc = next((a for a in settings.angel_accounts if a.get("client_id") == client_id), None)
            if not matching_acc:
                try:
                    from app.db.database import AsyncSessionLocal
                    from app.models.account import FamilyAccount
                    from sqlalchemy import select
                    async with AsyncSessionLocal() as db:
                        res = await db.execute(select(FamilyAccount).where(FamilyAccount.angel_client_id == client_id))
                        db_acc = res.scalar_one_or_none()
                        if db_acc:
                            matching_acc = {
                                "client_id": db_acc.angel_client_id,
                                "api_key": db_acc.angel_api_key or "",
                                "pin": db_acc.pin or "",
                                "totp_secret": db_acc.totp_secret or "",
                            }
                except Exception as ex:
                    logger.warning(f"Could not load account {client_id} from DB: {ex}")

            if matching_acc:
                login_res = await self.login_account(
                    client_id=client_id,
                    api_key=matching_acc.get("api_key", ""),
                    pin=matching_acc.get("pin", ""),
                    totp_secret=matching_acc.get("totp_secret", ""),
                )
                if login_res.get("success"):
                    session = self.sessions.get(client_id)

        if not session or not session.get("jwtToken"):
            logger.error(f"No active or recoverable broker session for {client_id}.")
            return {
                "success": False,
                "status": "AUTH_FAILED",
                "message": f"No active broker session for account {client_id}. Please re-authenticate.",
            }

        jwt_token = session["jwtToken"]
        key = api_key or session.get("api_key") or ""
        headers = self._get_common_headers(api_key=key, jwt_token=jwt_token)

        tradingsymbol = f"{symbol}-EQ" if actual_exchange == "NSE" else str(symbol)
        order_payload = {
            "variety": "NORMAL",
            "tradingsymbol": tradingsymbol,
            "symboltoken": str(token),
            "transactiontype": "SELL",
            "exchange": actual_exchange,
            "ordertype": "LIMIT",
            "producttype": "DELIVERY",
            "duration": "DAY",
            "price": str(limit_price),
            "quantity": str(shares),
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    f"{self.BASE_URL}/rest/secure/angelbroking/order/v1/placeOrder",
                    json=order_payload,
                    headers=headers,
                )
                data = res.json()
                if data.get("status") and data.get("data"):
                    broker_order_id = data["data"].get("orderid")
                    logger.info(f"[{client_id}] Listing day limit sell order PLACED: {broker_order_id}")
                    return {
                        "success": True,
                        "sell_order_id": broker_order_id,
                        "status": "EXECUTED",
                        "limit_price": limit_price,
                        "message": f"Order successfully submitted to Angel One. Order ID: {broker_order_id}",
                    }
                else:
                    err = data.get("message", "Order placement failed")
                    logger.error(f"[{client_id}] SmartAPI limit sell rejected by broker: {err}")
                    return {
                        "success": False,
                        "sell_order_id": None,
                        "status": "REJECTED",
                        "limit_price": limit_price,
                        "error": err,
                        "message": f"Angel One rejected order: {err}",
                    }
        except Exception as e:
            logger.error(f"[{client_id}] Pre-market sell network error: {e}")
            return {
                "success": False,
                "sell_order_id": None,
                "status": "FAILED",
                "limit_price": limit_price,
                "error": str(e),
                "message": f"Network exception while sending order: {str(e)}",
            }


angel_service = AngelOneSmartApiService()
