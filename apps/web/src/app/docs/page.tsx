'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Compass,
  Sparkles,
  Cpu,
  TrendingUp,
  Terminal,
  User,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Github,
  Linkedin,
  Globe,
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  Code2,
  FileText,
  Workflow,
  Lock,
  Search,
  Scale,
  DollarSign,
  ChevronRight,
  HelpCircle,
} from 'lucide-react'

import { DocsHeader } from '@/components/docs/DocsHeader'
import { DocsSidebar } from '@/components/docs/DocsSidebar'
import { DocsToc } from '@/components/docs/DocsToc'
import { DocsContactSection } from '@/components/docs/DocsContactSection'
import { CodeBlock } from '@/components/docs/CodeBlock'
import { DOCS_CHAPTERS } from '@/components/docs/docs-data'

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('executive-summary')
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Sync section with URL hash if present
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '')
      if (hash) {
        setActiveSection(hash)
        const el = document.getElementById(hash)
        if (el) {
          setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      }
    }
  }, [])

  const handleSelectSection = (id: string) => {
    setActiveSection(id)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${id}`)
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  // TOC items for on-page navigation
  const tocItems = useMemo(() => [
    { id: 'executive-summary', label: '1. Executive Summary' },
    { id: 'system-architecture', label: '2. System Architecture' },
    { id: 'quick-start', label: '3. Quick Start & Setup' },
    { id: 'multi-agent-pipeline', label: '4. Dual-Agent AI Diligence' },
    { id: 'listing-gatekeepers', label: '5. SEBI Listing Gatekeepers' },
    { id: 'conviction-formula', label: '6. Conviction Score Formula' },
    { id: 'sebi-allotment-rules', label: '7. SEBI Quota Mechanics' },
    { id: 'milp-formulation', label: '8. PuLP MILP Formulation' },
    { id: 'asba-lock-recycling', label: '9. ASBA Fund Recycling' },
    { id: 'smartapi-integration', label: '10. Angel One SmartAPI' },
    { id: 'asba-upi-workflow', label: '11. UPI Mandate & Safety' },
    { id: 'registrar-scrapers', label: '12. Registrar Scraping & Exit' },
    { id: 'tech-stack-deep-dive', label: '13. Full Tech Stack' },
    { id: 'rest-api-reference', label: '14. REST API Reference' },
    { id: 'contact-and-creator', label: '15. Creator & Contact Us' },
    { id: 'legal-disclaimer', label: '16. SEBI Compliance Disclaimer' },
  ], [])

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--ink-1)] flex flex-col font-sans selection:bg-[var(--accent)] selection:text-[var(--bg-base)]">
      {/* ── TOP HEADER ── */}
      <DocsHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* ── MAIN LAYOUT WRAPPER ── */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Left Sidebar */}
        <DocsSidebar
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
          searchQuery={searchQuery}
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Center Main Documentation Body */}
        <main className="flex-1 min-w-0 lg:pl-72 xl:pr-64 px-4 sm:px-8 py-8 lg:py-12 space-y-16">
          {/* ── TOP BREADCRUMB & HERO ── */}
          <div className="space-y-4 border-b border-[var(--border-default)] pb-8">
            <div className="flex items-center gap-2 text-2xs font-mono text-[var(--ink-3)]">
              <Link href="/" className="hover:text-[var(--ink-1)] transition-colors">Kapitl</Link>
              <span>/</span>
              <span className="text-[var(--accent)]">Documentation</span>
              <span>/</span>
              <span>Full Engineering Blueprint</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--ink-1)]">
                Kapitl Platform Documentation
              </h1>
              <p className="text-sm text-[var(--ink-2)] max-w-3xl leading-relaxed">
                The complete engineering and operational reference: from automated SEBI DRHP prospectus forensics with Claude & Gemini, to mathematical multi-Demat family allocation using Mixed-Integer Linear Programming (MILP), and 09:00:00 AM IST broker pre-market execution.
              </p>
            </div>

            {/* Quick Author Banner on First Page */}
            <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--bg-base)] font-mono font-bold flex items-center justify-center flex-shrink-0">
                  RY
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--ink-1)]">Engineered by Ravi Yadav</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)]">Architect</span>
                  </div>
                  <span className="text-2xs text-[var(--ink-3)]">Full-Stack & Autonomous AI Systems Engineer</span>
                </div>
              </div>

              {/* Direct Social Links */}
              <div className="flex items-center gap-2">
                <a
                  href="https://www.linkedin.com/in/raviyadav23/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-2xs font-medium text-[var(--ink-2)] hover:text-[#0a66c2] hover:border-[#0a66c2]/40 transition-colors flex items-center gap-1.5"
                >
                  <Linkedin className="w-3 h-3 text-[#0a66c2]" />
                  <span>LinkedIn</span>
                </a>
                <a
                  href="https://github.com/ravi-yadav-23"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-2xs font-medium text-[var(--ink-2)] hover:text-purple-400 hover:border-purple-400/40 transition-colors flex items-center gap-1.5"
                >
                  <Github className="w-3 h-3 text-purple-400" />
                  <span>GitHub</span>
                </a>
                <a
                  href="https://ravi-yadav-portfolio.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-2xs font-medium text-[var(--ink-2)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-colors flex items-center gap-1.5"
                >
                  <Globe className="w-3 h-3 text-[var(--accent)]" />
                  <span>Portfolio</span>
                </a>
              </div>
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 1: EXECUTIVE SUMMARY */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="executive-summary" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 01 / Core Fundamentals
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              Executive Summary & The Market Inefficiency
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
              Every year, over 100 Mainboard and SME companies list on the National Stock Exchange (NSE) and Bombay Stock Exchange (BSE), raising over ₹1,00,000+ Crores. However, retail and family investors continually face systemic disadvantages:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                <span className="text-2xs font-mono text-negative block">01 / PROSPECTUS OPACITY</span>
                <h4 className="text-xs font-medium text-[var(--ink-1)]">400+ Page DRHPs</h4>
                <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                  Key forensic risks (promoter dilution, related-party siphoning, auditor reservations) are buried inside massive PDFs that retail investors never read.
                </p>
              </div>

              <div className="grid p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                <span className="text-2xs font-mono text-negative block">02 / ALLOTMENT LOTTERY MATH</span>
                <h4 className="text-xs font-medium text-[var(--ink-1)]">Suboptimal Lot Sizing</h4>
                <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                  In retail oversubscribed IPOs, bidding for 13 lots grants the exact same lottery odds as bidding for 1 lot, unnecessarily locking ₹1,80,000 in ASBA.
                </p>
              </div>

              <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                <span className="text-2xs font-mono text-negative block">03 / PAN DISQUALIFICATION</span>
                <h4 className="text-xs font-medium text-[var(--ink-1)]">Accidental Double Bids</h4>
                <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                  Bidding through multiple brokers under the same PAN leads to instant disqualification by the registrar under SEBI regulations.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] space-y-2">
              <h4 className="text-xs font-medium text-[var(--ink-1)] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--positive)]" />
                The Kapitl Solution
              </h4>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Kapitl replaces fragmented manual trading with institutional algorithmic discipline. By unifying multiple family Demat accounts under a single mathematical solver, calculating real-time risk scores with dual LLM agents, and managing ASBA liquidity recycling, investors maximize primary market returns while eliminating manual overhead.
              </p>
            </div>
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 2: SYSTEM ARCHITECTURE */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="system-architecture" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 02 / System Engineering
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              End-to-End System Architecture
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
              Kapitl is built as a high-concurrency asynchronous system that connects live financial scrapers, operations research solvers, AI agents, and direct broker APIs:
            </p>

            {/* Architecture Card Diagram */}
            <div className="p-5 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] font-mono text-2xs space-y-4">
              <div className="text-2xs font-medium text-[var(--accent)] uppercase">
                Data Pipeline & Execution Topology
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                  <div className="text-[var(--ink-3)] text-2xs mb-1">STAGE 1</div>
                  <div className="text-xs text-[var(--ink-1)] font-medium">Ingestion & Scraping</div>
                  <div className="text-[10px] text-[var(--ink-3)] mt-1">NSE / BSE / Chittorgarh / SEBI EDGAR</div>
                </div>

                <div className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                  <div className="text-[var(--ink-3)] text-2xs mb-1">STAGE 2</div>
                  <div className="text-xs text-[var(--ink-1)] font-medium">Dual-Agent AI Diligence</div>
                  <div className="text-[10px] text-[var(--ink-3)] mt-1">Claude 3.5 Sonnet + Gemini 2.5 Flash</div>
                </div>

                <div className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                  <div className="text-[var(--ink-3)] text-2xs mb-1">STAGE 3</div>
                  <div className="text-xs text-[var(--ink-1)] font-medium">PuLP MILP Solver</div>
                  <div className="text-[10px] text-[var(--ink-3)] mt-1">CBC Algorithm (&lt;50ms) across N PANs</div>
                </div>

                <div className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                  <div className="text-[var(--ink-3)] text-2xs mb-1">STAGE 4</div>
                  <div className="text-xs text-[var(--ink-1)] font-medium">Broker & Registrar</div>
                  <div className="text-[10px] text-[var(--ink-3)] mt-1">SmartAPI Orders + Link Intime Polling</div>
                </div>
              </div>
            </div>

            <CodeBlock
              language="bash"
              title="Architecture Directory Tree"
              code={`IPO-Invest-Ai/
├── apps/
│   ├── api/                     # Python 3.10+ FastAPI Asynchronous Backend
│   │   ├── app/
│   │   │   ├── agents/          # Multi-Agent DRHP & GMP Analyzers (Claude & Gemini)
│   │   │   ├── db/              # SQLAlchemy Async Models & Migrations
│   │   │   ├── routers/         # REST API Routes (/ipos, /funds, /reports, /orders)
│   │   │   ├── schemas/         # Pydantic v2 Contract Validation
│   │   │   └── services/        # PuLP Optimizer, SmartAPI Broker, Scrapers
│   │   └── tests/               # Pytest Unit & Integration Suites (77+ tests)
│   └── web/                     # Next.js 14.2 App Router Web Terminal
│       ├── src/
│       │   ├── app/             # App Router pages (/ipos, /funds, /reports, /docs)
│       │   ├── components/      # Design System (Linear x Ramp x Mercury styled)
│       │   ├── lib/             # SWR Cache Client, Formatters, Auth Context
│       │   └── types/           # Strict TypeScript Domain Interfaces`}
            />
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 3: QUICK START & LOCAL SETUP */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="quick-start" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 03 / Deployment & Setup
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              Quick Start & Developer Setup
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
              Kapitl is engineered for fast local reproduction and seamless zero-configuration development using SQLite or production-grade PostgreSQL:
            </p>

            <CodeBlock
              language="bash"
              title="1. Clone & Set Up Backend Environment"
              code={`# 1. Clone the repository
git clone https://github.com/ravi-yadav-23/Kapital.git
cd Kapital

# 2. Setup Python Virtual Environment
cd apps/api
python -m venv venv

# Windows:
.\\venv\\Scripts\\activate
# macOS / Linux:
source venv/bin/activate

# 3. Install backend dependencies
pip install -r requirements.txt

# 4. Start FastAPI server with live reload
uvicorn app.main:app --reload --port 8000`}
            />

            <CodeBlock
              language="bash"
              title="2. Set Up & Run Frontend Terminal"
              code={`# Open a new terminal in the repository root
cd apps/web

# Install frontend dependencies
npm install

# Start Next.js development server
npm run dev

# Open http://localhost:3000 in your browser to view the platform`}
            />

            <div className="p-3.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs text-[var(--ink-2)]">
              💡 <strong>Instant Guest Sandbox:</strong> You do not need Angel One credentials or paid LLM keys to test the platform. When running locally or visiting the live demo, clicking <strong>&quot;Explore Demo Workspace&quot;</strong> boots an in-memory 6-Demat family sandbox seeded with real NSE/BSE IPOs.
            </div>
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 4: DUAL-AGENT AI DUE DILIGENCE */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="multi-agent-pipeline" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 04 / AI Forensics
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              Dual-Agent LLM Orchestration
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
              Traditional algorithmic trading models fail on IPOs because prospectus text is unformatted and qualitative. Kapitl uses specialized LLM agents working in tandem with strict Pydantic JSON contracts:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-[var(--ink-1)]">Agent 1: Forensic Auditor</h4>
                  <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">Claude 3.5 Sonnet</span>
                </div>
                <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                  Ingests restated balance sheets, cash flows, related-party transaction footnotes, and contingent liabilities. Flags negative operating cash flows, surging debtor days, and unusual promoter loans.
                </p>
              </div>

              <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-[var(--ink-1)]">Agent 2: Market Sentiment & GMP</h4>
                  <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">Gemini 2.5 Flash</span>
                </div>
                <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                  Extracts live unofficial Grey Market Premiums (GMP), Kostak rates, Subject-to-Sauda contracts, and real-time QIB/NII subscription bid acceleration to detect artificial hype vs organic demand.
                </p>
              </div>
            </div>
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 5: 5 SEBI LISTING GATEKEEPERS */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="listing-gatekeepers" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 05 / Deal-Breaker Checks
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              5 SEBI Listing Gatekeepers
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
              Before calculating valuation scores, Kapitl passes every IPO through 5 deal-breaker checks. If a company fails even one critical gatekeeper, its conviction score drops into the AVOID zone:
            </p>

            <div className="overflow-x-auto rounded-md border border-[var(--border-default)] bg-[var(--bg-card)]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-default)] text-2xs uppercase font-mono text-[var(--ink-3)]">
                  <tr>
                    <th className="py-2.5 px-3.5">Gatekeeper Check</th>
                    <th className="py-2.5 px-3.5">Threshold / Rule</th>
                    <th className="py-2.5 px-3.5">Impact if Violated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)] text-[var(--ink-2)] font-mono text-2xs">
                  <tr>
                    <td className="py-2.5 px-3.5 text-[var(--ink-1)] font-medium">1. Promoter Dilution & OFS Split</td>
                    <td className="py-2.5 px-3.5">OFS &gt; 70% of total issue size</td>
                    <td className="py-2.5 px-3.5 text-negative">-15 pts (Promoters cashing out without growth capital)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3.5 text-[var(--ink-1)] font-medium">2. Criminal & Material Litigation</td>
                    <td className="py-2.5 px-3.5">Claims &gt; 25% of Net Worth</td>
                    <td className="py-2.5 px-3.5 text-negative">-20 pts (Catastrophic legal liability risk)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3.5 text-[var(--ink-1)] font-medium">3. Debt-to-Equity & Solvency</td>
                    <td className="py-2.5 px-3.5">D/E &gt; 3.0x with negative CFO</td>
                    <td className="py-2.5 px-3.5 text-negative">-15 pts (High probability of default/refinancing strain)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3.5 text-[var(--ink-1)] font-medium">4. Related-Party Siphoning</td>
                    <td className="py-2.5 px-3.5">Unsecured loans to promoter entities</td>
                    <td className="py-2.5 px-3.5 text-negative">-20 pts (Corporate governance failure)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3.5 text-[var(--ink-1)] font-medium">5. Auditor Reservations</td>
                    <td className="py-2.5 px-3.5">Adverse opinion or mid-cycle resignation</td>
                    <td className="py-2.5 px-3.5 text-negative">-25 pts (Immediate deal-breaker qualification)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 6: CONVICTION SCORE FORMULA */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="conviction-formula" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 06 / Scoring Mathematics
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              Deterministic Conviction Score Formulation
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
              Unlike subjective analyst opinions, Kapitl computes an objective conviction score out of 100 derived from 6 normalized factor vectors:
            </p>

            <div className="p-4 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] font-mono text-xs text-[var(--ink-1)] space-y-2">
              <div className="text-[var(--accent)] font-medium">Score = (w₁·F₁ + w₂·F₂ + w₃·F₃ + w₄·F₄ + w₅·F₅ + w₆·F₆) - RedFlagPenalties</div>
              <div className="text-2xs text-[var(--ink-3)] pt-1">
                Where w₁ = 25% (Financial Growth), w₂ = 20% (Valuation vs Peers), w₃ = 20% (Promoter Governance), w₄ = 15% (Industry Moat), w₅ = 10% (Subscription Momentum), w₆ = 10% (GMP Spread).
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border-default)]">
                <span className="text-xs font-mono font-bold text-[var(--positive)]">80 - 100</span>
                <span className="text-2xs block text-[var(--ink-1)] font-medium mt-1">STRONG APPLY</span>
                <span className="text-[10px] text-[var(--ink-3)]">Bid across all family PANs</span>
              </div>
              <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border-default)]">
                <span className="text-xs font-mono font-bold text-amber-400">65 - 79</span>
                <span className="text-2xs block text-[var(--ink-1)] font-medium mt-1">APPLY</span>
                <span className="text-[10px] text-[var(--ink-3)]">Apply in Retail quota</span>
              </div>
              <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border-default)]">
                <span className="text-xs font-mono font-bold text-[var(--ink-2)]">50 - 64</span>
                <span className="text-2xs block text-[var(--ink-1)] font-medium mt-1">MODERATE</span>
                <span className="text-[10px] text-[var(--ink-3)]">Only with spare ASBA</span>
              </div>
              <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border-default)]">
                <span className="text-xs font-mono font-bold text-negative">&lt; 50</span>
                <span className="text-2xs block text-[var(--ink-1)] font-medium mt-1">AVOID</span>
                <span className="text-[10px] text-[var(--ink-3)]">Zero capital allocation</span>
              </div>
            </div>
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 7: OPERATIONS RESEARCH & MILP */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="sebi-allotment-rules" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 07 / Operations Research
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              SEBI Quota & Allotment Category Mechanics
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
              SEBI categorizes non-institutional investors into distinct quotas, each governed by different mathematical allotment probabilities:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                <h4 className="font-medium text-[var(--ink-1)]">Retail Individual Investors (RII)</h4>
                <p className="text-[var(--ink-3)] text-2xs leading-relaxed">
                  Maximum bid amount: <strong>₹2,00,000</strong>. When oversubscribed, SEBI mandates a pure lottery where every allotted applicant gets exactly <strong>1 minimum lot</strong>. Bidding for more than 1 lot increases capital lock-in with zero improvement in win odds.
                </p>
              </div>

              <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                <h4 className="font-medium text-[var(--ink-1)]">Small HNI (sHNI / NII)</h4>
                <p className="text-[var(--ink-3)] text-2xs leading-relaxed">
                  Bid amount between <strong>₹2,00,000 and ₹10,00,000</strong>. Allotment is also determined by lottery, but each winner receives the minimum sHNI allotment (usually 14–15 retail lots). For high-GMP issues, sHNI yields substantially higher absolute rupee gains.
                </p>
              </div>

              <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                <h4 className="font-medium text-[var(--ink-1)]">Big HNI (bHNI / NII)</h4>
                <p className="text-[var(--ink-3)] text-2xs leading-relaxed">
                  Bid amount <strong>&gt; ₹10,00,000</strong>. Allotment is proportional to subscription demand, suitable for large deployable family reserves.
                </p>
              </div>

              <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                <h4 className="font-medium text-[var(--ink-1)]">SME IPO Mandate</h4>
                <p className="text-[var(--ink-3)] text-2xs leading-relaxed">
                  Under SEBI SME guidelines, the minimum application is strictly <strong>≥ ₹2,00,000</strong> (typically 2 lots). Retail investors cannot apply with small ticket sizes; Kapitl enforces this constraint automatically.
                </p>
              </div>
            </div>
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 8: MILP FORMULATION */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="milp-formulation" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 08 / Mathematical Solver
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              PuLP Mixed-Integer Linear Programming Formulation
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
              Given family Demat accounts with liquid balances B(a) and active open IPOs with expected return R(i), the solver finds the optimal binary decision variables x(a,i) ∈ {'{0, 1}'} and integer lot counts y(a,i) ≥ 0:
            </p>

            <CodeBlock
              language="python"
              title="PuLP MILP Model Implementation (optimizer_service.py)"
              code={`import pulp

prob = pulp.LpProblem("Kapitl_Family_Allocation", pulp.LpMaximize)

# Decision Variables
# x[a, i, c] is binary: 1 if account 'a' applies for IPO 'i' in category 'c' (RETAIL/sHNI)
x = pulp.LpVariable.dicts("apply", ((a["id"], ipo["id"], c) for a in accounts for ipo in ipos for c in categories), cat=pulp.LpBinary)

# Objective: Maximize expected portfolio gain adjusted for category win probability
prob += pulp.lpSum(
    x[a["id"], ipo["id"], c] * expected_gain(ipo, c)
    for a in accounts for ipo in ipos for c in categories
)

# Constraint 1: Single account capital boundary
for a in accounts:
    prob += pulp.lpSum(
        x[a["id"], ipo["id"], c] * cost_for_category(ipo, c)
        for ipo in ipos for c in categories
    ) <= a["available_liquid_balance"]

# Constraint 2: SEBI PAN Uniqueness (At most 1 bid per IPO per account)
for a in accounts:
    for ipo in ipos:
        prob += pulp.lpSum(x[a["id"], ipo["id"], c] for c in categories) <= 1

# Solve using COIN-OR CBC algorithm in < 50ms
prob.solve(pulp.PULP_CBC_CMD(msg=False))`}
            />
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 9: ASBA LOCK RECYCLING */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="asba-lock-recycling" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 09 / Liquidity Optimization
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              ASBA Fund Lock & Recycling Timeline
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
              When bidding in an IPO, funds are blocked in the bank account via ASBA (Application Supported by Blocked Amount). Funds remain blocked for approximately 4 to 6 days. Kapitl models the future unblock dates to avoid missing upcoming blockbuster IPOs:
            </p>

            <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-3 font-mono text-2xs">
              <div className="text-[var(--accent)] font-medium">ASBA Capital Timeline Sequence</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-elevated)]">
                  <span>Day 1 (T): Bid Submitted & UPI Mandate Approved</span>
                  <span className="text-amber-400">Funds Blocked in Bank</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-elevated)]">
                  <span>Day 3 (T+2): Bidding Closes</span>
                  <span className="text-[var(--ink-3)]">Registrar Basis of Allotment</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-elevated)]">
                  <span>Day 4 (T+3): Allotment Finalization & Refund Initiation</span>
                  <span className="text-[var(--positive)]">Unblocked Funds Immediately Available for Next IPO</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-elevated)]">
                  <span>Day 5 (T+4): 09:00:00 AM Listing on NSE/BSE</span>
                  <span className="text-purple-400">Pre-Market Limit Order Executed</span>
                </div>
              </div>
            </div>
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 10: ANGEL ONE SMARTAPI & EXECUTION */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="smartapi-integration" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 10 / Broker Execution
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              Angel One SmartAPI & RFC 6238 TOTP Protocol
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
              Kapitl interfaces directly with Angel One&apos;s institutional SmartAPI v3. Authentication requires zero manual OTP intervention thanks to RFC 6238 algorithmic TOTP token generation:
            </p>

            <CodeBlock
              language="python"
              title="Automated Two-Factor Authentication Flow (smartapi_service.py)"
              code={`import pyotp
from SmartApi import SmartConnect

def authenticate_broker(client_code, pin, totp_secret, api_key):
    smart_api = SmartConnect(api_key=api_key)
    
    # Generate RFC 6238 6-digit TOTP code
    totp = pyotp.TOTP(totp_secret).now()
    
    # Authenticate and receive JWT Session
    session_data = smart_api.generateSession(client_code, pin, totp)
    auth_token = session_data['data']['jwtToken']
    feed_token = smart_api.getfeedToken()
    
    return smart_api, auth_token, feed_token`}
            />
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 11: ASBA UPI SAFETY */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="asba-upi-workflow" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 11 / Capital Safety
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              UPI Mandate & ASBA Fund Safety
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
              One of the most important architectural features of Kapitl is that client funds <strong>never touch third-party servers or intermediary wallets</strong>:
            </p>

            <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2 text-xs">
              <h4 className="font-medium text-[var(--positive)] flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Zero Counterparty Risk Guarantee
              </h4>
              <p className="text-2xs text-[var(--ink-2)] leading-relaxed">
                When an application is staged through Kapitl, a UPI mandate request is dispatched to the user&apos;s registered banking UPI ID (e.g. @okhdfcbank, @icici). The investor authorizes the mandate directly inside their bank app. Funds remain safely inside their personal bank account, continuing to earn daily savings account interest until allotment.
              </p>
            </div>
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 12: REGISTRAR SCRAPERS & LISTING STRATEGY */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="registrar-scrapers" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 12 / Listing Day Execution
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              Registrar Scraping & Listing Day 09:00:00 AM Strategy
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
              Registrars like Link Intime, KFintech, and Bigshare release allotment status at unpredictable hours (often between 11:00 PM and 02:00 AM). Kapitl runs an automated polling worker that queries registrar backends via PAN hashes, immediately recording credited shares.
            </p>

            <div className="p-4 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] space-y-2 text-xs">
              <h4 className="font-medium text-[var(--ink-1)]">Pre-Market Listing Exit (09:00:00 AM IST)</h4>
              <p className="text-2xs text-[var(--ink-2)] leading-relaxed">
                Historical empirical data shows that retail investors frequently panic-sell during regular trading hours, eroding listing pops. Kapitl allows users to stage pre-market limit sell orders that execute at precisely 09:00:00 AM IST during the NSE/BSE pre-open call auction, locking in opening price premiums.
              </p>
            </div>
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 13: FULL TECH STACK */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="tech-stack-deep-dive" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 13 / Technical Specifications
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              Full Technology Stack & Engineering Design Patterns
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-1.5">
                <span className="text-2xs font-mono text-[var(--accent)]">FRONTEND ENGINE</span>
                <h4 className="font-medium text-[var(--ink-1)]">Next.js 14.2 & Tailwind CSS</h4>
                <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                  App Router, React Server Components, TypeScript, Lucide Icons, and custom high-contrast design tokens inspired by Linear, Ramp, and Mercury.
                </p>
              </div>

              <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-1.5">
                <span className="text-2xs font-mono text-[var(--positive)]">BACKEND SERVICE</span>
                <h4 className="font-medium text-[var(--ink-1)]">FastAPI & Async SQLAlchemy</h4>
                <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                  Non-blocking ASGI framework with Pydantic v2 data models, SQLite / PostgreSQL 15 database engines, and WebSocket event emitters.
                </p>
              </div>

              <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-1.5">
                <span className="text-2xs font-mono text-purple-400">OPERATIONS RESEARCH</span>
                <h4 className="font-medium text-[var(--ink-1)]">PuLP MILP & CBC Solver</h4>
                <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                  High-speed linear solver guaranteeing mathematical optimality under capital, lot sizing, and PAN uniqueness constraints.
                </p>
              </div>

              <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-1.5">
                <span className="text-2xs font-mono text-blue-400">BROKER PROTOCOLS</span>
                <h4 className="font-medium text-[var(--ink-1)]">Angel One SmartAPI v3</h4>
                <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                  Automated TOTP 2FA session management, order book sync, and depository allotment polling.
                </p>
              </div>
            </div>
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 14: REST API REFERENCE */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="rest-api-reference" className="space-y-5 scroll-mt-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
              <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)]">
                Chapter 14 / API Reference
              </span>
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
              REST & WebSocket API Reference
            </h2>

            <div className="overflow-x-auto rounded-md border border-[var(--border-default)] bg-[var(--bg-card)]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-default)] text-2xs uppercase font-mono text-[var(--ink-3)]">
                  <tr>
                    <th className="py-2.5 px-3.5">Method</th>
                    <th className="py-2.5 px-3.5">Endpoint</th>
                    <th className="py-2.5 px-3.5">Description</th>
                    <th className="py-2.5 px-3.5">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)] text-[var(--ink-2)] font-mono text-2xs">
                  <tr>
                    <td className="py-2.5 px-3.5 text-blue-400 font-bold">GET</td>
                    <td className="py-2.5 px-3.5 text-[var(--ink-1)]">/api/ipos</td>
                    <td className="py-2.5 px-3.5">List all active, upcoming, and closed IPOs</td>
                    <td className="py-2.5 px-3.5 text-[var(--positive)]">Public</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3.5 text-green-400 font-bold">POST</td>
                    <td className="py-2.5 px-3.5 text-[var(--ink-1)]">/api/ipos/sync</td>
                    <td className="py-2.5 px-3.5">Trigger live scraper pipeline (NSE, BSE, Chittorgarh)</td>
                    <td className="py-2.5 px-3.5 text-amber-400">Guest / Admin</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3.5 text-green-400 font-bold">POST</td>
                    <td className="py-2.5 px-3.5 text-[var(--ink-1)]">/api/funds/optimize</td>
                    <td className="py-2.5 px-3.5">Run PuLP MILP solver across family accounts</td>
                    <td className="py-2.5 px-3.5 text-amber-400">Guest / Admin</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3.5 text-blue-400 font-bold">GET</td>
                    <td className="py-2.5 px-3.5 text-[var(--ink-1)]">/api/reports/{'{id}'}</td>
                    <td className="py-2.5 px-3.5">Fetch full dual-agent AI forensic audit report</td>
                    <td className="py-2.5 px-3.5 text-[var(--positive)]">Public</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3.5 text-purple-400 font-bold">WS</td>
                    <td className="py-2.5 px-3.5 text-[var(--ink-1)]">/api/ws</td>
                    <td className="py-2.5 px-3.5">Live WebSocket market events & allotment alerts</td>
                    <td className="py-2.5 px-3.5 text-[var(--positive)]">Public</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 15: CREATOR & CONTACT US */}
          {/* ────────────────────────────────────────────────────────── */}
          <DocsContactSection />

          {/* ────────────────────────────────────────────────────────── */}
          {/* SECTION 16: SEBI REGULATORY COMPLIANCE DISCLAIMER */}
          {/* ────────────────────────────────────────────────────────── */}
          <section id="legal-disclaimer" className="space-y-4 pt-6 border-t border-[var(--border-default)] scroll-mt-20">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-medium text-[var(--ink-1)]">
                Regulatory Safe-Harbor & SEBI Compliance Disclaimer
              </h3>
            </div>
            <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
              Kapitl is an engineering research platform and computational portfolio optimization tool. It is not registered as a SEBI Research Analyst (RA) or Investment Advisor (RIA) under the Securities and Exchange Board of India Regulations, 2014. The AI conviction scores, forensic evaluations, and MILP optimization models are generated purely via mathematical formulas and public prospectus disclosures. Investments in primary markets (IPOs) are subject to market risks, including loss of principal. Users must conduct their own due diligence or consult a licensed SEBI registered financial advisor before placing capital at risk.
            </p>
          </section>

          {/* ── FOOTER BAR ── */}
          <footer className="pt-8 border-t border-[var(--border-default)] flex flex-col sm:flex-row items-center justify-between gap-4 text-2xs text-[var(--ink-3)]">
            <div>
              © 2026 Kapitl • Engineered by{' '}
              <a
                href="https://www.linkedin.com/in/raviyadav23/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--ink-1)] hover:text-[var(--accent)] underline"
              >
                Ravi Yadav
              </a>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/ravi-yadav-23"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--ink-1)] transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://ravi-yadav-portfolio.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--ink-1)] transition-colors"
              >
                Portfolio
              </a>
              <a
                href="https://www.linkedin.com/in/raviyadav23/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--ink-1)] transition-colors"
              >
                LinkedIn
              </a>
            </div>
          </footer>
        </main>

        {/* Right Table of Contents */}
        <DocsToc
          items={tocItems}
          activeTocId={activeSection}
          onSelectToc={handleSelectSection}
        />
      </div>
    </div>
  )
}
