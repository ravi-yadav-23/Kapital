# Fund allocation

Code: `apps/api/app/services/optimizer_service.py` (PuLP solver with a greedy fallback) and
`apps/api/app/utils/allotment_odds.py`.

## Problem

Given the open IPOs and the family's demat accounts with their available funds, decide which account bids in which
IPO and in which category (retail, small HNI, big HNI).

## What the optimizer values

Each possible bid is worth

    amount x P(allotment in that category) x expected listing gain x score confidence

- **P(allotment)** is one divided by the category's subscription multiple (1 when under-subscribed; the overall
  multiple is used when the category's is unknown).
- **Expected listing gain** comes from the grey-market premium, capped at 80%, and is zero when there is no quote.
- **Score confidence** is the IPO's score divided by 100 (the single engine score).

So a hot but heavily oversubscribed IPO no longer beats a modest one you will actually get shares in.

## Rules it enforces

- One bid per PAN per IPO (SEBI), across the family's demat accounts.
- Category limits: retail up to 2 lakh, small HNI 2 to 10 lakh, big HNI above 10 lakh.
- UPI is limited to 5 lakh per bid; larger bids are tagged for net banking (ASBA).
- Per-account budgets; money locked by earlier applications (ASBA) is not reused before its refund date.
- Capital can be reserved for a high-scoring IPO that opens before an earlier one refunds.
- An open IPO whose price band or lot size is not known yet is **skipped with a reason**, never allocated with
  guessed terms.

## Limits

It is a heuristic. It gives a good plan under those rules, not a guaranteed best one, and it makes no promise about
allotment or profit.
