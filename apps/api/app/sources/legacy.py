"""Adapters that put the existing Groww and IPO Watch scrapers behind the Source interface.

Their parsers still live in app/tasks/ipo_tasks.py (they swallow their own errors and return [] on
failure, which the runner reports as a "0 records" warning). They are being split into pure,
fixture-tested parsers in the next step.
"""
from typing import Optional

from app.config import settings
from app.sources.base import Source, SourceResult


class GrowwSource(Source):
    name = "groww"

    def enabled(self) -> bool:
        return bool(settings.source_groww_enabled)

    async def fetch(self, *, requests_allowed: Optional[int] = None) -> SourceResult:
        from app.tasks.ipo_tasks import fetch_ipos_from_groww
        return SourceResult(records=await fetch_ipos_from_groww(), requests_used=1)


class IpoWatchSource(Source):
    name = "ipowatch"

    def enabled(self) -> bool:
        return bool(settings.source_ipowatch_enabled)

    async def fetch(self, *, requests_allowed: Optional[int] = None) -> SourceResult:
        from app.tasks.ipo_tasks import fetch_ipos_from_ipowatch
        return SourceResult(records=await fetch_ipos_from_ipowatch(), requests_used=1)
