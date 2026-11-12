"""F39: when Redis is down, do not retry (and wait for a timeout) on every single request."""
import pytest

from app.db import redis as redis_mod


@pytest.mark.asyncio
async def test_failed_connection_is_not_retried_immediately(monkeypatch):
    attempts = {"n": 0}

    class Dead:
        async def ping(self):
            attempts["n"] += 1
            raise ConnectionError("down")

    monkeypatch.setattr(redis_mod.aioredis, "from_url", lambda *a, **k: Dead())
    monkeypatch.setattr(redis_mod, "_redis_client", None)
    monkeypatch.setattr(redis_mod, "_retry_after", 0.0)

    assert await redis_mod.get_redis_pool() is None
    assert await redis_mod.get_redis_pool() is None
    assert await redis_mod.get_redis_pool() is None
    assert attempts["n"] == 1
