# Local Development Setup Guide

This guide walks you through running both the **FastAPI Backend** and the **Next.js Web Frontend** locally on your machine.

---

## 📋 Prerequisites
- **Node.js**: v18.18+ or v20+
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
Key variables to verify:
```ini
DATABASE_URL=sqlite+aiosqlite:///../../kapitl_local.db
SECRET_KEY=dev_secret_key_change_in_production
ALLOWED_EMAIL=admin@kapitl.local
ADMIN_PIN=123456
```

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
