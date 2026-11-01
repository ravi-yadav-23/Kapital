# Task Plan: Production Readiness Remediation

## Goal
Remediate all 4 critical production blockers, 3 high-severity defects, and test failures to bring Kapitl to 100% production readiness.

## Reference Documents
- Implementation Plan: `docs/plans/2026-11-01-production-readiness-remediation.md`
- Audit Report: `C:\Users\HP\.gemini\antigravity\brain\15f85ce5-90a9-4778-8225-7d186f0397f3\complete_codebase_audit_production_readiness.md`
- Plan Artifact: `C:\Users\HP\.gemini\antigravity\brain\15f85ce5-90a9-4778-8225-7d186f0397f3\production_readiness_implementation_plan.md`

## Phase Overview & Progress

- [x] **Task 1: Production Security & Secret Hardening (`[CRIT-01]`)**
  - Files: `apps/api/app/config.py`, `apps/api/tests/test_production_config_hardening.py`
  - Status: `completed` (Commit: `136380c`)

- [x] **Task 2: Persistent PostgreSQL Enforcement in Production (`[CRIT-02]`)**
  - Files: `apps/api/app/config.py`, `apps/api/app/db/database.py`, `apps/api/tests/test_database_persistence_enforcement.py`
  - Status: `completed` (Commit: `dd4f1d0`)

- [x] **Task 3: Protect Public Sync & Scraping Endpoint with Admin Auth (`[CRIT-04]`)**
  - Files: `apps/api/app/routers/ipos.py`, `apps/api/tests/test_admin_route_protection.py`
  - Status: `completed` (Commit: `1acc969`)

- [x] **Task 4: Repair Fund Summary Schema & Integrity Test (`[MED-01]`)**
  - Files: `apps/api/app/schemas/fund.py`, `apps/api/app/services/demo_dataset.py`, `apps/api/app/routers/funds.py`, `apps/api/tests/test_score_and_status_integrity.py`
  - Status: `completed` (Commit: `d576154`)

- [x] **Task 5: Precision SME Scrip & Trading Symbol Resolution (`[HIGH-02]`)**
  - Files: `apps/api/app/services/angel_service.py`, `apps/api/tests/test_sme_tradingsymbol_resolution.py`
  - Status: `completed` (Commit: `ae6eeec`)

- [x] **Task 6: P&L Summary Consistency & Guest Preview (`[SYNC-01]`)**
  - Files: `apps/api/app/routers/reports.py`, `apps/api/tests/test_pnl_consistency.py`
  - Status: `completed` (Commit: `075f000`)

- [x] **Task 7: Containerization & Pruning 0-Byte Infra Stubs (`[CRIT-03]`, `[HIGH-01]`)**
  - Files: `apps/web/Dockerfile`, `apps/web/.dockerignore`, `docker-compose.yml`, `infra/`
  - Status: `completed` (Commit: `d3d6d30`)

- [x] **Task 8: Monorepo Pruning & Dependency Cleanliness (`[ARC-01]`)**
  - Files: `apps/web/package.json`, `packages/`
  - Status: `completed` (Commit: `a88254e`)

- [x] **Task 9: Frontend Smoke Testing Baseline (`[HIGH-03]`)**
  - Files: `apps/web/package.json`, `apps/web/src/__tests__/smoke.test.ts`
  - Status: `completed` (Commit: `f522a24`)

- [x] **Task 10: Complete Verification & Final Audit Sign-Off**
  - Files: Full monorepo
  - Status: `completed` (74/74 Pytest passing, Next.js 13/13 routes compiled)

