'use client'

import React, { useState } from 'react'
import {
  Terminal,
  Play,
  Copy,
  Check,
  Code2,
  Database,
  Radio,
  ExternalLink,
} from 'lucide-react'

interface ApiEndpoint {
  id: string
  method: 'GET' | 'POST' | 'WS'
  path: string
  title: string
  description: string
  curlSnippet: string
  pythonSnippet: string
  tsSnippet: string
  sampleResponse: any
}

const ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'ipos',
    method: 'GET',
    path: '/api/ipos',
    title: 'List IPO Pipeline',
    description: 'Returns active, closing today, upcoming, and closed IPOs with real-time GMP and 6-factor score.',
    curlSnippet: `curl -X GET "https://kapital-gamma-nine.vercel.app/api/ipos" \\
  -H "Accept: application/json"`,
    pythonSnippet: `import httpx

response = httpx.get("https://kapital-gamma-nine.vercel.app/api/ipos")
ipos = response.json()
print(f"Loaded {len(ipos)} issues. First: {ipos[0]['name']}")`,
    tsSnippet: `const res = await fetch('https://kapital-gamma-nine.vercel.app/api/ipos')
const ipos = await res.json()
console.log('IPOs active:', ipos.filter(i => i.status === 'open'))`,
    sampleResponse: [
      {
        id: "tonbo-imaging-2026",
        name: "Tonbo Imaging India Ltd",
        symbol: "TONBO",
        type: "EQ",
        status: "open",
        lot_size: 21,
        price_band_min: 700.0,
        price_band_max: 700.0,
        min_investment: 14700.0,
        gmp_percent: 41.5,
        score: 84,
        issue_close_date: "2026-11-06",
        listing_date: "2026-11-11"
      },
      {
        id: "vedant-poly-2026",
        name: "Vedant Poly Fabs Solutions",
        symbol: "VPFL",
        type: "SME",
        status: "open",
        lot_size: 1200,
        price_band_min: 88.0,
        price_band_max: 94.0,
        min_investment: 112800.0,
        gmp_percent: 16.0,
        score: 45,
        issue_close_date: "2026-11-05",
        listing_date: "2026-11-09"
      }
    ]
  },
  {
    id: 'optimize',
    method: 'POST',
    path: '/api/funds/optimize',
    title: 'PuLP MILP Allocation Solver',
    description: 'Executes mathematical optimization across family demat balances under SEBI quota rules.',
    curlSnippet: `curl -X POST "https://kapital-gamma-nine.vercel.app/api/funds/optimize" \\
  -H "Authorization: Bearer <GUEST_OR_ADMIN_JWT>" \\
  -H "Content-Type: application/json"`,
    pythonSnippet: `import httpx

headers = {"Authorization": "Bearer demo-guest-jwt-token"}
res = httpx.post("https://kapital-gamma-nine.vercel.app/api/funds/optimize", headers=headers)
plan = res.json()
print("Plan Status:", plan["status"], "Deployed:", plan["total_capital_deployed"])`,
    tsSnippet: `const res = await fetch('https://kapital-gamma-nine.vercel.app/api/funds/optimize', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${token}\` },
})
const plan = await res.json()
console.log('Optimized entries count:', plan.entries.length)`,
    sampleResponse: {
      plan_id: "plan-1793822035",
      generated_at: "2026-11-05T01:23:55Z",
      status: "OPTIMAL",
      total_capital_deployed: 338400.0,
      solve_time_ms: 12,
      is_demo: true,
      asba_lock_overlaps_detected: 0,
      entries: [
        {
          account_id: "demat-01",
          account_name: "Ramesh Yadav",
          ipo_id: "vedant-poly-2026",
          ipo_name: "Vedant Poly Fabs Solutions",
          category: "SHNI",
          lots_to_bid: 2,
          shares_to_bid: 2400,
          capital_required: 225600.0,
          expected_return_pct: 16.0,
          solver_rationale: "sHNI lottery quota selected for higher absolute rupee returns"
        },
        {
          account_id: "demat-02",
          account_name: "Sunita Yadav",
          ipo_id: "vedant-poly-2026",
          ipo_name: "Vedant Poly Fabs Solutions",
          category: "RETAIL",
          lots_to_bid: 1,
          shares_to_bid: 1200,
          capital_required: 112800.0,
          expected_return_pct: 16.0,
          solver_rationale: "Retail allotment odds maximization (SEBI 1-lot lottery rule)"
        }
      ],
      warnings: [
        "DEMO MODE: Showing sample allocation plan with demo family accounts."
      ]
    }
  },
  {
    id: 'reports',
    method: 'GET',
    path: '/api/reports/{id}',
    title: 'Dual-Agent AI Forensic Audit',
    description: 'Retrieves 400-page DRHP forensic diligence, 5 SEBI listing gatekeepers, and score breakdown.',
    curlSnippet: `curl -X GET "https://kapital-gamma-nine.vercel.app/api/reports/tonbo-imaging-2026" \\
  -H "Accept: application/json"`,
    pythonSnippet: `import httpx

res = httpx.get("https://kapital-gamma-nine.vercel.app/api/reports/tonbo-imaging-2026")
report = res.json()
print("Verdict:", report["verdict"], "Score:", report["conviction_score"])`,
    tsSnippet: `const res = await fetch('https://kapital-gamma-nine.vercel.app/api/reports/tonbo-imaging-2026')
const report = await res.json()
console.log('Gatekeepers passed:', report.gatekeepers.filter(g => g.passed).length)`,
    sampleResponse: {
      ipo_id: "tonbo-imaging-2026",
      company_name: "Tonbo Imaging India Ltd",
      conviction_score: 84,
      verdict: "STRONG APPLY",
      audit_run: true,
      gatekeepers: [
        { name: "Promoter Dilution & OFS Split", status: "PASS", detail: "Fresh issue 80%, OFS 20%" },
        { name: "Material Litigation", status: "PASS", detail: "Litigation claims < 2% of Net Worth" },
        { name: "Debt-to-Equity & Solvency", status: "PASS", detail: "D/E 0.12x, strong CFO positive" },
        { name: "Related-Party Transactions", status: "PASS", detail: "Arms-length disclosures verified" },
        { name: "Auditor Qualifications", status: "PASS", detail: "Clean unmodified auditor report" }
      ],
      score_breakdown: {
        financial_growth: 88,
        valuation_safety: 82,
        promoter_governance: 86,
        industry_tailwinds: 85,
        subscription_velocity: 78,
        gmp_strength: 84
      }
    }
  }
]

