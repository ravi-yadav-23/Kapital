# Kapitl Audit — state file

Branch: `audit/claude-code` (created from `main` @ d6e0c24). Nothing pushed, nothing committed yet.
Re-read this file at the start of every phase.

## Phase status
- [x] Phase 0 — Orient / baseline
- [x] Phase 1 — Audit (complete; awaiting go-ahead for Phase 2)
- [x] Phase 2 — Plan (approved with decisions D1-D3, D8; rest at recommendation)
- [x] Phase 3 — Fix (all approved items done; checkpoints 1-4 green)
- [x] Phase 4 — Verify (see end of file)

---

## Phase 0: Baseline

### Environment used
- Windows 11, Git Bash/PowerShell. Python 3.10.x and 3.13.x available (no 3.12,  which CI uses). Node v22.22.2, npm 11.9, pnpm 9.15.9, Docker 29.9.2 present.
- Fresh venv created OUTSIDE the repo (scratchpad `venv310`, Python 3.10) — the repo's own `apps/api/.venv` was not used.
- `.env` files exist locally (root, `apps/api`, `apps/web/.env.local`). They were **not opened or printed**. They are gitignored (`git check-ignore` confirms `.env`; `*.db` and `.venv/` also ignored).
- Tests were run with `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `IPOALERTS_API_KEY` blanked, `ANGEL_ACCOUNTS_JSON=[]`, and `REDIS_URL` pointed at a dead port, so a local `.env` could not make a test hit a live service. (Process env vars override `.env` in pydantic-settings.)

### Results
| Step | Command | Result |
|---|---|---|
| Backend install | `pip install -r apps/api/requirements.txt` (py3.10, fresh venv) | OK. `pip check`: "No broken requirements found". |
| Backend tests | `pytest tests -q` in `apps/api` | **121 passed, 0 failed, 8 warnings, 135 s** |
| Frontend install | `pnpm install --frozen-lockfile` (root) | OK (427 resolved) |
| Frontend build | `npm run build` in `apps/web` | OK; 14 static pages compiled, type/lint check passed |
| Frontend tests | `npm test` in `apps/web` | 5 pass, 0 fail (single file `smoke.test.ts`, scoring/status logic only) |
| Docker build | not run in Phase 0 | pending Phase 1 item 7 |

Not yet tried: Python 3.13 and 3.12 installs (requirements are pinned; 3.13 may not resolve — to check in Phase 1/4).

### Early observations (not yet verified as findings)
- `requirements.txt` has **no `langchain`** and no tenacity conflict; `pip check` clean → KNOWN ISSUE "langchain conflicts with tenacity" looks FIXED (confirm in Phase 1).
- `apps/web/Dockerfile` no longer copies `packages/` → that part looks FIXED. `docker-compose.yml` still sets `NEXT_PUBLIC_API_URL=http://api:8000` for the web container (browser cannot resolve `api`) and `next.config.mjs` rewrites default to `127.0.0.1:8000` unless `API_URL` is set (compose doesn't set it).
- `cron.py::_verify_cron_auth` now requires a dedicated `CRON_SECRET` and no longer accepts SECRET_KEY → that part looks FIXED (confirm by probe).
- `config.py` has a hard-coded Google OAuth client ID default (public by nature, but machine/project specific) — also duplicated in `next.config.mjs`.
- Tests passed with no LLM key, so `test_orchestrator_due_diligence` either mocks the LLM now or is skipped — confirm.
- CI (`.github/workflows/ci.yml`) uses Python 3.12 and `pnpm build`; it does **not** run frontend tests or lint, and runs `pytest tests/` without blanking API keys (CI has none, so fine).

### Deployment and scheduled jobs
| Mode | How it runs | How scheduled jobs are triggered |
|---|---|---|
| Vercel (`vercel.json` "services": api = FastAPI at `apps/api`, web = Next.js; `/api/*` rewritten to api service) | Serverless. `apps/api/main.py` is the entrypoint (wraps `app.main` import in a try/except that serves a "startup_failed" fallback including the **traceback** to anyone). | `lifespan` skips `start_scheduler()` when `VERCEL`/`AWS_LAMBDA_FUNCTION_NAME` set. Webhook routes exist at `/api/cron/*` but **neither `vercel.json` has a `crons` block and `.github/workflows` only has `ci.yml`** → nothing in the repo calls them. Needs Phase 1 confirmation. |
| `Procfile` (Heroku/Render style) | `uvicorn app.main:app` single process | In-process APScheduler started from `lifespan` (`app/tasks/scheduler.py`, 10 jobs). Works only while the process is alive; no multi-instance coordination other than `acquire_job_lock` (Redis, local fallback). |
| `docker-compose.yml` (root) | db (postgres:15), redis, api (uvicorn, `ENVIRONMENT=development`, bind-mounts `./apps/api` over `/app`), web (Next standalone) | In-process APScheduler in the api container. |
| `infra/docker/docker-compose.dev.yml` | includes `celery_worker` and `celery_beat` commands against `app.tasks.celery_app` | Celery beat — need to check whether `celery_app` defines a beat schedule (Phase 1). |

### Repo layout notes
- Monorepo: `apps/api` (FastAPI, SQLAlchemy async, Alembic with 3 revisions, `app/{agents,routers,services,models,tasks,utils}`), `apps/web` (Next 14 app router), `infra/` (AWS/nginx/deploy scripts), `.ai/` and `docs/` (planning docs), `.cursor/`.
- Every router is mounted twice (`/api/...` and `/...`) in `app/main.py`.
- Committed notes: `.ai/*.md`, `docs/plans/2026-11-01-production-readiness-remediation.md`. The `findings.md`, `progress.md`, `task_plan.md` files named in the brief are **not tracked** in `git ls-files` (so likely already removed; verify with `git log --diff-filter=D`).
- Untracked-but-present binary artifacts in working tree: `kapitl_local.db` (root), `apps/api/{ipo_invest,kapitl,kapitl_local}.db` — all gitignored via `*.db`, so not a repo problem, but they may contain real data.

---

## Phase 1: Audit findings

Method: read the code, then ran two temporary probe test files (seeded in-memory SQLite; broker and LLM mocked; **deleted afterwards**, so `git status` shows only AUDIT.md). Probe A = route x identity matrix (none / invalid / 2FA-pending / guest / admin token) with one seeded "real" account (PAN, client ID, UPI VPA, name). Probe B = money-path and AI-pipeline behaviours. Phase 3 re-creates each as a permanent failing test first.
Impact legend: **breaks** = wrong behaviour/money, **misleads** = users or recruiters are told something untrue, **latent** = risk that bites under realistic conditions, **polish**.
"Evidence" file:line refer to `apps/api/` unless prefixed `web/`.

### Findings (sorted by impact, then severity)

