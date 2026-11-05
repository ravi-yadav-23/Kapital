import time
import ipaddress
import logging
from typing import Dict, List, Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.db.redis import get_redis_pool

logger = logging.getLogger("middleware.rate_limit")

# RFC 1918 & Loopback Trusted Networks for proxy validation
_TRUSTED_PROXY_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),  # Strictly 172.16.0.0 – 172.31.255.255
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("fc00::/7"),
]


def _is_trusted_proxy(ip_str: str) -> bool:
    """Validates whether direct socket connection originates from trusted RFC-1918 / loopback subnet."""
    try:
        addr = ipaddress.ip_address(ip_str.strip())
        return any(addr in net for net in _TRUSTED_PROXY_NETWORKS)
    except ValueError:
        return False


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Sliding window rate limiter with Redis backend and in-memory fallback.
    Protects multi-instance / serverless deployments from distributed abuse.
    """

    def __init__(self, app, max_requests: int = 120, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.client_records: Dict[str, List[float]] = {}
        self._last_prune = time.time()

    def _prune_expired_records(self, now: float):
        """Evicts in-memory IP records when Redis is unavailable to prevent memory leakage."""
        expired_ips = [
            ip for ip, timestamps in self.client_records.items()
            if not timestamps or (now - timestamps[-1] >= self.window_seconds)
        ]
        for ip in expired_ips:
            self.client_records.pop(ip, None)
        self._last_prune = now

    async def dispatch(self, request: Request, call_next) -> Response:
        # Exclude internal health checks, docs, websocket
        path = request.url.path
        if (
            path in ["/health", "/api/health", "/docs", "/redoc", "/openapi.json", "/api/docs", "/api/redoc", "/api/openapi.json"]
            or path.startswith("/ws")
            or path.startswith("/api/ws")
            or request.method == "OPTIONS"
        ):
            return await call_next(request)

        # Determine client IP safely: only trust proxy headers if socket connection is from private/loopback address
        direct_ip = request.client.host if request.client else "127.0.0.1"
        is_trusted = _is_trusted_proxy(direct_ip)

        if is_trusted and request.headers.get("x-forwarded-for"):
            candidate = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            try:
                ipaddress.ip_address(candidate)
                client_ip = candidate
            except ValueError:
                client_ip = direct_ip
        elif is_trusted and request.headers.get("x-real-ip"):
            candidate = request.headers.get("x-real-ip", "").strip()
            try:
                ipaddress.ip_address(candidate)
                client_ip = candidate
            except ValueError:
                client_ip = direct_ip
        else:
            client_ip = direct_ip

        now = time.time()
        redis = await get_redis_pool()

        # 1. Distributed Redis Sliding Window
        if redis:
            key = f"rate:{client_ip}"
            pipe = redis.pipeline()
            # Remove timestamps outside current sliding window
            pipe.zremrangebyscore(key, 0, now - self.window_seconds)
            # Add current timestamp
            pipe.zadd(key, {str(now): now})
            # Count elements in window
            pipe.zcard(key)
            # Set TTL to window length
            pipe.expire(key, self.window_seconds)

            try:
                results = await pipe.execute()
                current_count = results[2]
                if current_count > self.max_requests:
                    return JSONResponse(
                        status_code=429,
                        content={
                            "detail": "Too many requests. Rate limit exceeded.",
                            "retry_after_seconds": self.window_seconds,
                        },
                        headers={"Retry-After": str(self.window_seconds)},
                    )
                return await call_next(request)
            except Exception as e:
                logger.warning(f"Redis rate limit check error ({e}). Falling back to in-memory limiter.")

        # 2. In-Memory Fallback
        if now - self._last_prune > 60 or len(self.client_records) > 500:
            self._prune_expired_records(now)

        timestamps = self.client_records.get(client_ip, [])
        valid_timestamps = [t for t in timestamps if now - t < self.window_seconds]

        if len(valid_timestamps) >= self.max_requests:
            retry_after = int(self.window_seconds - (now - valid_timestamps[0]))
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests. Rate limit exceeded.",
                    "retry_after_seconds": max(1, retry_after),
                },
                headers={"Retry-After": str(max(1, retry_after))},
            )

        valid_timestamps.append(now)
        self.client_records[client_ip] = valid_timestamps

        return await call_next(request)