export function InteractiveApiConsole() {
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('ipos')
  const [activeTab, setActiveTab] = useState<'curl' | 'python' | 'ts' | 'response'>('response')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const endpoint = ENDPOINTS.find((e) => e.id === selectedEndpointId) || ENDPOINTS[0]

  const handleRunRequest = () => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setActiveTab('response')
    }, 400)
  }

  const handleCopyCode = async () => {
    const textToCopy =
      activeTab === 'curl'
        ? endpoint.curlSnippet
        : activeTab === 'python'
        ? endpoint.pythonSnippet
        : activeTab === 'ts'
        ? endpoint.tsSnippet
        : JSON.stringify(endpoint.sampleResponse, null, 2)

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden my-6">
      {/* ── HEADER ── */}
      <div className="p-4 sm:p-5 border-b border-[var(--border-default)] bg-[var(--bg-elevated)]/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[var(--ink-1)] flex items-center gap-2">
              Interactive API Playground & Sandbox Console
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400">
                Live Console
              </span>
            </h3>
            <p className="text-2xs text-[var(--ink-3)]">
              Execute requests, inspect real JSON schemas, and switch between cURL, Python, and TypeScript.
            </p>
          </div>
        </div>

        <button
          onClick={handleRunRequest}
          disabled={isLoading}
          className="btn btn-primary btn-sm gap-1.5 self-stretch sm:self-auto"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{isLoading ? 'Executing...' : 'Test Request'}</span>
        </button>
      </div>

      {/* ── ENDPOINT TABS ── */}
      <div className="px-4 py-2.5 border-b border-[var(--border-default)] bg-[var(--bg-base)] flex flex-wrap items-center gap-2">
        {ENDPOINTS.map((ep) => {
          const isSelected = ep.id === selectedEndpointId
          return (
            <button
              key={ep.id}
              onClick={() => setSelectedEndpointId(ep.id)}
              className={`px-3 py-1.5 rounded text-xs font-mono flex items-center gap-2 transition-colors ${
                isSelected
                  ? 'bg-[var(--bg-elevated)] text-[var(--ink-1)] border border-[var(--accent)] font-medium'
                  : 'text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-[var(--bg-elevated)]/50'
              }`}
            >
              <span
                className={`text-[10px] font-bold ${
                  ep.method === 'GET'
                    ? 'text-blue-400'
                    : ep.method === 'POST'
                    ? 'text-[var(--positive)]'
                    : 'text-purple-400'
                }`}
              >
                {ep.method}
              </span>
              <span>{ep.path}</span>
            </button>
          )
        })}
      </div>

      {/* ── CODE LANGUAGE & RESPONSE TABS ── */}
      <div className="px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-elevated)]/40 flex items-center justify-between">
        <div className="flex items-center gap-1 text-2xs font-mono">
          <button
            onClick={() => setActiveTab('response')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'response'
                ? 'bg-[var(--bg-subtle)] text-[var(--accent)] font-medium'
                : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]'
            }`}
          >
            Response Payload (200 OK)
          </button>
          <button
            onClick={() => setActiveTab('curl')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'curl'
                ? 'bg-[var(--bg-subtle)] text-[var(--accent)] font-medium'
                : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]'
            }`}
          >
            cURL
          </button>
          <button
            onClick={() => setActiveTab('python')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'python'
                ? 'bg-[var(--bg-subtle)] text-[var(--accent)] font-medium'
                : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]'
            }`}
          >
            Python (httpx)
          </button>
          <button
            onClick={() => setActiveTab('ts')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'ts'
                ? 'bg-[var(--bg-subtle)] text-[var(--accent)] font-medium'
                : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]'
            }`}
          >
            TypeScript (fetch)
          </button>
        </div>

        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1.5 text-2xs text-[var(--ink-2)] hover:text-[var(--ink-1)] transition-colors px-2 py-0.5 rounded hover:bg-[var(--bg-subtle)]"
          title="Copy snippet"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[var(--positive)]" />
              <span className="text-[var(--positive)] font-mono">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* ── CODE / RESPONSE VIEW ── */}
      <div className="p-4 bg-[#0a0907] overflow-x-auto text-[var(--ink-1)] font-mono text-2xs sm:text-xs leading-relaxed max-h-80">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-[var(--ink-3)]">
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span>Executing live API call...</span>
          </div>
        ) : (
          <pre>
            <code>
              {activeTab === 'curl'
                ? endpoint.curlSnippet
                : activeTab === 'python'
                ? endpoint.pythonSnippet
                : activeTab === 'ts'
                ? endpoint.tsSnippet
                : JSON.stringify(endpoint.sampleResponse, null, 2)}
            </code>
          </pre>
        )}
      </div>

      {/* ── FOOTER HINT ── */}
      <div className="p-3 bg-[var(--bg-card)] border-t border-[var(--border-default)] text-2xs text-[var(--ink-3)] flex items-center justify-between">
        <span className="font-mono">
          Endpoint: {endpoint.title} • {endpoint.description}
        </span>
        <span className="text-[var(--positive)] font-mono hidden sm:inline">
          HTTPS • CORS Enabled • JSON Contract
        </span>
      </div>
    </div>
  )
}

