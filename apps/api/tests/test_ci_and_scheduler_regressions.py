"""Two real GitHub Actions failures (2026-11-13/14), so they cannot come back.

1. CI "Setup pnpm" failed: the workflow pinned `version: 9` while package.json also says `packageManager: pnpm@9.0.0`
   (pnpm/action-setup refuses to run with both).
2. The 22:00 IST "nightly-maintenance" webhook timed out (curl exit 28 after 120 s): it ran the AI model inside the web
   server. All model work belongs to the nightly GitHub Actions job (`python -m app.jobs.nightly`).
"""
import json
import re
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

ROOT = Path(__file__).resolve().parents[3]


def test_ci_does_not_pin_a_pnpm_version_when_package_json_does():
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    if package.get("packageManager", "").startswith("pnpm@"):
        block = re.search(r"uses:\s*pnpm/action-setup@[^\n]*\n((?:[ \t]+[^\n]*\n)*)", ci)
        assert block is not None
        assert not re.search(r"^\s*version\s*:", block.group(1), re.M), (
            "pnpm/action-setup must not set `version` when package.json has `packageManager`")


def test_every_workflow_that_installs_pnpm_agrees_with_package_json():
    for path in (ROOT / ".github" / "workflows").glob("*.yml"):
        text = path.read_text(encoding="utf-8")
        if "pnpm/action-setup" in text:
            assert not re.search(r"pnpm/action-setup@[^\n]*\n\s*with:\s*\n\s*version\s*:", text), path.name


@pytest.mark.asyncio
async def test_nightly_maintenance_never_runs_the_ai_model():
    from app.tasks import scheduler

    boom = AsyncMock(side_effect=AssertionError("the web-server job must not generate AI reports"))
    with patch("app.agents.orchestrator.orchestrator.run_full_due_diligence", new=boom), \
         patch("app.tasks.report_tasks.generate_nightly_ipo_dossiers", new=boom), \
         patch("app.tasks.order_tasks.sync_expired_asba_locks", new=AsyncMock(return_value=0)) as sweep, \
         patch("app.services.allotment_service.allotment_service.auto_detect_allotments",
               new=AsyncMock(return_value={})) as scan:
        await scheduler.daily_asba_and_reports_maintenance()
    boom.assert_not_awaited()
    sweep.assert_awaited_once()      # the useful work is still done
    scan.assert_awaited_once()
