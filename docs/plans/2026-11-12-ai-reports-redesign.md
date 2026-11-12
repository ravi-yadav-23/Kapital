# AI Reports redesign - what is broken and the plan to fix it

Status: **plan only, nothing implemented.** Written after the audit (see `AUDIT.md`). Evidence below was read from the code; items marked *unverified* need checking before work starts.

## 1. What is broken today (with evidence)

| # | Symptom you see | Root cause | Evidence |
|---|---|---|---|
| 1 | "Run AI Audit" finishes in ~1 s and says "AI due diligence audit completed" | The toast fires whenever the API returns *any* report, including the instant preliminary stub. No LLM key, a guest session, a cached row, or an LLM failure all end in the same green toast. Guests cannot run audits at all (non-admins get the cached/preliminary report; this was deliberate to stop LLM cost abuse) but the UI still celebrates. | `apps/web/src/app/reports/page.tsx:240-255` (success toast on `if (rep)`); `report_service.build_fallback_report_response` |
| 2 | Every upcoming IPO shows **27/100** | Before an IPO opens there is no GMP or subscription, and the preliminary formula is only `0.6 x GMP signal + 0.4 x subscription signal`: GMP 0 -> 25, subscription baseline 30 -> `25*0.6 + 30*0.4 = 27`. The number carries no information. | `report_service.py:279-330` |
| 3 | "Rating changes when an IPO is open" | There are **four different scoring formulas**: `score_engine.compute_score` (points-based, sets `Ipo.score` at every sync), `report_service` fallback (piecewise 60/40), `orchestrator` preliminary (`gmp*2`, `qib*8`), and the orchestrator's audited weighted sum. The list page, the report page and the optimizer can show different scores for the same IPO, and live GMP/subscription (which change all day once bidding opens) rewrite the headline rating. | `score_engine.py:21`, `report_service.py`, `orchestrator.py`, writers of `Ipo.score` in `ipo_service.py:454,532`, `ipo_tasks.py:137,244,449,530` |
| 4 | Gatekeepers all "Pending audit"; 6-factor breakdown mostly "Not assessed" | Correct and honest after the audit fixes - but it shows the real problem: **the AI is given almost nothing to analyse.** | `agents/tools.py` profile: name, price band, lot size, issue size, GMP, subscription, an "about" blurb, a short list of strengths/risks from feeds |
| 5 | No useful green flags / red flags | Red flags come only from the LLM, which sees no financials, no litigation, no promoter data, no risk factors. Strengths/risks shown are scraped one-liners or generic text chosen by keyword (`sector_fallbacks.py`). Nothing is derived from the actual offer document. | `prompts.py`, `sector_fallbacks.py`, `analysis_agent.py` |
| 6 | "Prospectus/DRHP" features | Not implemented anywhere: no document download, no PDF library in `requirements.txt`, `drhp_url/rhp_url` columns are never written. | `grep drhp_url app` |
| 7 | Slow/unreliable runs | The audit is a synchronous HTTP request with a 28 s timeout, which cannot work for reading a 300-500 page prospectus and is cut off on Vercel. | `orchestrator.py` `asyncio.wait_for(..., 28)` |

Bottom line: the report engine is currently a **market-signal widget plus an LLM that summarises a one-paragraph blurb**. No amount of prompt tuning will make that a due-diligence tool. The fix is data first, then rules, then the LLM as a reader, then a UI that tells the truth.

## 2. Target design

```
 sources            ingest              extract                 judge                  present
 --------           ------              -------                 -----                  -------
 RHP/DRHP PDF  -->  download + hash --> text + tables  -->  structured facts  -->  rule engine  --> report
 exchange/anchor    store raw file      per-section          (LLM, with quotes      (deterministic      (verdict +
 lists, GMP/subs    (cache by hash)     split               + page refs, then       flags with          red/green flags
 feeds                                                       machine-validated)      evidence)           + evidence)
```

Principles
1. **Every flag and number carries evidence**: a rule id, the source page, and the exact quote. No evidence, no flag.
2. **Deterministic rules decide; the LLM reads.** The LLM extracts facts and summarises text. It never invents numbers. Extracted quotes are verified as substrings of the source text; extracted numbers are checked (units, totals, cross-statement consistency).
3. **Two clearly separated signals**: *Fundamental assessment* (from the offer document; changes only when new documents arrive) and *Market momentum* (GMP, subscription; live and volatile, always labelled as such). The headline verdict never silently flips because GMP moved.
4. **Honest states**: `NO_DATA`, `PRELIMINARY`, `ANALYSING`, `READY`, `STALE`, `FAILED`, each with a reason shown to the user.
5. **Heavy work is a background job**, not a web request.

## 3. Phased implementation plan

### Phase A - Stop misleading users (days; no new data needed)
- A1. Audit button states: queued / running (with progress) / done / failed / "admin only" / "no AI key configured" - toast reflects the real result (`is_audited`, `data_sufficiency`). Guests see "Sample report - audits are admin-only", not a spinner.
- A2. Replace "27/100" for IPOs with no market data by **"No score yet"** (score is `null`, not a made-up number).
- A3. **One scoring module** (`scoring.py`) used by the list endpoint, report endpoint, optimizer and frontend; delete the other three formulas. Add a contract test that all endpoints return the same score for the same IPO.
- A4. Split the UI/API fields: `fundamental` (null until documents are analysed) and `momentum` (live, timestamped). Store a **score history** table (timestamp, component, value, reason) so changes are explainable ("momentum rose because QIB subscription went 0.4x -> 3.2x").
- Exit test: same IPO shows identical numbers on IPO Board, Reports and the optimizer; toasts match backend state; no placeholder scores.

