# IPO scoring (Listing-Gain Engine)

There is **one score** per IPO (0 to 100, or "No score yet"). It is computed in one place,
`apps/api/app/services/rating.py`, using `apps/api/app/utils/listing_gain.py`. The IPO list, the report page, the
badges and the optimizer all read it, so the same IPO never shows two different numbers.

The goal is narrow: how likely is an IPO to list above its issue price, for someone who sells on listing day.

## Inputs and weights

Inputs that are unknown are left out and the others share the weight. Nothing is replaced by an invented number.

| Input | Weight | Source |
|-------|--------|--------|
| Company quality | 30% | Facts read from the offer document by the nightly job (profit, growth, debt, cash flow, valuation, promoter holding) |
| Demand | 30% | Total and QIB subscription multiples |
| Grey-market premium (GMP) | 20% | Unofficial premium; capped, and discounted when demand does not back it |
| Issue size (float) | 10% | Smaller issues tend to react more |
| Market mood | 10% | Reserved; ignored while there is no input |

Before the offer document has been analysed the score uses market data only and says so. When a document has been
analysed, company quality and red flags are added and the score is recomputed with the latest market numbers.

## Safeguards

- With fewer than two of company quality, demand and GMP, the score stays between 45 and 60 (Watch): one signal alone can neither recommend nor reject. Only a quote-backed critical flag can still veto.
- GMP far stronger than demand supports is pulled down to just above demand.
- A critical red flag caps the score at 35. A critical flag needs a quote from the document that really appears in
  the text; without one it is a high flag (minus 10 points). Medium flags subtract 4. Together at most 25 points.
- For banks and finance companies the leverage and operating-cash-flow rules are skipped (a lender borrows to lend).

## Verdicts

| Score | Verdict | Badge |
|-------|---------|-------|
| 80 and above | Strong apply | Apply |
| 62 to 79 | Moderate apply | Apply |
| 45 to 61 | Watch | Watch |
| below 45 | Avoid | Avoid |
| no data | Pending | none |

## Status

The weights and bands are a reasoned starting point and are **not yet calibrated** against enough real listing
results. The daily GMP and subscription snapshots and the listing outcomes (`ipo_outcomes`) are being collected so
that `backtest()` in `listing_gain.py` can check them. See `docs/reports/` for the current list of open problems.
