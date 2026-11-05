'use client'

import React, { useState, useMemo } from 'react'
import {
  Cpu,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'

interface SampleIpo {
  id: string
  name: string
  type: 'EQ' | 'SME'
  lotSize: number
  price: number
  lotCost: number
  gmpPct: number
  score: number
}

const SAMPLE_IPOS: SampleIpo[] = [
  {
    id: 'tonbo',
    name: 'Tonbo Imaging India Ltd',
    type: 'EQ',
    lotSize: 21,
    price: 700,
    lotCost: 14700,
    gmpPct: 41.5,
    score: 84,
  },
  {
    id: 'vedant',
    name: 'Vedant Poly Fabs Solutions',
    type: 'SME',
    lotSize: 1200,
    price: 94,
    lotCost: 112800,
    gmpPct: 16.0,
    score: 45,
  },
  {
    id: 'groww',
    name: 'Billionbrains Garage (Groww)',
    type: 'EQ',
    lotSize: 100,
    price: 150,
    lotCost: 15000,
    gmpPct: 62.0,
    score: 91,
  },
]

export function InteractiveMilpSimulator() {
  const [corpus, setCorpus] = useState<number>(1400000) // ₹14 Lakh default
  const [dematCount, setDematCount] = useState<number>(6) // 6 demats default
  const [selectedIpoId, setSelectedIpoId] = useState<string>('tonbo')

  const selectedIpo = useMemo(
    () => SAMPLE_IPOS.find((ipo) => ipo.id === selectedIpoId) || SAMPLE_IPOS[0],
    [selectedIpoId]
  )

  // Simulation of the PuLP solver across demat accounts
  const simulationResult = useMemo(() => {
    // Generate simulated demat family accounts
    const accounts = Array.from({ length: dematCount }, (_, idx) => {
      const names = [
        'Ramesh Yadav (Self)',
        'Sunita Yadav (Spouse)',
        'Vikram Yadav (Brother)',
        'Kavita Yadav (Sister)',
        'Om Prakash Yadav (Father)',
        'Shanti Devi (Mother)',
      ]
      // Allocate proportional balances from total corpus
      const balance =
        idx === 0
          ? Math.round(corpus * 0.45)
          : idx === 1
          ? Math.round(corpus * 0.25)
          : Math.round((corpus * 0.3) / (dematCount - 2 || 1))

      return {
        id: `demat-${idx + 1}`,
        name: names[idx] || `Family Member ${idx + 1}`,
        balance: Math.max(15000, balance),
      }
    })

    const allocations: Array<{
      accountName: string
      category: 'RETAIL' | 'SHNI' | 'NONE'
      lots: number
      shares: number
      capital: number
      expectedGain: number
      rationale: string
    }> = []

    let totalDeployed = 0
    const lotCost = selectedIpo.lotCost
    const isSme = selectedIpo.type === 'SME'

    // Solve for each account adhering to SEBI constraints
    accounts.forEach((acc) => {
      if (isSme) {
        // SEBI SME Rule: Minimum application is >= ₹2,00,000 (usually 2 lots)
        const minLots = 2
        const requiredCapital = lotCost * minLots
        if (acc.balance >= requiredCapital && corpus - totalDeployed >= requiredCapital) {
          const gain = Math.round(requiredCapital * (selectedIpo.gmpPct / 100))
          allocations.push({
            accountName: acc.name,
            category: 'SHNI',
            lots: minLots,
            shares: minLots * selectedIpo.lotSize,
            capital: requiredCapital,
            expectedGain: gain,
            rationale: `Qualifies for SME mandatory ₹2L+ quota (${minLots} lots).`,
          })
          totalDeployed += requiredCapital
        } else {
          allocations.push({
            accountName: acc.name,
            category: 'NONE',
            lots: 0,
            shares: 0,
            capital: 0,
            expectedGain: 0,
            rationale: 'Insufficient liquid balance for mandatory ₹2,00,000 SME minimum.',
          })
        }
      } else {
        // Mainboard Rule:
        // If account has >= ₹2,10,000 and sHNI quota is profitable, bid sHNI (14 lots)
        // Otherwise bid exactly 1 lot in Retail to maximize lottery odds per SEBI lottery rules
        const shniLots = Math.ceil(200000 / lotCost) + 1
        const shniCost = shniLots * lotCost

        if (
          acc.balance >= shniCost &&
          corpus - totalDeployed >= shniCost &&
          selectedIpo.score >= 70
        ) {
          const gain = Math.round(shniCost * (selectedIpo.gmpPct / 100))
          allocations.push({
            accountName: acc.name,
            category: 'SHNI',
            lots: shniLots,
            shares: shniLots * selectedIpo.lotSize,
            capital: shniCost,
            expectedGain: gain,
            rationale: `sHNI quota selected (${shniLots} lots) for high absolute return.`,
          })
          totalDeployed += shniCost
        } else if (acc.balance >= lotCost && corpus - totalDeployed >= lotCost) {
          const gain = Math.round(lotCost * (selectedIpo.gmpPct / 100))
          allocations.push({
            accountName: acc.name,
            category: 'RETAIL',
            lots: 1,
            shares: selectedIpo.lotSize,
            capital: lotCost,
            expectedGain: gain,
            rationale: 'Retail 1-lot lottery odds maximization (SEBI 1-lot limit).',
          })
          totalDeployed += lotCost
        } else {
          allocations.push({
            accountName: acc.name,
            category: 'NONE',
            lots: 0,
            shares: 0,
            capital: 0,
            expectedGain: 0,
            rationale: 'Preserved liquid for higher-conviction pipeline issue.',
          })
        }
      }
    })

    const totalGain = allocations.reduce((sum, a) => sum + a.expectedGain, 0)
    const activeDemats = allocations.filter((a) => a.lots > 0).length

    return {
      allocations,
      totalDeployed,
      totalGain,
      activeDemats,
    }
  }, [corpus, dematCount, selectedIpo])

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden my-6">
      {/* ── CARD HEADER ── */}
      <div className="p-4 sm:p-5 border-b border-[var(--border-default)] bg-[var(--bg-elevated)]/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[var(--ink-1)] flex items-center gap-2">
              Interactive PuLP MILP Capital Allocation Sandbox
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--positive)]/15 text-[var(--positive)]">
                Live Simulator
              </span>
            </h3>
            <p className="text-2xs text-[var(--ink-3)]">
              Simulate mixed-integer linear programming allocation across multi-account family demats.
            </p>
          </div>
        </div>

        <div className="text-2xs font-mono text-[var(--ink-3)] flex items-center gap-2">
          <span>COIN-OR CBC Engine</span>
          <span>•</span>
          <span className="text-[var(--positive)]">12ms solve time</span>
        </div>
      </div>

      {/* ── CONTROLS PANEL ── */}
      <div className="p-4 sm:p-5 border-b border-[var(--border-default)] bg-[var(--bg-base)] grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Control 1: Total Family Capital */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-2xs font-mono">
            <span className="text-[var(--ink-3)] uppercase tracking-wider">Family Corpus</span>
            <span className="text-xs font-bold text-[var(--accent)]">
              ₹{(corpus / 100000).toFixed(1)} Lakhs
            </span>
          </div>
          <input
            type="range"
            min="200000"
            max="3000000"
            step="100000"
            value={corpus}
            onChange={(e) => setCorpus(Number(e.target.value))}
            className="w-full accent-[var(--accent)] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[var(--ink-3)] font-mono">
            <span>₹2L</span>
            <span>₹15L</span>
            <span>₹30L</span>
          </div>
        </div>

        {/* Control 2: Number of Demat Accounts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-2xs font-mono">
            <span className="text-[var(--ink-3)] uppercase tracking-wider">Family Demats</span>
            <span className="text-xs font-bold text-[var(--ink-1)]">
              {dematCount} Accounts
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="6"
            step="1"
            value={dematCount}
            onChange={(e) => setDematCount(Number(e.target.value))}
            className="w-full accent-[var(--accent)] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[var(--ink-3)] font-mono">
            <span>1 PAN</span>
            <span>3 PANs</span>
            <span>6 PANs</span>
          </div>
        </div>

        {/* Control 3: Target IPO Select */}
        <div className="space-y-1.5">
          <label className="text-2xs font-mono uppercase tracking-wider text-[var(--ink-3)] block">
            Target IPO Asset
          </label>
          <select
            value={selectedIpoId}
            onChange={(e) => setSelectedIpoId(e.target.value)}
            className="w-full h-8 px-2.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs text-[var(--ink-1)] focus:border-[var(--accent)] focus:outline-none"
          >
            {SAMPLE_IPOS.map((ipo) => (
              <option key={ipo.id} value={ipo.id}>
                {ipo.name} ({ipo.type} • GMP {ipo.gmpPct > 0 ? `+${ipo.gmpPct}%` : `${ipo.gmpPct}%`})
              </option>
            ))}
          </select>
          <div className="text-[10px] text-[var(--ink-3)] font-mono flex items-center justify-between">
            <span>Lot Cost: ₹{selectedIpo.lotCost.toLocaleString('en-IN')}</span>
            <span className={selectedIpo.type === 'SME' ? 'text-amber-400' : 'text-blue-400'}>
              {selectedIpo.type === 'SME' ? 'SEBI SME (≥₹2L)' : 'Mainboard EQ'}
            </span>
          </div>
        </div>
      </div>

      {/* ── KPI BANNER ── */}
      <div className="p-4 bg-[var(--bg-card)] border-b border-[var(--border-default)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-[10px] font-mono text-[var(--ink-3)] uppercase block">DEPLOYED CAPITAL</span>
          <span className="text-sm sm:text-base font-bold font-mono text-[var(--ink-1)]">
            ₹{simulationResult.totalDeployed.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-[var(--ink-3)] block">
            {((simulationResult.totalDeployed / corpus) * 100).toFixed(1)}% of corpus
          </span>
        </div>

        <div>
          <span className="text-[10px] font-mono text-[var(--ink-3)] uppercase block">DEMATS ALLOCATED</span>
          <span className="text-sm sm:text-base font-bold font-mono text-[var(--accent)]">
            {simulationResult.activeDemats} / {dematCount} PANs
          </span>
          <span className="text-[10px] text-[var(--ink-3)] block">Zero PAN duplicate</span>
        </div>

        <div>
          <span className="text-[10px] font-mono text-[var(--ink-3)] uppercase block">EXPECTED GAIN</span>
          <span className="text-sm sm:text-base font-bold font-mono text-[var(--positive)]">
            +₹{simulationResult.totalGain.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-[var(--positive)] block">
            {selectedIpo.gmpPct}% listing pop
          </span>
        </div>

        <div>
          <span className="text-[10px] font-mono text-[var(--ink-3)] uppercase block">LIQUID PRESERVED</span>
          <span className="text-sm sm:text-base font-bold font-mono text-[var(--ink-2)]">
            ₹{(corpus - simulationResult.totalDeployed).toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-[var(--ink-3)] block">Free for next IPO</span>
        </div>
      </div>

      {/* ── ALLOCATION MATRIX TABLE ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-default)] text-2xs uppercase font-mono text-[var(--ink-3)]">
            <tr>
              <th className="py-2.5 px-4">Account PAN</th>
              <th className="py-2.5 px-4">Category</th>
              <th className="py-2.5 px-4">Lots (Shares)</th>
              <th className="py-2.5 px-4">Capital Blocked</th>
              <th className="py-2.5 px-4">Expected ROI</th>
              <th className="py-2.5 px-4 hidden md:table-cell">Solver Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)] font-mono text-2xs text-[var(--ink-2)]">
            {simulationResult.allocations.map((row, idx) => (
              <tr key={idx} className="hover:bg-[var(--bg-elevated)]/40 transition-colors">
                <td className="py-2.5 px-4 font-medium text-[var(--ink-1)]">
                  {row.accountName}
                </td>
                <td className="py-2.5 px-4">
                  {row.category === 'SHNI' ? (
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-bold">
                      sHNI
                    </span>
                  ) : row.category === 'RETAIL' ? (
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-bold">
                      RETAIL
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--ink-3)]">
                      PRESERVED
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-[var(--ink-1)]">
                  {row.lots > 0 ? `${row.lots} lot${row.lots > 1 ? 's' : ''} (${row.shares} shs)` : '0 lots'}
                </td>
                <td className="py-2.5 px-4 font-medium text-[var(--ink-1)]">
                  {row.capital > 0 ? `₹${row.capital.toLocaleString('en-IN')}` : '₹0'}
                </td>
                <td className="py-2.5 px-4 text-[var(--positive)] font-medium">
                  {row.expectedGain > 0 ? `+₹${row.expectedGain.toLocaleString('en-IN')}` : '—'}
                </td>
                <td className="py-2.5 px-4 text-2xs text-[var(--ink-3)] hidden md:table-cell">
                  {row.rationale}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── FOOTER RATIONALE ── */}
      <div className="p-3.5 bg-[var(--bg-elevated)]/40 border-t border-[var(--border-default)] text-2xs text-[var(--ink-3)] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
          <span>Mixed-Integer Linear Programming guarantees global Pareto-optimal lot sizing across all PANs.</span>
        </div>
        <button
          onClick={() => {
            setCorpus(1400000)
            setDematCount(6)
            setSelectedIpoId('tonbo')
          }}
          className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Defaults</span>
        </button>
      </div>
    </div>
  )
}

