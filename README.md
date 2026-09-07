# IPO-Invest-Ai (Antigravity 🚀)
> Autonomous Multi-Account Indian IPO Trading & Investment Platform

The entire application code is located in the `antigravity/` directory.

---

## Quick Start (Windows PowerShell)

Open PowerShell in this folder (`C:\MY Coding\IPO-Invest-Ai`):

### Terminal 1: Start Backend (FastAPI on Port 8000)
```powershell
cd antigravity\apps\api
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```
* **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Terminal 2: Start Frontend (Next.js on Port 3000)
```powershell
cd antigravity\apps\web
pnpm install
pnpm dev
```
* **Dashboard URL**: [http://localhost:3000](http://localhost:3000)

---

For detailed documentation, architecture, and environment configuration, see:
👉 **[antigravity/README.md](antigravity/README.md)**
