# 🧑 Context — Who, What, Why

## Who Is Building This

**Ravi Yadav**
- B.Tech CSE, LPU (2024–2028), CGPA 8.76
- Full-stack developer: React, Next.js, TypeScript, FastAPI, Python, PostgreSQL, Docker
- Has built agentic AI systems before (RAG, LLM integration, multi-agent workflows)
- This is a **personal tool** — not a startup, not a SaaS, not a product for others

---

## What We Are Building

**Antigravity** — A personal IPO investment automation platform.

The name reflects the mission: lift returns above market gravity using intelligent automation.

### Version 1 Scope (CURRENT)

| Module | Description | Status |
|--------|-------------|--------|
| IPO Discovery | Open / upcoming / closing-today with full details | 🔨 Building |
| AI Scoring Engine | 0–100 score per IPO across 6 dimensions | 🔨 Building |
| Fund Manager | 10 family accounts, dynamic allocation across Retail/sHNI/bHNI | 🔨 Building |
| Order Engine | Auto-apply via Angel One SmartAPI (manual UPI in V1) | 🔨 Building |
| Allotment Tracker | Auto-sort confirmed allotments into Active/Inactive | 🔨 Building |
| Pre-listing Sell | Trigger sell via broker API after allotment confirmed | 🔨 Building |
| P&L Dashboard | Per IPO × per account breakdown with charts | 🔨 Building |
| Report Generator | Score + params + red flags + recommendation | 🔨 Building |

### V1 Explicit Limitations (Do Not Try to Automate These Yet)
- UPI mandate is applied **manually** by Ravi — Angel One SmartAPI handles the order, but UPI payment step is human
- No auto bank balance pull (bank APIs in V2)
- 10 family member accounts, all separate Angel One logins, all separate bank accounts
- No family account grouping under one Angel One umbrella — each is a separate credential set

---

## Why We Are Building This

1. **IPO allotment is a numbers game** — more accounts = more chances. Managing 10 accounts manually across multiple IPOs is error-prone and slow.
2. **Timing is everything** — applying in the right category (Retail vs sHNI vs bHNI) at the right amount maximizes allotment probability and return.
3. **Most retail investors miss fund lock-in conflicts** — ASBA blocks funds during subscription period. If you don't track this, you miss better IPOs that open while your money is locked.
4. **AI-generated scoring saves 2-3 hours per IPO** — reading DRHPs, checking GMP, analyzing subscription data manually is time-consuming. Agents automate this.
5. **Pre-listing sell window is 15–30 minutes on listing day** — automation is the only way to catch it reliably.
