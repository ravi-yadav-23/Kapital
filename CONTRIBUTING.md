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
  pytest tests/unit tests/integration -v
  ```
- **Security Rule**: Never commit Angel One session tokens, API secrets, or TOTP files. Check `.gitignore`.

---

## Submitting Pull Requests
1. Ensure all tests pass.
2. Provide a descriptive commit message following the Conventional Commits specification:
   - `feat(...)`: New feature
   - `fix(...)`: Bug fix
   - `style(...)`: Visual UI or theme adjustment
   - `docs(...)`: Documentation update
3. Open a Pull Request against `main`.
