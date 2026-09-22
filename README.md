<div align="center">

# 🚀 Kapitl

### Autonomous Multi-Account Indian IPO Allocation & Trading Engine

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

<p align="center">
  A state-of-the-art algorithmic platform designed to maximize IPO allotment odds, automate family Demat capital allocation across Retail and sHNI quotas, track ASBA fund locks, and execute pre-market listing-day sell orders.
</p>

</div>

---

## 📑 Table of Contents
- [System Architecture](#-system-architecture)
- [Key Capabilities](#-key-capabilities)
- [Repository Structure](#-repository-structure)
- [Prerequisites](#-prerequisites)
- [Quick Start Guide](#-quick-start-guide)
  - [1. Configure Environment Variables](#1-configure-environment-variables)
  - [2. Start the Backend API](#2-start-the-backend-api)
  - [3. Start the Web Frontend](#3-start-the-web-frontend)
- [SEBI ASBA Regulatory Framework](#-sebi-asba-regulatory-framework)
- [Automated Background Schedules](#-automated-background-schedules)
- [REST API Reference](#-rest-api-reference)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Security & Credential Protection](#-security--credential-protection)

---

## 🏛 System Architecture

Kapitl bridges algorithmic operations research with real-time Indian stock exchange feeds and broker APIs.

```mermaid
graph TD
    A[Live Feeds: ipoalerts.in & ipowatch.in] -->|Scrape & Webhook| B(IPO Ingestion Pipeline)
    B --> C[(PostgreSQL Database)]
    C --> D[Multi-Factor Scoring Engine]
    D --> E[Multi-Agent AI Due Diligence: Groq / Gemini / Claude]
    
    F[Family Demat Accounts] -->|Angel One SmartAPI v3| G(RMS Funds & Holding Sync)
    G --> C
    
    C --> H[PuLP MILP Capital Optimizer]
    H -->|Optimal Category & Lot Allocation| I[ASBA Order Tracker]
    
    I -->|Allotment Confirmation| J[09:00:00 AM Listing Sell Executor]
    J -->|Limit Order via SmartAPI| K[NSE / BSE Exchanges]
    
    C --> L[Next.js 14 Web Dashboard]
    M[FastAPI WebSocket] -->|Real-time Telemetry| L
```

---

## ⚡ Key Capabilities

### 1. Dual-Stream Live Market Ingestion & Scoring
- **Primary Source**: Structured REST feed from `ipoalerts.in` (providing price bands, issue sizes, subscription figures across Retail/sHNI/bHNI/QIB, and exchange timelines).
- **Secondary Source**: Live Grey Market Premium (GMP) scraper from `ipowatch.in` with real-time percentage premiums and dynamic open/close date detection.
- **5-Factor Score Engine**: Quantitative scoring out of 100 factoring GMP demand, QIB subscription momentum, issue size liquidity, business quality, and controversy penalties.

### 2. Multi-Agent AI Due Diligence
- Parallel multi-agent analysis utilizing LLMs (**Groq LLaMA 3.3**, **Google Gemini 1.5 Flash**, or **Anthropic Claude 3.5 Haiku**).
- Automated generation of comprehensive reports: investment thesis, promoter integrity, valuation metrics, competitive advantages, key operational risks, and final verdict.

### 3. PuLP Mixed-Integer Linear Programming (MILP) Optimizer
- Mathematically allocates pooled family capital across multiple Demat accounts.
- Evaluates allotment probabilities between **Retail** (≤ ₹2 Lakhs) and **sHNI** (₹2 Lakhs – ₹10 Lakhs) categories.
- Ensures capital deployment complies with account-specific balance limits and SEBI PAN-level application rules.

### 4. ASBA Capital Allocation & Order Tracker
- Records and monitors capital blocked under ASBA (Application Supported by Blocked Amount).
- Reconciles funds across individual family accounts, preventing double-allocation and overdrafts.
- Dynamic UPI VPA routing for mandate approval notifications.

### 5. Listing-Day Automated Limit Sell Execution
- Background daemon checks Demat holdings at 08:30 AM on IPO listing dates.
- Upon allotment confirmation, stages and fires limit sell orders at **09:00:00 AM IST** (exchange pre-market call auction) through Angel One SmartAPI, locking in listing gains.

---

## 📁 Repository Structure

```
IPO-Invest-Ai/
├── apps/
│   ├── api/                     # FastAPI Backend Application
│   │   ├── alembic/             # Database migrations
│   │   ├── app/
│   │   │   ├── agents/          # Multi-Agent AI due diligence engine
│   │   │   ├── db/              # Async SQLAlchemy engine & session setup
│   │   │   ├── middleware/      # Rate limiting & JWT authentication
│   │   │   ├── models/          # PostgreSQL data models
│   │   │   ├── routers/         # REST & WebSocket API endpoints
│   │   │   ├── schemas/         # Pydantic validation schemas
│   │   │   ├── services/        # SmartAPI, Bank, and IPO business logic
│   │   │   ├── tasks/           # Background scheduler & scrapers
│   │   │   └── utils/           # Score engine & Fernet encryption
│   │   └── tests/               # Pytest test suite (Integration & Unit)
│   └── web/                     # Next.js 14 Frontend Application
│       ├── src/
│       │   ├── app/             # App Router pages (Dashboard, IPOs, Funds, Orders, Settings)
│       │   ├── components/      # Reusable UI cards, tables, and modal dialogs
│       │   ├── lib/             # API client, WebSocket hooks, and formatters
│       │   └── types/           # TypeScript domain definitions
│       └── public/              # Static assets & icons
├── packages/
│   ├── config/                  # Shared linting and environment defaults
│   ├── score-engine/            # Algorithmic score engine
│   └── shared-types/            # Shared cross-service TypeScript interfaces
├── infra/                       # Deployment manifests (Docker, Nginx, AWS)
├── docs/                        # Architecture decisions & API specs
├── .env.example                 # Root environment template
└── README.md                    # Project documentation
```

---

## 🛠 Prerequisites

- **Node.js**: v18.17+ or v20+
- **Python**: 3.10+
- **Package Managers**: `pnpm` (`npm install -g pnpm`) or `npm`, and `pip`
- **PostgreSQL**: Local PostgreSQL 15+ or a cloud instance ([Supabase](https://supabase.com) recommended)
- **Redis** *(Optional for local development)*: For Celery/caching

---

## 🚀 Quick Start Guide

### 1. Configure Environment Variables

Copy `.env.example` to `apps/api/.env`:

```powershell
cp .env.example apps/api/.env
```

Edit `apps/api/.env` with your settings:

```env
# Database (PostgreSQL with asyncpg)
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/kapitl
REDIS_URL=redis://localhost:6379/0

# App Security
SECRET_KEY=your-secure-random-32-byte-secret-key
ADMIN_PIN=7090
ENVIRONMENT=development
CORS_ORIGINS=["http://localhost:3000"]

# Angel One SmartAPI (Family Demat Accounts)
# Sensitive values are automatically encrypted at rest in the DB using Fernet
ANGEL_ACCOUNTS_JSON=[{"name":"Self","relation":"Self","api_key":"your_smartapi_key","client_id":"your_client_id","pin":"your_mpin","totp_secret":"your_totp_base32_secret"}]

# AI Providers (Choose your preferred provider; Groq offers the fastest inference)
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
DEFAULT_AI_PROVIDER=groq
DEFAULT_AI_MODEL=openai/gpt-oss-120b

# Live IPO Data Feed
IPOALERTS_API_KEY=your_free_key_from_ipoalerts.in

# NSE Whitelisted Static IP (optional in development)
STATIC_IP=
```

Frontend environment configuration (`apps/web/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

---

### 2. Start the Backend API

Open a terminal in the repository root:

```powershell
cd apps\api

# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Run database migrations
alembic upgrade head

# 3. Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

- **Backend API**: `http://localhost:8000`
- **Swagger Documentation**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`

---

### 3. Start the Web Frontend

Open a second terminal in the repository root:

```powershell
cd apps\web

# 1. Install dependencies
pnpm install

# 2. Start Next.js development server
pnpm dev
```

- **Web Dashboard**: `http://localhost:3000`

---

## 📜 SEBI ASBA Regulatory Framework

> [!IMPORTANT]
> **Why retail trading APIs cannot directly place primary IPO bids:**
> Under Securities and Exchange Board of India (SEBI) circulars, retail IPO applications must be submitted exclusively via **ASBA (Application Supported by Blocked Amount)** through Self Certified Syndicate Banks (SCSBs) or via the **UPI 2.0 Mandate mechanism**.
> 
> Retail broker trading APIs (including Angel One SmartAPI, Zerodha Kite, and Upstox) are authorized by exchanges solely for **secondary market order routing** (equities, F&O, commodities). They do not permit programmatic submission of primary market IPO bids.
>
> **How Kapitl Handles This Transparently:**
> 1. **Bidding & Allocation Tracker**: Kapitl calculates the optimal mathematical lot allocation across family accounts and records the ASBA fund block.
> 2. **Mandate Submission**: You approve the UPI mandate or ASBA bid in your banking/broker application.
> 3. **Automated Secondary Market Execution**: Once allotted shares hit your Demat account, Kapitl automatically executes the pre-market limit sell order at **09:00:00 AM IST** via SmartAPI.

---

## ⏰ Automated Background Schedules

The built-in scheduler (`apps/api/app/tasks/scheduler.py`) manages recurring workflows automatically during Indian market hours (IST):

| Time (IST) | Frequency | Workflow Description |
|---|---|---|
| **08:30:00 AM** | Mon – Fri | Authenticates all family accounts via TOTP, refreshes JWTs, and synchronizes live RMS trading balances. |
| **09:00:00 AM** | Listing Days | Inspects Demat holdings for newly listed IPOs and triggers pre-market limit sell orders via SmartAPI. |
| **10:00:00 AM** | Market Days | Opens daily live order tracking and WebSocket status broadcasts. |
| **05:00:00 PM** | Mon – Fri | Synchronizes end-of-day subscription figures (QIB/NII/Retail) and updates score cards. |

---

## 📡 REST API Reference

### IPOs & Market Data
- `GET /api/ipos` — Retrieve IPO list with status, score, GMP, and filters (`status`, `type`, `min_score`).
- `GET /api/ipos/{id}` — Detailed information for a single issue including schedules and subscription breakdown.
- `POST /api/ipos/sync` — Trigger manual data synchronization from `ipoalerts.in` and `ipowatch.in`.

### Fund Management & Demat Accounts
- `GET /api/funds/summary` — Aggregate family capital, available balances, and ASBA locked funds.
- `GET /api/funds/accounts` — List of configured family Demat accounts and individual utilization.
- `POST /api/funds/accounts/sync-all` — Trigger RMS balance synchronization via SmartAPI.
- `POST /api/funds/optimize` — Run PuLP solver to generate an optimal allocation plan across family accounts.

### Orders & Execution
- `GET /api/orders` — Audit trail of all staged and placed IPO applications.
- `POST /api/orders/apply` — Stage an IPO application, record ASBA fund lock, and store UPI VPA.
- `POST /api/orders/cancel/{id}` — Cancel an application and release the ASBA fund lock.

### AI Due Diligence
- `GET /api/reports` — List generated multi-agent analysis reports.
- `POST /api/reports/generate/{ipo_id}` — Trigger on-demand multi-agent due diligence.

### System Settings
- `GET /api/settings` — Get application preferences and masked configuration.
- `POST /api/settings` — Update preferences (default UPI VPA, allocation limits, AI provider/model, alerts).

### Real-Time Updates
- `WS /ws` — WebSocket stream broadcasting live market updates, order changes, and balance syncs.

---

## 🧪 Testing & Quality Assurance

### Run Backend Unit & Integration Tests
```powershell
cd apps\api
python -m pytest -v
```
All **25 tests** cover security encryption, JWT lifecycles, route handling, PuLP optimizer logic, score engines, and multi-agent AI fallback.

### Validate Frontend TypeScript & Production Build
```powershell
cd apps\web
npm run build
```
Ensures all 11 routes compile cleanly with zero TypeScript or linting errors.

---

## 🔐 Security & Credential Protection

- **Symmetric Encryption at Rest**: Broker API keys, Client MPINs, and TOTP secrets are encrypted in PostgreSQL using **Fernet (AES-128 in CBC mode with HMAC-SHA256)** derived from your `SECRET_KEY`.
- **Zero Raw Credential Leakage**: Sensitive credentials and API tokens are masked (`gsk_...1234`) across all REST endpoints.
- **Configurable Authentication**: Admin login PIN is fully configurable via the `ADMIN_PIN` environment variable.

---

<div align="center">
  <sub>Built for precision, speed, and regulatory compliance in the Indian equity markets.</sub>
</div>