### Phase B - Data foundation: get the actual documents (largest piece)
- B1. **Document discovery**: find the RHP/DRHP PDF link per IPO (candidate sources: SEBI's public filings pages, NSE/BSE offer-document pages, the IPO feeds you already use if they link PDFs). *Unverified: availability, stability and terms of use of each source must be checked before building; prefer official exchange/SEBI documents.*
- B2. **Download + store**: fetch PDF, store in object storage keyed by SHA-256, write `documents` table (ipo_id, type DRHP/RHP, url, hash, pages, fetched_at). Respect robots/ToS and rate limits.
- B3. **Text extraction**: PDF text per page (pypdf/pdfplumber class library), OCR fallback for scanned pages, table extraction for financial statements. Keep page numbers.
- B4. **Section splitter**: locate standard RHP sections (Summary of the offer, Objects of the issue, Capital structure, Risk factors, Industry overview, Financial information, Outstanding litigation, Promoters, Comparison with listed peers). Section map is cached.
- B5. **Where it runs**: a worker outside the Vercel request path (GitHub Actions job, a small container, or a queue worker). **Decision needed** (see section 6).
- Exit test: 20 historical mainboard IPOs -> documents found, sections located (precision measured on a hand-checked sample).

### Phase C - Structured extraction (LLM as a reader, with validation)
- C1. Schemas for facts: offer structure (fresh vs OFS, size, price band), use of proceeds (% debt repayment, capex, general corporate), restated financials FY-3..FY (revenue, EBITDA, PAT, CFO, debt, net worth, receivables, ROE/ROCE if given), promoter holding pre/post and pledge, top risk factors, litigation table (count, amount), related-party items, auditor remarks, customer/supplier concentration, peer comparison table (peer P/E is disclosed in the RHP itself, so no external peer feed is needed).
- C2. Each extracted item = `{value, unit, source_page, quote}`. **Validators**: quote must exist in the page text; units normalised (lakh/crore); totals and year-over-year relations sanity-checked; low-confidence or failed items are dropped and listed under "could not assess".
- C3. Cost control: cheap model for per-section extraction, stronger model only for the final narrative; cache by document hash; per-IPO token budget; one retry with a corrective prompt, then mark `FAILED` honestly.
- Exit test: extraction accuracy >= agreed threshold (e.g. 95% on key numbers) on the hand-labelled set, measured in CI.

### Phase D - Deterministic flag engine (this is where real green/red flags come from)
- D1. Rule library, each rule = id, definition, thresholds, severity, evidence template. Examples: CFO/PAT < 0.6 or negative while PAT > 0; receivable days rising faster than revenue; debt-to-equity high or proceeds mostly for debt repayment; OFS > 70% of the issue; promoter holding falls sharply post-issue or high pledge; litigation amount > x% of net worth; related-party revenue share; qualified auditor remarks; single-customer concentration above a limit; P/E at upper band vs disclosed peer median; anchor book quality (MF share) when anchor list is published; positives: strong ROE/ROCE, consistent growth with cash conversion, fresh issue funding growth, low leverage.
- D2. Output = list of **red flags** and **green flags**, each with severity, the numbers, a one-line plain-English explanation, and the page link. LLM may rewrite the explanation text but cannot add or remove flags.
- D3. Thresholds live in config and are documented, so they can be reviewed and tuned; rule changes are versioned.
- Exit test: unit tests per rule with fixture facts; a golden-file test of flags for the labelled IPO set.

### Phase E - Scoring and verdict
- E1. Fundamental score = documented rubric over rule outcomes (not model opinion), with a **confidence** level driven by data completeness; momentum score from GMP/subscription separately.
- E2. Verdict wording avoids personalised advice: "Signals: strong / mixed / weak, confidence: low/medium/high" plus the reasons. *Not legal advice: giving buy/avoid recommendations may fall under SEBI research-analyst rules; get this reviewed before presenting STRONG APPLY / AVOID to the public.*
- E3. **Backtest**: compare score/flag history with realised listing gains on past IPOs and publish the (probably modest) honest result. Do not claim predictive power that has not been measured.

### Phase F - Pipeline and operations
- F1. Job model: `report_jobs` (status, stage, progress, error). Endpoints: create job (admin), poll status, list. Idempotent per (ipo, document hash, rules version).
- F2. Triggers: new document found, anchor list published, subscription final, manual re-run. Stages: discover -> download -> extract -> flags -> score -> narrative. Stale detection when inputs change.
- F3. Observability: per-stage timing, token/cost per report, failure reasons, alert when extraction fails for an open IPO.

### Phase G - UI redesign (report page)
- Header: verdict + confidence + "as of" timestamp + data completeness bar.
- **Red flags / Green flags** panels, each item: title, severity, number, plain explanation, "view page N" link to the source quote.
- Financial table and simple charts (revenue/PAT/CFO), peer comparison (IPO P/E vs disclosed peers), offer structure and use of proceeds.
- "What we could not assess" section (explicit), momentum panel with live GMP/subscription and its own history chart, score-history timeline.
- Run states from A1; guest view shows precomputed public reports read-only.

### Phase H - Quality gates
- Labelled evaluation set (start with 20-30 past mainboard IPOs), extraction-accuracy and flag-precision metrics in CI; prompt/schema/rules version pinned in each report; regression tests for the contract in A3.

## 4. Suggested order and rough size

| Order | Phase | Size | Depends on |
|---|---|---|---|
| 1 | A (honest UI, single score, no placeholders) | S-M (a few days) | none |
| 2 | B (documents + extraction text) | L | decision D-2 (where jobs run) |
| 3 | C + D (facts + rules) | L | B |
| 4 | E + F (score, jobs) | M | C, D |
| 5 | G (UI) | M | D, E |
| 6 | H runs alongside C-E | M | labelled set |

Realistically: Phase A is quick and fixes the "broken-feeling" symptoms immediately; Phases B-D are the real project (weeks, not days) and are what makes the green/red flags genuine.

## 5. Risks
- **Document access and format**: availability, PDF quality (scanned pages, odd tables) and source terms of use are unverified; coverage will start at mainboard IPOs, SME later.
- **LLM error**: validators reduce but do not eliminate wrong extractions; unsupported items must be dropped, not guessed.
- **Cost/latency**: a 400-page filing is large; section targeting and caching are mandatory, and measured cost per report must be recorded before any cost claim is made.
- **Regulatory**: see E2.
- **Timing**: DRHP appears weeks before the issue, but RHP, price band and anchor lists appear only days or hours before opening; the pipeline must re-run on those events.

## 6. Decisions needed from you
1. **Where heavy jobs run**: GitHub Actions job / a small always-on container / a managed queue. (Vercel functions are not suitable for PDF parsing.)
2. **LLM provider and monthly budget** for extraction + narrative (and whether to keep Groq as default).
3. **Scope of v1**: mainboard only first (recommended) or SME too.
4. **Guests**: read-only precomputed reports (recommended) vs no reports.
5. **Wording/recommendation policy** (E2): signals-and-reasons vs explicit Apply/Avoid labels.
6. **Document sources**: approve the exact sources after checking their terms of use.

## 7. Decisions recorded (2026-11-13)

- **Budget: Rs 0.** Groq free tier as the only LLM. Heavy jobs run on **GitHub Actions** (free minutes; if the repo is private the free allowance is limited, so keep jobs short and cache aggressively - *verify your repo visibility and current Actions allowance*).
- **Guests**: can read precomputed reports **and** click "Run audit", with a **global cap of 50 clicks per day for all guests combined** (from anywhere). Enforced server-side in the database, not in browser or memory.
- **Verdicts**: "signals + reasons" as the main presentation, with Apply / Avoid style labels shown as a small corner badge (not the headline). Keep the "not investment advice" notice (see E2).
- **Document sources**: still to be chosen (see the explanation below).

### Design consequences
1. **Clicks are capped at 50/day, but fresh LLM work is capped by tokens, not clicks.** If Groq's free limits are as pasted (e.g. gpt-oss-120b about 200K tokens/day), and one fresh IPO analysis costs roughly 25-30K tokens (an estimate, to be measured on the first 3 IPOs), only about 6-7 *new* analyses fit in a day. So a guest click must work like this:
   - report already computed for the current document -> **instant answer from cache, zero LLM cost** (most clicks);
   - not computed yet -> the click joins a **queue** ("queued, position N, usually ready within X"), and a GitHub Actions job processes the queue within the day's token budget;
   - when the day's budget is used up -> "Daily free analysis budget reached, showing the latest available report; try again tomorrow."
   A separate counter tracks tokens used today so the queue stops before Groq returns 429.
2. This **replaces** the current rule from the audit (non-admins can never trigger generation, commit C11): guests may *request* an analysis, but they only ever enqueue a job; they never call the LLM directly.
3. **Queue + trigger**: guest click inserts a row in a `report_jobs` table (counted against the 50/day cap). GitHub Actions runs either (a) every ~15 minutes on a schedule and drains the queue, or (b) is triggered immediately through the GitHub API (`workflow_dispatch`, needs a token stored as a secret). (a) is simpler and keeps everything free; (b) feels more "live".
4. **Live-demo proof plan**: nightly Actions run pre-computes 5-10 mainboard reports; they are what recruiters see; the guest "Run audit" demonstrates the queue and cache honestly without being able to burn the free quota.

## 8. Nightly pipeline (GitHub Actions, free) - added 2026-11-13

**Schedule:** 02:00 IST = 20:30 UTC the previous day, cron `30 20 * * *`. GitHub schedules are best-effort and can start late. Also *verify*: GitHub may disable scheduled workflows in a repo with no activity for about 60 days, so keep a heartbeat or re-enable manually.

**How it runs:** the workflow checks out the repo and runs a Python script (not the web API) that connects to the database with repo secrets (`DATABASE_URL`, `GROQ_API_KEY`). Free, no server needed. The Groq token budget, not job runtime, is the real limit.

**Order of work (priority queue):**
1. Refresh data: IPO list, dates, price band, subscription, GMP snapshot (stored as a time series, never overwritten).
2. Analyse **open and closing-today IPOs first**, then **upcoming IPOs ordered by open date (soonest first)**. Closed IPOs are never re-analysed (they only get their outcome recorded, see below).
3. Stop cleanly when the day's token budget is reached; the next night resumes exactly where it stopped.

**Chunked analysis (each chunk about 5K tokens or less, stored the moment it succeeds):**

| Stage | Input | Done by |
|---|---|---|
| S1 offer structure | objects of issue, fresh vs OFS, size | code first (regex/tables), small LLM call only to fill gaps |
| S2 financials | restated financial tables | **code** (table parsing + sanity checks), no LLM |
| S3 peers/valuation | "comparison with listed peers" table | **code** |
| S4 risk factors | headings only, batched | small LLM (classification), 1-3 chunks |
| S5 litigation | litigation table + narrative | code for counts/amounts, small LLM for severity |
| S6 promoters/management | promoter section | small LLM + code checks (holding %, pledge) |
| S7 business/industry | business overview | small LLM summary |
| S8 combine | stored chunk outputs | **deterministic rule engine** builds flags and score; one final small LLM call writes the narrative from the stored facts only |

Each chunk is a row in `analysis_chunks` (ipo, document hash, stage, status, output JSON with quotes and pages, model, tokens, timestamp). A failed chunk is retried the next night; finished chunks are never recomputed unless the document hash changes. Spread stages across Groq models that have separate daily quotas (pasted limits, *verify in your console*: gpt-oss-120b about 200K tokens/day, llama-3.1-8b about 500K, qwen3-32b about 500K): cheap classification on the small model, hard extraction on the bigger one. Keep an `llm_usage` table and read Groq's rate-limit headers so the queue stops before 429 errors.

**Never delete analyses:** reports become **append-only versions** (`analysis_versions`: ipo, version, inputs hash, rules version, score components, flags, narrative, created_at). Nothing overwrites or deletes them. Closed IPOs keep their final analysis plus a stored **outcome** (listing price, day-1 close, listing gain %), which later shows whether the scores were any good. Current code does NOT do this: the orchestrator updates the single `ai_reports` row in place, and `ai_reports` has `ON DELETE CASCADE` from `ipos`, so deleting an IPO would delete its analysis. Both must change (a data-model change, needs your approval).

## 9. Data sources - proposal to confirm

| Data | Proposed source | Why | Status / risk |
|---|---|---|---|
| RHP / DRHP, addenda | **Official**: SEBI filings pages, NSE/BSE offer-document pages | official, public, authoritative | you approved official download; exact URLs and robots rules still to be checked |
| IPO list, dates, price band, lot size | keep **ipoalerts.in API** (free key) as primary, cross-check against NSE/BSE | already integrated | free-tier limits unverified |
| Subscription (category-wise, live) | prefer **NSE/BSE live bidding pages** (official numbers); keep the Groww scrape as fallback | official figures beat aggregators | exchange endpoints are unofficial JSON/HTML and can change; terms unverified |
| Anchor investor list | exchange circular / issue page (published 1 working day before opening) | needed for the anchor-quality flag | format unverified |
| GMP | **no official source exists**; keep ipowatch.in and add a second aggregator for cross-check; store daily history | unregulated, can be manipulated | always label "unofficial, indicative"; use the median of 2 or more sources; GMP alone never drives a verdict |
| Peer data | from the RHP's own peer table | no extra feed | parsing risk |
| Listing outcomes | exchange data after listing | for calibration | |

Decision for you: approve these, and for each scraped site accept the risk after reading its terms (I can read the terms and robots pages for you if you let me make those public web requests).

## 10. What is missing from the analysis today (add these)

**Must have (core to a real IPO decision)**
1. **Valuation**: P/E at upper band vs disclosed peers, plus P/B, EV/EBITDA, market cap / revenue, post-issue market cap, free float.
2. **Financial quality** (3 years): revenue and PAT CAGR, margin trend, ROE/ROCE, **CFO vs PAT**, receivable days, debt/equity, interest cover, contingent liabilities.
3. **Offer structure**: fresh vs OFS, **use of proceeds** (how much repays debt vs funds growth), promoter selling, pre-IPO placements at lower prices, ESOPs, lock-ins, promoter holding after the IPO.
4. **Governance and legal**: promoter background and SEBI orders, share pledges, related-party transactions, auditor qualifications or changes, criminal/tax litigation amounts vs net worth, group-company issues.
5. **Business risk**: customer/supplier concentration, regulatory dependence, cyclicality, competitive position, industry growth.
6. **Allotment odds and expected value** (specific to your app): retail lottery odds from the retail subscription multiple (about 1 in N), sHNI/bHNI proportional allotment, expected gain = P(allotment) x expected listing gain - costs. The optimizer currently ignores this.
7. **Subscription quality**: category-wise numbers, QIB participation late on the last day, the final-day pattern, not a single number.
8. **Anchor book quality**: share of mutual funds and long-term investors, lock-in.
9. **Market context**: recent listing performance of comparable IPOs, index trend, number of IPOs open at once, issue size vs liquidity.
10. **Data completeness and confidence**: every report says what it could not assess and how confident the verdict is.

**Should have**
11. GMP **trend** over days (not one value), with source and timestamp.
12. Separate **listing-gain view vs long-term view**.
13. **SME-specific** handling (large minimum lot, thin liquidity, market-maker lock-in).
14. **Outcome tracking** and a backtest to calibrate weights (the only honest way to say the score means anything).
15. A freshness stamp ("as of 02:10 IST") and alerts when an input changes after the report (price band revised, new addendum).

## 11. How scoring works today, and what to change

Today there are **three unrelated formulas, none calibrated against real listing results**:

| Where | Formula | Notes |
|---|---|---|
| `score_engine.py` (sets the IPO list score at every sync) | GMP 0-30 points + subscription 0-25 + issue size 0-18 + strengths keywords 0-15 - risk keywords 0-15. Maximum possible is 88, so 100 is unreachable. Bands: 78+ Strong Apply, 62+ Moderate, 45+ Watch, else Avoid | size points reward big issues regardless of quality; strengths/risks are keyword matches on a scraped blurb ("market leader" = +3, "litigation" = -5); before opening, GMP/subscription default to neutral points |
| Report page fallback (`report_service.py`) | 60% GMP signal + 40% subscription signal | gives 27 to every upcoming IPO with no market data |
| Audited report (`orchestrator.py`) | financial quality 25%, valuation 20%, GMP 20%, promoter integrity 15%, industry 10%, subscription 10%, minus red-flag penalties; bands 80 / 62 / 45 | 70% of it was LLM opinion on a blurb, and GMP counts 20% of a "fundamental" score |

The percentages (25, 30 and so on) were picked by hand; nothing in the repo justifies them.

**Proposed replacement (weights live in config and are tuned later by backtest):**

*Fundamental score (from documents; changes only when documents change)*, 100 points, **no GMP inside it**:
- Financial quality 25 (growth, margins, ROE/ROCE, cash conversion, leverage)
- Valuation vs peers 20
- Governance and legal 20 (promoter record, pledges, related-party, auditor, litigation)
- Offer structure 15 (fresh vs OFS, use of proceeds, promoter selling, pre-IPO placements)
- Business and industry risk 20 (concentration, cyclicality, moat, sector growth)

Each point comes from a rule with evidence. An area that cannot be assessed is "not assessed" and lowers confidence; it does not get a default number.

*Market momentum score (live, labelled, separate)*: subscription quality 40%, anchor quality 20%, GMP trend 25% (unofficial), market context 15%.

*Verdict*: signals plus reasons, with confidence. The corner badge (Apply / Neutral / Avoid) comes from a documented matrix: strong fundamentals with supportive momentum gives Apply; weak fundamentals, or red flags above a severity limit, gives Avoid regardless of momentum; everything else is Neutral/Watch. **Hard-stop rules**: certain red flags (for example negative CFO with a large OFS, or heavy promoter pledge) cap the verdict no matter how high the GMP is.

*For the allocator (money decisions)*: add **expected value = allotment probability x expected gain** instead of ranking by GMP x score.

Phase A (already approved) builds the plumbing: one scoring module, momentum and fundamental separated, history stored. These weights are a starting proposal and only become trustworthy after the outcome backtest.

---

# UPDATE 2026-11-13 (supersedes sections 9 and 11 below where they conflict)

**Project goal, confirmed:** listing-day gain only. Buy through the IPO, sell on the listing day, never hold long term. So the engine must predict *listing gain and the chance of a loss at listing*, with GMP and demand signals first. Long-term fundamentals only matter as a downside guard (fraud, absurd valuation, heavy promoter selling).

## 12. What the sites' terms actually allow (read 2026-11-13; robots.txt + terms; not legal advice)

I cannot "make" a site allow scraping; I can only choose sources whose rules allow what we do. Result:

| Source | robots.txt | Terms of use (what I found) | Verdict for automated use |
|---|---|---|---|
| **ipoalerts.in API** | n/a (API) | Using its **published API** is the permitted way; scraping the site is banned. Display to end users in your own app/website is allowed, including commercial. No redistribution of the data. Keys must stay server-side. **Forbids "real-time trading, automated or algorithmic trading"** and says data is not a substitute for a live exchange feed. Free plan: **25 requests/day, 750/month, 6/minute, only currently OPEN issues, 1 IPO per request.** GMP is a **paid add-on** on the pricing page, although the GMP-trends page says "Free Preview until further notice" (contradictory, must be tested with a key). Pro plans start at Rs 499/month. | **Allowed** for open IPOs within quota, as long as nothing is traded automatically from it. Keep a human in the loop. |
| **NSE** (nseindia.com) | allows `/` | Terms of Use bar "systematic or automated data collection" (scraping, data mining, harvesting). Sub-sites say the same. NSE offers an official MCP/AI access page for informational use only (no licence to exploit commercially or train AI). | **No automated scraping.** Manual personal download of a document is fine. |
| **BSE** (bseindia.com) | returned 403 to my fetch (blocks bots) | Main disclaimer: no reproduction/redistribution without written consent. The BSEPlus sub-site bans systematic downloading into a database. Full main-site terms not retrieved. | **Treat as no automated access.** |
| **SEBI** (sebi.gov.in) | allows everything except `/js` and `/css` | Website policy: material may be reproduced free after **permission requested by email**, accurately and with credit. Automated retrieval is not addressed. | **Low-volume document download is likely tolerable, but get written permission** (email SEBI) to be safe. |
| **Groww** (/ipo) | allows `/ipo` | Section IV.2 prohibits copying, reproducing or "enter[ing] into a database" platform content; IV.4 bars copying or displaying content without authorisation. | **Not allowed.** The current Groww scraper conflicts with these terms. |
| **IPO Watch** (ipowatch.in) | allows pages (blocks `/api/`, year archives) | Terms of Use grant a licence for **personal, non-commercial** access only; copying, republishing or commercial exploitation is restricted. | **Not allowed** for a public demo without permission. The current GMP scraper conflicts. |
| **Chittorgarh** | allows pages (blocks AI crawlers such as GPTBot) | Disclaimer bars reuse of contents for public/commercial purposes without prior written permission (page is old). | **Needs written permission.** |

### What this means (honest conclusion)
- There is **no free, clearly permitted, fully automatic source** for GMP or live subscription. The only clean automated source is the **ipoalerts API** (open IPOs only, tiny free quota).
- The code today scrapes **Groww** and **IPO Watch**, which their terms do not allow. For a public live demo that is a real risk (takedown, IP block, reputational). This should be fixed first (new item **A0 - compliance**): disable those two scrapers by default and replace them as below.

### Recommended free and compliant data plan
1. **IPO basics for OPEN issues**: ipoalerts free API (25/day budget: one call per open IPO per day, plus one list call).
2. **Offer documents (RHP/DRHP)**: the admin **downloads the PDF manually** from SEBI/NSE/BSE (allowed for personal use) and drops it into the repo/storage or uploads it in an admin screen. The nightly Action then analyses it. Optionally email SEBI for permission to automate fetching. For a demo of 5-10 IPOs this is realistic and fully compliant.
3. **GMP**: (a) first test whether the ipoalerts GMP-trends preview works on the free key; (b) otherwise an **admin form** where you type the GMP you see on public sites (with source + timestamp) - keep **at least 2 sources**; (c) email IPO Watch / Chittorgarh asking for written permission to read their GMP table automatically; (d) paid add-on later when this becomes a real product.
4. **Subscription (category-wise)**: ipoalerts if it exposes it (not stated on the pricing page - test), else the same admin form (the exchange pages are fine to *read by eye*, not to scrape).
5. **Never auto-trade from this data** (ipoalerts clause). The app suggests; a human decides and places or stages the order. Mark this in the README.

## 13. Listing-Gain Engine v1 (new scoring engine; replaces the three old formulas)

**What it predicts:** the expected % gain at listing (issue price -> listing price), the probability of listing at a loss, and the expected rupee gain per application after allotment odds. Nothing about long-term value.

**Inputs (all known before or at close of bidding):**

| Group | Signals | Weight in the listing-gain score |
|---|---|---|
| **A. Grey market (primary)** | GMP as % of upper band (median of >= 2 sources), 3-day GMP trend (rising/falling/flat), GMP stability (std dev), source agreement | **40%** |
| **B. Demand** | final subscription: QIB (x), NII/HNI (sNII and bNII), retail (x), total; late-day surge on the last day; QIB share of the book | **30%** |
| **C. Anchor book** | anchor size as % of issue, share of mutual funds / long-term funds, any famous marquee names | **8%** |
| **D. Supply and structure** | issue size and float (small issues pop more, huge ones less), OFS share, pre-IPO placements below issue price, QIB reserved share | **8%** |
| **E. Pricing guard** | P/E (or P/S for loss-makers) at the upper band vs disclosed peers: expensive pricing caps the upside | **6%** |
| **F. Market regime** | Nifty 5-day trend, average listing gain of the last ~10 IPOs, number of IPOs open the same week (liquidity drain) | **8%** |

**Hard rules (override the weights):**
- **Red-flag caps** from the offer document: fraud/regulatory action on promoters, negative operating cash flow with large OFS, extreme valuation, pledged promoter holding - cap the verdict at Neutral/Avoid no matter how high GMP is, because listing day collapses on bad news.
- **Data-quality rule:** if GMP has fewer than 2 sources, or is older than 24 h, or sources disagree by a wide margin, confidence is Low and the verdict is shown as "unreliable data".
- **Manipulation guard:** a GMP that jumps while subscription stays weak is down-weighted.

**Outputs:**
1. `expected_listing_gain_pct` with a range (low / base / high), not a single point.
2. `p_gain_positive`, `p_gain_above_10pct`, `p_loss`.
3. `confidence` (Low / Medium / High) from data completeness and source agreement.
4. **Signal badge** in the corner (Apply / Neutral / Avoid) from a documented matrix, plus the **reasons** list as the main content ("GMP +32% rising 3 days; QIB 78x; anchor 62% MFs; P/E 38 vs peers 41"; red flags listed separately).
5. **Per-application expected value**: `P(allotment) x expected_gain x application_amount - costs`. Retail allotment probability is about `1 / retail_subscription_multiple` when oversubscribed (lottery); sHNI/bHNI are proportional. This feeds the optimizer so it ranks by expected rupees, not by GMP x score.
6. **Exit note** for listing day (informational, not advice): after the listing price is discovered, a price band applies for the rest of the day (the width depends on issue size and segment - verify current NSE/BSE rules), which limits further upside and downside that day.

**Calibration (what makes it honest):**
- Keep an **`ipo_outcomes`** table: issue price, listing price, listing gain %, day-1 close. Seed it with the past ~50-100 mainboard IPOs by manual CSV import from public pages (by eye/manual download), and add each new listing automatically.
- Store a **GMP/subscription snapshot at bidding close** for every IPO so the feature values used for prediction are reproducible.
- Fit the weights with a simple, transparent method (for example a ridge regression or monotonic rules) and publish the backtest: predicted vs actual, hit rate of "p_gain_positive", average error. Until at least a few dozen outcomes exist the engine is labelled **"uncalibrated v1 - rules of thumb"**.
- **No claim of accuracy** is made beyond what the backtest shows. GMP is the best-known leading indicator but is unofficial and can be wrong or manipulated.

**What this changes in the earlier plan:**
- The LLM/document pipeline shrinks to what it is good for here: red-flag hard-stops, offer structure (fresh vs OFS, pre-IPO placements), and peer P/E from the RHP. It is **no longer the core score**, which saves free-tier tokens and makes results deterministic.
- Fundamental long-term sub-scores (ROE trends, moat etc.) are dropped from the headline; they remain optional detail only.
- Report page: top = signal badge + expected gain range + probabilities + confidence; then reasons; then red flags/green flags; then "data we could not verify".

## 14. Revised phase order for the free, listing-gain version
1. **A0 compliance**: disable the Groww and IPO Watch scrapers by default (config switch), document sources and limits, switch IPO basics to the ipoalerts API for open issues.
2. **A honest UI + one scoring module + score history** (as before).
3. **B1 data capture**: `gmp_snapshots`, `subscription_snapshots`, `ipo_outcomes` tables; admin entry forms; nightly snapshot at 02:00 IST.
4. **B2 Listing-Gain Engine v1** (rules above) + unit tests + backtest script over `ipo_outcomes`.
5. **B3 allotment-odds expected value** and optimizer switch to expected rupees.
6. **C document analysis (small)**: manual PDF drop -> chunked extraction -> red-flag hard-stops and peer P/E, stored append-only.
7. **D UI redesign** and guest queue/cap (50 clicks/day, global).
8. **E calibration** as outcomes accumulate; publish the backtest in the README.

---

# UPDATE 2026-11-13 (late) - answers to: "GMP too high", "hidden red flags", "AI web search", "NSE/BSE documents"

## 15. Scoring v1.1 - GMP is evidence, not the verdict (supersedes the weights in section 13)

You are right: a 40% GMP weight lets a manipulated number decide. GMP is unofficial and can be pumped. New principle: **three layers, and GMP can only support a verdict that demand and company reality already allow.**

| Layer | What | Weight in the listing-gain score |
|---|---|---|
| **1. Company reality (from the offer document)** | forensic red flags, financial health (cash flow vs profit, debt, accumulated losses), offer structure (fresh vs OFS, use of proceeds, pre-IPO placements, promoter selling), valuation vs disclosed peers | **30%** and a **veto** (see below) |
| **2. Real demand (hard to fake)** | final subscription by category (QIB first, then NII, then retail), late-day pattern, anchor book size and quality | **30%** |
| **3. Grey market** | GMP level, 3-day trend, agreement of >= 2 sources | **20%**, and automatically **discounted** when it disagrees with layers 1 and 2 |
| **4. Float and supply** | issue size, free float, QIB share, listing-day liquidity | **10%** |
| **5. Market regime** | Nifty trend, recent IPO listing average, IPOs open the same week | **10%** |

**Rules that stop manipulation and hidden problems from winning:**
1. **Red-flag veto:** a severe red flag (examples below) caps the verdict at Neutral, or at Avoid for the worst, **regardless of GMP**.
2. **GMP sanity check:** GMP counts fully only if it is consistent with demand: e.g. GMP +40% with QIB under 5x, or GMP rising while subscription is flat, cuts GMP's contribution by half or more and shows "GMP not confirmed by demand".
3. **Valuation cap:** an aggressive P/E vs disclosed peers caps the expected gain range.
4. All weights, thresholds and caps live in one config file, versioned, and are tuned later against the `ipo_outcomes` backtest. Until then the label stays **"uncalibrated v1.1"**.

GMP stays the single most visible input (it is the market's expectation), but it is no longer able to outvote the company's own filed numbers.

## 16. Finding red flags the report tries to bury

Companies put damaging facts deep in the document and in dense tables. A generic "find the red flags" prompt will miss them. The approach is **targeted extraction + trigger-phrase search + rules, with a page quote for every finding**:

| Where it hides | What to look for (rule examples) |
|---|---|
| **Auditor's report / restated financials** | qualified opinion, emphasis-of-matter, going-concern note, CARO remarks, **big gap between audited and restated profit**, changes in accounting policy, prior-period adjustments |
| **Cash flow vs profit** | CFO/PAT < 0.6 or negative, receivable days or inventory growing faster than revenue, high "other income" share of profit, exceptional gains, capitalised expenses |
| **Related-party tables** | related-party share of revenue or purchases, loans/advances to promoters or group firms, guarantees given for group companies |
| **Contingent liabilities and litigation** | amounts vs net worth, tax (income-tax/GST) disputes, criminal cases against promoters/directors, SEBI/RBI/ED actions, past non-compliance penalties |
| **Objects of the issue** | "general corporate purposes" near the allowed ceiling, debt repayment to related/affiliated lenders, unidentified acquisitions |
| **Offer structure** | OFS dominating the issue, promoters exiting, shares issued to insiders far below the issue price in the last 12-18 months, promoters' weighted average cost of acquisition vs issue price, ESOP overhang |
| **Capital structure** | promoter pledge, low post-issue promoter holding, accumulated losses or negative net worth |
| **Business dependence** | top-5 customer or supplier share, single licence/contract/regulatory dependence, expiring approvals |
| **Risk-factor language** | historical wording such as "we have in the past not complied", "delays in filing", "show cause notice", "penalty", "default", "pledge", "adjudication", "investigation" |
| **DRHP vs RHP changes** | the document often changes between the draft and the final RHP/addendum; diff the two and flag new or removed risks, changed financials, changed use of proceeds |

How the pipeline does it: code searches the full text for these trigger phrases and parses the tables (related-party, litigation, objects of issue, financials) -> each hit is a candidate with a page and quote -> a small LLM call classifies/explains each candidate (never invents one) -> the rule engine assigns severity -> the report lists red flags with evidence. Because the search is over the whole document and not a summary, buried items are found. This is also token-cheap: the LLM only sees short candidate snippets, not 400 pages.

## 17. "Let an AI model with web search get the data" - honest assessment

It works technically, but it is not a free pass:
1. **Groq's built-in web search** (Compound / agentic tools) exists in Groq's docs but **web searches are priced separately (about $5 per 1,000 basic searches in Groq's docs)**, free-tier limits for it are unclear (two aggregator sites disagree), users report "Request too large" errors on the free tier, and one third-party page claims Compound was removed in October 2026 (unconfirmed). **Do not build the core on it.** Check your Groq console limits page before relying on it.
2. **Legal/terms:** an AI doing the reading does not change the site's terms. The scraping bans (Groww "enter into a database", IPO Watch personal-only, Chittorgarh permission needed, NSE automated-collection ban) apply to whoever fetches the page, and we would still be storing the result in our database. Facts such as "GMP is Rs 32" are not copyrightable, so the exposure is mostly breach-of-terms (IP block, takedown request), not copyright. At one low-volume read a day the practical risk is small, but it is real, and **it is your decision to accept it.**
3. **Accuracy:** LLMs misread numbers and mix up dates, especially for GMP.

**If you decide to use it, do it with guardrails (optional "AI research provider", off by default, switch in config):**
- at most one pass per open IPO per day, in the 02:00 job, never per user click;
- the model must return **numbers + source URL + the quoted text**; we verify that the quoted text actually contains the number; mismatches are discarded;
- need >= 2 independent sources agreeing within a tolerance, otherwise the value is stored as "unverified" and GMP confidence is Low;
- stored as a snapshot with timestamp, label "AI-retrieved, unofficial" in the UI, no redistribution of their pages or tables, attribution shown;
- never used to place or stage orders automatically (ipoalerts' no-automated-trading clause);
- in parallel, email the sites asking for permission; if granted, switch to a plain fetch.

## 18. Offer documents without downloading by hand (the real blocker)

You are right that the hard part is **getting the PDF**, not reading it; chat tools only "read" what a person uploads. Solution ladder, cheapest and most compliant first:

1. **SEBI hosts the PDFs.** SEBI serves draft offer documents (DRHP, updated DRHP) and many prospectuses at stable URLs of the form `sebi.gov.in/sebi_data/attachdocs/<month-year>/<id>.pdf` (confirmed by search results). A DRHP appears **weeks to months before the IPO** and already contains almost everything (business, risk factors, restated financials, litigation, related parties, objects of the issue). So analyse the **DRHP/UDRHP early**; later, only diff against the **RHP/addendum** that appears days before opening. The nightly Action checks SEBI's draft-offer-document listing once a day for new links. SEBI's website policy says reuse is allowed after emailing for permission, and does not mention automation, so **email SEBI once** to say what you are doing (a portfolio project, one low-volume check a day) and keep the reply.
2. **RHP link discovery, not downloading:** the RHP is also published on the issuer's site and the lead managers' sites (regulation requires it) and on the exchange issue pages. The nightly job finds the link (a search step) and downloads the PDF from the **issuer/lead-manager site**, which are public regulatory documents. Check each host's terms; a polite once-a-day download of a public prospectus is low risk.
3. **NSE's official MCP/AI access** (nseindia.com/nse-mcp) is the sanctioned way for AI systems to use NSE data, **for informational/educational, non-commercial use, not for real-time trading**. That fits a portfolio demo. Whether it exposes offer documents is **unverified** (my fetch of that page timed out; a search says it lists equities, derivatives, indices and corporate actions). Test it first; do not use unofficial community NSE scrapers (they break NSE's terms).
4. **Paste-a-link fallback (10 seconds per IPO, not a manual download):** an admin box where you paste the PDF URL; the pipeline downloads and analyses it. Only about 100 mainboard IPOs a year, with 3-10 open at any time, so even this fallback is minutes per week.
5. **Permission request to NSE/BSE** for low-volume automated access, if the above is not enough.

Not recommended: scraping NSE/BSE pages (explicitly against their terms), or unofficial NSE/BSE scraper libraries.

Net effect: for most IPOs the document arrives **automatically** via SEBI (DRHP) and issuer/lead-manager links; you only intervene for the occasional missing link.

---

# FINAL DECISIONS 2026-11-13 and build order

## 19. Decisions (owner: project author)
1. **Fully automated, nothing manual.** Data comes from the **ipoalerts API plus scraping** of Groww, IPO Watch, Chittorgarh and other public sites. The project author accepts the terms-of-use risk documented in section 12 for this small portfolio project. (This supersedes the "disable the scrapers / manual admin form / paste-a-link" ideas in sections 12-14; the paste-a-link box may still exist as an optional last-resort fallback, not as a required step.)
2. **Free only**: Groq free tier for the LLM, GitHub Actions for the nightly job at **02:00 IST**, no paid services.
3. **Listing gain only**, Scoring v1.1 (section 15): company reality 30% + veto, demand 30%, GMP 20% (cross-checked), float 10%, market regime 10%.
4. **Priority order each night:** open IPOs first, then upcoming by open date. Chunked analysis, every finished chunk stored; analyses are append-only and **never deleted**.
5. **Guests**: read precomputed reports and may click "Run audit" (50 clicks/day globally, DB-enforced); a click returns the cached result or queues a job - it never calls the LLM directly.
6. **Verdict**: signals + reasons as the main content; Apply / Neutral / Avoid as a corner badge.
7. **Offer documents**: found automatically (SEBI draft-offer-document listing and issuer / lead-manager links), analysed from the DRHP early and diffed against the RHP/addendum later.

## 20. Engineering rules that make a scraping-based design reliable (not legal points)
Scrapers break and get blocked; the design must stay correct when a source fails:
- **Each source is a plug-in** with a config switch, its own parser, and a recorded **health status** (last success, last error, rows parsed). A failing source is skipped, never fatal.
- **Parsers are tested against saved HTML/JSON fixtures** (committed), so a site layout change shows up as a failing test or a health alert, not as silently wrong numbers.
- **Datacenter IPs get blocked.** GitHub Actions runners often get 403/captcha pages from protected sites (BSE already returned 403 to my fetch). Mitigations: realistic headers, retries with back-off, prefer a site's JSON endpoint to its HTML, one request per page per night, response caching. If a source stays blocked the engine simply has fewer sources and lowers **confidence** (it already requires >= 2 sources for full GMP weight).
- **Polite and cheap**: at most a few requests per site per night, custom User-Agent with a contact URL, honour `Retry-After`, cache by URL and date.
- **Cross-source agreement is mandatory**: a value is trusted only when >= 2 sources agree within tolerance; disagreements are stored and shown ("sources disagree: 28% vs 41%").
- **Quality gates in the pipeline**: schema validation, plausibility ranges (e.g. GMP between -50% and +300%, subscription >= 0), freshness stamps; anything failing is stored as `rejected` with the reason, never silently used.
- **Data-quality is part of the report**: the page shows "sources used: 3 of 4, freshest 02:07 IST".
- The ipoalerts free plan covers **open IPOs only (25 requests/day, 1 IPO per request)**, so upcoming and closed IPOs come from the scrapers.
- Per ipoalerts' terms the data is never used to place or stage orders automatically; the app only suggests.

## 21. Consolidated build order (milestones)
| # | Milestone | Main content | Depends on |
|---|---|---|---|
| M1 | **Honest UI + one scoring module + history** (Phase A) | real audit states and toasts, no placeholder 27, single score function, momentum vs fundamental split, `score_history` | none |
| M2 | **Source plug-in framework + health** | refactor existing scrapers into plug-ins, add Chittorgarh and more, fixtures, tests, health table, ipoalerts API for open IPOs | M1 |
| M3 | **Snapshots and outcomes** | `gmp_snapshots`, `subscription_snapshots`, `ipo_outcomes`, nightly capture, listing-outcome capture after listing | M2 |
| M4 | **Listing-Gain Engine v1.1** | demand + GMP cross-check + float + regime + caps, backtest script, expected gain range, probabilities, confidence | M3 |
| M5 | **Allotment odds / expected value** | retail odds, sHNI/bHNI, optimizer ranks by expected rupees | M4 |
| M6 | **Document pipeline** | SEBI listing discovery, issuer link discovery, PDF text/tables, DRHP vs RHP diff, chunk store, append-only versions | M2 |
| M7 | **Red-flag engine** | trigger-phrase + table rules, Groq snippet classification, veto rules, evidence with page links | M6 |
| M8 | **Nightly GitHub Actions job** | 02:00 IST, priority queue (open first), token budget, resume, secrets | M2-M7 |
| M9 | **Report UI + guest queue** | badge + reasons + flags + data-quality panel, 50/day global cap, cached/queued runs | M4, M7, M8 |
| M10 | **Calibration + live-demo proof** | backtest published in README, precomputed demo reports, screenshots | M3-M9 |

Each milestone follows the same rules as the audit: failing test first, small commits, full suite green, AUDIT.md updated.

## 22. What I need from the project author (one-time)
- **ipoalerts API key** (free) -> GitHub secret `IPOALERTS_API_KEY`.
- **Groq API key** -> GitHub secret `GROQ_API_KEY` (and keep the console limits page open while we measure tokens).
- **Database URL** for the nightly job -> secret `DATABASE_URL` (the Postgres the app uses).
- Approval for the **data-model changes** (new tables, append-only report versions, removing the cascade that would delete analyses).


## 23. Progress log
- **M1 done (2026-11-13):** single scoring module `app/utils/scoring.py`; "No score yet" instead of placeholder numbers (backend + frontend, removed the UI `|| 50` / `|| 70` defaults and the frontend's own copy of the formula); one `effective_rating` rule (audited report wins; stored stubs are not audits; live GMP cannot overwrite an audited score); list, report and optimizer agree (contract test); `score_history` table (append-only, no cascade) + Alembic migration `d2a91f6c7b10`; report API returns `audit_state` / `audit_note` and the audit toast now reflects what really happened; removed invented P/E 24.0 and hard-coded fake "PASS" gatekeeper texts in the frontend.
- Next: **M0** (persistent Postgres; needs the database URL) then **M2** (source plug-ins).
- **M0 (2026-11-13, in progress):** Postgres verified; migration chain repaired and made idempotent; catch-up migration; safe `init_db`; dry-run tool and manual migrate workflow; CI runs Postgres tests. **Not yet applied to the real database: waiting for explicit approval.**
