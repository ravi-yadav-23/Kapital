import React from 'react'
import { ArrowDown, ArrowRight, Check, X } from 'lucide-react'
import type { DiagramName } from '@/lib/docs-content'

/*
 * Explanatory figures for the documentation, drawn with HTML + theme tokens so they follow light / dark mode and
 * reflow on phones. Every number shown here comes from the code; the worked score examples are re-computed by
 * apps/api/tests/test_docs_examples.py, so change both together.
 */

type Tone = 'muted' | 'accent' | 'pos' | 'neg' | 'warn' | 'plain'

const TONE_VAR: Record<Exclude<Tone, 'muted' | 'plain'>, string> = {
  accent: 'var(--accent)',
  pos: 'var(--positive)',
  neg: 'var(--negative)',
  warn: '#d97706',
}

function toneStyle(tone: Tone, strength = 14): React.CSSProperties {
  if (tone === 'plain') return { borderColor: 'var(--line)', background: 'var(--bg-surface)' }
  if (tone === 'muted') return { borderColor: 'var(--line-strong)', background: 'var(--bg-selected)' }
  const c = TONE_VAR[tone]
  return { borderColor: c, background: `color-mix(in srgb, ${c} ${strength}%, transparent)` }
}

function fill(tone: Tone): React.CSSProperties {
  if (tone === 'muted' || tone === 'plain') return { background: 'var(--line-strong)' }
  return { background: `color-mix(in srgb, ${TONE_VAR[tone]} 70%, transparent)` }
}

