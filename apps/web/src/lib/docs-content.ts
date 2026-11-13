// Documentation content for /docs. Plain data + pure helpers (no React) so it can be unit tested.
// Every statement here must match what the code does today; see api tests/test_docs_honesty.py.

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'callout'; tone: 'note' | 'warn'; title: string; text: string }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'code'; lang: string; text: string }

export interface DocPage {
  slug: string
  group: string
  title: string
  description: string
  blocks: Block[]
}

export const DOC_GROUPS = ['Start here', 'How scoring works', 'Data and automation', 'Money and accounts', 'Run it yourself'] as const

export function slugifyHeading(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export const DOC_PAGES: DocPage[] = [
  {
    slug: 'overview',
    group: 'Start here',
    title: 'What Kapitl is',
    description: 'A planning tool for Indian retail IPO investors who apply from several family demat accounts.',
    blocks: [
      { type: 'p', text: 'Kapitl helps you decide which IPOs are worth applying to for a listing-day gain, how much to put in from each family account, and keeps track of the money that is locked while an application is pending (ASBA).' },
      { type: 'h2', text: 'What it does' },
      { type: 'ul', items: [
        'Collects IPO details (dates, price band, lot size, subscription, grey-market premium) from several public sources.',
        'Reads the official offer document (DRHP / RHP) filed with SEBI and extracts a few hard facts such as profit, debt and promoter holding.',
        'Combines demand, company quality, grey-market premium and red flags into one listing-gain score with the reasons shown.',
        'Suggests how to split capital across your family accounts using the odds of getting an allotment.',
        'Tracks ASBA locks, allotments and the listing-day sell.',
      ] },
      { type: 'h2', text: 'What it does not do' },
      { type: 'ul', items: [
        'It does not give investment advice and cannot promise a listing gain. Every verdict is an estimate.',
        'It does not place live IPO applications unless you switch that on explicitly (see Money and accounts).',
        'It does not guess missing numbers. If a price band or score is not known yet it says so ("TBA" / "No score yet").',
      ] },
      { type: 'callout', tone: 'warn', title: 'Not investment advice', text: 'Scores and badges are produced by a formula and a language model reading public documents. They can be wrong. Read the reasons, check the offer document, and decide yourself.' },
    ],
  },
  {
    slug: 'how-it-works',
    group: 'Start here',
    title: 'How it works end to end',
    description: 'The path from a public IPO listing to a verdict on your screen.',
    blocks: [
      { type: 'ol', items: [
        'Source sync: Groww, IPO Watch and ipoalerts are read and merged into one record per IPO. Each source has a health record, so a broken source is visible instead of silent.',
        'Snapshots: every day the grey-market premium and subscription numbers are saved, and after listing the real listing gain is stored as the outcome.',
        'Documents: for each IPO the SEBI filing link is followed to the PDF, the text is split into chunks, and each chunk is analysed separately and saved straight away.',
        'Scoring: the Listing-Gain Engine combines the facts, demand and grey-market data and applies the red-flag rules.',
        'Display: the report page shows the signals with their reasons and a small Apply / Watch / Avoid badge.',
      ] },
      { type: 'p', text: 'Steps 1 to 4 run in a nightly job (around 02:00 IST). Visiting the site never triggers a model call, so reading reports is free and fast.' },
      { type: 'callout', tone: 'note', title: 'Append-only', text: 'Documents, chunk analyses, scores and outcomes are never deleted or overwritten. A changed document becomes a new version, and each night’s result is a new row, so history stays available.' },
    ],
  },
  {
    slug: 'listing-gain-score',
    group: 'How scoring works',
    title: 'The listing-gain score',
    description: 'What goes into the 0 to 100 score and why grey-market premium is only a minor part.',
    blocks: [
      { type: 'p', text: 'The goal is narrow: estimate how likely an IPO is to list above its issue price, for someone who sells on listing day. The score combines five inputs. Inputs that are unknown are left out and the others share the weight; nothing is replaced by an invented number.' },
      { type: 'table', head: ['Input', 'Weight', 'What it measures'], rows: [
        ['Company quality', '30%', 'Profit, growth, debt, cash flow, valuation and promoter holding read from the offer document.'],
        ['Demand', '30%', 'Total and QIB subscription multiples.'],
        ['Grey-market premium', '20%', 'The unofficial premium. Easy to manipulate, so it is capped and cross-checked.'],
        ['Issue size (float)', '10%', 'Smaller issues tend to react more.'],
        ['Market mood', '10%', 'Reserved for a market-regime input; ignored while it is not available.'],
      ] },
      { type: 'h2', text: 'Safeguards' },
      { type: 'ul', items: [
        'If the grey-market premium is far stronger than demand supports, it is pulled down to just above demand and the reason says so.',
        'With fewer than two of company quality, demand and grey-market data, the score is capped at 60, so it cannot reach an Apply verdict on one signal.',
        'A critical red flag caps the score at 35 (a veto). High flags subtract 10 points and medium flags 4 (at most 25 together).',
      ] },
      { type: 'h2', text: 'Verdict bands' },
      { type: 'table', head: ['Score', 'Verdict', 'Badge'], rows: [
        ['80 and above', 'Strong apply', 'Apply'],
        ['62 to 79', 'Moderate apply', 'Apply'],
        ['45 to 61', 'Watch', 'Watch'],
        ['Below 45', 'Avoid', 'Avoid'],
        ['No data', 'Pending', 'none'],
      ] },
      { type: 'callout', tone: 'warn', title: 'Not calibrated yet', text: 'The weights and bands are a reasoned starting point. A first look at 29 recently closed IPOs showed that IPOs subscribed above 20 times averaged about +26% on listing day and those under 5 times averaged about −2%, which supports demand as a signal, but the sample is small. The thresholds will be checked against stored outcomes as they accumulate.' },
    ],
  },
  {
    slug: 'red-flags',
    group: 'How scoring works',
    title: 'Red flags and confidence',
    description: 'The rules that can lower or veto a score, and how confidence is reported.',
    blocks: [
      { type: 'p', text: 'Red flags are fixed rules applied to facts extracted from the offer document. A fact that could not be found never raises a flag: unknown is not treated as bad.' },
      { type: 'table', head: ['Rule', 'Severity', 'Triggers when'], rows: [
        ['Regulatory action', 'Critical', 'The document discloses enforcement action against a promoter or the company and a quote from the document backs it up. Without a verifiable quote it is shown as a High flag and never vetoes.'],
        ['Auditor qualification', 'High', 'The auditor qualified or flagged the financial statements.'],
        ['Loss-making', 'High', 'Net profit is negative.'],
        ['Rich valuation', 'High', 'P/E is more than double the sector P/E.'],
        ['High leverage', 'High', 'Debt-to-equity is above 2.5.'],
        ['Negative operating cash flow', 'Medium', 'Operating cash flow is below zero.'],
        ['Mostly offer for sale', 'Medium', '80% or more of the issue is an offer for sale.'],
        ['Low promoter holding', 'Medium', 'Promoter holding after the issue is below 25%.'],
        ['Material litigation', 'Medium', 'Material litigation is disclosed.'],
      ] },
      { type: 'callout', tone: 'note', title: 'Banks and lenders', text: 'For banks, NBFCs and housing-finance companies the leverage and operating-cash-flow rules are skipped, and so are those two inputs in the company score. A lender borrows to lend, and its loan disbursements show up as negative operating cash flow, so those numbers do not mean what they mean for other businesses.' },
      { type: 'h2', text: 'Confidence' },
      { type: 'ul', items: [
        'High: company quality, demand and grey-market data are all available.',
        'Medium: two of the three are available.',
        'Low: only one is available. The verdict is tentative and the page says so.',
      ] },
      { type: 'p', text: 'The language model only extracts facts from each chunk of the document. For regulatory action and auditor qualification it must also give an exact quote; the quote is checked against the text and a claim whose quote is not found is discarded. Its answer is filtered to a fixed list of fields with sensible ranges, so text hidden inside a document cannot change a verdict.' },
    ],
  },
  {
    slug: 'allotment-odds',
    group: 'How scoring works',
    title: 'Allotment odds and the optimizer',
    description: 'Why a hot but heavily oversubscribed IPO is not always the best use of capital.',
    blocks: [
      { type: 'p', text: 'A listing gain only helps if you are allotted shares. The optimizer values each possible bid as the chance of allotment multiplied by the expected listing gain, per investor category (retail, small HNI, big HNI).' },
      { type: 'ul', items: [
        'Chance of allotment is one divided by the category’s subscription multiple (certain when under-subscribed).',
        'Expected gain comes from the grey-market premium, capped at 80%, and is zero when no quote exists.',
        'If the price band or lot size is not known yet, the IPO is skipped with a reason instead of being allocated with guessed terms.',
      ] },
      { type: 'p', text: 'Each family PAN can bid once per IPO, and each application respects the UPI limit of ₹5 lakh. The solver is a heuristic: it finds a good plan under those rules, not a guaranteed best one.' },
    ],
  },
  {
    slug: 'data-sources',
    group: 'Data and automation',
    title: 'Data sources and freshness',
    description: 'Where the numbers come from, and what happens when a source breaks.',
    blocks: [
      { type: 'table', head: ['Source', 'Provides', 'Notes'], rows: [
        ['Groww', 'Open, upcoming and closed IPOs, lot sizes, SEBI filing link, listing results', 'Read from the page’s embedded data.'],
        ['IPO Watch', 'Dates, price band, grey-market premium', 'Read from the JSON the site itself loads.'],
        ['ipoalerts', 'Open IPOs and NSE subscription', 'Free plan: open IPOs only, one per request, 25 requests a day. The app uses at most 20.'],
        ['SEBI, NSE, BSE', 'Offer documents (DRHP / RHP)', 'Regulator and exchange hosts, over https.'],
        ['Issuer websites', 'The company’s own RHP PDF, found through Groww’s IPO page', 'Used only when there is no SEBI link. https only; the host must resolve to public addresses and the size is capped.'],
      ] },
      { type: 'h2', text: 'When a source fails' },
      { type: 'ul', items: [
        'Each source has a health record: last success, last error, consecutive failures and requests used today.',
        'A failure in one source or one record never stops the others.',
        'Implausible values (for example a grey-market premium above 300%) are dropped and noted.',
        'Unknown values stay unknown and appear as "TBA".',
      ] },
      { type: 'callout', tone: 'note', title: 'Sources can change', text: 'Groww and IPO Watch are not official APIs. If their layout changes, parsing can stop working until the code is updated. The health record shows when that happens.' },
    ],
  },
  {
    slug: 'nightly-run',
    group: 'Data and automation',
    title: 'The nightly run and Run audit',
    description: 'When analysis happens, and what the Run audit button does.',
    blocks: [
      { type: 'p', text: 'A scheduled GitHub Actions job runs at about 02:00 IST. It refreshes the sources and then analyses offer documents with the free Groq tier. Open IPOs come first, then upcoming ones. Within a long document the most relevant parts (financial statements, promoter holding, litigation) are read first, and reading stops once the core numbers are known.' },
      { type: 'ul', items: [
        'A limited number of document chunks is analysed each night. Every finished chunk is saved immediately.',
        'A token budget (150,000 by default) also limits the night’s model use. When it is used up the run stops cleanly and resumes the next night.',
        'If a data source fails, the job finishes with an error so that GitHub marks the run as failed and notifies the repository owner.',
        'If the model provider asks us to slow down, the run stops cleanly and continues the next night from where it stopped.',
        'A document that is already fully analysed is not downloaded again, but its score is refreshed with that night’s market data.',
      ] },
      { type: 'h2', text: 'The Run audit button' },
      { type: 'p', text: 'Anyone can open a report and read the stored analysis. The Run audit button never calls a model. It does one of three things:' },
      { type: 'ol', items: [
        'If an analysis newer than 24 hours exists, it is shown and no request is used.',
        'Otherwise the IPO is queued for the next nightly run and jumps ahead of the normal order.',
        'If the IPO is already queued, nothing new is queued.',
      ] },
      { type: 'p', text: 'Queued requests share a daily limit of 50 across all visitors. The limit is enforced in the database with a single conditional update, so simultaneous clicks cannot exceed it. When it is used up the button explains that and asks you to return tomorrow.' },
    ],
  },
  {
    slug: 'accounts-and-orders',
    group: 'Money and accounts',
    title: 'Accounts, ASBA and orders',
    description: 'How family accounts, locks, applications and listing-day sells are handled.',
    blocks: [
      { type: 'ul', items: [
        'Family accounts store broker details encrypted. The PAN is validated and masked values are rejected.',
        'An application locks money (ASBA) until allotment or refund. Kapitl tracks these locks so you can see how much is free.',
        'Order states are guarded: for example, an order that is already filled cannot be cancelled by Kapitl.',
        'After listing, the sell step works only on shares that were really allotted, and says clearly when it could not complete a step.',
      ] },
      { type: 'callout', tone: 'warn', title: 'Live applications are off by default', text: 'Submitting real IPO applications through the broker is disabled until ENABLE_LIVE_IPO_APPLY is set to true. Do this only after you have verified the broker endpoint yourself. Without it, the app refuses and tells you why instead of pretending to apply.' },
      { type: 'p', text: 'If the broker’s balance check fails, Kapitl keeps the last known balance and marks it unknown rather than showing zero.' },
    ],
  },
  {
    slug: 'security',
    group: 'Money and accounts',
    title: 'Security and privacy',
    description: 'Who can see what, and how secrets are handled.',
    blocks: [
      { type: 'ul', items: [
        'Sign-in uses Google with an allow-listed email, followed by a one-time code (TOTP). Failed code attempts are rate limited.',
        'Guests can read public data and sample information. Account, order, fund and broker data need the admin session.',
        'Scheduled-job endpoints need a secret that only the scheduler knows.',
        'Broker credentials are encrypted with a key held in the environment. If that key is lost or changed, stored credentials cannot be decrypted.',
        'Server errors return a generic message. Details stay in the server log.',
      ] },
      { type: 'callout', tone: 'note', title: 'Keep secrets out of the code', text: 'API keys, database URLs and encryption keys belong in environment variables or repository secrets, never in the repository. If a key has ever been committed, treat it as exposed and replace it.' },
    ],
  },
  {
    slug: 'api',
    group: 'Run it yourself',
    title: 'API reference',
    description: 'The public endpoints. Everything else needs a signed-in session.',
    blocks: [
      { type: 'p', text: 'All paths are under /api. Responses are JSON.' },
      { type: 'table', head: ['Method and path', 'Access', 'Purpose'], rows: [
        ['GET /health', 'Public', 'Service and database status.'],
        ['GET /ipos', 'Public', 'IPO list with stored scores. Never triggers scraping.'],
        ['GET /ipos/{id}', 'Public', 'One IPO.'],
        ['GET /reports/{id}', 'Public', 'Stored report for an IPO.'],
        ['GET /analysis/{id}', 'Public', 'Latest listing-gain analysis: score, badge, signals with reasons, red flags.'],
        ['POST /analysis/{id}/request', 'Public', 'Run audit: returns the stored analysis or queues the IPO. Shares the daily limit.'],
        ['GET /sources/health', 'Admin', 'Health of every data source.'],
      ] },
      { type: 'h3', text: 'Example: read an analysis' },
      { type: 'code', lang: 'bash', text: 'curl https://<your-deployment>/api/analysis/<ipo-id>' },
      { type: 'p', text: 'The response has a state of "ready" or "not_analysed", a badge of APPLY, WATCH or AVOID (or null), a score, a confidence level and a list of signals, each with a direction and a plain-language reason.' },
      { type: 'h3', text: 'Daily limit response' },
      { type: 'p', text: 'POST /analysis/{id}/request answers 429 with a short message when the global daily limit has been used.' },
    ],
  },
  {
    slug: 'run-locally',
    group: 'Run it yourself',
    title: 'Run it locally',
    description: 'Start the API and the web app on your machine.',
    blocks: [
      { type: 'p', text: 'You need Python 3.11 or newer and Node.js 22 or newer.' },
      { type: 'code', lang: 'bash', text: 'cd apps/api\npython -m venv venv\nvenv\\Scripts\\activate        # Windows; use: source venv/bin/activate\npip install -r requirements.txt\nalembic upgrade head\nuvicorn app.main:app --reload --port 8000' },
      { type: 'code', lang: 'bash', text: 'cd apps/web\nnpm install\nnpm run dev' },
      { type: 'p', text: 'Without a DATABASE_URL the API uses a local SQLite file, which is fine for development. Tests never contact live services: the AI provider, broker and sources are mocked.' },
      { type: 'code', lang: 'bash', text: 'cd apps/api && python -m pytest tests\ncd apps/web && npm test' },
    ],
  },
  {
    slug: 'deploy',
    group: 'Run it yourself',
    title: 'Deploy and schedule',
    description: 'Vercel for the app, Supabase for the database, GitHub Actions for the schedules.',
    blocks: [
      { type: 'h2', text: 'Vercel environment variables' },
      { type: 'ul', items: [
        'DATABASE_URL: the Supabase pooler URL. Vercel needs the transaction pooler (port 6543).',
        'SECRET_KEY, FERNET_KEY, ADMIN_TOTP_SECRET and CRON_SECRET.',
        'GOOGLE_CLIENT_ID and ALLOWED_EMAIL for sign-in.',
        'IPOALERTS_API_KEY and GROQ_API_KEY.',
      ] },
      { type: 'h2', text: 'GitHub repository secrets' },
      { type: 'ul', items: [
        'DATABASE_URL: the Supabase session pooler (port 5432) is the best fit for the long nightly job. The transaction pooler also works.',
        'GROQ_API_KEY and IPOALERTS_API_KEY for the nightly analysis.',
        'API_BASE_URL and CRON_SECRET for the market-hours webhooks.',
      ] },
      { type: 'h2', text: 'Database migrations' },
      { type: 'p', text: 'Schema changes are Alembic migrations. A dry-run script applies everything in one transaction, compares the result with the models and rolls back, so you can check a migration before running it for real.' },
      { type: 'code', lang: 'bash', text: 'cd apps/api\npython scripts/db_dry_run.py      # rehearse, changes nothing\nalembic upgrade head              # apply' },
      { type: 'callout', tone: 'note', title: 'Order matters', text: 'Apply migrations before deploying code that uses new tables, otherwise the new endpoints fail until the tables exist.' },
    ],
  },
  {
    slug: 'limits',
    group: 'Run it yourself',
    title: 'Known limits',
    description: 'What to keep in mind before relying on it.',
    blocks: [
      { type: 'ul', items: [
        'The scoring weights are not yet calibrated against enough real outcomes. Treat badges as a prompt to read the reasons, not as a signal to act.',
        'Public sources are unofficial. They can change layout or block requests, which pauses fresh data until fixed.',
        'The language model can misread a long document. Only a small set of numeric and yes/no facts is accepted, and each is range-checked, but errors are still possible.',
        'The free model tier has daily limits, so a busy night may analyse only some IPOs. Open IPOs are always first.',
        'GitHub schedules can start several minutes late, which matters for time-sensitive steps such as the listing-day sell.',
      ] },
      { type: 'p', text: 'If something looks wrong, check the admin endpoint GET /api/sources/health first: it shows which source last worked and the last error it hit.' },
    ],
  },
]

export function findPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug)
}

