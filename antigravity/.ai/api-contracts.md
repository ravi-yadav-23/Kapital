# 🔌 External API Contracts

## 1. Angel One SmartAPI

**Base URL**: `https://apiconnect.angelone.in`  
**Docs**: https://smartapi.angelbroking.com/docs  
**Cost**: FREE for all endpoints  
**Auth**: Session-based JWT (expires daily) + TOTP (refreshed each login)

### Authentication Flow
```python
# Step 1: Generate TOTP using stored secret
import pyotp
totp = pyotp.TOTP(account.totp_secret).now()

# Step 2: Login to get JWT
POST /rest/auth/angelbroking/user/v1/loginByPassword
Body: {
  "clientcode": account.client_id,
  "password": account.mpin,      # 4-6 digit PIN
  "totp": totp                   # 6-digit TOTP
}
Response: { "jwtToken": "...", "refreshToken": "...", "feedToken": "..." }

# Step 3: Use JWT for all subsequent calls
Header: Authorization: Bearer {jwtToken}
Header: X-UserType: USER
Header: X-SourceID: WEB
Header: X-ClientLocalIP: {static_ip}
Header: X-ClientPublicIP: {static_ip}
Header: X-MACAddress: {mac}
Header: X-PrivateKey: {api_key}
```

**IMPORTANT**: Sessions expire at end of day. We must re-login each morning before market open (APScheduler job at 8:45 AM IST).

### Key Endpoints We Use

```
# IPO Application (ASBA)
POST /rest/secure/angelbroking/ipo/v1/placeIPOorder
Body: {
  "ipoName": "string",
  "quantity": int,         # number of lots × lot_size
  "price": float,          # cutoff price or specific price
  "category": "RII|NII|BHNI",
  "upiId": "string"        # Pre-registered UPI ID (V1: manual step)
}

# Check IPO Allotment Status
GET /rest/secure/angelbroking/ipo/v1/getIPOAllotment?ipoName=...

# Place Regular Order (for pre-listing sell)
POST /rest/secure/angelbroking/order/v1/placeOrder
Body: {
  "variety": "NORMAL",
  "tradingsymbol": "string",
  "symboltoken": "string",
  "transactiontype": "SELL",
  "exchange": "NSE",
  "ordertype": "LIMIT",
  "producttype": "DELIVERY",
  "duration": "DAY",
  "price": float,
  "quantity": int
}

# Get Portfolio (holdings)
GET /rest/secure/angelbroking/portfolio/v1/getAllHolding

# Get Account Balance
GET /rest/secure/angelbroking/user/v1/getRMS
Response includes: { "net": float, "availablecash": float }
```

### Error Handling Rules
- `401` → session expired → re-login with TOTP → retry once
- `429` → rate limit → backoff 2 seconds → retry up to 3 times
- `500/503` → Angel One outage → log + alert → do NOT retry order placement (idempotency risk)

---

## 2. Claude API (Anthropic)

**Model**: `claude-haiku-4-5` (primary), `claude-haiku-4-5` batch for overnight jobs  
**SDK**: `anthropic` Python SDK  
**Cost**: ~$0.80/million input tokens, $4/million output tokens (Haiku)  
**Batch discount**: 50% off — use for overnight DRHP analysis

### How We Call Claude

```python
from anthropic import AsyncAnthropic

client = AsyncAnthropic(api_key=settings.anthropic_api_key)

response = await client.messages.create(
    model="claude-haiku-4-5",
    max_tokens=2048,
    system=ANALYSIS_SYSTEM_PROMPT,  # from prompts.py
    messages=[{
        "role": "user",
        "content": f"Analyze this IPO: {ipo_data_json}"
    }]
)
result = response.content[0].text
```

### What Claude Does
1. **Financial Quality Score (0–25)**: Reads IPO prospectus summary → revenue growth, margins, debt, promoter holding → outputs structured JSON score
2. **Red Flag Detection**: Returns list of red flags with severity and score penalty
3. **IPO Summary Report**: 200-word plain English summary for dashboard display

### Response Format (JSON always — never prose from Claude)
```json
{
  "financial_quality_score": 18,
  "red_flags": [
    {"flag": "Negative operating cash flow", "severity": "HIGH", "penalty": 20}
  ],
  "summary": "...",
  "reasoning": "..."
}
```

---

## 3. Gemini API (Google)

**Model**: `gemini-2.5-flash-lite` (primary)  
**SDK**: `google-generativeai` Python SDK  
**Cost**: $0.10/million input, $0.40/million output (Flash-Lite)  
**Free tier**: 1,000 requests/day — sufficient for development

### How We Call Gemini

```python
import google.generativeai as genai

genai.configure(api_key=settings.gemini_api_key)
model = genai.GenerativeModel("gemini-2.5-flash-lite")

response = await model.generate_content_async(
    contents=GMP_PROMPT.format(ipo_name=ipo.name),
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json"
    )
)
data = json.loads(response.text)
```

### What Gemini Does
1. **GMP Signal (0–20)**: Searches recent news + grey market references → estimates GMP as % of issue price
2. **Subscription Hype (0–20)**: Social media sentiment, news coverage volume, influencer mentions
3. **Industry Trend (0–10)**: Sector performance, peer IPO returns, sector news

### Response Format (always JSON)
```json
{
  "gmp_estimate_pct": 35.0,
  "gmp_confidence": "HIGH|MEDIUM|LOW",
  "gmp_score": 16,
  "sources": ["url1", "url2"],
  "reasoning": "..."
}
```

---

## 4. IPO Data Sources

**Primary**: We scrape/parse from:
- `https://www.nseindia.com/market-data/upcoming-issues-ipo` (NSE official)
- `https://www.bseindia.com/markets/PublicIssues/IPODetails_new.aspx` (BSE official)
- `https://ipomonitor.com` (aggregator, good for subscription data)
- `https://investorgain.com/report/ipo-grey-market-premium/` (GMP data)

**Scraping cadence**:
- Daily at 2:00 AM IST: fetch new/updated IPO data
- Every 30 min during market hours: update subscription rates
- On-demand: when user manually triggers refresh

**Data we need per IPO**:
```
name, symbol, exchange, issue_price, lot_size, min_investment,
issue_open_date, issue_close_date, allotment_date, refund_date, listing_date,
total_issue_size, retail_quota, sHNI_quota, bHNI_quota,
current_subscription_retail, current_subscription_sHNI, current_subscription_bHNI,
drhp_url, prospectus_url,
company_sector, promoter_holding_pct,
revenue_3yr (JSON), pat_3yr (JSON), debt_equity_ratio
```

---

## 5. Cost Optimization Strategy

### AI API Usage Pattern
| Task | Model | When | Estimated cost/month |
|------|-------|------|---------------------|
| DRHP analysis | Claude Haiku (Batch) | Overnight, once per IPO | ~$0.50 |
| Red flag detection | Claude Haiku (Batch) | Same as above | included |
| GMP fetch | Gemini Flash-Lite | Every 2 hours during market | ~$0.20 |
| News sentiment | Gemini Flash-Lite | Every 4 hours | ~$0.10 |
| Industry trend | Gemini Flash-Lite | Once daily | ~$0.05 |
| **Total AI cost** | | | **~$1–2/month** |

### Free Tier Usage
- Gemini: 1,000 req/day free → during development, all news agent calls are free
- Claude: $5 free credit on signup → covers first ~100 IPO analyses
- Angel One SmartAPI: completely free
- GitHub Actions: free for private repos (2,000 min/month)
