# 📋 Architectural Decisions Log

---

## ADR-011: ipoalerts.in API as Primary IPO Data Source

**Date**: 2026-08-30  
**API Key**: `b5a488488ff4bc9cc2915535297aa7829faee2be8e244f17146074164353b43e` (stored in `.env` as `IPOALERTS_API_KEY`)  
**Decision**: Use ipoalerts.in free tier as primary structured IPO data source  
**Endpoint pattern**: `GET https://api.ipoalerts.in/ipos?status={open|upcoming|closed}`  
**Auth**: `Authorization: Bearer {api_key}`  
**Why**:
- Returns clean structured JSON: name, dates, priceRange, minQty, issueSize, logo, prospectusUrl, schedule, strengths, risks, about, mediaCoverageLinks
- Free tier: 750 req/month, 25/day, 6/min — sufficient for development and live tracking
- Pro plan (₹499/month) adds GMP addon + historical IPOs from 2012 + no daily cap
- Response already includes `schedule` array with allotment date, refund date, listing date — exactly what we need for ASBA lock-in calculation

**Free tier limitation**: Returns only 1 IPO per call (preview mode). Pro plan returns all. During development, supplement with manual seed data.

**Disclaimer constraint**: ipoalerts.in explicitly states data must NOT be used for real-time trading or automated decision-making. We use it for DISCOVERY ONLY. Actual order placement goes through Angel One SmartAPI.

**Data mapping from ipoalerts response**:
```
ipoalerts field → our DB field
id              → external_id
name            → name
startDate       → issue_open_date
endDate         → issue_close_date
priceRange      → price_band (parse "95-100" → min/max)
minQty          → lot_size
issueSize       → total_issue_size
prospectusUrl   → prospectus_url
schedule[].date → allotment_date, refund_date, listing_date (by event name match)
strengths[]     → stored as JSON in ipo.strengths
risks[]         → stored as JSON in ipo.risks
about           → company_description
logo            → logo_url
```

**Rejected**: NSE direct scraping (fragile HTML, breaks often), paid data feeds (₹3k–10k/month, unnecessary)

---

## ADR-012: Dynamic Account Count (Not Fixed at 10)

**Date**: 2026-08-30  
**Decision**: Family member account count is dynamic, not hardcoded at 10  
**Why**: Real-world usage — accounts can be added/removed. Could be 1 for solo use, could be 20 as family grows.

**Rules**:
- Accounts are stored in DB (not in `.env` JSON array — changed from initial design)
- The `ANGEL_ACCOUNTS_JSON` env var is removed in favour of DB-managed accounts
- Each account has: name, angel_client_id, angel_api_key (encrypted), mpin (encrypted), totp_secret (encrypted), is_active flag
- Fund optimizer runs across ALL `is_active = True` accounts dynamically
- Dev seed: 5 placeholder accounts for testing UI/fund manager without real credentials

