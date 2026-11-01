# Kapitl Production Readiness Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remediate all critical production blockers, high-severity trading execution vulnerabilities, broken test assertions, and infrastructure gaps identified in the audit report to achieve 100% production readiness.

**Architecture:** Harden FastAPI backend security by eliminating insecure default credentials and ephemeral database fallbacks, secure public scraping endpoints with admin authentication, dynamically resolve SME stock trading series (`-SM`/`-ST`), fix schema-test discrepancies, and establish a containerized deployment architecture (Docker + PostgreSQL + Redis) to support the autonomous 09:00:00 AM IST trading scheduler.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (Async), PostgreSQL / aiosqlite, Pytest, Angel One SmartAPI, Docker & Docker Compose, Next.js 14, TypeScript.

---

### Task 1: Production Security & Secret Hardening (`[CRIT-01]`)

**Files:**
- Modify: `apps/api/app/config.py:54-95`
- Test: `apps/api/tests/test_production_config_hardening.py`

**Step 1: Write the failing test**
Create `apps/api/tests/test_production_config_hardening.py`:
```python
import pytest
from pydantic import ValidationError
from app.config import Settings, _INSECURE_DEFAULT_KEY


def test_production_rejects_default_admin_pin():
    """In production, admin_pin cannot be default '1234' or trivial."""
    with pytest.raises(ValidationError, match="admin_pin"):
        Settings(
            environment="production",
            secret_key="a-very-strong-production-secret-key-32chars!",
            admin_pin="1234",
            database_url="postgresql+asyncpg://user:pass@localhost:5432/kapitl",
        )


def test_production_rejects_short_admin_pin():
    """In production, admin_pin must be at least 6 characters."""
    with pytest.raises(ValidationError, match="admin_pin"):
        Settings(
            environment="production",
            secret_key="a-very-strong-production-secret-key-32chars!",
            admin_pin="9999",
            database_url="postgresql+asyncpg://user:pass@localhost:5432/kapitl",
        )


def test_production_rejects_trivial_sequences():
    """In production, reject trivial repeating pins."""
    for bad_pin in ["000000", "111111", "123456"]:
        with pytest.raises(ValidationError, match="admin_pin"):
            Settings(
                environment="production",
                secret_key="a-very-strong-production-secret-key-32chars!",
                admin_pin=bad_pin,
                database_url="postgresql+asyncpg://user:pass@localhost:5432/kapitl",
            )


def test_production_accepts_strong_pin():
    """Production mode initializes successfully with a strong 6+ digit non-trivial PIN."""
    s = Settings(
        environment="production",
        secret_key="a-very-strong-production-secret-key-32chars!",
        admin_pin="849204",
        database_url="postgresql+asyncpg://user:pass@localhost:5432/kapitl",
    )
    assert s.admin_pin == "849204"
    assert s.environment == "production"
```

**Step 2: Run test to verify it fails**
Run: `python -m pytest apps/api/tests/test_production_config_hardening.py -v`
Expected: FAIL (because `Settings` currently does not validate `admin_pin` in production).

**Step 3: Write minimal implementation**
In `apps/api/app/config.py`, update `validate_secret_key` or add model validator `validate_production_security`:
```python
    @model_validator(mode="after")
    def validate_production_security(self):
        val_sec = (self.secret_key or "").strip()
        val_pin = (self.admin_pin or "").strip()

        if self.environment == "production":
            # Secret key checks
            if not val_sec or val_sec == _INSECURE_DEFAULT_KEY:
                raise ValueError(
                    "In production, SECRET_KEY must be set to a strong, private secret (cannot be empty or default)."
                )
            if len(val_sec) < 32:
                raise ValueError("In production, SECRET_KEY must be at least 32 characters.")

            # Admin PIN checks
            if not val_pin:
                raise ValueError("In production, ADMIN_PIN must be explicitly set.")
            if val_pin in ["1234", "0000", "1111", "123456", "000000", "111111"]:
                raise ValueError("In production, ADMIN_PIN cannot be a trivial or default PIN.")
            if len(val_pin) < 6:
                raise ValueError("In production, ADMIN_PIN must be at least 6 digits/characters.")
        else:
            if not val_sec:
                self.secret_key = _INSECURE_DEFAULT_KEY
        return self
```

