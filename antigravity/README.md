# Antigravity 🚀
> Autonomous Multi-Account Indian IPO Trading & Investment Platform — Version 1

## Architecture
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + Lucide Icons + Recharts (`http://localhost:3000`)
- **Backend**: FastAPI (Python 3.10+) + SQLAlchemy (Async) + Alembic (`http://localhost:8000`)
- **Database**: PostgreSQL (Supabase / Local) + Redis (Cache & Tasks)
- **AI Agents**: Groq (LLaMA 3.3 / GPT-OSS 120B / Qwen 27B), Google Gemini (1.5 Flash), Anthropic Claude (3.5 Haiku)
- **Broker**: Angel One SmartAPI (Multi-account TOTP login, live RMS funds sync, 09:00 AM listing sell automation)
- **Optimization**: PuLP MILP Mathematical Solver (Automated Retail vs sHNI allocation across family accounts)

---

## Modules (V1)
| Module | Description |
|--------|-------------|
| **IPO Discovery** | Live scraping of Open, Upcoming, and Closing Today Indian IPOs (Mainboard & SME) |
| **Score Engine** | Multi-dimension AI scoring (GMP, financials, promoter integrity, valuation, momentum) |
| **Fund Manager** | Multi-account family Demat tracker with dynamic sHNI/Retail capital optimization |
| **Order Engine** | ASBA mandate staging, fund lock tracking, and order lifecycle management |
| **Allotment Tracker** | Automatic Demat holding detection and 09:00 AM listing-day limit sell execution |
| **P&L Dashboard** | Real-time realized P&L, ROI analytics, and hit-rate breakdown |

---

## Getting Started & Start Commands

### Prerequisites
- **Node.js**: v18.17+ or v20+
- **Python**: 3.10+
- **Package Managers**: `pnpm` (`npm install -g pnpm`) and `pip`
- **PostgreSQL Database**: Supabase account (recommended) or local PostgreSQL instance

---

### Step 1: Configure Environment Variables

Create or update `apps/api/.env`:

```env
# Database (Supabase IPv4 Session Pooler or Local PostgreSQL)
DATABASE_URL=postgresql+asyncpg://postgres.xxxx:yourpassword@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
REDIS_URL=redis://localhost:6379/0

SECRET_KEY=generate-a-secure-random-string
ENVIRONMENT=development

# Angel One SmartAPI (JSON array of family Demat accounts)
ANGEL_ACCOUNTS_JSON=[{"name":"Ravi","relation":"Self","api_key":"your_api_key","client_id":"your_client_id","pin":"your_mpin","totp_secret":"your_totp_base32_secret"}]

# AI Due Diligence Keys (Groq / Gemini / Claude)
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
DEFAULT_AI_PROVIDER=groq
DEFAULT_AI_MODEL=openai/gpt-oss-120b

# Whitelisted Static IP & CORS
STATIC_IP=128.185.168.216
CORS_ORIGINS=["http://localhost:3000"]
```

---

### Step 2: Start the Backend (FastAPI)

#### 🪟 In Windows PowerShell:
Depending on which directory your PowerShell prompt is currently in:

**If your PowerShell is in `C:\MY Coding\IPO-Invest-Ai` (the outer folder):**
```powershell
cd antigravity\apps\api
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**If your PowerShell is in `C:\MY Coding\IPO-Invest-Ai\antigravity`:**
```powershell
cd apps\api
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

* **API URL**: `http://localhost:8000`
* **Interactive API Documentation (Swagger)**: `http://localhost:8000/docs`
* **Automated Background Scheduler**: Starts automatically on startup:
  - **08:30 AM IST (Mon–Fri)**: SmartAPI TOTP login & RMS live balance sync.
  - **09:00:00 AM IST (Listing Days)**: Pre-market limit sell order execution.
  - **05:00 PM IST (Mon–Fri)**: Daily post-market IPO scraper update.

---

### Step 3: Start the Frontend (Next.js)

Open a second PowerShell window and run:

**If your PowerShell is in `C:\MY Coding\IPO-Invest-Ai` (the outer folder):**
```powershell
cd antigravity\apps\web
pnpm install
pnpm dev
```

**If your PowerShell is in `C:\MY Coding\IPO-Invest-Ai\antigravity`:**
```powershell
cd apps\web
pnpm install
pnpm dev
```

* **Web Dashboard**: `http://localhost:3000`

---

### Alternative: Start from Monorepo Root (`antigravity`)

If running both through Turbo:

```powershell
# Make sure you are inside the antigravity directory:
cd "C:\MY Coding\IPO-Invest-Ai\antigravity"
pnpm install
pnpm dev
```

---

## Core Operations & Initial Setup

Once both servers are running:
1. **Sync Live Indian IPOs**:
   - Send `POST http://localhost:8000/api/ipos/sync` or view the **IPO Board** to populate live issues from `ipoalerts.in`.
2. **Sync Demat RMS Funds**:
   - Send `POST http://localhost:8000/api/funds/accounts/sync-all` or click **Re-Authenticate Demat Accounts** in the **Settings** tab.
3. **Switch AI Models On-the-fly**:
   - Go to `http://localhost:3000/settings` to switch between **Groq** (`openai/gpt-oss-120b`), **Google Gemini**, or **Anthropic Claude**. Choice persists automatically in PostgreSQL.

---

## Project Structure
```
antigravity/
├── apps/
│   ├── web/          # Next.js 14 frontend (Dashboard, Funds, Orders, Settings)
│   └── api/          # FastAPI backend (SmartAPI, PuLP Solver, AI Engine, Tasks)
├── packages/
│   ├── shared-types/ # Shared TypeScript types
│   ├── config/       # Shared config
│   └── score-engine/ # Score calculation utilities
├── infra/            # Deployment configurations (AWS, Docker, Nginx)
└── docs/             # Architecture and implementation notes
```