export function pagesByGroup(): { group: string; pages: DocPage[] }[] {
  return DOC_GROUPS.map((group) => ({ group, pages: DOC_PAGES.filter((p) => p.group === group) })).filter((g) => g.pages.length > 0)
}

export function prevNext(slug: string): { prev: DocPage | null; next: DocPage | null } {
  const i = DOC_PAGES.findIndex((p) => p.slug === slug)
  if (i < 0) return { prev: null, next: null }
  return { prev: DOC_PAGES[i - 1] ?? null, next: DOC_PAGES[i + 1] ?? null }
}

export function headingsOf(page: DocPage): { id: string; text: string; level: 2 | 3 }[] {
  return page.blocks
    .filter((b): b is Extract<Block, { type: 'h2' | 'h3' }> => b.type === 'h2' || b.type === 'h3')
    .map((b) => ({ id: slugifyHeading(b.text), text: b.text, level: b.type === 'h2' ? 2 : 3 }))
}

function plainText(b: Block): string {
  switch (b.type) {
    case 'p':
    case 'h2':
    case 'h3':
      return b.text
    case 'ul':
    case 'ol':
      return b.items.join(' ')
    case 'callout':
      return `${b.title} ${b.text}`
    case 'table':
      return [...b.head, ...b.rows.flat()].join(' ')
    case 'code':
      return b.text
  }
}

/** Simple full-text search: every word must appear in the page title, description or body. */
export function searchDocs(query: string): DocPage[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return DOC_PAGES.filter((p) => {
    const hay = `${p.title} ${p.description} ${p.blocks.map(plainText).join(' ')}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
