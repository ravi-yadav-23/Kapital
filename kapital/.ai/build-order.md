# 🗓️ Build Order — Module Sequence and Status

## Strategy: Frontend First

**Decision (2026-08-30)**: Build frontend FIRST with mock data, then wire to real backend.
**Why**: Frontend with mock data lets Ravi see/validate the UI before backend is built.
Avoids building backend features that don't match what the UI actually needs.

**Data sources confirmed**:
- IPO data: ipoalerts.in API (`IPOALERTS_API_KEY` in `.env`)
- Broker API: Angel One SmartAPI (free)
- AI analysis: Claude Haiku (DRHP) + Gemini Flash-Lite (news/GMP)
- Subscription rates: Custom scraper (NSE/Chittorgarh)

**Account count**: Dynamic (not fixed at 10). Dev seed = 5 placeholder accounts.

**AI model split for frontend building**:
- Gemini 2.5 Pro → visual/layout components (cheaper, fast)  
- Claude Sonnet Thinking → logic-heavy components (ApplyModal, AllocationTable, hooks)

---

## Build Sequence

### Phase 1: Data Foundation
*Everything else depends on this being correct*

| # | Module | File(s) | Status | Notes |
|---|--------|---------|--------|-------|
| 1.1 | Database models | `models/ipo.py`, `models/account.py`, `models/allotment.py`, `models/order.py`, `models/fund.py`, `models/pnl.py`, `models/report.py` | ⬜ TODO | All currently empty |
| 1.2 | Pydantic schemas | `schemas/` | ⬜ TODO | Mirror models for API I/O |
| 1.3 | DB connection + Alembic migration | `db/database.py`, first migration | ⬜ TODO | Async SQLAlchemy setup |
| 1.4 | Shared TypeScript types | `packages/shared-types/src/` | ⬜ TODO | ipo.ts, account.ts, fund.ts, allotment.ts |

### Phase 2: Core Services (No AI Yet)
*Pure data + business logic, no agents*

| # | Module | File(s) | Status | Notes |
|---|--------|---------|--------|-------|
| 2.1 | IPO service | `services/ipo_service.py` | ⬜ TODO | Fetch + parse + store IPO data |
| 2.2 | Account service | `services/account_service.py` | ⬜ TODO | CRUD for family member accounts |
| 2.3 | Angel One service | `services/angel_service.py` | ⬜ TODO | Auth, TOTP, order placement |
| 2.4 | Fund service | `services/fund_service.py` | ⬜ TODO | Balance tracking + ASBA locks |

### Phase 3: Scoring Engine (Pure Math)
*No AI, just the math that combines agent outputs*

| # | Module | File(s) | Status | Notes |
|---|--------|---------|--------|-------|
| 3.1 | Score engine | `utils/score_engine.py` | ⬜ TODO | Weighted average + red flag penalties |
| 3.2 | Fund optimizer | `utils/fund_optimizer.py` | ⬜ TODO | PuLP constraint solver |
| 3.3 | Score weights TS | `packages/score-engine/weights.ts` | ⬜ TODO | Frontend uses same weights |

### Phase 4: AI Agents
*Now we plug in Claude + Gemini*

| # | Module | File(s) | Status | Notes |
|---|--------|---------|--------|-------|
| 4.1 | Prompts | `agents/prompts.py` | ⬜ TODO | All prompts in one file |
| 4.2 | Analysis agent | `agents/analysis_agent.py` | ⬜ TODO | Claude: DRHP analysis |
| 4.3 | News agent | `agents/news_agent.py` | ⬜ TODO | Gemini: GMP + sentiment |
| 4.4 | Allocation agent | `agents/allocation_agent.py` | ⬜ TODO | Orchestrates optimizer |
| 4.5 | Orchestrator | `agents/orchestrator.py` | ⬜ TODO | Coordinates all agents |
| 4.6 | Agent tools | `agents/tools.py` | ⬜ TODO | Callable function definitions |

### Phase 5: Background Tasks
*Celery jobs + scheduled triggers*

| # | Module | File(s) | Status | Notes |
|---|--------|---------|--------|-------|
| 5.1 | Celery app | `tasks/celery_app.py` | ⬜ TODO | Celery init + config |
| 5.2 | IPO tasks | `tasks/ipo_tasks.py` | ⬜ TODO | Daily IPO fetch, score update |
| 5.3 | Allotment tasks | `tasks/allotment_tasks.py` | ⬜ TODO | Poll allotment status |
| 5.4 | Order tasks | `tasks/order_tasks.py` | ⬜ TODO | Pre-listing sell trigger |
| 5.5 | Scheduler | `tasks/scheduler.py` | ⬜ TODO | APScheduler cron config |

### Phase 6: API Layer
*FastAPI routers — thin wrappers over services*

| # | Module | File(s) | Status | Notes |
|---|--------|---------|--------|-------|
| 6.1 | Health router | `routers/health.py` | ⬜ TODO | Already stubbed in main.py |
| 6.2 | IPOs router | `routers/ipos.py` | ⬜ TODO | CRUD + trigger scoring |
| 6.3 | Accounts router | `routers/accounts.py` | ⬜ TODO | Family account management |
| 6.4 | Funds router | `routers/funds.py` | ⬜ TODO | Balance + allocation plan |
| 6.5 | Orders router | `routers/orders.py` | ⬜ TODO | Place + track orders |
| 6.6 | Allotments router | `routers/allotments.py` | ⬜ TODO | Allotment status |
| 6.7 | Reports router | `routers/reports.py` | ⬜ TODO | P&L + IPO reports |
| 6.8 | WebSocket | `routers/websocket.py` | ⬜ TODO | Real-time push |

### Phase 7: Frontend
*Next.js 14 App Router — pages and components*

| # | Module | File(s) | Status | Notes |
|---|--------|---------|--------|-------|
| 7.1 | Dashboard layout | `app/layout.tsx`, sidebar, topbar | ✅ DONE | Dark theme, live IST clock, sync |
| 7.2 | Command Center Home | `app/dashboard/page.tsx` | ✅ DONE | 4 StatCards, Tabbed IPO Board, Solver Table, Activity Feed |
| 7.3 | IPO Discovery page | `app/ipos/page.tsx` | ✅ DONE | Open/upcoming/closing cards |
| 7.4 | IPO Detail page | `app/ipos/[id]/page.tsx` | ✅ DONE | Score radar, red flags, prospectus breakdown |
| 7.5 | Fund Manager page | `app/funds/page.tsx` | ✅ DONE | Multi-demat balances + solver table |
| 7.6 | Orders page | `app/orders/page.tsx` | ✅ DONE | Order audit history |
| 7.7 | Allotments page | `app/allotments/page.tsx` | ✅ DONE | Active/Inactive/Sold tracker |
| 7.8 | Reports page | `app/reports/page.tsx` | ✅ DONE | AI Due Diligence view |
| 7.9 | Settings page | `app/settings/page.tsx` | ✅ DONE | NSE Static IP & AI engines |

---

## Status Legend
- ⬜ TODO — not started
- 🔨 IN PROGRESS — currently being built
- ✅ DONE — complete and tested
- ❌ BLOCKED — waiting on dependency

---

## Current Status: Frontend V1 Operational ✅

**Next action**: Build Backend Phase 1 (Data models + schemas + DB setup + FastAPI endpoints)

