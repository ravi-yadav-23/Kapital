# Findings & Key Architecture Decisions

## Audit Defect Inventory
1. `[CRIT-01]` Default Admin PIN `"1234"` at `apps/api/app/config.py:83` allows trivial takeover if `ADMIN_PIN` is missing from production env.
2. `[CRIT-02]` Ephemeral SQLite fallback at `apps/api/app/db/database.py:30-33` writes to `/tmp/kapitl_local.db` in serverless runtimes.
3. `[CRIT-03]` Autonomous trading scheduler explicitly disabled when `is_serverless = True` (`main.py:85-95`). Requires a containerized backend or Cloud Cron webhook.
4. `[CRIT-04]` Public unauthenticated LLM scraping endpoint `POST /api/ipos/sync` at `apps/api/app/routers/ipos.py:40-44`.
5. `[HIGH-01]` 10 placeholder files in `infra/` are 0-byte stubs.
6. `[HIGH-02]` SME ticker trading symbols unconditionally append `-EQ` at `angel_service.py:413` instead of preserving `-SM` / `-ST`.
7. `[HIGH-03]` Zero frontend automated test coverage in `apps/web`.
8. `[MED-01]` Test assertion failure in `test_score_and_status_integrity.py:91` on missing `active_asba_locks` attribute.

