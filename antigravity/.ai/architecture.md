# 🏗️ Architecture

## Monorepo Structure

```
antigravity/                          ← Turborepo monorepo root
├── apps/
│   ├── web/                          ← Next.js 14 (App Router) frontend
│   └── api/                          ← FastAPI Python backend
│       └── app/
│           ├── agents/               ← AI agent layer (brain)
│           │   ├── orchestrator.py   ← Coordinates all agents
│           │   ├── analysis_agent.py ← Claude Haiku: DRHP + scoring
│           │   ├── news_agent.py     ← Gemini Flash-Lite: GMP + sentiment
│           │   ├── allocation_agent.py ← Orchestrates PuLP solver
│           │   ├── prompts.py        ← ALL prompts in one place (do not inline)
│           │   └── tools.py          ← Callable functions agents use
│           ├── routers/              ← FastAPI route handlers (thin layer)
│           ├── services/             ← Business logic layer (where real work happens)
│           ├── models/               ← SQLAlchemy ORM models
│           ├── schemas/              ← Pydantic v2 request/response schemas
│           ├── tasks/                ← Celery async tasks + APScheduler cron
│           └── utils/
│               ├── score_engine.py   ← Pure math: combines agent inputs → 0-100 score
│               └── fund_optimizer.py ← PuLP constraint solver for fund allocation
├── packages/
│   ├── shared-types/                 ← TypeScript types shared between web + packages
│   ├── config/                       ← Shared config (ESLint, TypeScript base)
│   └── score-engine/                 ← Scoring weights (weights.ts) — frontend uses these too
└── infra/
    ├── docker/                       ← docker-compose.dev.yml, docker-compose.prod.yml
    ├── nginx/                        ← Nginx reverse proxy config
    ├── aws/                          ← EC2 + EIP setup scripts
    └── scripts/                      ← Deployment + maintenance scripts
```

---

## Tech Stack (Locked — Do Not Change Without Updating decisions.md)

### Frontend
| Tech | Version | Why |
|------|---------|-----|
| Next.js | 14 (App Router) | SSR + RSC for fast initial load of dashboard |
| Tailwind CSS | 3.4 | Utility-first, fast iteration |
| shadcn/ui | latest | Radix-based accessible components |
| TanStack Query | v5 | Server state + cache management, perfect for polling |
| Recharts | 2.x | P&L charts, lightweight vs Chart.js |
| Zustand | 4.x | Client state (selected IPO, active filters) |
| Axios | 1.7 | HTTP client with interceptors for auth |

### Backend
| Tech | Version | Why |
|------|---------|-----|
| FastAPI | 0.115 | Async Python, auto-docs, Pydantic v2 native |
| SQLAlchemy | 2.0 | Async ORM with typed queries |
| Alembic | 1.13 | DB migrations |
| Celery | 5.4 | Task queue for async jobs (allotment checks, order submissions) |
| Redis | 5.0 | Celery broker + cache + real-time pub/sub for WebSockets |
| APScheduler | 3.10 | Cron-style triggers (6am allotment check, daily IPO fetch) |
| WebSockets | built-in | Live order status, allotment updates pushed to frontend |

### AI Agents
| Agent | Model | Task | Why This Model |
|-------|-------|------|----------------|
| Analysis Agent | Claude Haiku 4.5 | DRHP analysis, financial quality scoring, red flags | Best cost/quality for structured document analysis |
| News Agent | Gemini 2.5 Flash-Lite | GMP signals, news sentiment, social hype | Cheapest capable model for high-volume news calls |
| Allocation Agent | Python PuLP + Claude | Constraint solving + orchestration | Math solver for correctness, Claude for scoring inputs only |

**CRITICAL RULE**: Agents produce *inputs to the scoring engine*. The score_engine.py and fund_optimizer.py make the final numbers. Agents never directly set final scores or allocation amounts.

### Database
| Tech | Purpose |
|------|---------|
| PostgreSQL 16 | Primary: accounts, IPOs, orders, allotments, P&L, reports |
| Redis | Celery broker + cache + WebSocket pub/sub |
| TimescaleDB (optional, V2) | GMP price history time-series |

### Infrastructure
| Component | Choice | Why |
|-----------|--------|-----|
| Dev environment | Docker Compose locally | Zero cost, everything runs on laptop |
| Prod (when live) | Single EC2 t3.small, AWS Mumbai | Cheapest viable option, ~₹1,800/month |
| Static IP | AWS Elastic IP | Mandatory from Apr 2026 (NSE circular) |
| CI/CD | GitHub Actions | Free for private repos |
| Monitoring | Grafana + Prometheus (future) | Open source, self-hosted |

---

## Data Flow (End to End)

```
[IPO Data Sources]
SEBI / NSE / BSE → ipo_service.py → PostgreSQL (ipo table)
                         ↓
                  [Nightly at 2am]
                  Celery task → orchestrator.py
                         ↓              ↓
               analysis_agent    news_agent
               (Claude Haiku)    (Gemini Flash)
                         ↓              ↓
                    score_engine.py  (combines all 6 inputs)
                         ↓
                  IPO.score + IPO.recommendation saved to DB
                         ↓
                  fund_optimizer.py (PuLP)
                  reads all open IPOs + account balances
                  outputs AllocationPlan per IPO × account
                         ↓
                  WebSocket push → Next.js dashboard updates

[Order Flow]
User clicks "Apply" → orders.router → angel_service.py
angel_service → Angel One SmartAPI → order placed
Celery task polls for confirmation → allotment_service.py
Allotment confirmed → AllotmentTracker updated (Active/Inactive)
If Active + listing imminent → pre-listing sell trigger
```

---

## Key Constraints

1. **Angel One SmartAPI requires TOTP login** — use `pyotp` to generate TOTP from stored secret. Login produces a JWT that expires — refresh on each session.
2. **Static IP mandatory from April 2026** — all Angel One API calls must originate from NSE-whitelisted static IP.
3. **ASBA fund lock-in** — when an IPO application is submitted, funds are blocked until allotment date. fund_optimizer must account for this when calculating available balance.
4. **10 accounts = 10 separate credential sets** — no shared login. Each has: `client_id`, `api_key`, `mpin`, `totp_secret`.
5. **Pre-listing sell window** — typically 15-30 minutes before market opens on listing day. Order must be pre-staged and triggered automatically by APScheduler.