**Step 4: Run test to verify it passes**
Run: `python -m pytest apps/api/tests/test_production_config_hardening.py -v`
Expected: PASS (4 passed).

**Step 5: Commit**
```bash
git add apps/api/app/config.py apps/api/tests/test_production_config_hardening.py
git commit -m "fix(security): enforce strong non-trivial ADMIN_PIN in production"
```

---

### Task 2: Persistent PostgreSQL Enforcement in Production (`[CRIT-02]`)

**Files:**
- Modify: `apps/api/app/config.py:68-75`, `apps/api/app/db/database.py:20-45`
- Test: `apps/api/tests/test_database_persistence_enforcement.py`

**Step 1: Write the failing test**
Create `apps/api/tests/test_database_persistence_enforcement.py`:
```python
import pytest
from pydantic import ValidationError
from app.config import Settings


def test_production_rejects_sqlite_database_url():
    """In production, SQLite or /tmp databases are forbidden."""
    with pytest.raises(ValidationError, match="database_url"):
        Settings(
            environment="production",
            secret_key="a-very-strong-production-secret-key-32chars!",
            admin_pin="849204",
            database_url="sqlite+aiosqlite:////tmp/kapitl_local.db",
        )


def test_production_accepts_postgresql_database_url():
    """In production, managed PostgreSQL URL is required."""
    s = Settings(
        environment="production",
        secret_key="a-very-strong-production-secret-key-32chars!",
        admin_pin="849204",
        database_url="postgresql+asyncpg://postgres:pass@db.example.com:5432/kapitl",
    )
    assert "postgresql" in s.database_url
```

**Step 2: Run test to verify it fails**
Run: `python -m pytest apps/api/tests/test_database_persistence_enforcement.py -v`
Expected: FAIL (because `Settings` allows `database_url` to be SQLite in production).

**Step 3: Write minimal implementation**
In `apps/api/app/config.py`, add validator in `validate_production_security`:
```python
            # Database persistence check
            db_url = (self.database_url or "").strip().lower()
            if not db_url.startswith("postgresql") and not db_url.startswith("postgres"):
                raise ValueError(
                    "In production, DATABASE_URL must be a managed PostgreSQL connection "
                    "(e.g. postgresql+asyncpg://...). SQLite is forbidden to prevent data loss."
                )
```
In `apps/api/app/db/database.py`, prevent silent SQLite fallback if `settings.environment == "production"`:
```python
    except Exception as e:
        if getattr(settings, "environment", "") == "production":
            logger.critical(f"[DB FATAL] Cannot connect to primary database in production: {e}")
            raise RuntimeError(f"Production database initialization failed: {e}. SQLite fallback is disabled in production.")
        logger.error(f"[DB Error] Failed to create engine for {url}: {e}. Falling back to SQLite on /tmp")
        fallback_url = "sqlite+aiosqlite:////tmp/kapitl_local.db"
        return create_async_engine(fallback_url, echo=False)
```

**Step 4: Run test to verify it passes**
Run: `python -m pytest apps/api/tests/test_database_persistence_enforcement.py -v`
Expected: PASS (2 passed).

**Step 5: Commit**
```bash
git add apps/api/app/config.py apps/api/app/db/database.py apps/api/tests/test_database_persistence_enforcement.py
git commit -m "fix(db): enforce persistent PostgreSQL in production and disable SQLite fallback"
```

---

### Task 3: Protect Public Sync & Scraping Endpoint with Admin Auth (`[CRIT-04]`)

**Files:**
- Modify: `apps/api/app/routers/ipos.py:40-44`
- Test: `apps/api/tests/test_admin_route_protection.py`

