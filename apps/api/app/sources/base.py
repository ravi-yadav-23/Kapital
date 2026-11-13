from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class SourceResult:
    """What a source returns. A source must not raise for expected problems: report them in `error`."""
    records: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None
    requests_used: int = 0
    warnings: List[str] = field(default_factory=list)


class Source:
    """Base class for a data source plug-in."""

    name: str = "source"
    #: Requests per day this source may make (None = unlimited). The runner passes what is left.
    daily_request_budget: Optional[int] = None
    #: True for structured APIs that can legitimately return no rows (e.g. no IPO is open today).
    #: Scrapers returning 0 rows are flagged as a warning (layout change or block).
    empty_is_normal: bool = False

    def enabled(self) -> bool:
        return True

    async def fetch(self, *, requests_allowed: Optional[int] = None) -> SourceResult:
        raise NotImplementedError
