'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  ArrowLeft,
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
  Copy,
  Check,
  Share2,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Sliders,
  DollarSign,
} from 'lucide-react'

import { DocsHeader } from '@/components/docs/DocsHeader'
import { DocsSidebar } from '@/components/docs/DocsSidebar'
import { DocsToc } from '@/components/docs/DocsToc'
import { DocsContactSection } from '@/components/docs/DocsContactSection'
import { CodeBlock } from '@/components/docs/CodeBlock'
import { Callout } from '@/components/docs/Callout'
import { InteractiveMilpSimulator } from '@/components/docs/InteractiveMilpSimulator'
import { InteractiveApiConsole } from '@/components/docs/InteractiveApiConsole'
import { CommandSearchModal } from '@/components/docs/CommandSearchModal'
import { DOCS_CHAPTERS } from '@/components/docs/docs-data'

export default function DocsPage() {
  const [activeChapter, setActiveChapter] = useState<string>('getting-started')
  const [activeSection, setActiveSection] = useState<string>('executive-summary')
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<'yes' | 'no' | null>(null)

  // Listen for global keyboard shortcuts (Cmd+K, Ctrl+K, /)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchModalOpen(true)
      } else if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        setIsSearchModalOpen(true)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Sync state with URL hash on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '')
      if (hash) {
        // Find which chapter this section belongs to
        const foundChapter = DOCS_CHAPTERS.find((ch) =>
          ch.sections.some((s) => s.id === hash)
        )
        if (foundChapter) {
          setActiveChapter(foundChapter.id)
        }
        setActiveSection(hash)
        const el = document.getElementById(hash)
        if (el) {
          setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 120)
        }
      }
    }
  }, [])

  const handleSelectSection = (id: string, chapterId?: string) => {
    setActiveSection(id)
    if (chapterId) {
      setActiveChapter(chapterId)
    } else {
      const foundChapter = DOCS_CHAPTERS.find((ch) =>
        ch.sections.some((s) => s.id === id)
      )
      if (foundChapter) {
        setActiveChapter(foundChapter.id)
      }
    }

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${id}`)
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  const handleSelectChapter = (chId: string) => {
    setActiveChapter(chId)
    const ch = DOCS_CHAPTERS.find((c) => c.id === chId)
    if (ch && ch.sections[0]) {
      setActiveSection(ch.sections[0].id)
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#${ch.sections[0].id}`)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  const handleCopyPageUrl = async () => {
    if (typeof window !== 'undefined') {
      try {
        await navigator.clipboard.writeText(window.location.href)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
      } catch {}
    }
  }

  // Active TOC items corresponding to the active view
  const currentChapterObj = useMemo(
    () => DOCS_CHAPTERS.find((c) => c.id === activeChapter) || DOCS_CHAPTERS[0],
    [activeChapter]
  )

  const tocItems = useMemo(() => {
    return currentChapterObj.sections.map((s) => ({
      id: s.id,
      label: s.title,
    }))
  }, [currentChapterObj])

  // Previous & Next navigation
  const currentChapterIdx = DOCS_CHAPTERS.findIndex((c) => c.id === activeChapter)
  const prevChapter = currentChapterIdx > 0 ? DOCS_CHAPTERS[currentChapterIdx - 1] : null
  const nextChapter = currentChapterIdx < DOCS_CHAPTERS.length - 1 ? DOCS_CHAPTERS[currentChapterIdx + 1] : null

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--ink-1)] flex flex-col font-sans selection:bg-[var(--accent)] selection:text-[var(--bg-base)]">
      {/* ── COMMAND SEARCH MODAL ── */}
      <CommandSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectTopic={(chapterId, sectionId) => {
          setActiveChapter(chapterId)
          if (sectionId) {
            handleSelectSection(sectionId, chapterId)
          }
        }}
      />

      {/* ── STICKY TOPBAR ── */}
      <DocsHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        onOpenSearchModal={() => setIsSearchModalOpen(true)}
      />

      {/* ── 3-COLUMN CONTENT WRAPPER ── */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Left Sidebar */}
        <DocsSidebar
          activeSection={activeSection}
          activeChapterId={activeChapter}
          onSelectSection={handleSelectSection}
          onSelectChapter={handleSelectChapter}
          searchQuery={searchQuery}
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Center Main Documentation Body */}
        <main className="flex-1 min-w-0 lg:pl-72 xl:pr-64 px-4 sm:px-8 py-8 lg:py-10 space-y-12">
          {/* ── TOP BREADCRUMB & METADATA BAR ── */}
          <div className="space-y-4 border-b border-[var(--border-default)] pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 text-2xs font-mono text-[var(--ink-3)]">
              <div className="flex items-center gap-2">
                <Link href="/" className="hover:text-[var(--ink-1)] transition-colors">Kapitl</Link>
                <span>/</span>
                <span className="text-[var(--accent)] font-medium">Docs</span>
                <span>/</span>
                <span className="text-[var(--ink-2)] truncate max-w-[200px]">{currentChapterObj.title}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[var(--ink-3)]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>5 min read</span>
                </span>
                <span>•</span>
                <button
                  onClick={handleCopyPageUrl}
                  className="flex items-center gap-1 text-[var(--ink-2)] hover:text-[var(--ink-1)] transition-colors"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3 h-3 text-[var(--positive)]" />
                      <span className="text-[var(--positive)]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3 h-3" />
                      <span>Share</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Chapter Segmented Switcher Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              {DOCS_CHAPTERS.map((ch) => {
                const isSelected = ch.id === activeChapter
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleSelectChapter(ch.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[var(--accent)] text-[var(--bg-base)] font-bold shadow-sm'
                        : 'bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--ink-2)] hover:text-[var(--ink-1)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <span>{ch.title.split('. ')[1] || ch.title}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────── */}
          {/* CHAPTER 1: GETTING STARTED & OVERVIEW */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeChapter === 'getting-started' && (
            <div className="space-y-12">
              <section id="executive-summary" className="space-y-5 scroll-mt-20">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-2xs font-mono text-[var(--accent)] font-medium">
                    <Compass className="w-3 h-3" />
                    <span>OVERVIEW & ARCHITECTURE</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--ink-1)]">
                    Kapitl Platform Engineering Blueprint
                  </h1>
                  <p className="text-sm text-[var(--ink-2)] max-w-3xl leading-relaxed">
                    Institutional-grade multi-Demat IPO intelligence, automated SEBI DRHP forensic diligence, and Mixed-Integer Linear Programming (MILP) capital allocation for Indian primary markets.
                  </p>
                </div>

                {/* Author Spotlight Hero Card on First Page */}
                <div className="p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-11 h-11 rounded-full bg-[var(--accent)] text-[var(--bg-base)] font-mono font-bold flex items-center justify-center text-sm shadow-md flex-shrink-0">
                      RY
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--ink-1)]">Built by Ravi Yadav</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--positive)]/15 text-[var(--positive)]">
                          Lead Engineer
                        </span>
                      </div>
                      <p className="text-2xs text-[var(--ink-3)]">
                        Full-Stack & Autonomous AI Systems Engineer • Lovely Professional University
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 relative z-10">
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

                <div className="space-y-4 pt-2">
                  <h3 className="text-xl font-medium text-[var(--ink-1)]">
                    The Primary Market Problem
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
                    Every year in India, over ₹1,00,000+ Crores are raised through IPOs on NSE and BSE. However, retail family investors consistently underperform due to three systematic structural barriers:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                      <span className="text-2xs font-mono text-negative block font-bold">01 / PROSPECTUS OPACITY</span>
                      <h4 className="text-xs font-medium text-[var(--ink-1)]">400+ Page DRHP Filings</h4>
                      <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                        Crucial financial red flags (related-party loans, heavy promoter dilution, auditor qualifications) remain buried in extensive PDFs that retail applicants never read.
                      </p>
                    </div>

                    <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                      <span className="text-2xs font-mono text-negative block font-bold">02 / LOT ALLOTMENT MATH</span>
                      <h4 className="text-xs font-medium text-[var(--ink-1)]">Suboptimal Bidding</h4>
                      <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                        In retail oversubscribed IPOs, bidding for 13 lots grants the exact same lottery odds as bidding for 1 lot, unnecessarily locking ₹1,80,000 in ASBA.
                      </p>
                    </div>

                    <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                      <span className="text-2xs font-mono text-negative block font-bold">03 / PAN DISQUALIFICATION</span>
                      <h4 className="text-xs font-medium text-[var(--ink-1)]">Duplicate Applications</h4>
                      <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                        Applying through multiple brokers (e.g. Zerodha + Groww) under the same PAN leads to instant registrar disqualification under SEBI regulations.
                      </p>
                    </div>
                  </div>

                  <Callout type="success" title="The Institutional Edge">
                    Kapitl replaces manual guesswork with mixed-integer linear programming. Family capital is pooled conceptually while keeping Demat PAN ownership segregated, maximizing lottery win probability while guaranteeing zero duplicate PAN penalties.
                  </Callout>
                </div>
              </section>

              <section id="system-architecture" className="space-y-5 scroll-mt-20">
                <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
                  System Architecture & Data Pipelines
                </h2>
                <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
                  Kapitl is architected as an asynchronous, distributed pipeline running across four specialized stages:
                </p>

                <div className="p-5 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] font-mono text-2xs space-y-4">
                  <div className="text-2xs font-medium text-[var(--accent)] uppercase">
                    Execution Pipeline Architecture
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center">
                    <div className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                      <div className="text-[var(--ink-3)] text-2xs mb-1">STAGE 1</div>
                      <div className="text-xs text-[var(--ink-1)] font-medium">Scraping & Normalization</div>
                      <div className="text-[10px] text-[var(--ink-3)] mt-1">ipoalerts.in / Groww / ipowatch.in</div>
                    </div>

                    <div className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                      <div className="text-[var(--ink-3)] text-2xs mb-1">STAGE 2</div>
                      <div className="text-xs text-[var(--ink-1)] font-medium">Dual-Agent AI Diligence</div>
                      <div className="text-[10px] text-[var(--ink-3)] mt-1">Configured LLM (default Groq)</div>
                    </div>

                    <div className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                      <div className="text-[var(--ink-3)] text-2xs mb-1">STAGE 3</div>
                      <div className="text-xs text-[var(--ink-1)] font-medium">PuLP Linear Solver</div>
                      <div className="text-[10px] text-[var(--ink-3)] mt-1">COIN-OR CBC Algorithm (&lt;50ms)</div>
                    </div>

                    <div className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                      <div className="text-[var(--ink-3)] text-2xs mb-1">STAGE 4</div>
                      <div className="text-xs text-[var(--ink-1)] font-medium">SmartAPI Execution</div>
                      <div className="text-[10px] text-[var(--ink-3)] mt-1">09:00 AM Pre-Market Sell Orders</div>
                    </div>
                  </div>
                </div>

                <CodeBlock
                  language="bash"
                  title="Monorepo Structure (apps/api + apps/web)"
                  code={`Kapital/
├── apps/
│   ├── api/                     # Python 3.10+ FastAPI Asynchronous Backend
│   │   ├── app/
│   │   │   ├── agents/          # Multi-agent GMP/feed summarisers (configurable LLM)
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

              <section id="quick-start" className="space-y-5 scroll-mt-20">
                <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
                  Quick Start & Local Development
                </h2>
                <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
                  Run Kapitl locally in under 3 minutes with automated database seeding:
                </p>

                <CodeBlock
                  language="bash"
                  title="1. Clone & Set Up Backend Environment"
                  code={`# Clone repo
git clone https://github.com/ravi-yadav-23/Kapital.git
cd Kapital

# Start FastAPI backend
cd apps/api
python -m venv venv
.\\venv\\Scripts\\activate   # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000`}
                />

                <CodeBlock
                  language="bash"
                  title="2. Start Next.js Web Terminal"
                  code={`# In another terminal window
cd apps/web
npm install
npm run dev

# Open http://localhost:3000 in your browser`}
                />
              </section>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* CHAPTER 2: MULTI-AGENT AI DUE DILIGENCE */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeChapter === 'ai-forensics' && (
            <div className="space-y-12">
              <section id="multi-agent-pipeline" className="space-y-5 scroll-mt-20">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-2xs font-mono text-[var(--accent)] font-medium">
                  <Sparkles className="w-3 h-3" />
                  <span>AI FORENSICS</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--ink-1)]">
                  Two-Agent AI Summary Pipeline
                </h1>
                <p className="text-sm text-[var(--ink-2)] max-w-3xl leading-relaxed">
                  How the configured LLM summarises feed data and live grey market premiums into an indicative score. Prospectus filings are not parsed; anything that needs them is reported as not assessed.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium text-[var(--ink-1)]">Agent 1: Equity Research Summariser</h4>
                      <span className="text-2xs font-mono px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400">Configured LLM</span>
                    </div>
                    <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                      Reads price band, issue size and the listed strengths and risks. It is not given balance sheets, contingent liabilities or related-party data.
                    </p>
                  </div>

                  <div className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium text-[var(--ink-1)]">Agent 2: Market Sentiment Summariser</h4>
                      <span className="text-2xs font-mono px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400">Configured LLM</span>
                    </div>
                    <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                      Reads grey market premium and subscription multiples (Retail, sHNI, bHNI, QIB). Kostak/Sauda rates and news are not ingested.
                    </p>
                  </div>
                </div>

                <Callout type="note" title="Token Optimization & Latency">
                  Each report is two short LLM calls on structured feed data. Cost per report depends on your provider and model and has not been measured.
                </Callout>
              </section>

              <section id="listing-gatekeepers" className="space-y-5 scroll-mt-20">
                <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
                  5 SEBI Listing Gatekeepers (Deal-Breaker Checks)
                </h2>
                <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
                  Before any valuation scoring occurs, every IPO is subjected to 5 deal-breaker checks:
                </p>

                <div className="overflow-x-auto rounded-md border border-[var(--border-default)] bg-[var(--bg-card)]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-default)] text-2xs uppercase font-mono text-[var(--ink-3)]">
                      <tr>
                        <th className="py-2.5 px-3.5">Gatekeeper Check</th>
                        <th className="py-2.5 px-3.5">SEBI Threshold</th>
                        <th className="py-2.5 px-3.5">Penalty if Violated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-default)] text-[var(--ink-2)] font-mono text-2xs">
                      <tr>
                        <td className="py-2.5 px-3.5 text-[var(--ink-1)] font-medium">1. Promoter Dilution & OFS Split</td>
                        <td className="py-2.5 px-3.5">Offer For Sale &gt; 70% of issue</td>
                        <td className="py-2.5 px-3.5 text-negative">-15 pts (Promoters exit without growth capex)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3.5 text-[var(--ink-1)] font-medium">2. Criminal & Material Litigation</td>
                        <td className="py-2.5 px-3.5">Claims &gt; 25% of Net Worth</td>
                        <td className="py-2.5 px-3.5 text-negative">-20 pts (Legal liability risk)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3.5 text-[var(--ink-1)] font-medium">3. Debt-to-Equity & Solvency</td>
                        <td className="py-2.5 px-3.5">D/E &gt; 3.0x with negative CFO</td>
                        <td className="py-2.5 px-3.5 text-negative">-15 pts (High risk of default)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3.5 text-[var(--ink-1)] font-medium">4. Related-Party Transactions</td>
                        <td className="py-2.5 px-3.5">Unsecured loans to promoter firms</td>
                        <td className="py-2.5 px-3.5 text-negative">-20 pts (Corporate governance anomaly)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3.5 text-[var(--ink-1)] font-medium">5. Auditor Reservations</td>
                        <td className="py-2.5 px-3.5">Adverse opinion or resignation</td>
                        <td className="py-2.5 px-3.5 text-negative">-25 pts (Immediate deal-breaker qualification)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section id="conviction-formula" className="space-y-5 scroll-mt-20">
                <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
                  Deterministic Conviction Score Formulation
                </h2>
                <div className="p-4 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] font-mono text-xs text-[var(--ink-1)]">
                  <div className="text-[var(--accent)] font-bold">
                    Conviction Score = (0.25·Growth + 0.20·Valuation + 0.20·Governance + 0.15·Moat + 0.10·Velocity + 0.10·GMP) - Penalties
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* CHAPTER 3: OPERATIONS RESEARCH & MILP SOLVER */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeChapter === 'operations-research' && (
            <div className="space-y-12">
              <section id="sebi-allotment-rules" className="space-y-5 scroll-mt-20">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-2xs font-mono text-[var(--accent)] font-medium">
                  <Cpu className="w-3 h-3" />
                  <span>OPERATIONS RESEARCH</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--ink-1)]">
                  PuLP Mixed-Integer Linear Programming Engine
                </h1>
                <p className="text-sm text-[var(--ink-2)] max-w-3xl leading-relaxed">
                  How Kapitl formulates the multi-account family allocation problem as a bounded knapsack optimization, balancing SEBI Retail, sHNI, and SME quotas under ASBA liquidity recycling constraints.
                </p>

                {/* Interactive MILP Simulator */}
                <InteractiveMilpSimulator />

                <Callout type="warning" title="SEBI SME Mandatory Rule">
                  Under SEBI SME guidelines, the minimum application is strictly <strong>≥ ₹2,00,000</strong> (typically 2 lots). The solver enforces this constraint and never splits capital below ₹2 Lakhs in SME issues.
                </Callout>
              </section>

              <section id="milp-formulation" className="space-y-5 scroll-mt-20">
                <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
                  Mathematical Solver Formulation
                </h2>
                <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
                  Given family Demat accounts with liquid balances B(a) and active open IPOs with expected return R(i), the solver finds the optimal binary decision variables x(a,i) ∈ {'{0, 1}'} and integer lot counts y(a,i) ≥ 0:
                </p>

                <CodeBlock
                  language="python"
                  title="PuLP MILP Model Implementation (optimizer_service.py)"
                  code={`import pulp

prob = pulp.LpProblem("Kapitl_Family_Allocation", pulp.LpMaximize)

# Decision Variables: binary variable indicating whether account 'a' bids in category 'c'
x = pulp.LpVariable.dicts("bid", ((a["id"], ipo["id"], c) for a in accounts for ipo in ipos for c in categories), cat=pulp.LpBinary)

# Objective: Maximize expected portfolio gain adjusted for category win probability
prob += pulp.lpSum(
    x[a["id"], ipo["id"], c] * expected_gain(ipo, c)
    for a in accounts for ipo in ipos for c in categories
)

# Constraint 1: Single account balance boundary
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

              <section id="asba-lock-recycling" className="space-y-5 scroll-mt-20">
                <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
                  ASBA Capital Overlap & Recycling Timeline
                </h2>
                <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
                  When bidding in an IPO, money remains in the bank account blocked under ASBA. Funds unblock on T+3. If an upcoming blockbuster IPO opens before active funds unfreeze, Kapitl proactively holds back liquid reserves.
                </p>
              </section>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* CHAPTER 4: BROKER EXECUTION & TRACKING */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeChapter === 'execution-engine' && (
            <div className="space-y-12">
              <section id="smartapi-integration" className="space-y-5 scroll-mt-20">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-2xs font-mono text-[var(--accent)] font-medium">
                  <TrendingUp className="w-3 h-3" />
                  <span>EXECUTION & TRACKING</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--ink-1)]">
                  Broker Integration & 09:00:00 AM Exit Strategy
                </h1>
                <p className="text-sm text-[var(--ink-2)] max-w-3xl leading-relaxed">
                  Automating Angel One SmartAPI authentication via RFC 6238 TOTP, polling registrars for credited shares, and staging pre-market limit sell orders to lock in opening pops.
                </p>

                <CodeBlock
                  language="python"
                  title="Automated Two-Factor TOTP Broker Login (smartapi_service.py)"
                  code={`import pyotp
from SmartApi import SmartConnect

def authenticate_broker(client_code, pin, totp_secret, api_key):
    smart_api = SmartConnect(api_key=api_key)
    # Generate RFC 6238 6-digit TOTP code
    totp = pyotp.TOTP(totp_secret).now()
    session_data = smart_api.generateSession(client_code, pin, totp)
    return session_data['data']['jwtToken']`}
                />

                <Callout type="sebi" title="Zero Counterparty Risk">
                  Client funds never leave the investor&apos;s bank account. Applications trigger official bank UPI mandates; capital earns continuous savings bank interest until allotment confirmation.
                </Callout>
              </section>

              <section id="registrar-scrapers" className="space-y-5 scroll-mt-20">
                <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
                  Registrar Scraping & Pre-Market Exit Orders
                </h2>
                <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
                  Automated background workers poll Link Intime, KFintech, and Bigshare. At 09:00:00 AM IST on listing day, staged limit sell orders capture opening auction premiums before retail panic selling.
                </p>
              </section>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* CHAPTER 5: TECHNICAL SPECS & API REFERENCE */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeChapter === 'technical-specs' && (
            <div className="space-y-12">
              <section id="tech-stack-deep-dive" className="space-y-5 scroll-mt-20">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-2xs font-mono text-[var(--accent)] font-medium">
                  <Terminal className="w-3 h-3" />
                  <span>API & ENGINEERING REFERENCE</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--ink-1)]">
                  API Reference & Interactive Sandbox Console
                </h1>
                <p className="text-sm text-[var(--ink-2)] max-w-3xl leading-relaxed">
                  Complete documentation of REST endpoints, WebSocket telemetry events, and interactive payload inspection.
                </p>

                {/* Interactive API Console Component */}
                <InteractiveApiConsole />
              </section>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* CHAPTER 6: AUTHOR, CONTACT & LEGAL DISCLAIMER */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeChapter === 'author-contact' && (
            <div className="space-y-12">
              <section id="developer-profile" className="space-y-5 scroll-mt-20">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-2xs font-mono text-[var(--accent)] font-medium">
                  <User className="w-3 h-3" />
                  <span>CREATOR & COLLABORATION</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--ink-1)]">
                  About the Author & Contact
                </h1>
                <p className="text-sm text-[var(--ink-2)] max-w-3xl leading-relaxed">
                  Learn more about the engineering lead behind Kapitl, explore verified source repositories, and initiate direct communication.
                </p>

                {/* Full Interactive Contact Us Section */}
                <DocsContactSection />
              </section>

              <section id="legal-disclaimer" className="space-y-4 pt-6 border-t border-[var(--border-default)] scroll-mt-20">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[var(--accent)]" />
                  <h3 className="text-sm font-medium text-[var(--ink-1)]">
                    SEBI Regulatory Safe-Harbor Disclaimer
                  </h3>
                </div>
                <p className="text-2xs text-[var(--ink-3)] leading-relaxed">
                  Kapitl is an engineering research platform and computational portfolio optimization tool. It is not registered as a SEBI Research Analyst (RA) or Investment Advisor (RIA) under the Securities and Exchange Board of India Regulations, 2014. The AI conviction scores, forensic evaluations, and MILP optimization models are generated purely via mathematical formulas and public prospectus disclosures. Investments in primary markets (IPOs) are subject to market risks, including loss of principal. Users must conduct their own due diligence or consult a licensed SEBI registered financial advisor before placing capital at risk.
                </p>
              </section>
            </div>
          )}

          {/* ── ARTICLE FOOTER PAGINATION & FEEDBACK ── */}
          <div className="pt-8 border-t border-[var(--border-default)] space-y-6">
            {/* Previous & Next Chapter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {prevChapter ? (
                <button
                  onClick={() => handleSelectChapter(prevChapter.id)}
                  className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] hover:border-[var(--line-strong)] text-left transition-colors flex items-center gap-3 group"
                >
                  <ArrowLeft className="w-4 h-4 text-[var(--ink-3)] group-hover:text-[var(--accent)] transition-colors" />
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-mono text-[var(--ink-3)] block">Previous Chapter</span>
                    <span className="text-xs font-medium text-[var(--ink-1)] truncate block group-hover:text-[var(--accent)] transition-colors">
                      {prevChapter.title}
                    </span>
                  </div>
                </button>
              ) : <div />}

              {nextChapter ? (
                <button
                  onClick={() => handleSelectChapter(nextChapter.id)}
                  className="p-4 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] hover:border-[var(--line-strong)] text-right transition-colors flex items-center justify-end gap-3 group sm:ml-auto w-full"
                >
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-mono text-[var(--ink-3)] block">Next Chapter</span>
                    <span className="text-xs font-medium text-[var(--ink-1)] truncate block group-hover:text-[var(--accent)] transition-colors">
                      {nextChapter.title}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--ink-3)] group-hover:text-[var(--accent)] transition-colors" />
                </button>
              ) : <div />}
            </div>

            {/* Helpful Feedback Widget */}
            <div className="p-4 rounded-md bg-[var(--bg-elevated)]/40 border border-[var(--border-default)] flex flex-col sm:flex-row items-center justify-between gap-3 text-2xs">
              <span className="text-[var(--ink-2)]">Was this documentation page helpful?</span>
              <div className="flex items-center gap-2">
                {feedbackGiven ? (
                  <span className="text-[var(--positive)] font-mono flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Thank you for your feedback!
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => setFeedbackGiven('yes')}
                      className="px-2.5 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-default)] hover:border-[var(--positive)] text-[var(--ink-2)] hover:text-[var(--positive)] transition-colors flex items-center gap-1"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>Yes</span>
                    </button>
                    <button
                      onClick={() => setFeedbackGiven('no')}
                      className="px-2.5 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-default)] hover:border-red-400 text-[var(--ink-2)] hover:text-red-400 transition-colors flex items-center gap-1"
                    >
                      <ThumbsDown className="w-3 h-3" />
                      <span>No</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Bottom Credits & Links */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-2xs text-[var(--ink-3)]">
              <div>
                Kapitl Documentation • Engineered by{' '}
                <a
                  href="https://www.linkedin.com/in/raviyadav23/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline font-medium"
                >
                  Ravi Yadav
                </a>
              </div>
              <div className="flex items-center gap-4">
                <a
                  href="https://github.com/ravi-yadav-23/Kapital"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--ink-1)] transition-colors"
                >
                  Edit on GitHub
                </a>
                <a
                  href="https://ravi-yadav-portfolio.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--ink-1)] transition-colors"
                >
                  Developer Portfolio
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
            </div>
          </div>
        </main>

        {/* Right Table of Contents */}
        <DocsToc
          items={tocItems}
          activeTocId={activeSection}
          onSelectToc={(id) => handleSelectSection(id, activeChapter)}
        />
      </div>
    </div>
  )
}
