# Implementation Progress Log

## Session Started: 2026-11-01
## Batch 2 Complete (Tasks 4 - 6):
- **Task 4 (`[MED-01]`)**: Added `active_asba_locks: int = 0` to `FundSummaryResponse` and populated it in `demo_dataset.py` and `funds.py`. Confirmed `test_demo_data_whole_lots_and_asba_reconciliation` passes. (Commit: `d576154`)
- **Task 5 (`[HIGH-02]`)**: Added `resolve_tradingsymbol` to `AngelOneSmartApiService` preserving NSE SME series suffixes (`-SM`, `-ST`, etc.). Added 3 pytest cases (`test_sme_tradingsymbol_resolution.py`). (Commit: `ae6eeec`)
- **Task 6 (`[SYNC-01]`)**: Harmonized guest preview response on `/api/reports/pnl/summary` with demo allotments ledger. Added pytest verification (`test_pnl_consistency.py`). (Commit: `075f000`)