function Figure({ title, children, legend }: { title: string; children: React.ReactNode; legend?: [Tone, string][] }) {
  return (
    <div className="rounded-md border border-line bg-surface-raised p-4 text-ink-2 sm:p-6">
      <p className="mb-5 text-center text-[14px] font-semibold text-ink">{title}</p>
      {children}
      {legend && (
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-[12px] text-ink-3">
          {legend.map(([tone, label]) => (
            <span key={label} className="inline-flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 rounded-[3px] border" style={toneStyle(tone, 22)} aria-hidden />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Box({ tone = 'muted', title, sub, className = '' }: { tone?: Tone; title: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[5px] border px-3 py-2 ${className}`} style={toneStyle(tone)}>
      <div className="text-[13px] font-medium leading-5 text-ink">{title}</div>
      {sub && <div className="mt-0.5 text-[12px] leading-[18px] text-ink-3">{sub}</div>}
    </div>
  )
}

function Arrow({ down = false }: { down?: boolean }) {
  const Icon = down ? ArrowDown : ArrowRight
  return <Icon className="h-4 w-4 shrink-0 self-center text-ink-3" aria-hidden />
}

/** A row of boxes joined by arrows: horizontal on wide screens, vertical on phones. */
function Flow({ children }: { children: React.ReactNode[] }) {
  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-stretch">
      {children.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <>
              <span className="md:hidden"><Arrow down /></span>
              <span className="hidden md:flex"><Arrow /></span>
            </>
          )}
          <div className="md:flex-1">{c}</div>
        </React.Fragment>
      ))}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[12px] font-medium text-ink">{children}</p>
}

function Note({ children, tone }: { children: React.ReactNode; tone?: Tone }) {
  const color = tone === 'accent' ? 'var(--accent-text, var(--accent))' : tone === 'neg' ? 'var(--negative)' : tone === 'pos' ? 'var(--positive)' : undefined
  return <p className="mt-1.5 text-[12px] leading-[18px] text-ink-3" style={color ? { color } : undefined}>{children}</p>
}

// ---------------------------------------------------------------------------------------------------------------

function Pipeline() {
  return (
    <Figure
      title="From public listing to a verdict on your screen"
      legend={[['accent', 'Runs in the nightly job (around 02:00 IST)'], ['muted', 'Served on request: stored rows only, no model call']]}
    >
      <Flow>
        {[
          <Box key="a" tone="accent" title="1 · Source sync" sub="Groww, IPO Watch and ipoalerts merged into one record per IPO" className="h-full" />,
          <Box key="b" tone="accent" title="2 · Snapshots" sub="Grey-market premium and subscription saved daily; listing gain stored after listing" className="h-full" />,
          <Box key="c" tone="accent" title="3 · Documents" sub="Offer document split into chunks; facts extracted and checked" className="h-full" />,
          <Box key="d" tone="accent" title="4 · Scoring" sub="Listing-Gain Engine plus red-flag rules" className="h-full" />,
          <Box key="e" tone="muted" title="5 · Report page" sub="Signals with reasons and an Apply / Watch / Avoid badge" className="h-full" />,
        ]}
      </Flow>
      <div className="mt-4 grid gap-2 text-[12px] md:grid-cols-5">
        <div className="rounded-[4px] border border-dashed px-3 py-1.5 text-center md:col-span-4" style={{ borderColor: 'var(--accent)' }}>
          Every result is a new row: documents, chunk analyses, scores and outcomes are never overwritten
        </div>
        <div className="rounded-[4px] border border-dashed border-line-strong px-3 py-1.5 text-center">Free and fast to read</div>
      </div>
    </Figure>
  )
}

function Workflow() {
  const steps: [string, string, string][] = [
    ['Discover', 'IPO Board', 'Open, upcoming and closed issues with their score'],
    ['Judge', 'IPO report', 'Signals, reasons, red flags and the offer-document facts'],
    ['Plan', 'Fund Manager', 'The optimizer splits capital across family accounts'],
    ['Apply', 'Orders', 'Stage the bid, approve the UPI mandate, track the ASBA lock'],
    ['Exit', 'Allotments', 'Record the allotment and sell on listing day'],
  ]
  return (
    <Figure title="A typical IPO cycle in Kapitl" legend={[['accent', 'Where the decision is made'], ['muted', 'Where money moves']]}>
      <Flow>
        {steps.map(([verb, screen, text], i) => (
          <Box key={verb} tone={i < 3 ? 'accent' : 'muted'} className="h-full" title={<>{verb} <span className="font-normal text-ink-3">· {screen}</span></>} sub={text} />
        ))}
      </Flow>
    </Figure>
  )
}

function WeightBar({ parts }: { parts: { key: string; label: string; pct: number; tone: Tone; off?: boolean }[] }) {
  return (
    <div className="flex h-11 w-full overflow-hidden rounded-[5px] border border-line">
      {parts.map((p) => (
        <div
          key={p.key}
          className="flex min-w-0 flex-col items-center justify-center border-r border-[var(--bg-raised)] px-1 text-center last:border-r-0"
          style={{
            width: `${p.pct}%`,
            ...(p.off
              ? { background: 'repeating-linear-gradient(45deg, var(--bg-selected) 0 6px, transparent 6px 12px)' }
              : fill(p.tone)),
          }}
        >
          <span className={`truncate text-[11px] font-medium leading-4 ${p.off ? 'text-ink-3' : 'text-ink'}`}>{p.label}</span>
          <span className="text-[11px] leading-4 text-ink-3">{p.off ? 'left out' : `${p.pct.toFixed(p.pct % 1 ? 1 : 0)}%`}</span>
        </div>
      ))}
    </div>
  )
}

function ScoreWeights() {
  const full = [
    { key: 'company', label: 'Company', pct: 30, tone: 'pos' as Tone },
    { key: 'demand', label: 'Demand', pct: 30, tone: 'accent' as Tone },
    { key: 'gmp', label: 'Grey market', pct: 20, tone: 'warn' as Tone },
    { key: 'float', label: 'Size', pct: 10, tone: 'muted' as Tone },
    { key: 'market', label: 'Mood', pct: 10, tone: 'muted' as Tone },
  ]
  return (
    <Figure
      title="Unknown inputs are left out and the rest share their weight"
      legend={[['pos', 'Company quality (offer document)'], ['accent', 'Demand (subscription)'], ['warn', 'Grey-market premium'], ['muted', 'Issue size and market mood']]}
    >
      <div className="space-y-5">
        <div>
          <Label>Design weights: every input known</Label>
          <WeightBar parts={full} />
        </div>
        <div>
          <Label>Today: market mood is not available yet, so it is left out</Label>
          <WeightBar parts={[{ ...full[0], pct: 33.3 }, { ...full[1], pct: 33.3 }, { ...full[2], pct: 22.2 }, { ...full[3], pct: 11.1 }]} />
          <Note>30 / 30 / 20 / 10 divided by 0.90 → 33.3 / 33.3 / 22.2 / 11.1</Note>
        </div>
        <div>
          <Label>Before the offer document is read: market data only</Label>
          <WeightBar parts={[{ ...full[1], pct: 50 }, { ...full[2], pct: 33.3 }, { ...full[3], pct: 16.7 }]} />
          <Note>Grey-market premium never carries more than its share of what is known, and is cut when demand does not back it.</Note>
        </div>
      </div>
    </Figure>
  )
}

function VerdictScale() {
  const bands: { from: number; to: number; label: string; badge: string; tone: Tone }[] = [
    { from: 0, to: 45, label: 'Avoid', badge: 'Avoid', tone: 'neg' },
    { from: 45, to: 62, label: 'Watch', badge: 'Watch', tone: 'muted' },
    { from: 62, to: 80, label: 'Moderate apply', badge: 'Apply', tone: 'accent' },
    { from: 80, to: 100, label: 'Strong apply', badge: 'Apply', tone: 'pos' },
  ]
  return (
    <Figure title="Where a score lands, and the limits that hold it in place">
      <div className="relative pt-8">
        <div className="absolute top-0 -translate-x-1/2 text-center text-[11px] leading-4" style={{ left: '35%', color: 'var(--negative)' }}>
          35<br />critical-flag ceiling
        </div>
        <div className="absolute top-[30px] h-[60px] w-px" style={{ left: '35%', background: 'var(--negative)' }} aria-hidden />
        <div className="flex h-11 overflow-hidden rounded-[5px] border border-line">
          {bands.map((b) => (
            <div key={b.label} className="flex flex-col items-center justify-center border-r border-[var(--bg-raised)] last:border-r-0" style={{ width: `${b.to - b.from}%`, ...fill(b.tone) }}>
              <span className="text-[12px] font-medium text-ink">{b.label}</span>
              <span className="hidden text-[11px] text-ink-3 sm:block">badge: {b.badge}</span>
            </div>
          ))}
        </div>
        <div className="relative mt-1 h-4 text-[11px] text-ink-3">
          {[0, 45, 62, 80, 100].map((n) => (
            <span key={n} className="absolute -translate-x-1/2" style={{ left: `${n}%` }}>{n}</span>
          ))}
        </div>
        <div className="relative mt-3 h-10">
          <div className="absolute top-0 h-3 rounded-b-[4px] border-x border-b" style={{ left: '45%', width: '15%', borderColor: 'var(--accent)' }} aria-hidden />
          <div className="absolute top-4 -translate-x-1/2 whitespace-nowrap text-[11px]" style={{ left: '52.5%', color: 'var(--accent-text, var(--accent))' }}>
            45–60: thin evidence stays here
          </div>
        </div>
      </div>
      <ul className="mt-2 grid gap-2 text-[12px] leading-[18px] sm:grid-cols-3">
        <li className="rounded-[4px] border border-line p-2"><span className="font-medium text-ink">Critical red flag.</span> The score can go no higher than 35, whatever else is known.</li>
        <li className="rounded-[4px] border border-line p-2"><span className="font-medium text-ink">Only one core signal.</span> Kept between 45 and 60: one signal can neither recommend nor reject.</li>
        <li className="rounded-[4px] border border-line p-2"><span className="font-medium text-ink">Nothing known.</span> No number at all: the page says “No score yet” (Pending).</li>
      </ul>
    </Figure>
  )
}

function StepRow({ n, title, children, result, tone = 'muted' }: { n: number; title: string; children: React.ReactNode; result: string; tone?: Tone }) {
  return (
    <div className="grid gap-2 border-t border-line py-3 first:border-t-0 first:pt-0 sm:grid-cols-[150px_1fr_110px] sm:items-center sm:gap-4">
      <p className="text-[12px] font-medium text-ink">Step {n} · {title}</p>
      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">{children}</div>
      <div className="justify-self-start rounded-[5px] border px-2.5 py-1 text-[12px] font-medium text-ink sm:justify-self-end" style={toneStyle(tone, 18)}>{result}</div>
    </div>
  )
}

function Chip({ tone = 'muted', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className="rounded-[4px] border px-2 py-0.5 text-ink" style={toneStyle(tone)}>{children}</span>
}

function ScoreWalkthrough() {
  return (
    <Figure
      title="Scoring one IPO, step by step"
      legend={[['pos', 'Helps the score'], ['neg', 'Lowers the score'], ['muted', 'Not available, left out']]}
    >
      <p className="mb-4 text-[12px] leading-[18px] text-ink-3">
        Example inputs: grey-market premium 30%, subscribed 40× overall and 80× by QIBs, issue size ₹600 cr, company score 68 from the
        offer document, one medium red flag (mostly offer for sale).
      </p>
      <StepRow n={1} title="Turn inputs into 0–100" result="4 of 5 known">
        <Chip tone="pos">Company 68</Chip>
        <Chip tone="pos">Demand 95</Chip>
        <Chip tone="pos">Grey market 66</Chip>
        <Chip tone="pos">Size 60</Chip>
        <Chip>Mood —</Chip>
      </StepRow>
      <StepRow n={2} title="Is GMP backed?" result="Kept: 66" tone="pos">
        <span>Grey market 66 is not more than 30 points above demand 95, so it keeps its value.</span>
      </StepRow>
      <StepRow n={3} title="Weighted average" result="75.7">
        <span className="font-mono text-[11.5px]">(68×0.30 + 95×0.30 + 66×0.20 + 60×0.10) ÷ 0.90</span>
      </StepRow>
      <StepRow n={4} title="Red-flag penalty" result="71.7" tone="neg">
        <Chip tone="neg">Medium flag −4</Chip>
        <span className="text-ink-3">High −10 each, medium −4 each, at most −25 in total</span>
      </StepRow>
      <StepRow n={5} title="Caps and verdict" result="72 · Apply" tone="accent">
        <span>No critical flag and all three core signals known, so no cap. Rounded to 72: Moderate apply, confidence High.</span>
      </StepRow>
      <div className="mt-4 rounded-[5px] border border-dashed p-3 text-[12px] leading-[18px]" style={{ borderColor: 'var(--negative)' }}>
        <p className="font-medium text-ink">When the grey market outruns demand</p>
        <p className="mt-1 text-ink-3">
          Grey-market premium 60% (scores 84) but only 2× overall and 1.5× QIB subscription (demand scores 44). 84 is more than 30 above 44, so
          the grey-market value is cut to 44 + 15 = 59. Score: (44×0.30 + 59×0.20) ÷ 0.50 = <span className="font-medium text-ink">50 · Watch</span>, with the reason
          “not backed by subscription demand” shown on the page.
        </p>
      </div>
    </Figure>
  )
}

function CompanyScore() {
  const rows: [string, string, string][] = [
    ['Net profit', '> 0 → +15', '< 0 → −25'],
    ['Revenue growth', '≥ 25% → +10 · ≥ 10% → +5', '< 0% → −10'],
    ['Net margin', '≥ 15% → +6', ''],
    ['Debt-to-equity*', '≤ 1 → +8', '> 2.5 → −12'],
    ['Operating cash flow*', '> 0 → +8', '< 0 → −10'],
    ['P/E vs sector P/E', '≤ 1× → +7', '> 1.5× → −8'],
    ['Promoter holding after issue', '≥ 50% → +5', '< 25% → −8'],
  ]
  return (
    <Figure title="Company quality starts at 50 and each known fact moves it" legend={[['pos', 'Adds points'], ['neg', 'Removes points']]}>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-[12px]">
        <Chip>Start 50</Chip><Arrow /><Chip tone="pos">+ strengths</Chip><Chip tone="neg">− weaknesses</Chip><Arrow /><Chip tone="accent">clamp 0–100</Chip><Arrow />
        <Chip>cap 70 / 60 if not from the offer document</Chip>
      </div>
      <div className="overflow-hidden rounded-[5px] border border-line">
        {rows.map(([fact, up, down]) => (
          <div key={fact} className="grid grid-cols-[1fr_1fr] gap-px border-t border-line bg-[var(--line)] text-[12px] first:border-t-0 sm:grid-cols-[1.2fr_1fr_1fr]">
            <div className="col-span-2 bg-surface px-3 py-1.5 font-medium text-ink sm:col-span-1">{fact}</div>
            <div className="px-3 py-1.5" style={toneStyle('pos', 10)}>{up}</div>
            <div className="px-3 py-1.5" style={down ? toneStyle('neg', 10) : { background: 'var(--bg-surface)' }}>{down || '—'}</div>
          </div>
        ))}
      </div>
      <Note>* Skipped for banks, NBFCs and housing-finance companies. Fewer than three known facts → no company score at all.</Note>
    </Figure>
  )
}

function DocReading() {
  return (
    <Figure
      title="How an offer document becomes a handful of checked facts"
      legend={[['accent', 'Language model (untrusted output)'], ['pos', 'Deterministic checks in code'], ['muted', 'Stored, never overwritten']]}
    >
      <Flow>
        {[
          <Box key="a" tone="muted" className="h-full" title="DRHP / RHP PDF" sub="From SEBI, NSE, BSE or the issuer's own site (https only)" />,
          <Box key="b" tone="muted" className="h-full" title="Chunks" sub="About 6,000 characters each, 300 overlapping; ranked so financials, promoter holding and litigation come first" />,
          <Box key="c" tone="accent" className="h-full" title="Extract per chunk" sub="Model returns JSON for a fixed list of fields; each chunk's answer is saved at once" />,
          <Box key="d" tone="pos" className="h-full" title="Validate" sub="Unknown keys dropped · values range-checked · regulatory and auditor claims need a quote found in the text" />,
          <Box key="e" tone="pos" className="h-full" title="Facts → score" sub="Company score and red-flag rules run in code, not in the model" />,
        ]}
      </Flow>
      <div className="mt-4 rounded-[4px] border border-dashed border-line-strong px-3 py-2 text-center text-[12px]">
        Reading stops early once four of the five core facts are known and at least 12 chunks have been read; otherwise it resumes the next night.
      </div>
    </Figure>
  )
}

function FallbackLadder() {
  const rungs: { n: number; title: string; sub: string; cap: string; tone: Tone }[] = [
    { n: 1, title: 'Official offer document', sub: 'SEBI, NSE, BSE or the company PDF, read by the model. Quality, red flags and litigation checked.', cap: 'company score up to 100', tone: 'pos' },
    { n: 2, title: 'Groww company summary', sub: 'Revenue and profit for two years, read without the model. Debt, cash flow, promoter holding and litigation not checked.', cap: 'capped at 70', tone: 'accent' },
    { n: 3, title: 'Verified web search', sub: 'A few numeric facts, each with a quote we find on the cited page ourselves. Yes/no facts never taken from the web.', cap: 'capped at 60', tone: 'warn' },
    { n: 4, title: 'Market data only', sub: 'Grey-market premium and subscription. The page says the company has not been analysed.', cap: 'no company score', tone: 'muted' },
  ]
  return (
    <Figure title="If the offer document cannot be read, the system steps down a ladder" legend={[['pos', 'Most complete'], ['muted', 'Least complete']]}>
      <div className="space-y-2">
        {rungs.map((r, i) => (
          <div key={r.n} style={{ marginLeft: `${i * 4}%` }}>
            <div className="flex flex-col gap-2 rounded-[5px] border p-3 sm:flex-row sm:items-center sm:justify-between" style={toneStyle(r.tone)}>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">{r.n} · {r.title}</p>
                <p className="mt-0.5 text-[12px] leading-[18px] text-ink-3">{r.sub}</p>
              </div>
              <span className="shrink-0 self-start rounded-[4px] border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink sm:self-center">{r.cap}</span>
            </div>
            {i < rungs.length - 1 && <p className="ml-3 py-0.5 text-[11px] text-ink-3">↓ not available</p>}
          </div>
        ))}
      </div>
      <Note>The page always names the step the score rests on. When the offer document turns up later it replaces the lower step; the earlier results stay in history.</Note>
    </Figure>
  )
}

function Decision({ q, yes, tone }: { q: string; yes: string; tone: Tone }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div className="rounded-[5px] border border-line-strong bg-surface px-3 py-2 text-[13px] text-ink">{q}</div>
      <span className="text-[11px] font-medium text-ink-3 sm:px-1">yes →</span>
      <Box tone={tone} title={yes} />
    </div>
  )
}

function RunAuditFlow() {
  return (
    <Figure title="What the Run audit button does (it never calls a model)" legend={[['pos', 'Answer shown now'], ['accent', 'Queued for tonight'], ['neg', 'Refused for today']]}>
      <div className="mx-auto max-w-2xl space-y-1.5">
        <Box tone="muted" title="You click Run audit on a report" />
        <p className="pl-3 text-[11px] text-ink-3">↓</p>
        <Decision q="Is there an analysis newer than 24 hours?" yes="Show it. No request used." tone="pos" />
        <p className="pl-3 text-[11px] text-ink-3">↓ no</p>
        <Decision q="Is this IPO already queued for tonight?" yes="Nothing new queued." tone="muted" />
        <p className="pl-3 text-[11px] text-ink-3">↓ no</p>
        <Decision q="Are all 50 of today's shared requests used?" yes="429: please come back tomorrow." tone="neg" />
        <p className="pl-3 text-[11px] text-ink-3">↓ no</p>
        <Box tone="accent" title="Queued: jumps ahead in tonight's run" sub="Uses one of today's 50 shared requests" />
      </div>
    </Figure>
  )
}

function DailySchedule() {
  const jobs: { h: number; label: string; time: string; tone: Tone; days: string }[] = [
    { h: 2, label: 'Nightly analysis', time: '02:00', tone: 'accent', days: 'every day' },
    { h: 8.5, label: 'Broker login', time: '08:30', tone: 'muted', days: 'weekdays' },
    { h: 9, label: 'Listing-day sell', time: '09:00', tone: 'pos', days: 'weekdays' },
    { h: 10.08, label: 'Reconcile sells', time: '10:05', tone: 'muted', days: 'weekdays' },
    { h: 17, label: 'Source refresh', time: '17:00', tone: 'muted', days: 'weekdays' },
    { h: 22, label: 'Maintenance', time: '22:00', tone: 'muted', days: 'every day' },
  ]
  return (
    <Figure title="A day of scheduled jobs (IST)" legend={[['accent', 'Uses the language model'], ['pos', 'Places broker orders'], ['muted', 'No model, no orders'], ['warn', 'Allotment check every 30 min']]}>
      <div className="relative hidden h-[92px] md:block">
        <div className="absolute top-[42px] h-2 rounded-[3px]" style={{ left: `${(6 / 24) * 100}%`, width: `${(14 / 24) * 100}%`, ...fill('warn') }} />
        <div className="absolute left-0 right-0 top-[45px] h-px bg-[var(--line-strong)]" />
        {jobs.map((j, i) => {
          const up = i % 2 === 0
          return (
            <div key={j.label} className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: `${(j.h / 24) * 100}%`, top: up ? 0 : 40 }}>
              {up && <span className="font-mono text-[11px] leading-4 text-ink">{j.time}</span>}
              {up && <span className="h-[18px] w-px bg-[var(--line-strong)]" />}
              <span className="block h-3 w-3 rounded-full border" style={toneStyle(j.tone, 60)} />
              {!up && <span className="h-[18px] w-px bg-[var(--line-strong)]" />}
              {!up && <span className="font-mono text-[11px] leading-4 text-ink">{j.time}</span>}
            </div>
          )
        })}
      </div>
      <div className="mb-4 mt-1 hidden justify-between text-[11px] text-ink-3 md:flex"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {jobs.map((j) => (
          <li key={j.label} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full border" style={toneStyle(j.tone, 60)} />
            <span className="font-mono text-ink">{j.time}</span> {j.label} <span className="text-ink-3">· {j.days}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 text-[12px]"><span className="h-2.5 w-2.5 shrink-0 rounded-full border" style={toneStyle('warn', 60)} /><span className="font-mono text-ink">06:00–20:00</span> Allotment check every 30 min <span className="text-ink-3">· weekdays</span></li>
      </ul>
      <Note>GitHub Actions can start a scheduled job several minutes late.</Note>
    </Figure>
  )
}

function OrderLifecycle() {
  return (
    <Figure
      title="An application's life, and what happens to the money"
      legend={[['accent', 'Live: money locked in ASBA'], ['pos', 'Allotted: money debited'], ['muted', 'Closed: money released']]}
    >
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1.3fr] md:items-center">
        <div className="rounded-[5px] border p-3" style={toneStyle('accent')}>
          <p className="text-[12px] font-medium text-ink">Live application</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {['PENDING', 'SUBMITTED', 'CONFIRMED', 'APPLIED'].map((s) => <span key={s} className="rounded-[3px] border border-line bg-surface px-1.5 py-0.5 font-mono text-ink">{s}</span>)}
          </div>
          <Note>The bid amount moves from Available to In ASBA.</Note>
        </div>
        <span className="hidden md:block"><Arrow /></span>
        <span className="md:hidden"><Arrow down /></span>
        <div className="space-y-2">
          <Box tone="pos" title={<><span className="font-mono">ALLOTTED</span> · mandate debited</>} sub="Partial allotment refunds the excess. An allotment row is staged for the listing-day sell." />
          <Box tone="muted" title={<><span className="font-mono">NOT_ALLOTTED</span> · mandate unblocked</>} sub="The full amount returns to Available." />
          <Box tone="muted" title={<><span className="font-mono">CANCELLED</span> · mandate revoked</>} sub="Cancelled in Kapitl only; also cancel in your broker or UPI app if it was already submitted." />
        </div>
      </div>
      <Note>Final states do not change again: recording the same result twice does nothing, and an allotted or cancelled order cannot be cancelled.</Note>
    </Figure>
  )
}

function CategoryBands() {
  const max = 14
  const at = (l: number) => `${(l / max) * 100}%`
  return (
    <Figure title="Investor category by application amount (₹ lakh)" legend={[['accent', 'Retail'], ['pos', 'Small HNI (sHNI)'], ['muted', 'Big HNI (bHNI)']]}>
      <div className="relative pt-7">
        <div className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[11px]" style={{ left: at(5), color: 'var(--negative)' }}>₹5 L UPI limit</div>
        <div className="absolute top-[22px] h-[54px] w-0.5" style={{ left: at(5), background: 'var(--negative)' }} aria-hidden />
        <div className="flex h-10 overflow-hidden rounded-[5px] border border-line text-[12px] font-medium text-ink">
          <div className="flex items-center justify-center" style={{ width: at(2), ...fill('accent') }}>Retail</div>
          <div className="flex items-center justify-center" style={{ width: at(8), ...fill('pos') }}>sHNI</div>
          <div className="flex flex-1 items-center justify-center" style={fill('muted')}>bHNI</div>
        </div>
        <div className="relative mt-1 h-4 text-[11px] text-ink-3">
          {[0, 2, 5, 10].map((n) => <span key={n} className="absolute -translate-x-1/2" style={{ left: at(n) }}>{n}</span>)}
          <span className="absolute right-0">more</span>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-[12px] leading-[18px]">
        <li><span className="font-medium text-ink">Retail:</span> up to ₹2,00,000.</li>
        <li><span className="font-medium text-ink">sHNI:</span> ₹2,00,001 to ₹10,00,000. <span className="font-medium text-ink">bHNI:</span> above ₹10,00,000.</li>
        <li><span className="font-medium text-ink">Above ₹5,00,000</span> a UPI mandate is not possible: apply through net-banking ASBA in your broker app, then use “mark as applied”.</li>
      </ul>
    </Figure>
  )
}

function AllotmentEv() {
  const cases = [
    { name: 'Hot IPO', gmp: 60, sub: 50, p: 2, ev: 1.2 },
    { name: 'Quiet IPO', gmp: 15, sub: 1.5, p: 66.7, ev: 10 },
  ]
  return (
    <Figure title="Expected value per rupee = chance of allotment × expected listing gain" legend={[['accent', 'Chance of allotment'], ['pos', 'Expected value per ₹100 bid']]}>
      <div className="grid gap-4 sm:grid-cols-2">
        {cases.map((c) => (
          <div key={c.name} className="rounded-[5px] border border-line bg-surface p-3">
            <p className="text-[13px] font-medium text-ink">{c.name}</p>
            <p className="text-[12px] text-ink-3">Grey market {c.gmp}% · retail subscribed {c.sub}×</p>
            <div className="mt-3 space-y-2 text-[12px]">
              <div>
                <div className="mb-0.5 flex justify-between"><span>Chance of allotment</span><span className="font-mono text-ink">{c.sub > 1 ? `1 ÷ ${c.sub} = ` : ''}{c.p}%</span></div>
                <div className="h-2 rounded-full bg-[var(--bg-selected)]"><div className="h-2 rounded-full" style={{ width: `${c.p}%`, ...fill('accent') }} /></div>
              </div>
              <div>
                <div className="mb-0.5 flex justify-between"><span>Expected value per ₹100</span><span className="font-mono text-ink">₹{c.ev.toFixed(1)}</span></div>
                <div className="h-2 rounded-full bg-[var(--bg-selected)]"><div className="h-2 rounded-full" style={{ width: `${c.ev * 8}%`, ...fill('pos') }} /></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Note>The bigger headline gain is worth less once the odds are counted. Grey-market quotes are capped at 80% and floored at −50% here; no quote counts as 0.</Note>
    </Figure>
  )
}

function SignIn() {
  return (
    <Figure title="Who can see what" legend={[['pos', 'Admin session'], ['muted', 'Guest'], ['accent', 'Scheduler']]}>
      <div className="space-y-3">
        <Flow>
          {[
            <Box key="a" tone="plain" className="h-full" title="Google sign-in" sub="Email must match ALLOWED_EMAIL" />,
            <Box key="b" tone="plain" className="h-full" title="One-time code (TOTP)" sub="Failed attempts are rate limited" />,
            <Box key="c" tone="pos" className="h-full" title="Admin session" sub="Accounts, orders, funds, broker data, source health" />,
          ]}
        </Flow>
        <Flow>
          {[
            <Box key="a" tone="plain" className="h-full" title="No sign-in" sub="Anyone with the link" />,
            <Box key="b" tone="muted" className="h-full" title="Guest" sub="IPO list, reports, analyses, Run audit, sample data" />,
          ]}
        </Flow>
        <Flow>
          {[
            <Box key="a" tone="plain" className="h-full" title="GitHub Actions" sub="Bearer CRON_SECRET" />,
            <Box key="b" tone="accent" className="h-full" title="/api/cron/* only" sub="Never accepts the app's signing key" />,
          ]}
        </Flow>
      </div>
    </Figure>
  )
}

function Check2({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? Check : X
  return (
    <li className="flex items-start gap-2 text-[12px] leading-[18px]">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: ok ? 'var(--positive)' : 'var(--negative)' }} aria-hidden />
      <span>{children}</span>
    </li>
  )
}

function Confidence() {
  const rows: [string, boolean[], string][] = [
    ['High', [true, true, true], 'All three core signals'],
    ['Medium', [true, true, false], 'Any two of the three'],
    ['Low', [false, true, false], 'Only one: held in 45–60'],
  ]
  return (
    <Figure title="Confidence counts the three core signals">
      <div className="overflow-hidden rounded-[5px] border border-line text-[12px]">
        <div className="grid grid-cols-[80px_repeat(3,1fr)] bg-[var(--bg-selected)] px-3 py-1.5 font-medium text-ink sm:grid-cols-[90px_repeat(3,1fr)_1.5fr]">
          <span>Level</span><span>Company</span><span>Demand</span><span>Grey market</span><span className="hidden sm:block">Example</span>
        </div>
        {rows.map(([lvl, has, ex]) => (
          <div key={lvl} className="grid grid-cols-[80px_repeat(3,1fr)] items-center border-t border-line bg-surface px-3 py-1.5 sm:grid-cols-[90px_repeat(3,1fr)_1.5fr]">
            <span className="font-medium text-ink">{lvl}</span>
            {has.map((h, i) => (
              <ul key={i}><Check2 ok={h}>{h ? 'known' : 'unknown'}</Check2></ul>
            ))}
            <span className="hidden text-ink-3 sm:block">{ex}</span>
          </div>
        ))}
      </div>
    </Figure>
  )
}

export const DIAGRAMS: Record<DiagramName, () => React.ReactElement> = {
  pipeline: Pipeline,
  workflow: Workflow,
  'score-weights': ScoreWeights,
  'verdict-scale': VerdictScale,
  'score-walkthrough': ScoreWalkthrough,
  'company-score': CompanyScore,
  'doc-reading': DocReading,
  'fallback-ladder': FallbackLadder,
  'run-audit-flow': RunAuditFlow,
  'daily-schedule': DailySchedule,
  'order-lifecycle': OrderLifecycle,
  'category-bands': CategoryBands,
  'allotment-ev': AllotmentEv,
  'sign-in': SignIn,
  confidence: Confidence,
}

export function DocDiagram({ name, caption }: { name: DiagramName; caption: string }) {
  const D = DIAGRAMS[name]
  return (
    <figure className="my-2">
      <D />
      <figcaption className="mt-2 text-center text-[12px] leading-5 text-ink-3">{caption}</figcaption>
    </figure>
  )
}
