# 📐 Business Logic — The Rules That Cannot Change Without Ravi's Approval

## 1. IPO Scoring System (0–100)

Every IPO gets a composite score. This score drives all downstream decisions.

### Scoring Weights (must sum to 100%)

| Dimension | Weight | Who Computes | What It Measures |
|-----------|--------|-------------|-----------------|
| Financial Quality | **25%** | Claude Haiku (DRHP analysis) | Revenue growth, margins, debt/equity, promoter holding, auditor quality, litigation red flags |
| GMP Signal | **20%** | Gemini Flash-Lite | Grey market premium from Telegram groups, forums, informal market — signals real demand |
| Subscription Hype | **20%** | Gemini Flash-Lite | News coverage, Twitter/Reddit/YouTube sentiment, influencer coverage, retail buzz |
| Allotment Probability | **15%** | Internal math | Expected subscription rate × category lots → probability of getting 1 lot |
| Industry Trend | **10%** | Gemini Flash-Lite | Sector momentum — is the sector hot right now? Recent sector IPO performance? |
| Lock-in Conflict | **10%** | fund_optimizer.py | If our ASBA money is blocked during a better IPO window, penalize this IPO |

### Score → Recommendation Thresholds

| Score | Recommendation | Action |
|-------|---------------|--------|
| 80–100 | **STRONG APPLY** | Apply in all categories where funds allow |
| 60–79 | **MODERATE APPLY** | Retail + sHNI only |
| 40–59 | **WATCH** | Apply only if no competing IPO in same window |
| 0–39 | **AVOID** | Do not apply |

### Red Flags (auto-detected by Claude, force score penalty)

These are hard signals that reduce score regardless of other metrics:
- Promoter holding < 50% post-IPO → -15 points
- Negative operating cash flow for 2+ consecutive years → -20 points
- Qualified auditor's report or audit exceptions → -25 points
- Revenue declined YoY → -10 points
- Debt/Equity > 2.0 → -10 points
- Related-party transactions > 20% of revenue → -10 points
- Litigation amount > 50% of IPO size → -15 points

---

## 2. Fund Allocation System

### IPO Application Categories (SEBI-defined)

| Category | Amount Range | Lots | Allotment Logic |
|----------|-------------|------|-----------------|
| **Retail** | ≤ ₹2,00,000 | 1–13 lots | Lottery-based if oversubscribed |
| **sHNI** (Small HNI) | ₹2,00,001 – ₹10,00,000 | 14–100 lots (approx) | Proportionate if oversubscribed |
| **bHNI** (Big HNI) | > ₹10,00,000 | 100+ lots | Proportionate if oversubscribed |

**Why this matters**: sHNI and bHNI get proportionate allotment → applying more money = more shares. Retail is pure lottery. The optimizer must weigh expected value, not just probability.

### Fund Allocation Rules (Hardcoded — Do Not Change)

```
Rule 1: Never block > 80% of total family fund in a single IPO
Rule 2: Always check fund release (ASBA refund) dates vs next IPO open date
         → If funds are still locked when next IPO opens: mark as conflict
Rule 3: Prefer 1 bHNI application over multiple Retails IF:
         score >= 65 AND expected subscription <= 5X
Rule 4: For sHNI/bHNI, calculate break-even subscription rate
         (what subscription level makes proportionate allotment worth the capital lock-in?)
Rule 5: Each family member has an independent available_balance (post ASBA locks)
Rule 6: Maximum 1 application per account per IPO (SEBI rule)
Rule 7: Minimum lot size must be respected — never apply partial lots
```

### Allocation Optimization (PuLP Constraint Solver)

The `fund_optimizer.py` solves this as a linear program:

**Objective**: Maximize Σ (expected_return_per_account_per_ipo)

**Variables**: binary decision per (account × IPO × category)

**Constraints**:
- Sum of blocked funds per account ≤ available_balance[account]
- At most 1 application per (account × IPO)
- Only apply if score ≥ 40 (avoid below threshold)
- Respect ASBA dates: don't block funds beyond account's risk tolerance date
- Respect category minimums/maximums

**Inputs to solver** (from agents):
- score per IPO (from score_engine.py)
- expected_subscription_rate per IPO × category (from news_agent)
- lot_size, issue_price, min_lots per category (from ipo_service)
- available_balance per account (from fund_service)
- lock_dates (subscription_open, subscription_close, allotment_date, refund_date)

---

## 3. Allotment Tracking Logic

After submission:
1. Poll Angel One SmartAPI every 30 minutes from T+5 to T+7 (allotment day)
2. On allotment confirmation:
   - Get allotted shares count from API
   - If shares > 0 → mark `AllotmentStatus.ACTIVE`
   - If shares = 0 → mark `AllotmentStatus.INACTIVE` (refund pending)
3. On ACTIVE allotment:
   - Calculate listing gain estimate from current GMP
   - Estimate listing price
   - Stage pre-listing sell order if estimated gain > 10%
   - Trigger sell automatically via APScheduler at T+listing_day 09:00 IST

---

## 4. Pre-listing Sell Logic

Conditions to trigger pre-listing sell:
```
IF allotment.status == ACTIVE
AND listing_date == tomorrow
AND gmp_signal >= issue_price * 1.10  (at least 10% listing premium expected)
THEN:
    Stage limit sell order at: min(issue_price * 1.20, current_gmp * 0.95)
    Submit via Angel One SmartAPI at 09:00:00 IST on listing_date
    Set 30-minute validity (MO order)
```

If order doesn't fill by 09:30, cancel and re-evaluate (may hold for better price).

---

## 5. P&L Calculation

Per-allotment P&L:
```
invested_amount = allotted_shares × issue_price
selling_amount = sold_shares × sell_price
brokerage = Angel One charges (currently 0 for delivery, DP charges apply)
dp_charges = ₹15.93 per sell (Angel One DP charge for demat debit)
actual_pnl = selling_amount - invested_amount - brokerage - dp_charges - taxes
roi_percent = (actual_pnl / invested_amount) × 100
```

For unsold (held past listing):
```
current_value = allotted_shares × current_market_price
unrealized_pnl = current_value - invested_amount
```
