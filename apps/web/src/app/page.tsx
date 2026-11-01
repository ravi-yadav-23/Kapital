'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  SlidersHorizontal,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Github,
  Linkedin,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { ProductHeroShowcase } from '@/components/landing/ProductHeroShowcase'
import { LiveProfitAllocationCalculator } from '@/components/landing/LiveProfitAllocationCalculator'
import { LiveArchitectureSimulator } from '@/components/landing/LiveArchitectureSimulator'
import { ComparisonSection } from '@/components/landing/ComparisonSection'
import { FaqSection } from '@/components/landing/FaqSection'

export default function LandingPage() {
  const router = useRouter()
  const { loginAsGuest } = useAuth()
  const [isGuestLoading, setIsGuestLoading] = useState(false)

  const handleGuestExplore = async () => {
    setIsGuestLoading(true)
    try {
      await loginAsGuest()
      router.push('/dashboard')
    } catch (err) {
      console.error('Guest login failed:', err)
      router.push('/dashboard')
    } finally {
      setIsGuestLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--ink-1)] flex flex-col font-sans selection:bg-[var(--accent)] selection:text-[var(--bg-base)]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg-base)]/90 border-b border-[var(--border-default)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded bg-[var(--accent)] text-[var(--bg-base)] font-mono font-medium text-xs flex items-center justify-center">
              K
            </span>
            <span className="font-medium text-sm text-[var(--ink-1)] tracking-tight">
              Kapitl
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-xs text-[var(--ink-2)]">
            <a href="#showcase" className="hover:text-[var(--ink-1)] transition">Product Theater</a>
            <a href="#calculator" className="hover:text-[var(--ink-1)] transition">Allocation Simulator</a>
            <a href="#problem" className="hover:text-[var(--ink-1)] transition">The Problem</a>
            <a href="#how-it-works" className="hover:text-[var(--ink-1)] transition">How It Works</a>
            <a href="#comparison" className="hover:text-[var(--ink-1)] transition">Vs Brokers</a>
            <a href="#faq" className="hover:text-[var(--ink-1)] transition">FAQ</a>
            <a
              href="https://github.com/ravi-yadav-23/Kapital"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-[var(--ink-1)] transition"
            >
              <Github className="w-3.5 h-3.5" /> GitHub
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="btn btn-secondary btn-sm"
            >
              Sign In
            </Link>
            <button
              onClick={handleGuestExplore}
              disabled={isGuestLoading}
              className="btn btn-primary btn-sm gap-1.5"
            >
              <span>{isGuestLoading ? 'Launching...' : 'Explore Demo Workspace'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── SECTION 1: CENTERED HERO (Linear / Mercury Style) ─────────────── */}
      <section className="relative pt-16 pb-12 md:pt-24 md:pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] text-2xs font-mono font-medium text-[var(--ink-2)] mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)] inline-block" />
          <span>IPO INTELLIGENCE PLATFORM</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-[var(--ink-1)] leading-[1.12] max-w-4xl mx-auto">
          Every IPO. Scored, allocated, and executed across your family&apos;s Demat accounts.
        </h1>

        <p className="mt-5 text-sm sm:text-base text-[var(--ink-2)] leading-relaxed max-w-2xl mx-auto">
          Kapitl evaluates draft prospectuses with LLMs, solves mathematical lot distribution across family PANs via linear optimization, and stages pre-listing execution through broker APIs.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={handleGuestExplore}
            disabled={isGuestLoading}
            className="btn btn-primary btn-md gap-2"
          >
            <span>{isGuestLoading ? 'Loading Workspace...' : 'Explore Demo Workspace'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <a
            href="https://github.com/ravi-yadav-23/Kapital"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-md gap-2"
          >
            <Github className="w-4 h-4" />
            <span>Source Code</span>
          </a>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-2xs font-mono text-[var(--ink-3)]">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" /> No credentials required
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" /> Seeded family dataset
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" /> Live market feed
          </div>
        </div>
      </section>

      {/* ── SECTION 2: GRAND PRODUCT HERO SHOWCASE (Interactive Theater) ──── */}
      <section id="showcase" className="px-4 sm:px-6 lg:px-8 pb-20">
        <ProductHeroShowcase />
      </section>

      {/* ── SECTION 3: ALLOCATION CALCULATOR (Placed above The Problem) ───── */}
      <section id="calculator" className="py-16 border-t border-[var(--border-default)] bg-[var(--bg-surface)]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <LiveProfitAllocationCalculator />
        </div>
      </section>

      {/* ── SECTION 4: THE PROBLEM ────────────────────────────────────────── */}
      <section id="problem" className="py-16 border-t border-[var(--border-default)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)] block mb-1">
              The Retail Investor Friction
            </span>
            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-[var(--ink-1)]">
              Why manual IPO bidding leads to missed opportunities
            </h2>
            <p className="mt-3 text-[var(--ink-2)] text-sm leading-relaxed">
              The Indian primary market runs on strict math, changing GMP signals, and fragmented family accounts. Guesswork and manual spreadsheets lead to predictable failure modes:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 space-y-3">
              <div className="w-8 h-8 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center justify-center text-[var(--ink-2)]">
                <XCircle className="w-4 h-4 text-[var(--negative)]" />
              </div>
              <h3 className="text-base font-medium text-[var(--ink-1)]">
                300-page DRHP prospectuses
              </h3>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Deciphering promoter litigation, debt covenants, OFS vs fresh issue dilution, and peer multiples manually is slow and prone to subjective bias.
              </p>
            </div>

            <div className="card p-6 space-y-3">
              <div className="w-8 h-8 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center justify-center text-[var(--ink-2)]">
                <SlidersHorizontal className="w-4 h-4 text-[var(--ink-2)]" />
              </div>
              <h3 className="text-base font-medium text-[var(--ink-1)]">
                Suboptimal SEBI quota choice
              </h3>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Bidding Retail (&lt;₹2L) when sHNI (₹2L–₹10L) offers higher probability in high-demand issues, or misallocating lots across multiple accounts with duplicate PANs.
              </p>
            </div>

            <div className="card p-6 space-y-3">
              <div className="w-8 h-8 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center justify-center text-[var(--ink-2)]">
                <Clock className="w-4 h-4 text-[var(--ink-2)]" />
              </div>
              <h3 className="text-base font-medium text-[var(--ink-1)]">
                ASBA mandate lock overlap
              </h3>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                When multiple issues open simultaneously, bidding in a weak issue locks your bank balance so you cannot participate in a high-GMP issue opening two days later.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: HOW IT WORKS & ARCHITECTURE ───────────────────────── */}
      <section id="how-it-works" className="py-16 border-t border-[var(--border-default)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)] block mb-1">
              System Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-[var(--ink-1)]">
              Automated end-to-end IPO workflow
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 space-y-3">
              <span className="text-xs font-mono text-[var(--ink-3)] block">01 / AUDIT</span>
              <h3 className="text-base font-medium text-[var(--ink-1)]">
                DRHP & Forensic Due Diligence
              </h3>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Claude Haiku and Gemini Flash-Lite inspect financial statements, forensic red flags, auditor qualifications, and live grey market premiums to generate a 0–100 quality score.
              </p>
            </div>

            <div className="card p-6 space-y-3">
              <span className="text-xs font-mono text-[var(--ink-3)] block">02 / OPTIMIZE</span>
              <h3 className="text-base font-medium text-[var(--ink-1)]">
                PuLP Linear Solver
              </h3>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                A Mixed-Integer Linear Programming (MILP) solver calculates the mathematically optimal bid configuration across family accounts, balancing Retail and sHNI quotas against available funds.
              </p>
            </div>

            <div className="card p-6 space-y-3">
              <span className="text-xs font-mono text-[var(--ink-3)] block">03 / EXECUTE</span>
              <h3 className="text-base font-medium text-[var(--ink-1)]">
                Listing-Day Staging
              </h3>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Stage pre-market sell orders scheduled for execution at 09:00:00 AM IST on listing day via broker SmartAPI integration.
              </p>
            </div>
          </div>

          {/* System Lifecycle Architecture Simulator */}
          <div className="mt-12">
            <LiveArchitectureSimulator />
          </div>
        </div>
      </section>

      {/* ── SECTION 6: COMPARISON ─────────────────────────────────────────── */}
      <div id="comparison">
        <ComparisonSection />
      </div>

      {/* ── SECTION 7: FAQ ────────────────────────────────────────────────── */}
      <div id="faq">
        <FaqSection />
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="py-12 bg-[var(--bg-base)] border-t border-[var(--border-default)] text-xs text-[var(--ink-3)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)] inline-block" />
              <span className="font-mono text-2xs text-[var(--ink-2)]">All systems operational · Live feed synced</span>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <a
                href="https://github.com/ravi-yadav-23/Kapital"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[var(--ink-1)] transition flex items-center gap-1"
              >
                <Github className="w-3.5 h-3.5" /> GitHub
              </a>
              <a
                href="https://linkedin.com/in/ravi-yadav-23"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[var(--ink-1)] transition flex items-center gap-1"
              >
                <Linkedin className="w-3.5 h-3.5" /> LinkedIn
              </a>
              <Link href="/login" className="hover:text-[var(--ink-1)] transition">
                Sign In
              </Link>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-default)] flex flex-col sm:flex-row items-center justify-between gap-2 text-2xs text-[var(--ink-3)]">
            <span>Kapitl · IPO Intelligence Platform · Built by Ravi Yadav</span>
            <span className="font-mono">Geist Sans & Mono · PuLP MILP Solver · Angel One SmartAPI Sandbox</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
