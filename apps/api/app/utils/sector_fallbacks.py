from typing import Dict, Any, List


SECTOR_FALLBACKS: Dict[str, Dict[str, List[str]]] = {
    "healthcare": {
        "strengths": [
            "Hospital bed capacity expansion across key urban clusters",
            "Improving ARPOB (Average Revenue Per Occupied Bed) trajectory",
            "Growing private health insurance penetration driving patient volumes",
        ],
        "risks": [
            "Ayushman Bharat / CGHS government tariff cap exposure",
            "High doctor attrition and specialist talent retention costs",
            "Regional geographic concentration risk",
            "High capital expenditure cycles for advanced medical equipment",
        ],
    },
    "technology": {
        "strengths": [
            "Predictable recurring revenue model with enterprise stickiness",
            "Expanding addressable market (TAM) across domestic and global clients",
            "High gross margin software profile with strong operating leverage",
        ],
        "risks": [
            "Customer and client concentration risk",
            "Rising Customer Acquisition Cost (CAC) and lengthening sales cycles",
            "Key technical person dependency and talent inflation",
            "Intense competitive pricing pressure from legacy and cloud-native players",
        ],
    },
    "finance": {
        "strengths": [
            "Robust Net Interest Margins (NIM) with disciplined underwriting",
            "Diversified retail asset portfolio with low Gross NPA ratio",
            "Strong capital adequacy ratio exceeding regulatory benchmarks",
        ],
    },
    "manufacturing": {
        "strengths": [
            "Government PLI scheme incentives supporting capacity ramp-up",
            "Strong backward integration improving operating margins",
            "Diversified order book with tier-1 industrial clients",
        ],
        "risks": [
            "Raw material commodity price volatility affecting input costs",
            "High working capital requirements and extended receivable cycles",
            "Environmental compliance and stringent factory emission norms",
            "Cyclical industrial demand dependency",
        ],
    },
    "consumer": {
        "strengths": [
            "High brand recall with pan-India omnichannel distribution",
            "Premiumization trend driving average realization growth",
            "Strong direct-to-consumer (D2C) repeat purchase loyalty",
        ],
        "risks": [
            "Intense competition from organized regional and D2C challenger brands",
            "Sensitivity to discretionary consumer spending slowdowns",
            "Fluctuating packaging and agricultural input raw material costs",
            "High marketing and advertising spend required to defend market share",
        ],
    },
    "default": {
        "strengths": [
            "Established operating market position in core addressable market",
            "Experienced promoter management team with multi-year track record",
            "Demonstrated positive operating cash flow generation",
        ],
        "risks": [
            "Working capital requirements and cash conversion cycle sensitivity",
            "Regulatory compliance risk across state and central jurisdictions",
            "General macroeconomic and equity capital market volatility",
        ],
    },
}

# Synonyms for sector detection
_SECTOR_KEYWORDS: Dict[str, List[str]] = {
    "healthcare": ["health", "hospital", "pharma", "medical", "clinic", "diagnostic", "paras", "dr.", "biotech", "care"],
    "technology": ["tech", "software", "saas", "digital", "cloud", "platform", "it", "telecom", "data", "ai", "cyber", "jio"],
    "finance": ["bank", "finance", "fintech", "nbfc", "capital", "wealth", "insurance", "loan", "lending", "broker"],
    "manufacturing": ["manufacturing", "engineer", "steel", "chemical", "industrial", "auto", "power", "energy", "infra", "metal", "cement"],
    "consumer": ["retail", "consumer", "fmcg", "food", "fashion", "apparel", "brand", "beverage", "lifestyle", "jewel"],
}


def detect_sector(name: str = "", industry: str = "", about: str = "") -> str:
    """Detects the business sector based on industry label, company name, and description."""
    combined = f"{name} {industry} {about}".lower()
    for sector, keywords in _SECTOR_KEYWORDS.items():
        if any(kw in combined for kw in keywords):
            return sector
    return "default"


def get_sector_fallback(name: str = "", industry: str = "", about: str = "") -> Dict[str, List[str]]:
    """Retrieves sector-tailored strengths and risks for fallback scenarios."""
    sector = detect_sector(name, industry, about)
    fallback = SECTOR_FALLBACKS.get(sector, SECTOR_FALLBACKS["default"])
    return {
        "sector": sector,
        "strengths": list(fallback.get("strengths", SECTOR_FALLBACKS["default"]["strengths"])),
        "risks": list(fallback.get("risks", SECTOR_FALLBACKS["default"]["risks"])),
    }
