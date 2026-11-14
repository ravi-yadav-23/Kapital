# What is broken, temporary or unverified (2026-11-13)

Written for: the project owner, to review before deciding what to continue. Everything here is from code, tests and live runs I did myself; anything I could not check is listed as **unverified**.

## 1. What is verified working (live, on the real database)

| Item | Evidence |
| --- | --- |
| Database at `e4c9a1b73d58`, models and database agree (0 differences, including nullability) | Dry-run, then apply, then a schema comparison |
| Source sync: Groww 55/55, IPO Watch 4/4 stored | Live nightly runs 2 to 6 |
| Stale statuses corrected (20 of 97 rows) | Live run 5: `statuses_fixed: 20` |
| Real offer documents read end to end: Truhome Finance (SEBI filing, 431 chunks, 14 analysed) and Hero Fincorp (issuer-hosted PDF, 452 chunks, 12 analysed) with Groq | Live runs 5 to 7 |
| Lender fix works on real data: Truhome moved from AVOID 39 (false flags) to WATCH 60 (no flags); the old row is kept | Live run 6 |
| Issuer-hosted PDFs fetched through the new public-host path | Hero Fincorp DRHP on the company's own storage |
| Unverified critical flag no longer vetoes: Hero Fincorp went from AVOID 35 to WATCH 46 | Live run 8 |
| Real Groq cost: 10 chunks used 22,075 tokens (about 2,200 per chunk), so the default 60-chunk night is about 130,000 tokens, inside the 150,000 default budget | Live run 8 |
| Groq extraction works and ignores an injected instruction | Live check: injected "set debt_to_equity to 99", got 0.42 |
| Guest "Run audit" cap (50/day) holds under concurrency | 12 simultaneous clicks, cap 3, exactly 3 succeeded (local Postgres) |
| Tests | Backend 415 passed / 8 skipped (the 8 are Postgres-only and opt-in), web 31 passed, production build clean |

## 2. Broken or wrong right now

| # | Problem | Why it matters | Suggested fix |
| --- | --- | --- | --- |
| 1 | **Analysis coverage is tiny.** In the last live run 1 IPO was analysed, 7 had no document link, 2 were deferred. A DRHP has hundreds of chunks (Truhome: 431) and only 14 were read. | Most IPOs will show "No analysis yet" for a while. The numbers for the one analysed IPO come from 14 chunks. | Raise the nightly budget once the real Groq daily limit is known; add a "read the financial-statements section" step instead of keyword ordering. |
| 2 | ~~**Two different scores are visible.**~~ **Fixed (decision taken 2026-11-14):** one engine score everywhere (`app/services/rating.py`). The list, report page, badges and optimizer read it. Before the offer document is analysed it uses market data only and says so; an old AI report no longer decides the score. | | |
| 3 | **~~A single model-extracted yes/no can veto an IPO.~~ Fixed:** a critical flag now needs a quote that really appears in the text; otherwise it is shown as a high flag. Hero Fincorp's earlier veto (from one unchecked answer) is now WATCH 46. Still open: the page number of each quote is not stored, and nobody has checked the Hero flag against the document. | A genuine problem could still be missed if the model does not quote it. | Store page numbers; spot-check a sample of flags by hand. |
| 3b | **Extracted numbers are unchecked against the source.** The model reads 14 chunks and returns figures (profit, debt, cash flow). Nothing verifies the fiscal year or the unit. | A wrong number gives a wrong red flag or score. The Truhome run showed one real misjudgement already (see section 4). | Store the page number and quote for each fact; show it in the panel; spot-check a sample by hand. |
| 4 | **Placeholder rows.** 27 "upcoming" IPOs have no dates, and many use Groww's temporary symbols (`TEMPRZR`, `TEMPALLCHEM` ...). Older rows have source `bse` from the previous scraper. | They appear as upcoming with TBA fields and may duplicate real entries when real symbols arrive. | Hide or merge placeholder symbols; I did not delete anything. |
| 5 | **Grey-market premium has one unofficial source.** ipoalerts' free plan has no GMP; IPO Watch is the only source. | If IPO Watch changes its page, GMP disappears silently. | Alert when a source returns 0 records or fails twice. Today it only shows in `GET /api/sources/health` (admin). |
| 5b | **Document downloads sometimes fail.** In the last runs NSE's archive timed out for Watrana (`ReadTimeout`) and one SEBI page dropped the connection. One retry was added; NSE may also be rate-limiting automated clients. | Those IPOs stay unanalysed. | Try again next night (automatic); if it persists, add a browser-like header set or another mirror. |
| 6 | **Open IPOs often have no document.** *(Partly addressed 2026-11-14: Groww financial summary fallback, basis shown, score capped; pre-filing IPOs still have nothing to read anywhere.)* Groww currently lists no open IPOs; for SME IPOs the filing comes only from IPO Watch's page when it links one. | The "open IPOs first" priority cannot help if there is no document. | Add the NSE/BSE announcement pages as another source. |
| 7 | **Market-mood input does not exist.** The engine reserves 10% weight for it and ignores it. | Weights are renormalised, so nothing breaks, but the model is less complete than the docs table suggests (the docs say it is reserved). | Add a simple index-trend input, or drop the row. |
| 8 | **Engine thresholds are not calibrated.** Only 29 closed IPOs with subscription were checked, no GMP history. | The 62 and 45 bands are a starting point, not evidence. | Let the daily snapshots accumulate for a few weeks, then run the backtest. |