**Step 1: Write the failing test**
Create `apps/api/tests/test_admin_route_protection.py`:
```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_public_cannot_trigger_sync():
    """Unauthenticated POST /api/ipos/sync must return HTTP 401 or 403."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/ipos/sync")
        assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_guest_cannot_trigger_sync():
    """Guest token cannot trigger market scraping / sync pipeline."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create a guest session
        login_res = await client.post("/api/auth/guest-login")
        assert login_res.status_code == 200
        guest_token = login_res.json()["token"]

        res = await client.post(
            "/api/ipos/sync",
            headers={"Authorization": f"Bearer {guest_token}"}
        )
        assert res.status_code in (401, 403)
```

**Step 2: Run test to verify it fails**
Run: `python -m pytest apps/api/tests/test_admin_route_protection.py -v`
Expected: FAIL (because `POST /api/ipos/sync` currently returns 200 without any auth).

**Step 3: Write minimal implementation**
In `apps/api/app/routers/ipos.py`:
Import `require_admin` from `app.middleware.auth`:
```python
from app.middleware.auth import require_admin
```
Update route signature:
```python
@router.post("/sync")
async def sync_market_data(
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Trigger real-time sync for current Indian IPOs pipeline into PostgreSQL (Admin only)."""
    count = await sync_ipos_pipeline(db)
    return {"success": True, "message": f"Successfully synchronized {count} live IPOs into PostgreSQL database"}
```

**Step 4: Run test to verify it passes**
Run: `python -m pytest apps/api/tests/test_admin_route_protection.py -v`
Expected: PASS (2 passed).

**Step 5: Commit**
```bash
git add apps/api/app/routers/ipos.py apps/api/tests/test_admin_route_protection.py
git commit -m "fix(security): require admin authentication for POST /api/ipos/sync"
```

---

### Task 4: Repair Fund Summary Schema & Integrity Test (`[MED-01]`)

**Files:**
- Modify: `apps/api/app/schemas/fund.py:5-12`
- Modify: `apps/api/app/services/demo_dataset.py:423-438`
- Modify: `apps/api/app/routers/funds.py:22-48`
- Test: `apps/api/tests/test_score_and_status_integrity.py:80-93`

**Step 1: Run the existing test to observe the exact failure**
Run: `python -m pytest apps/api/tests/test_score_and_status_integrity.py::test_asba_locks_and_fund_summary_consistency -v`
Expected: FAIL (`AttributeError: 'FundSummaryResponse' object has no attribute 'active_asba_locks'`).

**Step 2: Write minimal implementation**
In `apps/api/app/schemas/fund.py`:
```python
class FundSummaryResponse(BaseModel):
    total_family_balance: float
    total_available: float
    total_locked_asba: float
    utilization_percent: float
    accounts_active: int = 0
    accounts_total: int
    active_asba_locks: int = 0
```
In `apps/api/app/services/demo_dataset.py`:
```python
        return FundSummaryResponse(
            total_family_balance=total_balance,
            total_available=available,
            total_locked_asba=locked,
            utilization_percent=round(utilization, 1),
            accounts_active=sum(1 for a in accounts if a["is_active"]),
            accounts_total=len(accounts),
            active_asba_locks=len(DEMO_OPEN_ORDERS),
        )
```
In `apps/api/app/routers/funds.py`:
Count active locks from orders/allotments:
```python
    active_orders = len([o for o in await allotment_service.get_asba_locks(db) if o.status == "PENDING"]) if hasattr(allotment_service, "get_asba_locks") else 0
    return FundSummaryResponse(
        total_family_balance=total_family,
        total_available=total_available,
        total_locked_asba=total_locked,
        utilization_percent=round(utilization, 1),
        accounts_active=active_count,
        accounts_total=len(accounts),
        active_asba_locks=active_orders,
    )
```

**Step 3: Run test to verify it passes**
Run: `python -m pytest apps/api/tests/test_score_and_status_integrity.py -v`
Expected: PASS (all 3 test cases pass).

