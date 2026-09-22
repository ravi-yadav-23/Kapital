# Fund Allocation Algorithm

## Problem
Given N IPOs open/upcoming and M family accounts with K total funds,
allocate rupees to maximize expected profit subject to:
- ASBA lock-in constraints (funds blocked until refund date)
- Category thresholds (retail ≤₹2L, sHNI ₹2–10L, bHNI >₹10L)
- Each family member = 1 PAN = 1 application per IPO per category

## Approach
1. Score all open/upcoming IPOs (0–100)
2. Build fund availability timeline per account (block/release dates)
3. Run constraint solver (PuLP) to maximize: Σ(score × expected_return × allocated_flag)
4. Output: AllocationPlan per IPO

## Key rules
- 1 bHNI > 9 retail in expected value IF score ≥ 65 AND subscription ≤ 5X
- If next IPO opens before current refund date → split funds
- Never block >80% of total family fund in a single IPO