| ID | Area | Finding | Evidence | Impact | Proposed fix | Effort | Status |
|---|---|---|---|---|---|---|---|
| F01 | Money / broker | `apply_ipo` returns a **simulated success** for ANY client with no live session whenever `ENVIRONMENT` is `dev/development/test` (the config default, `.env.example`, and docker-compose value). The order is stored SUBMITTED, an ASBA lock is created and balance debited for a bid that was never sent. | `app/services/angel_service.py:549-566`; `app/config.py:17`; consumer `app/services/order_service.py:137-185`. Probe B: `apply_ipo("REAL_CLIENT_X1")` -> `success=True, is_simulation=True` with env=development. | breaks | Simulate only for demo/test client-id prefixes, never from env; persist `is_simulation`; reject otherwise. | S | **FIXED** (C01) |
| F02 | Money / P&L | `get_order_status` returns `COMPLETE` (fake) when there is no session or for simulated IDs; the 10:05 reconcile job then books the allotment **SOLD with realized P&L at the staged limit price** (avg price 0 falls back to limit). On serverless the in-memory session dict is empty on every cold start, so this is the normal path there. Partial fills (`filled_shares`) are ignored. | `app/services/angel_service.py:645-655`; `app/tasks/scheduler.py:207-218`. Probe B: no-session status -> `{'status':'COMPLETE','average_price':0.0,'is_simulation':True}`. | breaks | Return `UNKNOWN` without session; reconcile only on real fills (`avg>0`, qty), handle partial; never trust `is_simulation`. | S-M | **FIXED** (C03) |
| F03 | Money / balances | Any RMS failure (no session, HTTP error, exception) returns `{net:0, availablecash:0}` and `sync_live_balance` **writes those zeros** over the account's balances. Its error handler also calls an undefined `logger` (NameError). Morning login job and `/funds/accounts/sync-all` therefore wipe balances on a broker hiccup, making the optimizer return INSUFFICIENT_FUNDS and orders fail "insufficient balance". | `app/services/angel_service.py:251-252,277-283`; `app/services/account_service.py:280-296` (no `import logging`/`logger`; module imports only `uuid`). Probe B: balance 5,00,000 -> `0.0` after sync with no session. | breaks | `get_rms_limits` returns `None` on failure; `sync_live_balance` leaves balances untouched; define `logger`. | S | **FIXED** (C02) |
| F04 | Money / order lifecycle | `process_allotment_result` has no status guard: ALLOTTED on a CANCELLED (or FAILED) order creates an Allotment and bumps `total_allotments_won`; ALLOTTED twice -> unhandled IntegrityError (500); NOT_ALLOTTED on an ALLOTTED order flips its status. | `app/services/order_service.py:398-515`. Probe B: ALLOTTED on cancelled order returned `ALLOTTED`; second call raised `IntegrityError`. | breaks | Allow transitions only from SUBMITTED/CONFIRMED/APPLIED/PENDING; idempotent otherwise. | S | **FIXED** (C04) |
| F05 | Money / SEBI | Order creation checks duplicates per **account**, not per **PAN**: two accounts sharing a PAN can both bid on one IPO (SEBI treats as duplicate). Optimizer enforces PAN uniqueness but the order path (and batch apply) does not. | `app/services/order_service.py:111-125`. Probe B: second same-PAN order -> `SUBMITTED`. | breaks | Reject when another active order exists for same PAN + IPO. | S | **FIXED** (C05) |
| F06 | Money / UPI | Orders > Rs 5,00,000 are accepted with a UPI VPA (probe: sHNI Rs 6,00,000). The allocation plan has no payment-method field, so the UI cannot tell the user a bid > Rs 5L needs net-banking ASBA. | `app/services/order_service.py:95-110` (only category bands checked); `app/schemas/fund.py` `AllocationEntrySchema` (no payment field). | breaks | Add `payment_method` to plan entries (UPI <= 5L else ASBA/net-banking), reject UPI > 5L in `create_order`. Needs your OK (public schema change). | M | **FIXED** (C26: `payment_method` on plan entries; UPI > Rs 5L rejected) |
| F07 | Scheduler | Job lock reads `settings.REDIS_URL` but the field is `redis_url`, so Redis is never used and the lock is per-process memory. Two workers/replicas, or a cron retry on serverless, run the 09:00 sell and 08:30 login jobs twice. README claims "exactly once across distributed worker processes". | `app/tasks/scheduler.py:22`. Probe B: `getattr(settings,'REDIS_URL','MISSING')` -> MISSING. | breaks | Use `settings.redis_url`; add test. | S | **FIXED** (C07) |
| F08 | Deploy | **Nothing triggers the cron endpoints in production.** No `crons` block in either `vercel.json`; `.github/workflows` has only `ci.yml`; `lifespan` skips APScheduler when `VERCEL` is set. Listing-day sells, 10:05 reconciliation, allotment polling, nightly IPO sync never run on Vercel. | `vercel.json`, `apps/api/vercel.json`, `app/main.py` lifespan (`is_serverless`), `.github/workflows/`. | breaks | Add Vercel `crons` (IST -> UTC) calling `/api/cron/*` with `CRON_SECRET`, or a GitHub Actions schedule. **Decision:** Vercel Hobby only allows daily crons; 09:00/10:05 jobs need Pro or an external scheduler. | M | **FIXED in repo** (C25 `.github/workflows/cron.yml`) - **needs your repo secrets** `API_BASE_URL`, `CRON_SECRET`; GitHub schedules are best-effort |
| F09 | Money / stage-sell | `stage_sell_order` reports `success: True` and "Pre-listing sell staged" even when the broker call failed (status silently reverts to ACTIVE, limit price stays stored). No guard on current status (re-staging a STAGED/SOLD row sends another SELL) and no check that `limit_price > 0`. | `app/services/allotment_service.py:100-120`; `app/schemas/allotment.py:4-8`. Probe B: broker failure -> `success=True`. (Negative/zero limit price: reading only, probe output lost to a console-encoding error.) | breaks / misleads | Return truthful result ("queued for 09:00 job" vs "failed"); validate price and status. | S | **FIXED** (C06) |
| F10 | Money / cancel | `cancel_order` only edits local rows ("mandate REVOKED", funds credited back); it never cancels the bid at the broker, and is allowed from any status (even ALLOTTED). A bid still live at the exchange appears released in the app. | `app/services/order_service.py:316-352`. No broker cancel exists in `angel_service.py`. | breaks / misleads | Restrict cancellable states; either call the broker (endpoint **unverified**) or label "cancelled locally - cancel in broker app". Decision. | S-M | **FIXED** (C16b: only live orders cancellable, 409 otherwise, labelled Kapitl-only). Broker-side cancel still not implemented |
| F11 | AI honesty | `data_sufficiency="full"` and `is_audited=True` are decided from the **model's output** (3 revenue + PAT history rows) although the agents receive no financial data at all. A fabricated 3-year history is therefore labelled "full / audited". | `app/agents/orchestrator.py:316-324,622`; inputs `app/agents/tools.py:19-42`, `app/agents/analysis_agent.py:37-46`. Probe B: model-supplied history -> `data_sufficiency=full`, `is_audited=True`. | misleads | Derive sufficiency from supplied inputs only; discard model-originated financial series; "audited" = LLM ran **and** inputs were sufficient. | S-M | **FIXED** (C16-C19 AI commit) |
| F12 | AI honesty | Prompts tell the model to return `null` for "not assessed" scores, but `_safe_int(None, default)` turns them into 70/65/75/75 and they enter the weighted score. | `app/agents/orchestrator.py:84-95,139`; `app/agents/prompts.py` NEWS prompt. Probe B: all-null model output -> breakdown 70/65/75/75, overall 62 (MODERATE_APPLY), `is_audited=True`. | misleads | Propagate `None`, exclude from weighted score or cap the report as preliminary. | S | **FIXED** (C16-C19 AI commit) |
| F13 | AI honesty | `has_drhp` is always False: the profile dict given to the orchestrator omits `drhp_url/rhp_url`, and nothing in the repo ever writes those columns. So every IPO (including open ones, which must have an RHP) shows "DRHP not yet filed". The `else` branch is dead code but would fabricate: OFS 25%, P/E 24.5, peer P/E 32, litigation 2% of issue, and hard-coded "HDFC, SBI, Nippon anchored" text. | `app/agents/orchestrator.py:154,441-444,526`; `app/agents/tools.py:19-42`; `grep drhp_url app` -> only model + orchestrator. Probe B: `rhp_url` set -> `drhp_status=NOT_FILED`. | misleads | Pass the URLs through; replace invented defaults by `None`/"not assessed"; **decision** on real DRHP ingestion vs rewording (see Docs). | S (fix) / L (ingestion) | **FIXED** (prospectus URLs passed through, invented defaults removed). Real DRHP ingestion NOT built (D1) |
| F14 | AI honesty | Prompt asks for `fair_value_estimate_inr`, `pe_ratio`, `peer_avg_pe`, `ofs_percentage`, `litigation_claims_cr` as `<float>` with no null escape, while the model sees only name/about/band/lot/GMP/subscription/stated strengths+risks. "SECTOR BENCHMARKS" passed to the model are a constant dict looked up with the IPO *type* (EQ/SME), so it always returns DEFAULT (pe 25). Financial-quality and valuation scores are therefore opinion on a text blurb. | `app/agents/prompts.py:41-47`; `app/agents/tools.py:83-92`; `app/agents/analysis_agent.py:34`. | misleads | Make these fields nullable/"not provided"; drop fake benchmarks or source them; reword UI. | S | **FIXED** (prompts allow null; fake benchmarks removed) |
| F15 | AI honesty | No-LLM fallbacks invent numbers: promoter score 75/60 and tailwinds 80/65 from GMP; fair value = band x 1.15; allocation fallback `capital_efficiency_score: 85` without `analysis_failed`. The orchestrator discards the first two (preliminary path) but the allocation dict is returned as if produced. | `app/agents/news_agent.py:61-75`, `analysis_agent.py:62-76`, `allocation_agent.py:64-83`. | misleads (minor) | Flag fallbacks `analysis_failed`/`source: heuristic`; drop fair value. | S | **FIXED** (fair value / efficiency score no longer invented; allocation fallback flagged) |
| F16 | Frontend | Mock data is shown to **admin/real** sessions: ASBA locks and reports return MOCK when the API errors **or returns an empty list**; IPO list falls back to MOCK_IPOS; allocation plan falls back to MOCK_ALLOCATION_PLAN; dashboard/IPO/report pages seed state with MOCK_* (real users see fake funds/orders until fetch completes, forever on failure). | `web/src/lib/api-client.ts:260,533,548,764,836`; `web/src/app/dashboard/page.tsx:44-49`; `web/src/app/ipos/page.tsx:13-14`; `web/src/app/reports/page.tsx:40-44`; `web/src/app/ipos/[id]/page.tsx:35,40`. | misleads | Mock only for guest sessions or `NEXT_PUBLIC_USE_MOCK`; real sessions get empty/error states. | M | **FIXED** (C20) |
| F17 | Frontend | Saving settings reports success when the API is unreachable: `handleResponse(res,{success:true})` returns the fallback on 503. | `web/src/lib/api-client.ts:187-200,853`. | misleads | Use `handleMutationResponse` for writes. | S | **FIXED** (C21) |
| F18 | Settings | Settings page controls nothing: thresholds (`auto_apply_min_score`, `watch_min_score`, `avoid_below_score`), `max_allocation_pct`, `limit_buffer_pct`, `default_upi_vpa`, all notification toggles are stored but **no backend code reads them** (grep: 0 hits outside `routers/settings.py`); no notification sender exists (telegram/whatsapp defaults to **on**). Optimizer's `max_exposure_pct` and `StageSellRequest.buffer_percent` are also unused. | `app/routers/settings.py:20-40`; `app/services/optimizer_service.py:86`; `app/schemas/allotment.py:7`; `web/src/app/settings/page.tsx:17-18,58-70`. | misleads | Wire up the few that are cheap (UPI default, max allocation) or mark controls "not yet active" and default notifications to off. Decision. | S (label) / L (wire) | **PARTLY** (C18b: banner says what is inactive, notifications off by default, fake test alert removed). Controls still not wired (D5) |
| F19 | Optimizer honesty | Objective is not expected value: per-category weights 0.35/0.25/0.40 are arbitrary constants, there is no allotment-probability term, and bHNI capital always dominates; `expected_return_pct` shown to users is just GMP%. README promises "maximize expected portfolio profit". | `app/services/optimizer_service.py:329-337,452`. | misleads | Reword claims (or model allotment odds from subscription data). | S (reword) / L (model) | **REWORDED** (README no longer claims expected profit / certainty). Objective itself unchanged (D6) |
| F20 | Docs honesty | Several false README/landing/docs claims; see **Docs honesty** table below. | multiple | misleads | Reword as listed. | M | **FIXED** (C23, guarded by `tests/test_docs_honesty.py`) |
| F21 | Auth / config | Default `ENVIRONMENT=development` plus a **publicly known default `SECRET_KEY`** (in repo). If a deploy forgets `ENVIRONMENT=production`, JWTs are signed with that key and anyone can mint an ADMIN token; F01 simulation also stays on. Probe A signed its admin token with this default and every admin route accepted it. | `app/config.py:17-18,160-163`; `app/middleware/auth.py:36-47`. | latent (critical if misdeployed) | Refuse to start (or refuse to verify tokens) when `VERCEL`/Lambda is set and key is default or env isn't production. | S | **FIXED** (C12) |
| F22 | Info leak | Any unhandled exception returns `error`, exception type, path and the **full traceback** with `Access-Control-Allow-Origin: *` + credentials to the caller. Also `str(e)` in auth/optimizer 500s and the startup-failure fallback app serves a traceback to every path. | `app/middleware/logging.py:28-48` (this middleware swallows the exception before the generic handler in `app/main.py`); `app/routers/auth.py:239`; `app/routers/funds.py:346`; `apps/api/main.py`. Probe B: `RuntimeError("boom-secret-detail")` -> 500 body contains it plus `traceback` list, ACAO `*`. | latent | Generic body + request id; log server-side only. | S | **FIXED** (C10) |
| F23 | Access control | Public GET/POST with side effects or cost: `POST /reports/{id}/generate` needs no token (non-forced runs call the LLM when no report exists); `GET /reports` and `GET /reports/{id}` write to the DB (seed) and, on an empty DB, trigger live scraping; `POST /funds/optimize` is open CPU. (Probe A's 5-minute runtime suggests one of these did network work; unverified which.) | `app/routers/reports.py:19-40,92-97,112-135`; `app/routers/funds.py:174-182`. Probe A: all 200 with no token. | latent | Require admin for generate; make GETs read-only; keep optimize guest-able but rate-limited. | S | **FIXED** (C11) |
| F24 | Access control | WebSocket: no auth outside production; in production any valid token (including GUEST) is accepted, and `broadcast_event` pushes ORDER_PLACED / ALLOTMENT_RESULT payloads (account name, IPO, amount) to **every** connected client. WS cannot work on Vercel serverless anyway. | `app/routers/websocket.py:43-84`; senders in `order_service.py`. **Code reading only; not probed.** | latent | Require ADMIN role for the stream, or send only to admin sockets. | S | **FIXED** (C14) |
| F25 | Auth | `X-API-Key` falls back to `SECRET_KEY` (and `master_api_key` is auto-set to it in prod), so the JWT-signing secret doubles as an admin credential; `environment == "test"` grants ADMIN with no credentials. TOTP: no attempt limit/replay protection; on serverless the TOTP secret is derived from `SECRET_KEY` when `ADMIN_TOTP_SECRET` is unset, so 2FA is not an independent factor there. | `app/middleware/auth.py:112-128`; `app/config.py:124-135`; `app/routers/auth.py:193-213,248-264`. | latent | Require explicit `MASTER_API_KEY`; delete env-based bypass; add attempt limiter; fail startup on serverless without `ADMIN_TOTP_SECRET`. | S | **FIXED** (C13) |
| F26 | Schema | Alembic does not match models: no migration for `family_accounts.pan/has_ddpi/tpin`, `ai_reports.is_audited/financial_metrics/gatekeepers/summary_source`, `ipos.isin`, or table `ipo_aliases` (grep of `alembic/versions` -> 0 hits). `npm run db:migrate` yields an incomplete DB. | `alembic/versions/*`; `app/models/{account,report,ipo}.py`. | latent | One catch-up migration. **Changes data model workflow - ask.** | M | **FIXED** (M0: idempotent catch-up migration `e5c3a9d41b27`; older migrations made idempotent; `alembic/env.py` imports all models and escapes `%` in URLs). Verified on a clean Postgres and by a rolled-back dry run against the real database |
| F27 | Schema | `init_db` runs `create_all` then `ALTER TABLE ... ADD COLUMN` inside one transaction with errors swallowed. On PostgreSQL a failed ALTER aborts the transaction, so the later commit becomes a ROLLBACK (including `create_all` on a fresh DB), and `BOOLEAN DEFAULT 0` is invalid on PG. | `app/db/database.py:64-80`. **Unverified:** no Postgres/Docker available; reasoned from PG semantics. | latent | Run via Alembic; per-statement autocommit / `IF NOT EXISTS`; `DEFAULT FALSE`. | M | **FIXED** (M0: PostgreSQL start-up only runs `create_all` for missing tables, no `ALTER`; data bootstrap split out; verified on a real Postgres) |
| F28 | Data integrity | No DB constraint on duplicate active orders (app check only; `scalar_one_or_none()` raises MultipleResultsFound -> 500 if two exist). `Allotment` has a unique (account, ipo); orders do not. | `app/models/order.py`; `app/services/order_service.py:111-122`. | latent | Partial unique index on (account_id, ipo_id) for active statuses - data-model change, ask. | M | open - deferred (D7: data-model change) |
| F29 | Allotment detection | Residual risk: NOT_ALLOTTED is inferred from **absence** of holdings at listing+3d (shares sold manually before then would be treated as not allotted and funds credited back); `totalqty + t1quantity` may double count (unverified); one failing order aborts the whole sweep (no per-order try). | `app/services/allotment_service.py:176-215`. | latent | Per-order try/except; require N consecutive successful empty checks; confirm T+1 field semantics. | S-M | **FIXED** (C08) |
| F30 | Optimizer | PuLP status `Not Solved` is accepted as success and the plan returned as `OPTIMAL` (empty entries on timeout); PuLP exceptions silently fall back to greedy with no log. Guest demo plan injects fictional "Jio Platforms Limited" etc. with invented GMP/score (labelled DEMO). | `app/services/optimizer_service.py:247-252,413`; `app/routers/funds.py:258-310`. | latent / misleads | Treat Not Solved as failure + warning; log fallback. | S | **FIXED** (C09) |
| F31 | Secrets | `encrypt_credential` returns **plaintext** on encryption error and `decrypt_credential` returns ciphertext on failure; PAN stored plaintext (masked in API - that part is FIXED); no PAN format validation, and a masked PAN sent back through `PUT /funds/accounts/{id}` would overwrite the real one (UI round-trip not checked); broker JWTs persisted in plaintext `.angel_sessions.json` (gitignored). Rotating `SECRET_KEY` breaks all stored broker secrets (Fernet key derived from it). | `app/utils/security.py:57,66,75`; `app/schemas/account.py:14,24`; `app/services/account_service.py:137,~212`; `app/services/angel_service.py:15,51-60`. | latent | Fail closed on crypto errors; validate PAN regex and reject masked values; document key rotation. | S-M | **FIXED** (C15) |
| F32 | Rate limiting / CORS | In-memory limiter is per-instance (no effect on serverless unless Redis), no stricter limit on auth/TOTP routes; CORS regex trusts any `kapital*/kapitl*.vercel.app` with credentials (auth is Bearer, so low risk); X-Forwarded-For trusted when the socket peer is private (could be spoofable behind some proxies - unverified for Vercel). | `app/middleware/rate_limit.py:51-100`; `app/main.py` CORS block. | latent | Redis limiter + per-route limits; tighten CORS to exact origins. | S-M | left (not planned): Redis limiter / exact-origin CORS |
| F33 | Broker integration | `POST /rest/secure/angelbroking/ipo/v1/apply` and its payload (`upiId`, `cutOff`...) are **unverified**: I know of no documented SmartAPI IPO-apply endpoint. If it doesn't exist every real bid fails (recorded FAILED, so safe), but README sells it. Also `X-MACAddress` header is the placeholder `02:00:00:00:00:00`. | `app/services/angel_service.py:178,598`; `app/config.py:204`. | latent / misleads | Confirm against Angel One docs with a sandbox before claiming. | S | **MITIGATED** (live IPO apply disabled by default). Endpoint itself still unverified |
| F34 | Tests | Frontend test is tautological: `smoke.test.ts` re-implements `calculateConvictionVerdict` inside the test and asserts on itself; its thresholds (80/65/50) differ from the backend (80/62/45, `orchestrator.py:50-58`). Only 5 frontend tests; CI doesn't run them. No backend tests for cron routes, scheduler jobs (listing sell / reconcile), `get_order_status`, websocket, cancel/allotment idempotency, RMS failure. `npm test` needs Node >= 22.6 (`--experimental-strip-types`) but README/SETUP say Node 18+. | `web/src/__tests__/smoke.test.ts:5-10`; `.github/workflows/ci.yml`; grep of `tests/`. | latent | Test real code; add CI step; add the missing backend tests (Phase 3 does most). | M | **FIXED** (C22: real-code frontend tests + CI step; backend tests added for cron, reconcile, cancel, WS, errors, auth) |
| F35 | Build / CI | CI: Python 3.12 only, `pnpm install --no-frozen-lockfile`, provisions Postgres/Redis but tests use in-memory SQLite (Postgres never exercised - see F27), no lint/frontend tests. Python 3.13 untested. docker-compose: web gets `NEXT_PUBLIC_API_URL=http://api:8000` (a hostname the browser can't resolve; also a build-time var) and no `API_URL`, so Next's rewrite targets `127.0.0.1:8000` *inside* the web container. api service bind-mounts `./apps/api` over `/app` with `ENVIRONMENT=development` (F01). **Docker daemon is not running here, so no image was built.** | `.github/workflows/ci.yml`; `docker-compose.yml:49-63`; `apps/web/next.config.mjs` rewrites. | latent (deploy) | Set `API_URL=http://api:8000` for web; fix CI matrix; add compose healthcheck. | S-M | **FIXED in files** (C24: build-arg API_URL, CI Node 22). Docker image NOT built - daemon unavailable |
| F36 | Frontend a11y/theme | 10 `aria-*` attributes across the whole app; 9 `outline-none` vs 2 `focus-visible/focus:ring` uses (keyboard focus mostly invisible). Landing components hardcode dark hex colors (`bg-[#0c0a09]` ...) while `globals.css:49` defines a light theme, so landing is probably unreadable in light mode (**from code only, not rendered**). Admin JWT is kept in `localStorage` (11 refs). | `web/src/styles/globals.css`, `web/src/components/landing/*.tsx`, `web/src/lib/auth-context.tsx`. | polish | Leave unless asked. | M | left (polish) |
| F37 | Repo hygiene | Committed: `.ai/` (8 "AI memory" files), `.cursor/rules`, `docs/plans/2026-11-01-production-readiness-remediation.md` (goal "100% production readiness"), dev script `apps/api/run_live_pipeline_dryrun.py` (logs into broker via `_seed_accounts_from_env`), hard-coded Google OAuth client ID default in `config.py` and `next.config.mjs` (public ID, but project-specific), personal GitHub URL in docs. `ADMIN_PIN` is validated in `config.py` but **no code reads it** while SETUP.md / `.env.example` / compose still instruct setting it. `scipy`/`numpy` are installed but never imported. | `git ls-files`; `grep admin_pin app`; `grep "import scipy" app`. | polish | Leave; fix the ADMIN_PIN doc drift when touching docs. | S | left (polish) |
| F38 | Swallowed errors | 32 `except Exception: ... pass` sites (grep). Most are best-effort broadcasts; the ones that matter are fixed under F27/F30. | `grep -rn "except Exception" app` | polish | Leave. | - | left (polish) |
| F41 | Data integrity | Card/badge components labelled a score with thresholds 70/55/40 while the backend report said 80/62/45 (score 75 = "Strong Apply" on a card, MODERATE_APPLY in the report). | `web/src/lib/formatters.ts:287-293` vs `app/agents/orchestrator.py` `get_recommendation`. | misleads | Align frontend to backend. | S | **FIXED** (C22) |
| F42 | Dependencies | `scipy==1.14.0` pinned but never imported; it has no Python 3.13 wheel. README claimed "Python 3.10+" but 3.13 does not install (`psycopg2-binary 2.9.9`, `aiohttp 3.10.0` also lack 3.13 wheels). | `requirements.txt`, `pyproject.toml`; py3.13 `pip install` log. | polish | Drop scipy; README says 3.10-3.12. | S | **FIXED** (chore commit) |

### Known-issues verdicts

| Known issue | Verdict | Evidence |
|---|---|---|
| Read routes treat missing/invalid tokens as "not guest" and return real data | **FIXED** | `get_viewer` (`middleware/auth.py:160-190`) maps none/invalid/2FA-pending/guest to demo. Probe A: no real marker (PAN, client ID, UPI, name) reached none/invalid/pending/guest on any route. |
| `PUT /funds/accounts/{id}` writable without admin | **FIXED** | `funds.py:123-128` uses `require_admin`; probe A: none/invalid/pending -> 401, guest -> 403. All 14 admin-only write routes behaved the same way (401 without a valid token, 403 for guest). |
| `/auth/login` accepts admin PIN (1234) or SECRET_KEY | **FIXED** | Route no longer exists (`routers/auth.py` has only google, verify-totp, guest-login, me). Residual: SECRET_KEY as `X-API-Key` (F25). |
| Cron auth falls back to SECRET_KEY | **FIXED** | `routers/cron.py:22-55`: dedicated `CRON_SECRET`, 503 if unset. (No test covers it - F34.) |
| TOTP re-enrols if `ADMIN_TOTP_SECRET` unset | **PARTLY FIXED** | Prod (non-serverless) refuses to start; serverless derives from `SECRET_KEY` (F25); dev still enrols (by design). |
| langchain 0.3.0 conflicts with tenacity 9.0.0; langchain unused | **FIXED** | `requirements.txt` has no langchain; fresh-venv install + `pip check` clean. |
| `apps/web/Dockerfile` copies nonexistent `packages/` | **FIXED** (by reading) | COPY lines only reference `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml*`, `apps/web`. Image not built (no Docker daemon). |
| Under compose the browser cannot reach the API | **CONFIRMED** (by reading) | F35. |
| Prompt asks model to estimate FY24-26 financials, never return nulls | **PARTLY FIXED** | Financial series and growth now say "empty/null if not provided"; scores and `pe/peer pe/ofs/litigation/fair value` still demanded (F14); result handling still fabricates (F11-F13). |
| Agents receive no financial or news data; no DRHP parsing | **CONFIRMED** | F11, F13. |
| README: DRHP scraping, per-agent Claude/Gemini, NSE/BSE/Chittorgarh/InvestorGain feeds, "SEBI EDGAR", trailing stop, test count, cost/latency | **MIXED** | README itself: test count "121+" is now TRUE (121 passed); "trailing stop" NOT FOUND in README or code (only a comment); DRHP/EDGAR/feeds/per-agent/cost/latency claims live in README + landing + `/docs` page - see Docs honesty. |
| Allotment detection: broker failure -> [] -> NOT_ALLOTTED | **FIXED** | `get_all_holdings` returns `None` on failure, caller defers (`allotment_service.py:136-143`); test `test_allotment_detection_skips_on_broker_failure` passes. |
| Allotted quantity uses applied qty not credited qty | **FIXED** | `allotted_qty=credited_qty` (`allotment_service.py:203`), partial handled in `order_service.py:~440`. |
| Symbol-substring fallback matching | **FIXED** | Matching is ISIN, exact symbol, or `{SYM}-IPO/-RE` only. |
| `test_orchestrator_due_diligence` needs a live LLM key | **FIXED** | Test patches the agents; suite passed offline with keys blanked. |
| api-client returns MOCK to admin sessions on failure/empty | **CONFIRMED** | F16. |
| Settings not read by backend; no notification sender | **CONFIRMED** | F18. |
| Allocation plan has no payment method (UPI Rs 5L) | **CONFIRMED** | F06. |
| PAN plaintext and returned by API | **PARTLY FIXED** | Returned masked (validator `AccountResponse._mask_pan`; probe: raw PAN never in any response). Still plaintext at rest (F31). |
| ~30 `except Exception: pass` | **CONFIRMED (32)** | F38. |
| No DB constraint prevents duplicate active orders | **CONFIRMED** | F28. |
| `findings.md`, `progress.md`, `task_plan.md` in repo root | **NOT REPRODUCIBLE** | Not in `git ls-files`, not in history deletions, absent on disk; they are in `.gitignore`. |
| `/design-preview` is public | **FIXED** | `design-preview/page.tsx:29-31` calls `notFound()` when `NODE_ENV==='production'` (build output still lists the route; not run in prod mode). |
| Alembic incomplete (ipo_aliases); `BOOLEAN DEFAULT 0` ALTERs | **CONFIRMED** | F26, F27. |
| Hard-coded `static_mac` | **FIXED / polish** | Now `STATIC_MAC` env with a placeholder default (F33). |
| Scheduled jobs never run on Vercel | **CONFIRMED** | F08. |

### AI pipeline: every number/claim in the UI that originates from model output
Deterministic (from feeds, not the model): GMP strength score (`gmp% x 2`), subscription momentum (`QIB x 8`, floor 20/50), `estimated_listing_price = band x (1 + GMP%)`, recommendation bands, the weighted-sum formula, and the preliminary score used when no LLM key exists (`gmp_s*0.6 + sub_m*0.4`, honestly tagged `is_audited=false`, `recommendation=PENDING`).
From the model: financial-quality, valuation-safety, promoter-integrity, industry-tailwinds scores (together 70% of the overall score), the overall score/recommendation derived from them, red-flag list + penalty points, strengths/risks text (when feed has none), executive summary, market-buzz rating, anchor-quality verdict, revenue/PAT/CFO history + growth + CFO/PAT ratio, P/E, peer P/E, OFS %, litigation claims and every gatekeeper PASS/WARN/FAIL built from them (currently suppressed by the F13 bug, which is the only reason they aren't shown).
Truthful states: "preliminary / PENDING / not audited" (no key or LLM failure) is honest. "Not assessed" for anchors is honest in text but F12 turns the null scores behind it into numbers, and `is_audited` / `data_sufficiency=full` (F11) are not truthful.

### Docs honesty (claim -> status -> corrected wording)

| Where | Claim | Status | Corrected wording |
|---|---|---|---|
| README Exec Summary 1; `/docs` page; landing | "synthesize verified prospectus data, peer P/E multiples ... explainable 6-dimension score" | FALSE - no prospectus or peer data is ingested | "An LLM summarises the IPO's feed metadata (price band, lot, GMP, subscription, listed strengths/risks) into a score. Prospectus (DRHP) parsing is not implemented." |
| README Tech Stack / Exec Summary | "Groq LLaMA-3.3-70B by default" | FALSE - default model is `openai/gpt-oss-120b` (`config.py:190`, `agents/base.py:23`) | "Groq (`openai/gpt-oss-120b` by default), or Anthropic/Gemini, one provider at a time via Settings." |
| `web/.../ComparisonSection.tsx:11`, `app/page.tsx:230`, `LiveArchitectureSimulator.tsx:39,268` | "Claude Haiku & Gemini Flash-Lite extract audited financials, promoter litigation and peer multiples in 30 seconds" | FALSE | "AI summary of feed data; financials, litigation and peer multiples are not extracted." |
| `docs/page.tsx:378,384,481-491`, `docs-data.ts:54` | per-agent Claude 3.5 Sonnet + Gemini 2.5 Flash; feeds "NSE / BSE / Chittorgarh / SEBI" | FALSE - one global provider; actual feeds are ipoalerts.in, Groww, ipowatch.in (`ipo_service.py`) | list the three real sources |
| `docs/page.tsx:484`, `docs-data.ts:34` | "Scrapes SEBI EDGAR filings" | FALSE (EDGAR is the US SEC system; no SEBI integration exists) | remove |
| `FaqSection.tsx:31-33` | "PyPDF ... 400-page DRHP pipeline", "under Rs 200/month" | FALSE / unmeasured - no PDF library in requirements | remove or mark roadmap |
| `docs/page.tsx:500`, `ProductHeroShowcase.tsx:475` | "under Rs 2.00 per audited report", "Sub-50ms Exchange Latency" | UNVERIFIED - nothing measures cost or latency | remove numbers |
| README Exec Summary 2 | MILP "maximize expected portfolio profit ... guaranteeing zero PAN duplication ... enforcing a 14-day ASBA fund reuse timeline" | MISLEADING - arbitrary weights, no allotment probability (F19); PAN rule holds within a plan, not at order time (F05); ASBA is a capital *reservation* heuristic with a 14-day lookahead, not constraint 4 | "Heuristic MILP that ranks bids by GMP x score and respects balances and one-bid-per-PAN within a plan." |
| README Exec Summary 3 / Highlights 4 | "autonomously executes 09:00 exits ... exactly once across distributed workers" | PARTLY FALSE - only where the in-process scheduler runs (not Vercel, F08); lock not actually distributed (F07); never exercised against a live broker | "Scheduled sell staging exists for self-hosted deployments; unverified against live Angel One." |
| README Highlights 3 | guest/unauth get isolated demo fixtures; PAN masked | TRUE for HTTP routes (probe A); WebSocket not covered (F24) | add WS caveat or fix F24 |
| README API list | `GET /api/funds/accounts` "admin-gated" | IMPRECISE - returns demo accounts to non-admins | "returns demo data unless signed in as admin" |
| README Setup | `uv run pytest apps/api/tests` from `apps/api`; Node 18+ | WRONG PATH; `npm test` needs Node >= 22.6 | `uv run pytest tests`; Node 22+ |
| README | "121+ automated tests" | TRUE (121 passed offline) | keep, or drop "+" |
| README Tech Stack | "SciPy - NumPy" | UNUSED (installed, never imported) | remove |
| SETUP.md / `.env.example` / compose | set `ADMIN_PIN` | STALE - no code reads it; omits `GOOGLE_CLIENT_ID`, `ADMIN_TOTP_SECRET`, `CRON_SECRET`; sample `ALLOWED_EMAIL=admin@kapitl.local` can't pass Google verification | document the real login flow and variables |
| `MarketTickerBar.tsx:15-60` | NIFTY/SENSEX levels and IPO GMP/score ticker | HARD-CODED sample values on a landing "ticker" | label "sample data" or wire to feed |
| README badge | live demo URL | not checked (no live service calls allowed) | - |

## Checked and fine
- **Read-route data isolation** (probe A: 5 identities x every non-auth, non-cron route; admin identity used on reads only): no seeded PAN/client ID/UPI/name reached none/invalid/2FA-pending/guest callers; admin saw client ID/name/UPI but never the raw PAN (masked). Demo payloads cached `public`, real ones `private, no-store` on `/funds/summary`.
- **Write-route protection:** all 14 admin-only mutating routes return 401 (none/invalid/pending) and 403 (guest).
- 2FA-pending temp tokens cannot be used as sessions (`decode_access_token`).
- Google login: audience check, `email_verified`, fail-closed `ALLOWED_EMAIL` whitelist, no default PIN login.
- Cron endpoints: dedicated secret, constant-time compare, 503 when unset.
- Production config validators (secret length, PIN, TOTP, Postgres-only) exist and are tested.
- Optimizer: category bounds, PAN uniqueness within a plan, per-account budget, date-guard on closed issues, reservation for upcoming IPOs (max-requirement approach is documented and tested); SME lot logic. Order creation validates category bands, balance, UPI shape, open status, row lock on Postgres.
- P&L maths: STT 0.1% sell side, DP charge, exchange/SEBI fees, GST, idempotent per allotment; two P&L endpoints reconcile (tests pass).
- Demo dataset reconciles across Dashboard/Funds/Orders/Allotments (existing `test_demo_dataset_reconciliation` passes; I did not re-derive it independently).
- No-LLM-key path produces an honest preliminary report (PENDING, not audited, null sub-scores).
- Dependency resolution on Python 3.10 fresh venv; frontend build, type check and lint pass; `.gitignore` covers `.env`, sessions, TOTP file, `*.db`; no secrets seen in tracked files I opened (I did not scan history).
- WebSocket and rate-limit exclusions for health/docs are intentional.

## Not verified (and why)
- **Anything against live services:** Angel One endpoints (including the IPO-apply endpoint), Google token verification, LLM output quality, the deployed Vercel site - calls forbidden.
- **PostgreSQL behaviour** (F27, migrations, row locks): no Postgres available; Docker daemon not running (`dockerDesktopLinuxEngine` pipe missing), so **no Docker build was run** and compose behaviour (F35) is from reading.
- **WebSocket leak** (F24) and Vercel XFF behaviour (F32): code reading only.
- **Which public route made probe A take ~5 minutes** (F23): not isolated.
- **Rendered UI** (light theme, mobile, a11y): no browser run; findings are from code/CSS only.
- Python 3.12/3.13 installs (only 3.10 tested); `uv` workflow and `uv.lock` consistency (not read).
- Git history was not scanned for committed secrets.
- Negative/zero `limit_price` acceptance in stage-sell (F09): probe output was lost; code reading only.
- Whether PAN masking round-trips destructively through the real settings/accounts UI (F31).

## Phase 2: Plan (awaiting approval)

Rule for every commit: failing test first -> fix -> relevant tests + full suite -> update AUDIT.md. After every 5 fixes: full backend tests, frontend build+tests, access-control probe (re-created as a permanent regression test `tests/test_route_auth_matrix.py` in step 0).

### Step 0 - regression harness (no behaviour change)
- C00: add permanent route x identity auth-matrix test (from probe A).

### Batch 1 - money safety (do first; all S, no product decision needed)
1. C01 F01 stop broker simulation for non-demo clients; persist/flag simulations.
2. C02 F03 RMS failure must not zero balances; define `logger`.
3. C03 F02 `get_order_status` UNKNOWN without session; reconcile only real fills.
4. C04 F04 allotment/cancel state guards, idempotent.
5. C05 F05 reject same-PAN duplicate active order.
   -> checkpoint (full suite + frontend + auth matrix)
6. C06 F09 stage-sell truthful result + price/status validation.
7. C07 F07 job lock uses `redis_url`.
8. C08 F29 per-order try/except in allotment sweep.
9. C09 F30 PuLP "Not Solved" = failure, log greedy fallback.

### Batch 2 - security / access (all S)
10. C10 F22 generic 500 body (no traceback, no ACAO `*`).
11. C11 F23 `generate` admin-only; GET /reports read-only.
12. C12 F21 refuse insecure default key/env on serverless.
    -> checkpoint
13. C13 F25 drop env-based test bypass; explicit `MASTER_API_KEY`; TOTP attempt limit.
14. C14 F24 WebSocket admin-only stream.
15. C15 F31 crypto fails closed; PAN validation, reject masked PAN on update.

### Batch 3 - AI honesty (S-M)
16. C16 F12 propagate null scores; no default numbers.
17. C17 F11 data_sufficiency/is_audited from inputs only.
18. C18 F13 pass drhp/rhp through; remove invented defaults (no ingestion).
19. C19 F14/F15 nullable prompt fields, drop fake benchmarks, flag heuristics.
    -> checkpoint

### Batch 4 - frontend honesty
20. C20 F16 mock data only for guest/`USE_MOCK`; real empty/error states.
21. C21 F17 settings save surfaces failure.
22. C22 F34 replace tautological frontend test with tests of real code; add CI step for web tests.
    -> checkpoint

### Batch 5 - docs/deploy wording (no logic)
23. C23 F20 reword README/landing/docs per Docs-honesty table; fix SETUP/ADMIN_PIN drift.
24. C24 F35 compose `API_URL`, CI tweaks.

### Needs YOUR decision before I touch it
| # | Item | Options | My recommendation |
|---|---|---|---|
| D1 | F13 DRHP | (a) reword claims only, (b) build real DRHP ingestion (L) | (a) |
| D2 | F08 cron on Vercel | Vercel Pro crons / GitHub Actions schedule / self-host scheduler | GitHub Actions calling `/api/cron/*` (works on Hobby, but best-effort timing, 09:00 sell may be minutes late) |
| D3 | F06 UPI >5L | add `payment_method` to plan schema + reject UPI >5L | yes (public schema change) |
| D4 | F10 cancel | restrict states + label "cancelled locally", or implement broker cancel (endpoint unverified) | label only |
| D5 | F18 settings | relabel unwired controls "not active" + notifications default off, or wire up | relabel |
| D6 | F19 optimizer claims | reword only, or model allotment odds (L) | reword |
| D7 | F26/F27/F28 schema | catch-up Alembic migration, safe `init_db`, partial unique index on active orders (data-model change; PG unverified) | do after you confirm a Postgres to test on |
| D8 | F33 Angel IPO endpoint | keep, or disable real IPO apply until verified | disable-with-clear-error unless you have docs |


### Decisions recorded
- D1 reword claims only (no DRHP ingestion). D2 GitHub Actions schedule calling `/api/cron/*` with `CRON_SECRET` (new commit C25, depends on repo secret `CRON_SECRET` + `API_BASE_URL` that you must set). D3 add `payment_method` to plan entries and reject UPI > Rs 5L (C26, public schema change approved). D8 disable real IPO apply with a clear error until the endpoint is verified (folds into C01).
- D4 label-only cancel, D5 relabel unwired settings + notifications default off, D6 reword optimizer claims, D7 schema work deferred until a Postgres is available - **taken at my recommendation, not explicitly confirmed**; tell me if any should change.

### Deliberately NOT fixing (polish)
F36 a11y/light theme, F37 repo hygiene (.ai/, dev script, OAuth client ID), F38 swallowed excepts, F32 CORS/rate-limit hardening (unless you ask).

### What only you can do (collect for Phase 4)
Set `ENVIRONMENT=production`, strong `SECRET_KEY`, `ADMIN_TOTP_SECRET`, `CRON_SECRET`, `ALLOWED_EMAIL`, `FERNET_KEY` in Vercel; rotate any key that has ever been in a local `.env` you shared; choose the cron mechanism (D2).

## Phase 3: Fix log
Test runner: audit venv (py3.10), AI/broker keys blanked, `--tb=line` (a failing assertion once printed the `Settings` repr - see note below).

| Commit | Finding | Test (written first, failed before fix) | Result |
|---|---|---|---|
| C00 | - | `tests/test_route_auth_matrix.py` (route x identity matrix, discovered via dependencies) | passes; 9 s |
| C01 | F01 + D8 | `tests/unit/test_apply_ipo_safety.py` (3 failed before) | real clients never simulated; live IPO apply off unless `ENABLE_LIVE_IPO_APPLY=true` |
| C02 | F03 | `tests/unit/test_rms_failure_safety.py` (4 failed before) | RMS failure returns `None`, balances untouched, `logger` defined |
| C03 | F02 | `tests/unit/test_reconcile_sells.py` (5 failed before) | P&L only from real, full fills at the real average price; UNKNOWN without session |
| C04 | F04 | `tests/unit/test_allotment_state_guards.py` (6 failed before) | allotment results only on live orders; repeats are idempotent |
| C05 | F05 | `tests/unit/test_same_pan_orders.py` (1 failed before) | same-PAN active order rejected before the broker is called |
| C06 | F09 | `tests/unit/test_stage_sell_truthful.py` (8 failed before) | stage-sell says "queued" vs "placed", `limit_price > 0`, only ACTIVE rows can be staged (409 otherwise) |
| C07 | F07 | `tests/unit/test_scheduler_lock.py` (2 failed before) | lock uses `settings.redis_url`; a second worker with empty memory is refused |
| C08 | F29 | `tests/unit/test_allotment_sweep_isolation.py` (1 failed before) | a failing order is rolled back and reported; others still processed |
| C09 | F30 | `tests/unit/test_optimizer_solver_status.py` (1 failed before) | "Not Solved"/error falls back to greedy and adds an explicit warning |
| C10 | F22 | `tests/test_error_responses_do_not_leak.py` (2 failed before) | generic 500 body, no traceback, no wildcard CORS; auth/optimizer/startup-fallback detail strings made generic |
| C11 | F23 | `tests/test_reports_no_side_effects.py` (5 failed before) | GET reports read-only (no seeding/scraping); non-admin `generate` returns cached/preliminary, never calls the LLM. Existing "guest can call generate" test kept and passes |
| C11b | F39 | `tests/unit/test_redis_backoff.py` (1 failed before) | failed Redis connect is not retried for 30 s; suite went 140 s -> 26 s |
| C12 | F21 | `tests/test_serverless_fails_closed.py` (1 failed before) | `VERCEL`/Lambda forces `environment=production`, so the public dev key is never used |
| C13 | F25 | `tests/test_auth_hardening.py` (3 failed before) | `SECRET_KEY` no longer works as `X-API-Key` (needs explicit `MASTER_API_KEY`), `ENVIRONMENT=test` bypass removed, 5 wrong TOTP codes -> 429 (per-instance memory; use Redis for a hard limit) |
| C14 | F24 | `tests/test_websocket_auth.py` (5 of 10 failed before) | WS requires an ADMIN token in every environment; web hook now sends its token and skips guests |
| C15 | F31 | `tests/unit/test_credential_and_pan_safety.py` (11 failed before) | encryption fails closed; PAN regex validated, masked PAN rejected. Confirmed the funds-page edit flow never sends `pan`, so no destructive round-trip |
| C16-19 | F11-F15 | `tests/unit/test_ai_report_honesty.py`, `tests/unit/test_ai_prompts_and_fallbacks.py` (16 failed before) | one commit instead of four: they edit the same orchestrator paths. Scores stay null, renormalised weights, "audited" only if the model scored something, model-invented financials ignored, gatekeepers "not assessed", prompts allow null |
| C20-22 | F16, F17, F34, F41 | `web/src/__tests__/data-policy.test.ts`, rewritten `smoke.test.ts` (6 failed before) | real sessions never get mock data, failed saves throw, UI verdict thresholds = backend, CI runs web tests on Node 22 |
| C26 | F06 (D3) | `tests/unit/test_upi_limit.py` | plan entries carry `payment_method`; UPI orders > Rs 5,00,000 rejected before the broker |
| C16b | F10 (D4) | `tests/unit/test_order_cancel_states.py` (6 failed before) | cancel only for live orders (409 otherwise), message says Kapitl-only |
| C25 | F08 (D2) | `tests/test_cron_endpoints_and_workflow.py` (workflow tests failed before; cron auth tests already passed = confirms they were fixed) | `.github/workflows/cron.yml` with 6 schedules + manual dispatch |
| C18b | F18 (D5) | `tests/unit/test_settings_honesty.py` | notifications off by default, inactive-controls banner, no fake test alert |
| C24 | F35 | `tests/test_compose_config.py` (2 failed before) | web image gets `API_URL` as a build arg (Next rewrites are build-time) |
| C23 | F20 | `tests/test_docs_honesty.py` (many offenders before) | ~45 false claims reworded across README, SETUP, docs, landing, UI |
| chore | F42 | `tests/test_requirements_hygiene.py` | unused scipy removed; README says Python 3.10-3.12 |

**Checkpoint 1 (after C05):** backend `147 passed`; `npm run build` OK; `npm test` 5 pass; auth matrix passes (part of the 147). Test-isolation fix in `tests/conftest.py`: the process-wide in-memory rate limiter is reset per test (more requests in the suite had started causing 429s). No assertion was changed or weakened.

**Checkpoint 2 (after C10):** backend `162 passed`; `npm run build` OK; `npm test` 5 pass; auth matrix included in the 162.

**Checkpoint 3 (after C15):** backend `200 passed` (26 s); `npm run build` OK; `npm test` 5 pass; auth matrix in the 200.

New findings during fixes:
- **F39 (latent):** while Redis is down, `get_redis_pool()` retries a connection (3 s timeout) on every request, from the rate limiter and others; the auth probe slowed from 9 s to 215 s because of this. `app/db/redis.py:15-38`. Not fixed (needs a back-off decision); the matrix test stubs it.
- **F40 (process):** a pytest failure printed the whole `Settings` object, which includes values read from the local `apps/api/.env` (Google client secret, admin TOTP secret, static IP). I never opened the file. **Treat those two secrets as exposed in this session transcript and rotate them if the transcript is shared.** Runner now uses `--tb=line`.

## Phase 4: Verification (final run, after the last commit)
- **Fresh venv** (Python 3.10, outside repo) + `pip install -r requirements.txt`: OK, `pip check` clean.
- **Backend:** `pytest tests` -> **256 passed** (121 at baseline), offline, AI/broker keys blanked, 17 s.
- **Route-auth regression:** `tests/test_route_auth_matrix.py` -> 4 passed (also part of the 256).
- **Frontend:** `npm run build` OK; `npm test` -> **13 passed** (5 at baseline, 1 file was tautological).
- **Docker:** NOT run - the Docker daemon is not running on this machine (`dockerDesktopLinuxEngine` pipe missing). Compose/Dockerfile changes are covered only by text-level tests.
- **Python 3.13:** does not install with the pinned requirements (psycopg2-binary 2.9.9 / aiohttp 3.10.0 lack wheels); README now says 3.10-3.12. Python 3.12 (CI's version) not available locally; not run.
- **PostgreSQL:** not available; F26-F28 remain open and unverified.
- **Live services:** none called (Angel One, Google, LLMs, deployed site).

### What remains open
| Item | Why |
|---|---|
| F26 Alembic catch-up migration, F27 safe `init_db` on PostgreSQL, F28 unique index on active orders | D7: data-model/DDL changes, need a Postgres to test on; recommend doing them together |
| F18 settings still not wired (thresholds, allocation cap, buffer, default UPI, notifications) | D5: relabelled only |
| F19 optimizer has no allotment-probability model | **resolved in M5**: bids are weighted by chance of allotment x expected listing gain |
| F10 no broker-side cancel | endpoint unverified |
| F33 Angel One IPO-apply endpoint/payload unverified | disabled by default (`ENABLE_LIVE_IPO_APPLY=false`) |
| F13 no DRHP ingestion | D1: wording only |
| F29 residual: NOT_ALLOTTED is still inferred from absence of holdings; T+1 quantity semantics unconfirmed | needs broker data |
| F32 limiter is per-instance memory; CORS regex for `kapital*.vercel.app` | polish, not requested |
| F36-F38 a11y/light theme, repo hygiene (`.ai/`, dev script), 32 swallowed excepts | polish, left as agreed |
| Deviations from "one finding per commit" | C16-19 (AI honesty) and C20-22 (frontend) were each committed together because they touch the same code paths |

### What YOU must do
1. **Rotate secrets that appeared in this session's tool output** (a test failure printed the settings object from your local `apps/api/.env`): the Google OAuth **client secret** and `ADMIN_TOTP_SECRET` (re-enrol the authenticator), and treat the static IP as disclosed. The files themselves were never opened or committed. Also rotate anything else that has ever been pasted into a shared transcript.
2. **Vercel environment:** `ENVIRONMENT=production`, strong `SECRET_KEY` (32+ chars), `ALLOWED_EMAIL`, `GOOGLE_CLIENT_ID`, `ADMIN_TOTP_SECRET` (otherwise serverless derives it from `SECRET_KEY`), `FERNET_KEY` (44-char Fernet key; **changing `SECRET_KEY`/`FERNET_KEY` later makes stored broker secrets undecryptable**), `CRON_SECRET`, `DATABASE_URL` (PostgreSQL), optional `MASTER_API_KEY` (X-API-Key is disabled without it), LLM key(s). Do **not** set `ENABLE_LIVE_IPO_APPLY=true` until the Angel One IPO-apply endpoint is verified.
3. **GitHub repo secrets** for the new workflow: `API_BASE_URL` (no trailing slash) and `CRON_SECRET` (same value as on the API). GitHub cron is best-effort - the 09:00 IST sell can start minutes late.
4. **Run the Alembic/PostgreSQL work (F26-F28)** when you have a Postgres instance, then re-run the suite against it.
5. **Smoke-test with a real login** after deploying: Google sign-in + TOTP, dashboard, one dry-run cron call (`workflow_dispatch` -> `allotment-poll`), and confirm WebSocket events only reach the admin session.
6. Decide whether to keep the legacy `ADMIN_PIN` start-up validation (still enforced for non-serverless production; unused for login).



## M0 addendum (2026-11-13): findings on the real database
- The Supabase database in `DATABASE_URL` is PostgreSQL 17, reachable only through the **session pooler** (the direct `db.<ref>.supabase.co` host is IPv6-only).
- It holds real data (38 IPOs, 11 reports, 1 account, 1 order, 1 allotment) and its `alembic_version` was stuck at the initial revision `c13dc79076eb`, with `system_settings` created outside Alembic. Missing: `ai_reports.{is_audited,financial_metrics,gatekeepers,summary_source}`, `family_accounts.{pan,has_ddpi,tpin}`, `ipos.isin`, tables `ipo_aliases`, `realized_pnl`, `fund_snapshots`, `score_history`.
- `alembic upgrade head` used to **crash** on that database (`system_settings already exists`) and on any fresh database that the app had started first. Both fixed and tested.
- **Near miss during testing:** the Supabase pooler ignores the `options=-c search_path=...` startup parameter, so a "scratch schema" test would have run in `public`. Nothing changed (the attempts rolled back), but destructive tests must never target the hosted database. Tests now use a throw-away local/CI Postgres and refuse hosted hosts.
- `python scripts/db_dry_run.py` (and the manual `db-migrate.yml` workflow, mode dry-run) applies the whole upgrade in one transaction, compares with the models and rolls back. Result on the real DB: `c13dc79076eb -> e5c3a9d41b27`, no remaining differences, row counts unchanged.


## Redesign milestones M3-M10 (2026-11-13)
- Built and tested: snapshots/outcomes (M3), Listing-Gain Engine + backtest (M4), allotment-odds optimizer (M5), offer-document pipeline (M6), red-flag rules (M7), nightly analysis job + workflow (M8), guest analysis API with a DB-enforced 50/day "Run audit" cap and report-page panel (M9). Details in `docs/plans/2026-11-12-ai-reports-redesign.md` section 23.
- Database (Supabase) is at `c2a7d9e45f61`. **Not yet applied:** `d3b8e0f56a72` (audit queue). Apply with the dry-run first.
- **Not verified:** the nightly job has never run against the real Groq API or real SEBI filings beyond one fetch test; the engine's thresholds are not calibrated (needs weeks of snapshots); the full flow on the deployed site has not been exercised.
- Still to do by you: GitHub secrets `DATABASE_URL` (session pooler, 5432), `GROQ_API_KEY`, `IPOALERTS_API_KEY`; Vercel env; rotate exposed keys (see list above).

## Follow-up (2026-11-13, autonomous pass)
- Database now at `d3b8e0f56a72`; `e4c9a1b73d58` (ipos dates nullable) pending until verified.
- **Found by the first live run:** (1) the Groq model needs `max_completion_tokens` and `reasoning_effort="low"` (a 600-token cap cut the JSON off: `json_validate_failed`) - fixed with a regression test; (2) the real database still had `ipos.issue_open_date` / `issue_close_date` NOT NULL (initial schema), so upcoming IPOs without dates could not be stored - migration `e4c9a1b73d58`; (3) my earlier "no structural differences" check ignored nullability - both the dry-run script and the model/migration test now flag `modify_nullable`.
- F36: keyboard focus ring restored for links and buttons (global rule). Landing-page light theme still unchecked (needs rendering).
- Docs section rebuilt (`/docs`, 13 pages from `apps/web/src/lib/docs-content.ts`); README updated.

## Second follow-up (2026-11-13)
- Critical red flags now need a verbatim quote that is found in the document excerpt; unverified claims are shown as high flags and cannot veto (found because a real run vetoed Hero Fincorp on one unchecked model answer).
- Nightly job: token budget, stop check before each chunk, exit code 1 when a source fails (GitHub notifies the owner).
- Test infrastructure: the pytest process did not exit after the tests passed (an aiosqlite connection opened through the application's own engine was never closed). Fixed in `tests/conftest.py`; CI would have hung on it.
- Smoke check of the built web app: `/`, `/dashboard`, `/ipos`, `/reports`, `/settings` and all `/docs/*` pages return 200, unknown docs pages 404. Not looked at in a browser.