**Rejected**: Fixed 10 in env (inflexible), hardcoded array (can't add at runtime)

Every major decision is logged here with: WHAT we decided, WHY, and what we rejected.
This prevents future AI assistants from second-guessing or "improving" decisions that were made deliberately.

---

## ADR-001: Angel One SmartAPI over Zerodha Kite

**Date**: 2026-08-30  
**Decision**: Use Angel One SmartAPI as the primary broker API  
**Why**:
- Angel One SmartAPI is **completely free** — no per-call charges, no API subscription fee
- Zerodha Kite API costs ₹2,000/month (₹24,000/year) for API access
- Angel One's IPO application endpoint is specifically built for ASBA orders — better fit
- All 10 family member accounts are already on Angel One

**Rejected**: Zerodha Kite (paid), Groww API (not mature enough), Upstox (limited ASBA support)

---

## ADR-002: PuLP Constraint Solver over Pure Claude Allocation

**Date**: 2026-08-30  
**Decision**: Fund allocation is done by PuLP linear program, NOT by Claude/LLM directly  
**Why**:
- LLMs are probabilistic — fund allocation must be mathematically deterministic
- PuLP guarantees mathematical correctness (maximizes expected return within constraints)
- Claude provides *scoring inputs* to the solver — it's the intelligence layer
- PuLP is the optimization layer — it makes the actual ₹ decisions
- This separation means allocation decisions are auditable and reproducible

**Rejected**: Pure Claude allocation (hallucination risk on amounts), pure rule-based system (not optimal)

---

## ADR-003: Claude Haiku for Analysis, Gemini Flash-Lite for News

**Date**: 2026-08-30  
**Decision**: Split AI workload by task type, not by unified model  
**Why**:
- Claude Haiku: Best for structured document analysis (DRHP = legal/financial PDF text)
  - Haiku's context window and instruction-following is excellent for structured JSON output
  - Cost: $0.80/$4 per million tokens (input/output)
- Gemini Flash-Lite: Best for high-volume, short-context news queries
  - Gemini has grounding/search capabilities built-in
  - Cost: $0.10/$0.40 per million tokens — 8x cheaper than Haiku for news calls
- Using the right model for the right task = better quality + lower cost

**Rejected**: GPT-4o mini (no free tier, more expensive), using Claude for news (overkill + expensive), using Gemini for DRHP analysis (inferior for long-doc structured extraction)

---

## ADR-004: Monorepo with Turborepo + pnpm

**Date**: 2026-08-30  
**Decision**: Single monorepo managed by Turborepo, pnpm workspaces  
**Why**:
- `packages/shared-types` can be imported by both `apps/web` (TypeScript) and used as reference by `apps/api`
- `packages/score-engine/weights.ts` ensures frontend displays the same weights used in backend
- Single `git` repo = single PR history, easier to track what changed together
- Turborepo caches builds — `pnpm dev` boots everything at once
- pnpm is significantly faster than npm for monorepos

**Rejected**: Separate repos (type drift between frontend/backend), Lerna (deprecated), Nx (overkill for this scale)

---

## ADR-005: Local Docker Dev, Single EC2 for Prod

**Date**: 2026-08-30  
**Decision**: No cloud during development; single EC2 t3.small for production  
**Why**:
- Development phase: ₹0/month. Everything (Postgres + Redis + API) runs via Docker Compose locally
- Production: Single t3.small (~₹1,800/month) with Docker — Postgres + Redis + API + Nginx all on one machine
- RDS + ElastiCache adds ~₹4,000/month for managed DB — not justified for a personal tool
- Static Elastic IP is mandatory (NSE whitelist requirement from Apr 2026)

**Scale trigger**: If the system grows to handle >100 IPO analyses/day or >50 concurrent API calls, then consider splitting services. Not before.

**Rejected**: Kubernetes (massive overkill), Serverless (cold starts incompatible with scheduled 9am sell triggers), RDS from day 1 (unnecessary cost)

---

## ADR-006: APScheduler for Cron, Celery for Async Jobs

**Date**: 2026-08-30  
**Decision**: Use both APScheduler (for cron) and Celery (for async task queue)  
**Why**:
- APScheduler: Best for time-critical exact-time triggers (sell order at 09:00:00 IST — must not drift)
- Celery: Best for async work queues (scoring 10 IPOs concurrently, polling 10 accounts simultaneously)
- They complement each other: APScheduler kicks off the trigger, Celery handles the parallel work

**Rejected**: Pure Celery beat (less precise timing control), pure cron (no async task management), AWS Lambda scheduled functions (adds cloud dependency + cold start latency)

---

## ADR-007: Pydantic v2 Throughout

**Date**: 2026-08-30  
**Decision**: All schemas use Pydantic v2 syntax  
**Why**:
- FastAPI 0.115+ is Pydantic v2 native — using v1 creates deprecation warnings
- v2 is 5-10x faster at validation
- `model_config = ConfigDict(from_attributes=True)` replaces old `orm_mode = True`

**NOTE for AI**: Never use `class Config: orm_mode = True` — this is Pydantic v1 syntax. Always use `model_config = ConfigDict(from_attributes=True)`.

---

## ADR-008: No Authentication System in V1

**Date**: 2026-08-30  
**Decision**: No user login/registration for V1. Single user (Ravi) assumed.  
**Why**:
- This is a personal tool, not a SaaS
- Auth adds complexity without value for a solo user
- API is not public-facing — only accessible from localhost or behind VPN
- Angel One credentials are stored encrypted in DB, not tied to platform user accounts

**Future**: If sharing with family members, add simple PIN-based auth. No JWT/OAuth needed.

---

## ADR-009: Scraping for IPO Data (Not Paid API)

**Date**: 2026-08-30  
**Decision**: Scrape NSE/BSE/IPO aggregators for IPO data instead of paying for data feed  
**Why**:
- NSE official website is free and has machine-readable data
- Paid IPO data APIs cost ₹3,000–₹10,000/month
- IPO data changes slowly (1-2 times per day for new listings) — scraping is sufficient
- We enrich with GMP data from investorgain.com + ipomonitor.com (also free)

**Risk**: Scrapers can break if website structure changes. Mitigation: use multiple sources, alert on parse failure.

---

## ADR-010: Cost-First Design Philosophy

**Date**: 2026-08-30  
**Decision**: Every architecture choice optimizes for cost first, then features  
**Why**:
- Ravi is a student building a personal tool — monthly cost must stay under ₹4,000/month at steady state
- Target: ₹0/month during development, ₹2,000–3,500/month when live
- AI costs minimized via: Haiku (not Sonnet), Batch API (50% discount), Flash-Lite (8x cheaper than Haiku for news)
- Infrastructure: single EC2, no managed DB, no CDN until traffic justifies it

**Monthly cost target breakdown**:
```
EC2 t3.small (on-demand): ~₹1,800
Elastic IP: ~₹300
Data transfer: ~₹200
AI APIs (Claude + Gemini): ~$1–2 = ₹85–170
Total target: ~₹2,400–2,500/month
```
