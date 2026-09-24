import time
from typing import Dict, List
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    In-memory token-bucket / sliding window rate limiter.
    Limits requests per IP per minute.
    """

    def __init__(self, app, max_requests: int = 120, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.client_records: Dict[str, List[float]] = {}
        self._last_prune = time.time()

    def _prune_expired_records(self, now: float):
        """Evicts IP records with no activity within the current window to prevent memory leaks."""
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
            path in ["/api/health", "/docs", "/redoc", "/openapi.json"]
            or path.startswith("/ws")
            or request.method == "OPTIONS"
        ):
            return await call_next(request)

        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()

        # Periodic cleanup of inactive IPs every 60s
        if now - self._last_prune > 60 or len(self.client_records) > 500:
            self._prune_expired_records(now)

        # Clean timestamps older than window
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
