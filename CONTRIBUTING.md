# Contributing to Kapitl

Thank you for your interest in contributing to **Kapitl** — an autonomous multi-account IPO intelligence platform and trading engine.

## Code of Conduct
We are committed to providing a friendly, safe, and welcoming environment for all contributors, regardless of experience level.

---

## Development Workflow

### 1. Fork & Clone
```bash
git clone https://github.com/ravi-yadav-23/Kapital.git
cd Kapital
```

### 2. Branching Strategy
- `main`: Production-ready release branch.
- Feature branches: `feat/<feature-name>`, `fix/<bug-name>`, `style/<change>`.

### 3. Setting Up Locally
Please refer to [SETUP.md](./SETUP.md) for step-by-step local development setup instructions across both Next.js and FastAPI services.

---

## Code Quality Standards

### Frontend (Next.js / TypeScript)
- Use **DM Sans** (`var(--font-heading)`) for headings and **Inter** for body text.
- Follow the **Option A Warm Amber/Dark** design system tokens:
  - Base background: `#0c0a09`
  - Elevated surface: `#1a1612`
  - Border subtle: `#2d2520`
  - Primary accent: `#f59e0b` (Amber gold)
  - Success / Gain: `#22c55e`
  - Error / Loss: `#ef4444`
- Always verify builds before committing:
  ```bash
  cd apps/web
  npm run build
  ```

### Backend (FastAPI / Python)
- Write type-annotated, asynchronous code with SQLAlchemy 2.0.
- Run tests before submitting pull requests:
  ```bash
  cd apps/api
  python -m pytest tests
  ```
- **Security Rule**: Never commit Angel One session tokens, API secrets, or TOTP files. Check `.gitignore`.

### Architecture rules
- **One score.** An IPO's score is computed only in `apps/api/app/services/rating.py` (Listing-Gain Engine). Do not add a second formula in a router, task or the frontend. The frontend shows the score the API returns.
- **Never invent data.** An unknown price band, lot size, score or fact is `None` / "TBA" / "No score yet", not a default number. Optimizer inputs with unknown terms are skipped.
- **Broker calls** go through `apps/api/app/services/angel_service.py`. Live IPO applications stay disabled unless `ENABLE_LIVE_IPO_APPLY=true`, and a failed broker call must never be reported as success.
- **Allocation decisions** come from the solver in `apps/api/app/services/optimizer_service.py`; a language model only supplies facts, never decides money.
- **Model output is untrusted.** Facts extracted from documents are filtered to a fixed list of keys and ranges; a critical flag needs a verifiable quote.
- **History is append-only.** Score history, snapshots, outcomes, document versions and analysis results are never deleted or overwritten.
- **Migrations** are idempotent Alembic revisions. Rehearse with `python scripts/db_dry_run.py` before `alembic upgrade head`. Tests never use the hosted database.
- **Tests mock live services** (AI provider, broker, data sources). Use a throw-away database for Postgres tests.
- **Prompts** live in `apps/api/app/agents/prompts.py` and `apps/api/app/documents/facts.py`, not inline in routers.

---

## Submitting Pull Requests
1. Ensure all tests pass.
2. Provide a descriptive commit message following the Conventional Commits specification:
   - `feat(...)`: New feature
   - `fix(...)`: Bug fix
   - `style(...)`: Visual UI or theme adjustment
   - `docs(...)`: Documentation update
3. Open a Pull Request against `main`.
