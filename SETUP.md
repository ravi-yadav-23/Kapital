# Local Development Setup Guide

This guide walks you through running both the **FastAPI Backend** and the **Next.js Web Frontend** locally on your machine.

---

## 📋 Prerequisites
- **Node.js**: v22+ (needed for `npm test`, which uses `node --test` with TypeScript type stripping; `next build` alone works on 18.18+)
- **Python**: 3.10, 3.11, or 3.12
- **Package Manager**: `npm` or `pnpm`
- **Database**: SQLite (built-in, zero setup) or PostgreSQL 15+

---

## 1. Clone the Repository
```bash
git clone https://github.com/ravi-yadav-23/Kapital.git
cd Kapital
```

---

## 2. Backend Setup (FastAPI)

### Step 2.1 — Create Virtual Environment
```bash
cd apps/api
python -m venv venv

# On Windows:
.\venv\Scripts\activate

# On macOS / Linux:
source venv/bin/activate
```

### Step 2.2 — Install Pinned Dependencies
```bash
pip install -r requirements.txt
```

### Step 2.3 — Configure Environment Variables
Copy the example environment template:
```bash
cp ../../.env.example .env
```
Key variables (see `.env.example` for the full list):
```ini
ENVIRONMENT=development            # set to "production" on any internet-facing deploy
SECRET_KEY=<random 32+ chars>      # signs login tokens; never reuse the dev default in production
DATABASE_URL=sqlite+aiosqlite:///../../kapitl_local.db   # PostgreSQL required in production

# Admin sign-in is Google + authenticator app (TOTP). There is no PIN login.
GOOGLE_CLIENT_ID=<your Google OAuth web client id>
ALLOWED_EMAIL=<the one Google account allowed to sign in as admin>
ADMIN_TOTP_SECRET=<base32 secret; leave empty locally to enrol on first sign-in>

# Needed only if something calls /api/cron/* (GitHub Actions workflow, Vercel cron...)
CRON_SECRET=<random 32+ chars>

# Legacy: no code reads it for login any more, but non-serverless production start-up validation
# still requires a non-trivial value.
# ADMIN_PIN=
```
Without a Google account matching `ALLOWED_EMAIL` you cannot sign in as admin; the "Explore as Guest" button works with no setup and only shows sample data.

### Step 2.4 — Start the API Server
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Docs: `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/health`

---

## 3. Frontend Setup (Next.js 14)

Open a new terminal window:

### Step 3.1 — Install Frontend Dependencies
```bash
cd apps/web
npm install
```

### Step 3.2 — Configure Frontend Environment
Create `apps/web/.env.local`:
```ini
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
```

### Step 3.3 — Start the Dev Server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

## 4. Running Tests

### Backend Unit & Integration Tests
```bash
cd apps/api
pytest tests/unit tests/integration -v
```

### Frontend Typecheck & Production Build
```bash
cd apps/web
npm run build
```


## Nightly analysis (GitHub Actions)

The workflow `.github/workflows/nightly-analysis.yml` runs at 02:00 IST (20:30 UTC). It syncs the IPO sources and then analyses offer documents with the free Groq tier, open IPOs first.

Repository secrets (Settings > Secrets and variables > Actions):

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **session pooler** URL (port 5432). The port is part of the URL; the transaction pooler (6543) also works. |
| `GROQ_API_KEY` | Groq free-tier key |
| `IPOALERTS_API_KEY` | ipoalerts key (optional) |
| `GEMINI_API_KEY` | Google Gemini key (optional). Backup model when Groq's limit is reached, and the last-resort web search. Optional environment variables `GEMINI_MODEL` and `GEMINI_SEARCH_MODEL` change the models (Google retires models, for example the 2.5-series Flash model is announced to be replaced on 2026-12-01). |

Run it by hand from the Actions tab (Run workflow). The optional inputs `max_chunks`, `max_ipos` and `max_tokens` keep a test run small, for example 8 / 3 / 40000. The job exits with an error when a data source fails, so GitHub shows the run as failed and emails the repository owner.

Apply database migrations (`alembic upgrade head`, after `python scripts/db_dry_run.py`) before the first run, otherwise the new tables do not exist.

**Gemini web search and cost.** Web-search grounding is free of charge only on the Gemini 2.5 models (up to 500 requests a day, per Google's pricing page at the time of writing). Newer models need a paid account (the first 5,000 searches a month are free, then USD 14 per 1,000). If the search model stops working the web tier finds nothing and the job carries on. Set `WEB_RESEARCH_ENABLED=false` to turn the web tier off, and `NIGHTLY_MAX_WEB_LOOKUPS` (default 8) to limit searches per night.
