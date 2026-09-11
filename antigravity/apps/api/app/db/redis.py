import logging
from typing import Optional
import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger("db.redis")

_redis_client: Optional[aioredis.Redis] = None


async def get_redis_pool() -> Optional[aioredis.Redis]:
    """
    Returns an async Redis client pool connection.
    Gracefully returns None if Redis is unreachable.
    """
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    try:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_timeout=3.0,
            socket_connect_timeout=3.0,
        )
        # Verify connectivity
        await _redis_client.ping()
        logger.info(f"Connected to Redis at {settings.redis_url}")
        return _redis_client
    except Exception as exc:
        logger.warning(f"Redis unavailable ({exc}). Continuing without Redis caching.")
        _redis_client = None
        return None


async def close_redis():
    """Closes the Redis connection pool cleanly."""
    global _redis_client
    if _redis_client:
        try:
            await _redis_client.close()
        except Exception:
            pass
        _redis_client = None
