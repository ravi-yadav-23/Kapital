"""F08 / D2 + F34: cron webhooks are authenticated, and the GitHub Actions schedule actually calls every one."""
import re
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.routing import APIRoute
from httpx import AsyncClient, ASGITransport

from app.config import settings
from app.main import app

WORKFLOW = Path(__file__).resolve().parents[3] / ".github" / "workflows" / "cron.yml"
SECRET = "c" * 40

JOB_TARGETS = {
    "morning-login": "app.tasks.scheduler.morning_angel_one_login",
    "listing-sell": "app.tasks.scheduler.listing_day_premarket_execution",
    "reconcile-sells": "app.tasks.scheduler.reconcile_listing_sells",
    "allotment-poll": "app.tasks.scheduler.periodic_allotment_detection",
    "daily-scrape": "app.tasks.scheduler.daily_ipo_scraper_sync",
    "nightly-maintenance": "app.tasks.scheduler.daily_asba_and_reports_maintenance",
}


def _cron_paths():
    return sorted({r.path[len("/api/cron/"):] for r in app.routes
                   if isinstance(r, APIRoute) and r.path.startswith("/api/cron/")})


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def test_every_cron_route_is_known_to_this_test():
    assert _cron_paths() == sorted(JOB_TARGETS)


@pytest.mark.asyncio
@pytest.mark.parametrize("job", sorted(JOB_TARGETS))
async def test_cron_rejects_missing_wrong_and_guest_credentials(job, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", SECRET)
    boom = AsyncMock(side_effect=AssertionError("job must not run"))
    with patch(JOB_TARGETS[job], new=boom):
        async with _client() as c:
            assert (await c.post(f"/api/cron/{job}")).status_code == 401
            assert (await c.post(f"/api/cron/{job}", headers={"Authorization": "Bearer nope"})).status_code == 401
            assert (await c.post(f"/api/cron/{job}", headers={"X-API-Key": "nope"})).status_code == 401
    boom.assert_not_awaited()


@pytest.mark.asyncio
async def test_cron_is_closed_when_secret_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "")
    async with _client() as c:
        resp = await c.post("/api/cron/listing-sell", headers={"Authorization": "Bearer anything"})
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_secret_key_is_not_a_cron_credential(monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", SECRET)
    async with _client() as c:
        resp = await c.post("/api/cron/listing-sell", headers={"Authorization": f"Bearer {settings.secret_key}"})
    assert resp.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("job", sorted(JOB_TARGETS))
async def test_cron_runs_job_with_correct_secret(job, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", SECRET)
    ok = AsyncMock(return_value=None)
    with patch(JOB_TARGETS[job], new=ok):
        async with _client() as c:
            resp = await c.post(f"/api/cron/{job}", headers={"Authorization": f"Bearer {SECRET}"})
    assert resp.status_code == 200
    ok.assert_awaited_once()


def test_workflow_exists_and_uses_repo_secrets_only():
    assert WORKFLOW.exists(), "add .github/workflows/cron.yml (D2)"
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "secrets.CRON_SECRET" in text and "secrets.API_BASE_URL" in text
    # no literal secret or URL baked into the file
    assert not re.search(r"Bearer\s+[A-Za-z0-9]{20,}", text)
    assert "vercel.app" not in text


def test_workflow_triggers_every_cron_route_on_a_schedule():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "schedule:" in text and "workflow_dispatch" in text
    for job in JOB_TARGETS:
        assert job in text, f"workflow never calls /api/cron/{job}"


def test_db_migrate_workflow_is_manual_and_uses_the_secret():
    wf = WORKFLOW.parent / "db-migrate.yml"
    assert wf.exists()
    text = wf.read_text(encoding="utf-8")
    assert "workflow_dispatch" in text and "schedule:" not in text, "migrations must never run on a timer"
    assert "secrets.DATABASE_URL" in text and "db_dry_run.py" in text and "alembic upgrade head" in text
    assert not re.search(r"postgres(ql)?://[^\s$]*:[^\s$@]+@", text), "no credentials in the workflow file"
