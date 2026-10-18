'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  TrendingUp,
  BrainCircuit,
  SlidersHorizontal,
  Zap,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ChevronRight,
  Github,
  Linkedin,
  ExternalLink,
  PieChart,
  BarChart3,
  Bot,
  Activity,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { MarketTickerBar } from '@/components/landing/MarketTickerBar'
import { HeroEcosystemVisual } from '@/components/landing/HeroEcosystemVisual'
import { LiveProfitAllocationCalculator } from '@/components/landing/LiveProfitAllocationCalculator'
import { LiveArchitectureSimulator } from '@/components/landing/LiveArchitectureSimulator'
import { ComparisonSection } from '@/components/landing/ComparisonSection'
import { FaqSection } from '@/components/landing/FaqSection'

export default function LandingPage() {
  const router = useRouter()
  const { loginAsGuest, isAuthenticated } = useAuth()
  const [isGuestLoading, setIsGuestLoading] = useState(false)

  const handleGuestExplore = async () => {
    setIsGuestLoading(true)
    try {
      await loginAsGuest()
      // Directly route to IPO board (the most compelling screen with real live data)
      router.push('/ipos')
    } catch (err) {
      console.error('Guest login failed:', err)
      // Fallback
      router.push('/ipos')
    } finally {
      setIsGuestLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0c0a09] text-[#fafaf9] selection:bg-[#f59e0b]/30 selection:text-white flex flex-col font-sans relative overflow-x-hidden">
      {/* Background radial ambient lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-[#f59e0b]/10 via-[#d97706]/5 to-transparent blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-[800px] -left-48 w-[600px] h-[600px] bg-[#f59e0b]/5 rounded-full blur-[160px] pointer-events-none -z-10" />
      <div className="absolute top-[1600px] -right-48 w-[600px] h-[600px] bg-[#d97706]/5 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0c0a09]/80 border-b border-[#2d2520]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] flex items-center justify-center shadow-lg shadow-[#f59e0b]/20">
              <Sparkles className="w-5 h-5 text-[#0c0a09]" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-bold text-lg tracking-tight text-[#fafaf9]">
                Kapitl
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#a8a29e]">
                IPO Intelligence Platform
              </span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-7 text-sm text-[#a8a29e]">
            <a href="#calculator" className="hover:text-[#f59e0b] transition">Profit Calculator</a>
            <a href="#problem" className="hover:text-[#fafaf9] transition">The Problem</a>
            <a href="#how-it-works" className="hover:text-[#fafaf9] transition">How It Works</a>
            <a href="#comparison" className="hover:text-[#fafaf9] transition">Vs Brokers</a>
            <a href="#faq" className="hover:text-[#fafaf9] transition">FAQ</a>
            <a
              href="https://github.com/ravi-yadav-23/Kapital"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-[#fafaf9] transition"
            >
              <Github className="w-4 h-4" /> GitHub
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-medium text-[#a8a29e] hover:text-[#fafaf9] px-3.5 py-2 rounded-lg hover:bg-[#1a1612] transition"
            >
              Sign In
            </Link>
            <button
              onClick={handleGuestExplore}
              disabled={isGuestLoading}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#0c0a09] hover:brightness-110 shadow-md shadow-[#f59e0b]/20 transition-all cursor-pointer"
            >
              {isGuestLoading ? (
                <>Launching...</>
              ) : (
                <>
                  Explore as Guest <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Real-time Market & IPO Ticker Marquee */}
      <MarketTickerBar />

      {/* SECTION 1: HERO */}
      <section className="relative pt-20 pb-24 md:pt-28 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1612] border border-[#2d2520] text-xs font-medium text-[#f59e0b] mb-6">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span>Autonomous Multi-Agent IPO Pipeline</span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#fafaf9] leading-[1.15]">
              Stop guessing which <span className="bg-gradient-to-r from-[#f59e0b] to-[#d97706] bg-clip-text text-transparent">IPO to apply</span> to.
            </h1>

            <p className="mt-6 text-base sm:text-lg text-[#a8a29e] leading-relaxed max-w-2xl">
              Kapitl scores every IPO with AI, allocates your family&apos;s capital mathematically across SEBI categories, and manages the entire application workflow autonomously.
            </p>

            <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-4 w-full sm:w-auto">
              <button
                onClick={handleGuestExplore}
                disabled={isGuestLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#0c0a09] font-bold text-sm sm:text-base shadow-xl shadow-[#f59e0b]/25 hover:brightness-110 transition-all cursor-pointer"
              >
                {isGuestLoading ? 'Loading Live Data...' : 'Explore as Guest →'}
              </button>

              <a
                href="https://github.com/ravi-yadav-23/Kapital"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#1a1612] hover:bg-[#251e18] border border-[#2d2520] text-[#fafaf9] font-medium text-sm sm:text-base transition"
              >
                <Github className="w-4 h-4 text-[#a8a29e]" />
                View on GitHub
              </a>
            </div>

            <div className="mt-8 flex items-center gap-6 text-xs text-[#a8a29e]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#22c55e]" /> No credit card required
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#22c55e]" /> Instant guest access
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#22c55e]" /> Real market data
              </div>
            </div>
          </div>

          {/* Hero Right Visual: Live Animated Card with Gauge & Dynamic Topology */}
          <div className="lg:col-span-5 flex justify-center w-full">
            <HeroEcosystemVisual />
          </div>
        </div>
      </section>

      {/* SECTION 2: THE PROBLEM */}
      <section id="problem" className="py-20 border-t border-[#2d2520] bg-[#0c0a09]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs uppercase font-mono tracking-widest text-[#ef4444] font-semibold">
              The Retail Investor Dilemma
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#fafaf9] mt-3">
              Why manual IPO bidding costs you lakhs in missed listing gains
            </h2>
            <p className="mt-4 text-[#a8a29e] text-base">
              The Indian IPO market runs on strict math, fast GMP shifts, and fragmented family accounts. Guesswork and manual spreadsheets fail in three major ways:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Problem 1 */}
            <div className="bg-[#1a1612] border border-[#2d2520] rounded-2xl p-7 relative hover:border-[#ef4444]/40 transition group">
              <div className="w-12 h-12 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-[#ef4444] mb-6">
                <XCircle className="w-6 h-6" />
              </div>
              <h3 className="font-heading text-lg font-bold text-[#fafaf9] mb-2">
                2-3 hours reading 400-page DRHPs
              </h3>
              <p className="text-sm text-[#a8a29e] leading-relaxed">
                Reading red-herring prospectuses, deciphering promoter pledge risk, checking OFS vs fresh issue ratios, and comparing peer multiples manually is exhausting and prone to bias.
              </p>
              <div className="mt-6 pt-4 border-t border-[#2d2520] text-xs text-[#ef4444] font-mono">
                Result: Blind reliance on Telegram tips
              </div>
            </div>

            {/* Problem 2 */}
            <div className="bg-[#1a1612] border border-[#2d2520] rounded-2xl p-7 relative hover:border-[#ef4444]/40 transition group">
              <div className="w-12 h-12 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-[#ef4444] mb-6">
                <SlidersHorizontal className="w-6 h-6" />
              </div>
              <h3 className="font-heading text-lg font-bold text-[#fafaf9] mb-2">
                Wrong SEBI category = rejected bids
              </h3>
              <p className="text-sm text-[#a8a29e] leading-relaxed">
                Applying Retail (&lt;₹2L) when sHNI (₹2L-₹10L) has 3x higher allotment odds, or bidding across multiple accounts with duplicate PANs immediately disqualifies your bids.
              </p>
              <div className="mt-6 pt-4 border-t border-[#2d2520] text-xs text-[#ef4444] font-mono">
                Result: 0 allotment despite high capital
              </div>
            </div>

            {/* Problem 3 */}
            <div className="bg-[#1a1612] border border-[#2d2520] rounded-2xl p-7 relative hover:border-[#ef4444]/40 transition group">
              <div className="w-12 h-12 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-[#ef4444] mb-6">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-heading text-lg font-bold text-[#fafaf9] mb-2">
                Funds stuck in ASBA, better IPO missed
              </h3>
              <p className="text-sm text-[#a8a29e] leading-relaxed">
                When 3 IPOs open in the same week, locking capital into a mediocre issue blocks you from bidding on an 80% GMP blockbuster opening two days later.
              </p>
              <div className="mt-6 pt-4 border-t border-[#2d2520] text-xs text-[#ef4444] font-mono">
                Result: Suboptimal capital deployment
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: INTERACTIVE ALLOCATION & PROFIT SIMULATOR */}
      <section id="calculator" className="py-20 border-t border-[#2d2520] bg-[#14100c]/40 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <LiveProfitAllocationCalculator />
        </div>
      </section>

      {/* SECTION 3: HOW IT WORKS */}
      <section id="how-it-works" className="py-20 border-t border-[#2d2520]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs uppercase font-mono tracking-widest text-[#f59e0b] font-semibold">
              The Solution
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#fafaf9] mt-3">
              How Kapitl automates your entire IPO operation
            </h2>
            <p className="mt-4 text-[#a8a29e] text-base">
              A 3-stage autonomous workflow combining deep LLM research, constraint-solver allocation math, and listing-day execution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-[#1a1612] border border-[#2d2520] rounded-2xl p-7 relative">
              <div className="w-9 h-9 rounded-full bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 font-heading font-bold text-sm flex items-center justify-center mb-6">
                1
              </div>
              <h3 className="font-heading text-xl font-bold text-[#fafaf9] mb-3">
                AI scores every IPO 0-100
              </h3>
              <p className="text-sm text-[#a8a29e] leading-relaxed mb-4">
                Specialized agents inspect the DRHP financial statements, audit reports, track grey market premiums (GMP), and evaluate subscription numbers in real-time.
              </p>
              <div className="text-xs font-mono text-[#f59e0b] bg-[#0c0a09] p-3 rounded-xl border border-[#2d2520]">
                Claude 3.5 & Gemini 2.5 flash agents generate a 6-dimension composite score: Apply or Avoid.
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-[#1a1612] border border-[#2d2520] rounded-2xl p-7 relative">
              <div className="w-9 h-9 rounded-full bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 font-heading font-bold text-sm flex items-center justify-center mb-6">
                2
              </div>
              <h3 className="font-heading text-xl font-bold text-[#fafaf9] mb-3">
                Math allocates the capital
              </h3>
              <p className="text-sm text-[#a8a29e] leading-relaxed mb-4">
                Our linear constraint solver analyzes your family corpus across up to 10 Demat accounts. It calculates the mathematically optimal distribution per SEBI rules.
              </p>
              <div className="text-xs font-mono text-[#f59e0b] bg-[#0c0a09] p-3 rounded-xl border border-[#2d2520]">
                Optimizes Retail, sHNI (&gt;₹2L), and bHNI (&gt;₹10L) to maximize expected allotment value.
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-[#1a1612] border border-[#2d2520] rounded-2xl p-7 relative">
              <div className="w-9 h-9 rounded-full bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 font-heading font-bold text-sm flex items-center justify-center mb-6">
                3
              </div>
              <h3 className="font-heading text-xl font-bold text-[#fafaf9] mb-3">
                System executes autonomously
              </h3>
              <p className="text-sm text-[#a8a29e] leading-relaxed mb-4">
                Track allotment status seamlessly. On listing day, execute pre-open profit booking or trail stop losses through broker APIs directly at 9:00 AM.
              </p>
              <div className="text-xs font-mono text-[#f59e0b] bg-[#0c0a09] p-3 rounded-xl border border-[#2d2520]">
                Angel One SmartAPI integration fires target exit orders with zero manual intervention.
              </div>
            </div>
          </div>

          {/* Live System Lifecycle Architecture Simulator */}
          <div className="mt-14">
            <LiveArchitectureSimulator />
          </div>
        </div>
      </section>

      {/* SECTION: COMPARISON */}
      <div id="comparison">
        <ComparisonSection />
      </div>

      {/* SECTION 4: LIVE STATS BAR */}
      <section id="stats" className="py-14 border-y border-[#2d2520] bg-[#1a1612]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-4">
              <div className="font-heading text-3xl sm:text-4xl font-extrabold text-[#fafaf9] tracking-tight">
                12+
              </div>
              <div className="text-xs text-[#a8a29e] uppercase font-mono tracking-wider mt-1.5">
                IPOs Tracked Live
              </div>
            </div>
            <div className="p-4">
              <div className="font-heading text-3xl sm:text-4xl font-extrabold text-[#22c55e] tracking-tight">
                5 Open
              </div>
              <div className="text-xs text-[#a8a29e] uppercase font-mono tracking-wider mt-1.5">
                Accepting Bids Today
              </div>
            </div>
            <div className="p-4">
              <div className="font-heading text-3xl sm:text-4xl font-extrabold text-[#f59e0b] tracking-tight">
                ₹200 / mo
              </div>
              <div className="text-xs text-[#a8a29e] uppercase font-mono tracking-wider mt-1.5">
                Monthly AI Cost
              </div>
            </div>
            <div className="p-4">
              <div className="font-heading text-3xl sm:text-4xl font-extrabold text-[#fafaf9] tracking-tight">
                10 Accounts
              </div>
              <div className="text-xs text-[#a8a29e] uppercase font-mono tracking-wider mt-1.5">
                Family Multi-PAN Support
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: FAQ */}
      <div id="faq">
        <FaqSection />
      </div>

      {/* SECTION 5: CTA FOOTER & RECRUITER INFO */}
      <footer className="py-20 bg-[#0c0a09] border-t border-[#2d2520] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Conversion Banner */}
          <div className="bg-gradient-to-br from-[#1a1612] to-[#251e18] border border-[#2d2520] rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden mb-16 shadow-2xl">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#f59e0b]/10 rounded-full blur-[100px] pointer-events-none" />
            
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[#fafaf9] tracking-tight">
              Ready to see real IPO intelligence in action?
            </h2>
            <p className="mt-3 text-[#a8a29e] text-sm sm:text-base max-w-xl mx-auto">
              Explore the full IPO board, multi-agent AI reports, and dynamic capital allocation solver without signing up.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={handleGuestExplore}
                disabled={isGuestLoading}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#0c0a09] font-bold text-sm sm:text-base shadow-xl shadow-[#f59e0b]/20 hover:brightness-110 transition cursor-pointer"
              >
                {isGuestLoading ? 'Loading Live Data...' : 'Explore as Guest Now →'}
              </button>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#0c0a09] hover:bg-[#1a1612] border border-[#2d2520] text-[#fafaf9] font-medium text-sm sm:text-base transition"
              >
                Sign In to Terminal
              </Link>
            </div>
          </div>

          {/* Credits & Links */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-[#2d2520] pt-8 text-xs text-[#a8a29e]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#fafaf9]">Built by Ravi Yadav</span>
              <span>•</span>
              <span>B.Tech CSE • Lovely Professional University</span>
            </div>

            <div className="flex items-center gap-6">
              <a
                href="https://github.com/ravi-yadav-23/Kapital"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#fafaf9] transition flex items-center gap-1.5"
              >
                <Github className="w-4 h-4" /> GitHub
              </a>
              <a
                href="https://linkedin.com/in/ravi-yadav-23"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#fafaf9] transition flex items-center gap-1.5"
              >
                <Linkedin className="w-4 h-4" /> LinkedIn
              </a>
              <Link href="/login" className="hover:text-[#fafaf9] transition">
                Admin Terminal
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
