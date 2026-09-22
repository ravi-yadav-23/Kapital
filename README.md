# Kapitl 🚀
> Autonomous Multi-Account Indian IPO Trading & Intelligence Platform

The entire application code is located in the `kapital/` directory.

---

## Quick Start (Windows PowerShell)

Open PowerShell in this folder:

### Terminal 1: Start Backend (FastAPI on Port 8000)
```powershell
cd kapital\apps\api
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```
* **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Terminal 2: Start Frontend (Next.js on Port 3000)
```powershell
cd kapital\apps\web
pnpm install
pnpm dev
```
* **Dashboard URL**: [http://localhost:3000](http://localhost:3000)

---

For detailed documentation, architecture, and environment configuration, see:
👉 **[kapital/README.md](kapital/README.md)**