**Step 4: Run entire pytest test suite**
Run: `python -m pytest apps/api/tests/`
Expected: PASS (65/65 tests pass, 0 failures).

**Step 5: Commit**
```bash
git add apps/api/app/schemas/fund.py apps/api/app/services/demo_dataset.py apps/api/app/routers/funds.py
git commit -m "fix(funds): add active_asba_locks to FundSummaryResponse and resolve test assertion"
```

---

### Task 5: Precision SME Scrip & Trading Symbol Resolution (`[HIGH-02]`)

**Files:**
- Modify: `apps/api/app/services/angel_service.py:110-140, 410-425`
- Test: `apps/api/tests/test_sme_tradingsymbol_resolution.py`

**Step 1: Write the failing test**
Create `apps/api/tests/test_sme_tradingsymbol_resolution.py`:
```python
import pytest
from app.services.angel_service import angel_service


def test_preserve_existing_series_suffix():
    """If symbol is already qualified (e.g. BLSPOLYMER-SM), it must not become BLSPOLYMER-SM-EQ."""
    res_sm = angel_service.resolve_tradingsymbol("BLSPOLYMER-SM", exchange="NSE")
    assert res_sm == "BLSPOLYMER-SM"

    res_st = angel_service.resolve_tradingsymbol("KRN-ST", exchange="NSE")
    assert res_st == "KRN-ST"

    res_eq = angel_service.resolve_tradingsymbol("RELIANCE-EQ", exchange="NSE")
    assert res_eq == "RELIANCE-EQ"


def test_mainline_symbol_defaults_to_eq():
    """Clean mainline NSE symbol without suffix defaults to -EQ."""
    res = angel_service.resolve_tradingsymbol("RELIANCE", exchange="NSE")
    assert res == "RELIANCE-EQ"


def test_bse_symbol_remains_clean():
    """BSE symbols do not append -EQ."""
    res = angel_service.resolve_tradingsymbol("500325", exchange="BSE")
    assert res == "500325"
```

**Step 2: Run test to verify it fails**
Run: `python -m pytest apps/api/tests/test_sme_tradingsymbol_resolution.py -v`
Expected: FAIL (`AttributeError: 'AngelOneService' object has no attribute 'resolve_tradingsymbol'`).

**Step 3: Write minimal implementation**
In `apps/api/app/services/angel_service.py`:
Add helper method `resolve_tradingsymbol`:
```python
    def resolve_tradingsymbol(self, symbol: str, exchange: str = "NSE") -> str:
        """
        Determines the exact trading symbol with proper series suffix.
        Preserves SME suffixes (-SM, -ST) and special categories (-BE, -BZ).
        Appends -EQ only for mainline NSE equity without existing suffix.
        """
        clean = (symbol or "").strip().upper()
        if not clean:
            return ""
        if (exchange or "NSE").upper() != "NSE":
            return clean
        if clean.endswith(("-EQ", "-SM", "-ST", "-BE", "-BZ", "-SZ")):
            return clean
        # Check if instrument master contains clean-SM or clean-ST
        if f"NSE:{clean}-SM" in self._instrument_cache:
            return f"{clean}-SM"
        if f"NSE:{clean}-ST" in self._instrument_cache:
            return f"{clean}-ST"
        return f"{clean}-EQ"
```
In `stage_listing_sell_order` at line 413:
```python
        tradingsymbol = self.resolve_tradingsymbol(symbol, exchange=actual_exchange)
```

**Step 4: Run test to verify it passes**
Run: `python -m pytest apps/api/tests/test_sme_tradingsymbol_resolution.py -v`
Expected: PASS (3 passed).

**Step 5: Commit**
```bash
git add apps/api/app/services/angel_service.py apps/api/tests/test_sme_tradingsymbol_resolution.py
git commit -m "fix(angel): add resolve_tradingsymbol supporting NSE SME -SM/-ST series"
```

