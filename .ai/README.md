# 🧠 Antigravity — AI Memory Folder

This folder is the **source of truth for every AI assistant** working on this project.
If you are an AI reading this: **READ EVERYTHING HERE FIRST** before writing a single line of code.
Do not assume. Do not invent logic. Every architectural decision is documented here with the reason *why* it was made.

---

## 📁 Files in This Folder

| File | Purpose |
|------|---------|
| `context.md` | WHO we are, WHAT we're building, WHY |
| `architecture.md` | Full technical architecture, stack choices + reasoning |
| `business-logic.md` | Core rules: scoring weights, fund allocation, categories |
| `build-order.md` | Module build sequence and current status |
| `decisions.md` | Architectural decisions log — why we chose X over Y |
| `api-contracts.md` | All external APIs (Angel One, Gemini, Claude) — how we call them |
| `cost-model.md` | Cost breakdown, optimization strategy, free tier usage |

---

## ⚠️ Rules for AI Assistants

1. **Never change scoring weights** without updating `business-logic.md`
2. **Never add a new dependency** without noting it in `architecture.md`
3. **All Angel One API calls** must go through `apps/api/app/services/angel_service.py` — never call it directly from agents or routers
4. **All prompts** live in `apps/api/app/agents/prompts.py` — not inline in agent files
5. **Fund allocation decisions** must pass through PuLP solver in `fund_optimizer.py` — Claude/Gemini only provides *scoring inputs*, never makes allocation decisions directly
6. We are building for **Ravi Yadav only** — this is a personal tool, not a SaaS product. Do not over-engineer auth, multi-tenancy, or billing.
7. V1 = UPI step is **manual**. Do not build auto-UPI. Angel One SmartAPI is used for order placement only after UPI mandate is already set up.
