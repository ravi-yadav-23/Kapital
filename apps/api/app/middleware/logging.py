import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("http.access")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Structured HTTP request and latency measurement middleware.
    Attaches X-Process-Time (ms) header to all HTTP responses.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()
        path = request.url.path

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000
            response.headers["X-Process-Time"] = f"{duration_ms:.2f}ms"

            # Avoid spamming access logs with periodic health check polling
            if path != "/api/health":
                logger.info(
                    f"{request.method} {path} -> {response.status_code} ({duration_ms:.2f}ms)"
                )
            return response
        except Exception as exc:
            import traceback
            from starlette.responses import JSONResponse
            duration_ms = (time.perf_counter() - start_time) * 1000
            tb = traceback.format_exc()
            logger.error(f"{request.method} {path} -> FAILED: {exc}\n{tb} ({duration_ms:.2f}ms)")
            return JSONResponse(
                status_code=500,
                content={
                    "error": str(exc),
                    "type": type(exc).__name__,
                    "path": path,
                    "traceback": tb.split("\n"),
                },
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Credentials": "true",
                    "X-Process-Time": f"{duration_ms:.2f}ms",
                },
            )
