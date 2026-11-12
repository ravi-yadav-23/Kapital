# IPO Scoring System

## Score: 0–100

| Dimension | Weight | Source |
|-----------|--------|--------|
| Financial Quality | 25% | LLM opinion on listed highlights (model configurable; null if not assessed) |
| GMP Signal | 20% | Deterministic from feed GMP % |
| Subscription Hype | 20% | Gemini (social + news sentiment) |
| Allotment Probability | 15% | Category math × subscription rate |
| Industry Trend | 10% | Gemini (sector news) |
| Lock-in Conflict | 10% | Internal fund optimizer |

## Recommendation thresholds
- **80–100**: Apply (strong) — all categories where funds allow
- **60–79**: Apply (moderate) — retail + sHNI only
- **40–59**: Watch — apply only if no competing IPO
- **0–39**: Avoid