---

### Task 6: P&L Summary API Consistency & Schema Harmonization (`[SYNC-01]`)

**Files:**
- Modify: `apps/api/app/routers/reports.py:115-135`
- Test: `apps/api/tests/test_pnl_consistency.py`

**Step 1: Write the failing test**
Create `apps/api/tests/test_pnl_consistency.py`:
```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_guest_pnl_endpoints_return_structured_responses():
    """Both /api/funds/pnl-summary and /api/reports/pnl/summary return valid models for guests."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Login as guest
        login_res = await client.post("/api/auth/guest-login")
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Check /api/funds/pnl-summary
        res_funds = await client.get("/api/funds/pnl-summary", headers=headers)
        assert res_funds.status_code == 200
        data_funds = res_funds.json()
        assert "total_realized_pnl" in data_funds
        assert "overall_roi_percent" in data_funds

        # 3. Check /api/reports/pnl/summary
        res_reports = await client.get("/api/reports/pnl/summary", headers=headers)
        assert res_reports.status_code == 200
        data_reports = res_reports.json()
        assert "total_invested" in data_reports
        assert "total_net_pnl" in data_reports
        assert "breakdown" in data_reports
```

**Step 2: Run test to verify current state**
Run: `python -m pytest apps/api/tests/test_pnl_consistency.py -v`

**Step 3: Write minimal implementation**
In `apps/api/app/routers/reports.py`, align guest fallback with demo dataset ledger so guest exploration provides a rich realistic preview instead of a blank zero-state:
```python
    if user and user.get("is_guest"):
        # Return demo ledger summary for rich guest preview
        from app.services.demo_dataset import DEMO_ALLOTMENTS
        sold_allotments = [a for a in DEMO_ALLOTMENTS if a.get("status") == "SOLD"]
        total_inv = sum(a.get("invested_amount", 0.0) for a in sold_allotments)
        total_pnl = sum(a.get("realized_pnl", 0.0) for a in sold_allotments)
        roi = round((total_pnl / total_inv * 100.0), 1) if total_inv > 0 else 0.0
        return {
            "total_invested": total_inv,
            "total_realized": total_inv + total_pnl,
            "total_net_pnl": total_pnl,
            "overall_roi_percent": roi,
            "total_trades": len(sold_allotments),
            "wins": sum(1 for a in sold_allotments if a.get("realized_pnl", 0) > 0),
            "losses": sum(1 for a in sold_allotments if a.get("realized_pnl", 0) <= 0),
            "win_rate_percent": round(sum(1 for a in sold_allotments if a.get("realized_pnl", 0) > 0) / len(sold_allotments) * 100.0, 1) if sold_allotments else 0.0,
            "breakdown": [
                {
                    "ipo_name": a.get("ipo_name"),
                    "shares": a.get("shares_allotted"),
                    "invested": a.get("invested_amount"),
                    "realized_pnl": a.get("realized_pnl"),
                    "roi_percent": round((a.get("realized_pnl", 0) / a.get("invested_amount", 1) * 100.0), 1),
                }
                for a in sold_allotments
            ],
        }
```

**Step 4: Run test to verify it passes**
Run: `python -m pytest apps/api/tests/test_pnl_consistency.py -v`
Expected: PASS.

**Step 5: Commit**
```bash
git add apps/api/app/routers/reports.py apps/api/tests/test_pnl_consistency.py
git commit -m "fix(reports): harmonize P&L ledger data for guest exploration"
```

---

### Task 7: Containerization & Ghost Infrastructure Pruning (`[CRIT-03]`, `[HIGH-01]`)

**Files:**
- Create: `apps/web/Dockerfile`
- Create: `apps/web/.dockerignore`
- Modify: `docker-compose.yml`
- Remove / Populate: 0-byte ghost files in `infra/`

**Step 1: Create `apps/web/Dockerfile`**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9.0.0

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY packages ./packages

