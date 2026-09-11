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
