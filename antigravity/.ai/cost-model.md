# 💰 Cost Model

## Development Phase (Now → Go Live): ₹0/month

| Component | Dev Cost | How |
|-----------|---------|-----|
| Infrastructure | ₹0 | Docker Compose locally — Postgres + Redis + API on laptop |
| Claude API | ₹0 | $5 free credit on signup covers ~100 IPO analyses |
| Gemini API | ₹0 | 1,000 req/day free tier |
| Angel One SmartAPI | ₹0 | Permanently free |
| GitHub (CI/CD) | ₹0 | Free for private repos |
| **Total dev** | **₹0** | |

## Production Phase (When Go Live): ~₹2,400–2,600/month

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| EC2 t3.small (AWS Mumbai) | ~₹1,800 | Runs Docker: API + Postgres + Redis + Nginx |
| Elastic IP | ~₹300 | Static IP mandatory for NSE whitelist |
| Data transfer | ~₹200 | API calls, monitoring |
| Claude Haiku (Batch API) | ~$0.50 (~₹42) | ~10 IPOs/month × DRHP analysis, 50% batch discount |
| Gemini Flash-Lite | ~$0.30 (~₹25) | News + GMP calls, after free tier |
| **Total production** | **~₹2,370** | Well under ₹4k target |

## AI API Detailed Breakdown

### Claude Haiku Usage Pattern
```
DRHP Analysis:
- Input: ~15,000 tokens per IPO (prospectus excerpt + structured prompt)
- Output: ~500 tokens (JSON response)
- Cost: (15,000 × $0.0008 + 500 × $0.004) / 1,000,000
- Per IPO analysis: ~$0.014 ($0.007 with batch)
- 10 IPOs/month: ~$0.07/month (batch)

Red Flag Report:
- Similar token usage to DRHP analysis
- 10 IPOs/month: ~$0.07/month (batch)

Real-time queries (score refresh, user-triggered):
- ~20 calls/month, non-batch
- ~$0.10/month

TOTAL CLAUDE: ~$0.25–0.50/month
```

### Gemini Flash-Lite Usage Pattern
```
GMP Fetch (every 2 hours, 12 hours/day):
- 6 calls/day × 30 days = 180 calls/month
- Input: ~200 tokens, Output: ~150 tokens
- Cost: negligible, well within free tier

News Sentiment (every 4 hours):
- 3 calls/day × 30 days = 90 calls/month  
- Input: ~500 tokens, Output: ~300 tokens
- All within 1,000 req/day free tier

TOTAL GEMINI: ~$0/month (free tier covers all usage)
```

## Cost Optimization Switches

| Optimization | Savings | How |
|-------------|---------|-----|
| Claude Batch API | 50% off | Use for all overnight/non-real-time analyses |
| Gemini Flash-Lite vs Flash | 10x cheaper | Flash-Lite at $0.10/M vs Flash at $1.00/M |
| Single EC2 vs RDS+EC2 | ₹4,000/month | Self-managed Postgres in Docker |
| No load balancer | ₹1,500/month | Nginx on same EC2 |
| No CloudWatch | ₹500/month | Use Prometheus + Grafana self-hosted |

## Break-Even Analysis

The platform pays for itself with **1 good allotment per month**:
```
Typical scenario:
- 1 lot allotted in a decent IPO
- Issue price: ₹400, Lot size: 35 shares = ₹14,000 invested
- 20% listing gain = ₹2,800 profit
- Platform cost: ₹2,400/month
- Net: +₹400 just from one allotment

With 10 accounts applying across 4 IPOs/month:
- Even 2-3 allotments at 15% gain = ₹6,000–₹9,000 profit
- Platform cost: ₹2,400
- ROI on platform: 150-275% monthly
```