RUN pnpm install --frozen-lockfile || pnpm install

COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @kapitl/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

**Step 2: Create `apps/web/.dockerignore`**
```
node_modules
.next
.git
.env*.local
*.log
```

**Step 3: Update `docker-compose.yml` with the `web` service**
Add `web` service to `docker-compose.yml`:
```yaml
  web:
    build:
      context: .
      dockerfile: ./apps/web/Dockerfile
    container_name: kapitl-web
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:8000
    depends_on:
      - api
```

**Step 4: Clean up 0-byte ghost infrastructure files**
Remove or populate the 0-byte placeholder files in `infra/` (`infra/aws/ec2/user_data.sh`, `infra/aws/rds/init.sql`, `infra/aws/s3/lifecycle.json`, `infra/docker/docker-compose.prod.yml`, `infra/docker/docker-compose.yml`, `infra/nginx/nginx.conf`, `infra/nginx/ssl.conf`, `infra/scripts/*.sh`), or replace them with a single documented `infra/README.md` and standard production Nginx config.

**Step 5: Validate Compose Config**
Run: `docker compose config`
Expected: Valid compose specification with `db`, `redis`, `api`, `web`.

**Step 6: Commit**
```bash
git add apps/web/Dockerfile apps/web/.dockerignore docker-compose.yml infra/
git commit -m "build(docker): add web Dockerfile, compose service, and prune ghost infra stubs"
```

---

### Task 8: Monorepo Pruning & Dependency Cleanliness (`[ARC-01]`)

**Files:**
- Modify: `apps/web/package.json`
- Remove: Unused `packages/` (`packages/score-engine`, `packages/config`, `packages/shared-types`)
- Verify: `pnpm-lock.yaml`, `apps/web` build

**Step 1: Remove unimported workspace dependency**
In `apps/web/package.json`, remove `"@kapitl/shared-types": "workspace:*"`.

**Step 2: Clean up orphaned packages or integrate them**
Prune the unused empty/duplicate packages from `packages/`.

**Step 3: Run TypeScript & Next.js verification**
Run:
```bash
npx --prefix apps/web tsc --noEmit
npm --prefix apps/web run build
```
Expected: Clean build, 0 TypeScript errors.

**Step 4: Commit**
```bash
git add apps/web/package.json packages/
git commit -m "chore(repo): prune orphaned packages and unlink unused workspace dependency"
```

---

### Task 9: Frontend Smoke Testing Baseline (`[HIGH-03]`)

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/__tests__/smoke.test.ts`

**Step 1: Add Vitest config**
Create `apps/web/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Step 2: Add unit smoke test**
Create `apps/web/src/__tests__/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateConvictionVerdict } from '@/lib/types';

describe('Kapitl Core Scoring Smoke Test', () => {
  it('correctly maps scores to canonical investment verdicts', () => {
    expect(calculateConvictionVerdict(92).label).toBe('STRONG APPLY');
    expect(calculateConvictionVerdict(75).label).toBe('APPLY');
    expect(calculateConvictionVerdict(55).label).toBe('MODERATE APPLY');
    expect(calculateConvictionVerdict(45).label).toBe('AVOID');
  });
});
```

**Step 3: Run Vitest**
Run: `npm --prefix apps/web test`
Expected: 1 test file passed.

**Step 4: Commit**
```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/src/__tests__/
git commit -m "test(web): add Vitest test framework and core scoring logic tests"
```

---

### Task 10: Complete Verification & Final Audit Sign-Off

**Step 1: Run all backend tests**
Run: `python -m pytest apps/api/tests/ -v`
Expected: 100% pass (zero errors).

**Step 2: Run frontend typecheck & production build**
Run: `npx --prefix apps/web tsc --noEmit && npm --prefix apps/web run build`
Expected: Exit code 0, 13/13 routes compiled.

**Step 3: Update production readiness scorecard**
Verify that all 4 Critical Blockers and 3 High Severity findings are marked resolved.