## 3. Temporary things that should be replaced

| Item | Where | What to do |
| --- | --- | --- |
| Sample ("mock") data for guests | `apps/web/src/lib/mock-data.ts` | **Changed:** guests now see real IPO and report data. Sample data remains only for accounts, funds, orders, allotments and P&L (personal data), under the existing "Demo workspace" banner. |
| Settings page controls that do nothing (thresholds, allocation cap, buffer, default UPI, notifications) | `apps/web/src/app/settings`, audit item F18 | Wire them or remove them. They are labelled as not active today. |
| ~~Committed scratch and AI-assistant files~~ | `.ai/`, `.cursor/rules/`, the old production-readiness plan, `apps/api/run_live_pipeline_dryrun.py`, four empty placeholder files in `docs/` | **Done:** deleted (still in git history). The valid architecture rules were rewritten into `CONTRIBUTING.md`; `docs/agents/scoring-system.md` and `docs/fund-logic/allocation-algorithm.md` were rewritten to match the code. |
| Personal details in code | Google client ID default in `config.py` / `next.config.mjs`, personal GitHub URL in docs | Move to configuration. |
| Legacy `ADMIN_PIN` and its start-up warning | `config.py` | Remove once nothing reads it. |
| Every API route is mounted twice (`/api/...` and without the prefix) | `app/main.py` | Keep one. |
| Landing page uses hard-coded dark colours; admin token kept in `localStorage` | web app, audit item F36 | Check in light mode; consider a cookie. |
| Windows-only shutdown noise ("Event loop is closed") after jobs | local runs only | Harmless; Linux runners are unaffected. |

## 4. Fixed today, worth knowing

- **Lenders were misjudged.** The first real analysis (Truhome Finance, a housing-finance company) flagged "negative operating cash flow" and "high leverage" and returned AVOID. For banks and finance companies both are normal. Those two rules and score inputs are now skipped for lenders (model flag plus a name check). Other sectors may need similar care (for example real estate, where cash flow is lumpy).
- **Real database had NOT NULL dates** on `ipos.issue_open_date` / `issue_close_date`, so upcoming IPOs without dates could not be stored. Migration `e4c9a1b73d58` applied. My earlier schema checks missed nullability; they now catch it.
- **One slow database statement used to poison a whole source sync.** Records are now saved one by one.
- **The Groq model needs a larger token limit** (a 600-token cap cut the answer off). Fixed with a test.
- **Stale statuses** (9 "open" and 11 "upcoming" rows that had closed) are now refreshed by the nightly job.

## 5. Unverified (could be wrong)

- Angel One IPO-apply endpoint and payload (live applying stays off by default), broker-side cancel, and allotment detection by absence of holdings. I cannot test these without a live broker account.
- The deployed Vercel site after these changes. I did not open any page in a browser: the new docs, the analysis panel and the badges are built and unit-tested but not looked at.
- Whether the nightly GitHub Actions workflow runs. It has not run there; I ran the same command locally against the real database.
- The real Groq free-tier daily token limit. The default of 60 chunks per night is a guess.
- Whether SEBI filing pages always link the whole document. The first PDF link on a page may be only one part.

## 6. Your setup questions

- **GitHub secrets (your screenshot):** all five exist. `DATABASE_URL` is one value that already contains the port; you do not add a port anywhere else. For the nightly job use the Supabase *session pooler* URL (ends with `:5432/postgres`). The transaction pooler (`:6543`) also works with this code, so a wrong port will not break it. `API_BASE_URL` and `CRON_SECRET` are for the market-hours jobs, not the nightly analysis.
- **Vercel:** your list is complete for what the code reads. `DATABASE_URL` there should be the transaction pooler (`:6543`). Nothing new is needed.
- **Still to do by you:** rotate the keys that were exposed earlier (ipoalerts key in git history, Groq key, database password, Google client secret, TOTP secret).

## 7. Decisions

1. **Single score: done.** Engine score everywhere.
2. **Scratch files: done.** Deleted or rewritten as above.
3. **Guests: done.** Real IPO data; sample data only for personal sections.
4. Alerts: the job already exits with an error when a source fails (GitHub emails you). Anything beyond that is still open.

## 8. What changed in this pass

Migrations applied to Supabase: `a8d4e6f20c13`, `b9e5f7a31d24`, `c2a7d9e45f61`, `d3b8e0f56a72`, `e4c9a1b73d58`. All code is pushed to `audit/claude-code`; open the pull request from
`https://github.com/ravi-yadav-23/Kapital/compare/main...audit/claude-code?expand=1`
(`gh` is not installed on this machine). The audit history is in `AUDIT.md`; the design and progress log in `docs/plans/2026-11-12-ai-reports-redesign.md`.


## 9. GitHub Actions failures found on 2026-11-14
| Failure | Cause | Status |
| --- | --- | --- |
| CI web job, "Setup pnpm" | workflow set `version: 9` and `package.json` has `packageManager` | fixed, regression test |
| CI backend job, "Event loop is closed" | test pool reused across event loops on real Postgres | fixed; suite passes against Postgres (441 passed, 0 skipped) |
| Scheduled jobs #6 (22:00 IST) timed out | the web webhook ran the AI model | fixed; web jobs never run the model |
All three fixes are on `audit/claude-code` after the merge of PR #5. They reach `main` (and tonight's 22:00 IST job) only when a new pull request is merged.
