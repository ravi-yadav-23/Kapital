"""F07: the job lock must really use Redis (settings.redis_url), not silently fall back to process memory."""
import pytest

from app.tasks import scheduler


class FakeRedis:
    store = {}
    calls = []

    async def set(self, key, value, nx=False, ex=None):
        FakeRedis.calls.append((key, nx, ex))
        if nx and key in FakeRedis.store:
            return None
        FakeRedis.store[key] = value
        return True

    async def aclose(self):
        pass


@pytest.fixture(autouse=True)
def _fresh(monkeypatch):
    FakeRedis.store, FakeRedis.calls = {}, []
    monkeypatch.setattr(scheduler, "_in_memory_job_locks", {})
    monkeypatch.setattr("redis.asyncio.from_url", lambda *a, **k: FakeRedis())


@pytest.mark.asyncio
async def test_lock_is_taken_in_redis():
    assert await scheduler.acquire_job_lock("job-x", 60) is True
    assert FakeRedis.calls and FakeRedis.calls[0][1] is True


@pytest.mark.asyncio
async def test_second_worker_is_refused_even_with_empty_process_memory(monkeypatch):
    assert await scheduler.acquire_job_lock("job-y", 60) is True
    # simulate another process / serverless cold start: its in-memory dict is empty
    monkeypatch.setattr(scheduler, "_in_memory_job_locks", {})
    assert await scheduler.acquire_job_lock("job-y", 60) is False
