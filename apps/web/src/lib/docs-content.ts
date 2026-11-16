// Documentation content for /docs. Plain data + pure helpers (no React) so it can be unit tested.
// Every statement here must match what the code does today; see api tests/test_docs_honesty.py and
// tests/test_docs_examples.py (which re-computes the worked score examples). Text may use `backticks` for code.

export const DIAGRAM_NAMES = [
  'pipeline', 'workflow', 'score-weights', 'verdict-scale', 'score-walkthrough', 'company-score', 'doc-reading',
  'fallback-ladder', 'run-audit-flow', 'daily-schedule', 'order-lifecycle', 'category-bands', 'allotment-ev', 'sign-in',
  'confidence',
] as const
export type DiagramName = (typeof DIAGRAM_NAMES)[number]

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'callout'; tone: 'note' | 'warn' | 'tip'; title: string; text: string }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'code'; lang: string; text: string; title?: string }
  | { type: 'diagram'; name: DiagramName; caption: string }
  | { type: 'steps'; items: { title: string; text: string }[] }
  | { type: 'cards'; items: { title: string; text: string; href?: string }[] }
  | { type: 'defs'; items: { term: string; text: string }[] }
  | { type: 'faq'; items: { q: string; a: string }[] }

export interface DocPage {
  slug: string
  group: string
  title: string
  description: string
  blocks: Block[]
}

export const DOC_GROUPS = ['Start here', 'Using Kapitl', 'How scoring works', 'Data and automation', 'Money and accounts', 'Run it yourself'] as const

export function slugifyHeading(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export const DOC_PAGES: DocPage[] = [
  // ───────────────────────────── Start here ─────────────────────────────
  {
    slug: 'overview',
    group: 'Start here',
    title: 'What Kapitl is',
    description: 'A planning tool for Indian retail IPO investors who apply from several family demat accounts.',
    blocks: [
      { type: 'p', text: 'Kapitl helps you decide which IPOs are worth applying to for a listing-day gain, how much to put in from each family account, and keeps track of the money that is locked while an application is pending (ASBA).' },
      { type: 'p', text: 'It is built for one specific strategy: apply in the IPO, and if you are allotted shares, sell them on the day they list. Everything in the score is aimed at one question: how likely is this IPO to list above its issue price?' },
      { type: 'diagram', name: 'workflow', caption: 'Each IPO moves through five screens. The first three help you decide; the last two track the money.' },
      { type: 'h2', text: 'What it does' },
      { type: 'cards', items: [
        { title: 'Collects IPO data', text: 'Dates, price band, lot size, subscription and grey-market premium from several public sources, merged into one record per IPO.', href: '/docs/data-sources' },
        { title: 'Reads the offer document', text: 'Follows the SEBI filing (DRHP / RHP) and extracts a few hard facts such as profit, debt and promoter holding.', href: '/docs/reading-documents' },
        { title: 'Scores the listing gain', text: 'Combines demand, company quality, grey-market premium and red flags into one 0–100 score, with the reasons shown.', href: '/docs/listing-gain-score' },
        { title: 'Plans the family split', text: 'Suggests how to spread capital across your family accounts using the odds of getting an allotment.', href: '/docs/allotment-odds' },
        { title: 'Tracks the money', text: 'ASBA locks, applications, allotments, refunds and the listing-day sell, per account.', href: '/docs/accounts-and-orders' },
        { title: 'Shows its work', text: 'Every verdict lists its signals, the red flags it found and where the company facts came from.', href: '/docs/ipo-report' },
      ] },
      { type: 'h2', text: 'What it does not do' },
      { type: 'ul', items: [
        'It does not give investment advice and cannot promise a listing gain. Every verdict is an estimate.',
        'It does not place live IPO applications unless you switch that on explicitly (see Money and accounts).',
        'It does not guess missing numbers. If a price band or score is not known yet it says so ("TBA" / "No score yet").',
        'It does not call a language model when you open a page. All analysis runs in a nightly job and is stored.',
      ] },
      { type: 'callout', tone: 'warn', title: 'Not investment advice', text: 'Scores and badges are produced by a formula and a language model reading public documents. They can be wrong. Read the reasons, check the offer document, and decide yourself.' },
      { type: 'h2', text: 'Where to go next' },
      { type: 'cards', items: [
        { title: 'Quickstart', text: 'Your first session, from sign-in to a staged application.', href: '/docs/quickstart' },
        { title: 'The listing-gain score', text: 'What goes into the number and how to read it.', href: '/docs/listing-gain-score' },
        { title: 'Glossary', text: 'GMP, ASBA, QIB, RHP and the other terms used here.', href: '/docs/glossary' },
      ] },
    ],
  },
  {
    slug: 'quickstart',
    group: 'Start here',
    title: 'Quickstart',
    description: 'Your first session: sign in, add the family accounts, read a report and stage an application.',
    blocks: [
      { type: 'p', text: 'This walk-through takes about ten minutes. You can read the IPO Board and every report without signing in; the steps that involve accounts and money need the admin session.' },
      { type: 'steps', items: [
        { title: 'Sign in', text: 'Open the app and sign in with Google using the allow-listed email, then enter the six-digit code from your authenticator app. Without signing in you are a guest and see public data only.' },
        { title: 'Add your family accounts', text: 'Go to Fund Manager and choose Add Account for each family member: full name, relation, Angel One client ID, starting available balance and default category. Broker credentials are encrypted before they are stored.' },
        { title: 'Set your UPI handle', text: 'In Settings, enter the UPI ID that will receive ASBA mandate requests (for example name@bank).' },
        { title: 'Find an IPO', text: 'Open the IPO Board. Use the Open tab and the Min AI Score filter to see what is biddable now and how it scores.' },
        { title: 'Read the report', text: 'Click an IPO. Read the signals and the red flags, not just the badge. Check which step of the data ladder the company facts come from.' },
        { title: 'Plan the split', text: 'Back on the Dashboard or in Fund Manager, run the optimizer. It proposes lots per account and explains each line in the Solver Rationale column.' },
        { title: 'Stage the application', text: 'Use Apply on the report or the batch apply in Fund Manager. Kapitl checks the category limits, the ₹5 lakh UPI limit and one bid per PAN, then locks the amount as ASBA.' },
        { title: 'Approve and follow up', text: 'Approve the UPI mandate in your bank app. After the allotment date, record the result in Orders; allotted shares appear in Allotments for the listing-day sell.' },
      ] },
      { type: 'callout', tone: 'tip', title: 'Try it without real money', text: 'Live broker applications stay off until ENABLE_LIVE_IPO_APPLY is set. Until then you can plan and track applications that you place yourself in your broker app, and use "mark as applied" to keep Kapitl in step.' },
    ],
  },
  {
    slug: 'how-it-works',
    group: 'Start here',
    title: 'How it works end to end',
    description: 'The path from a public IPO listing to a verdict on your screen.',
    blocks: [
      { type: 'diagram', name: 'pipeline', caption: 'Steps 1 to 4 run in the nightly job. Step 5 only reads what is stored, so opening a report is free and fast.' },
      { type: 'ol', items: [
        'Source sync: Groww, IPO Watch and ipoalerts are read and merged into one record per IPO. Each source has a health record, so a broken source is visible instead of silent.',
        'Snapshots: every day the grey-market premium and subscription numbers are saved, and after listing the real listing gain is stored as the outcome.',
        'Documents: for each IPO the SEBI filing link is followed to the PDF, the text is split into chunks, and each chunk is analysed separately and saved straight away.',
        'Scoring: the Listing-Gain Engine combines the facts, demand and grey-market data and applies the red-flag rules.',
        'Display: the report page shows the signals with their reasons and a small Apply / Watch / Avoid badge.',
      ] },
      { type: 'p', text: 'Steps 1 to 4 run in a nightly job (around 02:00 IST). Visiting the site never triggers a model call, so reading reports is free and fast.' },
      { type: 'h2', text: 'Why it is built this way' },
      { type: 'ul', items: [
        'Cost: the free model tier has daily limits. Doing all model work in one scheduled job keeps usage predictable, and a guest clicking around cannot use it up.',
        'Speed: a report is a database read, not a model call, so it loads in the time it takes to fetch a row.',
        'Honesty: because every result is stored with its date, you can see how a verdict changed as subscription and grey-market numbers moved.',
      ] },
      { type: 'callout', tone: 'note', title: 'Append-only', text: 'Documents, chunk analyses, scores and outcomes are never deleted or overwritten. A changed document becomes a new version, and each night’s result is a new row, so history stays available.' },
    ],
  },
  {
    slug: 'glossary',
    group: 'Start here',
    title: 'Glossary',
    description: 'The Indian IPO terms and the Kapitl terms used throughout these pages.',
    blocks: [
      { type: 'h2', text: 'IPO terms' },
      { type: 'defs', items: [
        { term: 'ASBA', text: 'Application Supported by Blocked Amount. The bid amount stays in your bank account but is blocked until allotment; it is then debited (allotted) or released (not allotted).' },
        { term: 'DRHP / RHP', text: 'Draft Red Herring Prospectus and Red Herring Prospectus: the offer document filed with SEBI. It holds the financial statements, promoter holding, litigation and risk factors.' },
        { term: 'GMP (grey-market premium)', text: 'The unofficial premium at which IPO shares are traded before listing, shown as a percentage of the issue price. Unregulated and easy to move, so Kapitl gives it limited weight.' },
        { term: 'Subscription (×)', text: 'How many times the shares on offer were bid for. 40× means bids for forty times the shares available. Reported overall and per category.' },
        { term: 'QIB', text: 'Qualified Institutional Buyers: mutual funds, insurers, banks and similar. Their subscription is used as a signal of informed demand.' },
        { term: 'Retail, sHNI, bHNI', text: 'Investor categories by application amount: retail up to ₹2 lakh, small HNI from ₹2 lakh to ₹10 lakh, big HNI above ₹10 lakh.' },
        { term: 'Lot', text: 'The minimum number of shares you can bid for, and the step size above it.' },
        { term: 'Price band', text: 'The range within which you can bid. Kapitl bids at the top of the band unless you set a price.' },
        { term: 'Offer for sale (OFS)', text: 'Shares sold by existing holders. Money from an OFS goes to the sellers, not to the company.' },
        { term: 'Listing gain', text: 'The difference between the listing-day price and the issue price, as a percentage.' },
        { term: 'UPI mandate', text: 'The request your bank app shows to approve blocking the bid amount. Possible up to ₹5 lakh per application.' },
      ] },
      { type: 'h2', text: 'Kapitl terms' },
      { type: 'defs', items: [
        { term: 'Listing-gain score', text: 'A 0–100 estimate of how likely an IPO is to list above its issue price. The same number appears everywhere in the app.' },
        { term: 'Badge', text: 'Apply, Watch or Avoid, derived from the score bands. No badge when there is no score.' },
        { term: 'Signal', text: 'One input to the score with its direction (positive, negative or neutral) and a plain-language reason.' },
        { term: 'Red flag', text: 'A fixed rule over facts from the offer document. Critical flags veto, high and medium flags subtract points.' },
        { term: 'Confidence', text: 'High, Medium or Low, depending on how many of company quality, demand and grey-market data are known.' },
        { term: 'Facts basis', text: 'Where the company facts came from: the offer document, the Groww company summary or a verified web search.' },
        { term: 'Run audit', text: 'The button on a report that shows a fresh stored analysis or queues the IPO for the next nightly run.' },
        { term: 'Corpus', text: 'The total balance across all family accounts.' },
      ] },
    ],
  },

  // ───────────────────────────── Using Kapitl ─────────────────────────────
  {
    slug: 'app-tour',
    group: 'Using Kapitl',
    title: 'A tour of the app',
    description: 'The screens in the sidebar, what each one is for and when you use it.',
    blocks: [
      { type: 'p', text: 'The sidebar has eight entries. Most days you only need the Dashboard and the IPO Board; the rest come into play around an application.' },
      { type: 'table', head: ['Screen', 'Use it to', 'Needs sign-in'], rows: [
        ['Dashboard', 'See the family corpus, money in ASBA, realized P&L and the IPO pipeline; run the optimizer.', 'For account figures'],
        ['IPO Board', 'Browse open, upcoming and closed IPOs with their score, and filter them.', 'No'],
        ['IPO report', 'Read one IPO in depth: signals, red flags, facts, schedule and the offer document link.', 'No'],
        ['Fund Manager', 'Add family accounts, view the optimizer plan, batch-apply and follow ASBA locks.', 'Yes'],
        ['Orders', 'Track every application, filter, export to CSV and record allotment results.', 'Yes'],
        ['Allotments', 'See allotted shares and stage the listing-day sell.', 'Yes'],
        ['AI Reports', 'Browse every IPO’s research dossier in a list-and-detail view.', 'No'],
        ['Settings', 'UPI handle and bidding guardrails, broker session, notifications.', 'Yes'],
      ] },
      { type: 'h2', text: 'Dashboard' },
      { type: 'p', text: 'The Dashboard opens with a needs-attention strip, then four figures: Total family corpus, Available to deploy, In ASBA and Realized P&L. The hit rate counts only applications whose allotment result is known; bids still awaiting allotment are shown separately. Below them, a bar shows how the corpus is split between free money and money locked in applications, and a 90-day P&L line shows the trend.' },
      { type: 'p', text: 'The IPO pipeline table lists current issues with dates, price band, minimum investment, grey-market premium and the score bar coloured by verdict band. Run optimizer at the top builds an allocation plan from what is open now.' },
      { type: 'callout', tone: 'note', title: 'Unknown is not zero', text: 'If a broker balance check fails, the last known balance is kept and marked unknown rather than shown as ₹0. A missing price band shows as TBA.' },
    ],
  },
  {
    slug: 'ipo-board',
    group: 'Using Kapitl',
    title: 'IPO Board',
    description: 'Find IPOs by status, type, investment size and score.',
    blocks: [
      { type: 'p', text: 'The IPO Board lists every IPO Kapitl knows about, one row each, with its bidding window, price band, minimum investment and score.' },
      { type: 'h2', text: 'Tabs and filters' },
      { type: 'table', head: ['Control', 'What it does'], rows: [
        ['All / Open / Upcoming / Closed', 'Limits the list by status. Open means you can bid today.'],
        ['Issue Type', 'Mainboard (EQ), SME or REIT / InvIT.'],
        ['Max Investment', 'Hides IPOs whose minimum investment is above the amount you set (₹2 lakh to start).'],
        ['Min AI Score', 'Hides IPOs that score below the value you set. IPOs with no score yet stay visible.'],
        ['Search', 'Finds an IPO by name.'],
        ['Reset all filters', 'Back to the full list.'],
      ] },
      { type: 'h2', text: 'Reading a row' },
      { type: 'ul', items: [
        'The score number and its bar use the same bands as the report: red below 45, neutral 45 to 61, amber 62 to 79, green 80 and above.',
        '"No score yet" means there is no grey-market premium or subscription data and no analysed document. It is not a low score.',
        'A score built from market data only is marked as such on the report page; it can move a lot once the document is analysed.',
      ] },
      { type: 'callout', tone: 'tip', title: 'Upcoming IPOs rotate', text: 'The nightly job works on IPOs someone queued with Run audit first, then open IPOs, then upcoming ones in an order that changes every day. Upcoming IPOs with no document yet therefore cannot take every night’s look-ups.' },
    ],
  },
  {
    slug: 'ipo-report',
    group: 'Using Kapitl',
    title: 'The IPO report page',
    description: 'How to read one IPO: the verdict panel, signals, red flags, facts and filings.',
    blocks: [
      { type: 'p', text: 'Open any IPO from the board or the dashboard to see its report. The page is laid out so the reasons sit next to the verdict: the badge is small on purpose.' },
      { type: 'h2', text: 'Sections of the page' },
      { type: 'steps', items: [
        { title: 'Header', text: 'Name, status, the score and a thin bar coloured by verdict band.' },
        { title: 'Listing-gain score', text: 'The score, verdict, confidence and badge (Apply, Watch or Avoid), with a label saying what it rests on: offer document, company summary, web search or market data only. Then every signal with its direction and reason.' },
        { title: 'Score breakdown', text: 'How many points each input adds: its 0–100 value times its share of the weight, shown as one coloured bar out of 100 with a line per input. “Show the calculation, step by step” lists the weighted average, any red-flag penalty, any cap, and the final rounded score. Inputs that are not known are simply not listed.' },
        { title: 'Red flags and company facts', text: 'Each red flag with its severity, and the facts found in the document (profit, growth, debt, promoter holding and so on). If no document has been read, the page says red flags are unknown rather than “none”. The Run audit button sits at the bottom of this panel.' },
        { title: 'Business overview, strengths and risks', text: 'Context taken from the stored report.' },
        { title: 'Specs and schedule', text: 'Price band, lot size, minimum retail investment, open, close and listing dates.' },
        { title: 'Official filings', text: 'A link to download the DRHP / RHP so you can check any fact yourself.' },
      ] },
      { type: 'h2', text: 'States you may see' },
      { type: 'table', head: ['Situation', 'What it means'], rows: [
        ['Offer document analysed', 'Company facts come from the DRHP / RHP. Most complete.'],
        ['Company summary only', 'No readable offer document; revenue and profit come from Groww’s summary. Company score capped at 70.'],
        ['Web search only', 'A few facts found on the web and checked against the cited pages. Company score capped at 60; sources listed.'],
        ['Market data only', 'Scored from grey-market premium and subscription; the company has not been analysed yet.'],
        ['No score yet', 'Nothing to score from yet. Not a negative verdict.'],
        ['Queued for tonight', 'Someone pressed Run audit; the IPO moves ahead in the next nightly run.'],
      ] },
      { type: 'callout', tone: 'warn', title: 'Read the reasons, not only the badge', text: 'Two IPOs with the same score can get there very differently: one on strong demand, another on a high grey-market quote. The signals tell you which.' },
    ],
  },
  {
    slug: 'fund-manager',
    group: 'Using Kapitl',
    title: 'Fund Manager and the optimizer',
    description: 'Family accounts, the allocation plan, batch apply and the ASBA lock timeline.',
    blocks: [
      { type: 'p', text: 'Fund Manager is where the family’s money is organised. It has four parts, top to bottom.' },
      { type: 'steps', items: [
        { title: 'Figures and utilisation', text: 'Total balance, available money, money in ASBA and a thin bar showing how much of the corpus is locked.' },
        { title: 'Allocation plan', text: 'The optimizer’s suggestion: target IPO, account, category, lots to bid, capital required, expected return and a Solver Rationale for each line. The header says how many bids across how many accounts, and whether the solver proved the plan best or a heuristic fallback was used. From here you can stage the orders and view the UPI mandate steps.' },
        { title: 'Accounts table', text: 'One row per family member with client ID, category, total balance, available, in ASBA, hit rate and realized P&L.' },
        { title: 'ASBA lock timeline', text: 'Every blocked amount with its IPO, blocked date, release date and status.' },
      ] },
      { type: 'h2', text: 'Adding an account' },
      { type: 'p', text: 'Add Account asks for the member’s full name, relation (Self, Spouse, Father, Mother, Brother, Sister or Other), Angel One client ID, starting available balance and default category preference. Where a PAN is stored it is validated and masked values are rejected; it is what enforces one application per PAN across the family. Broker credentials are encrypted with the server’s key.' },
      { type: 'h2', text: 'How the plan is made' },
      { type: 'p', text: 'The optimizer ranks every possible bid by expected value per rupee and fills accounts within their available money and the application rules. See Allotment odds and the optimizer for the formula.' },
      { type: 'callout', tone: 'note', title: 'Skipped IPOs say why', text: 'If an IPO has no price band or lot size yet, it is left out of the plan with a reason instead of being allocated on guessed terms.' },
    ],
  },
  {
    slug: 'orders-and-allotments',
    group: 'Using Kapitl',
    title: 'Orders and allotments',
    description: 'Track applications, record allotment results and stage the listing-day sell.',
    blocks: [
      { type: 'h2', text: 'Orders' },
      { type: 'p', text: 'Orders lists every application with its account, IPO, category, lots, amount, status, broker order ID and date. Search by IPO, account or ID, filter by status, account and IPO, and use Export CSV for your records.' },
      { type: 'ul', items: [
        'Mark Applied: for an application you completed yourself in the broker or UPI app, so Kapitl shows it as applied.',
        'Cancel: only for a live application. It releases the lock in Kapitl; if the application already reached the exchange, cancel it in your broker or UPI app too.',
        'Mark Allotted or Mark Not Allotted once results are out. The API also accepts the actual quantity for a partial allotment.',
      ] },
      { type: 'diagram', name: 'order-lifecycle', caption: 'Live applications hold money in ASBA. The result either debits it, partly refunds it or releases it.' },
      { type: 'h2', text: 'Allotments' },
      { type: 'p', text: 'Allotments shows the shares you received: target IPO, demat account, allotted shares, invested amount, listing date and status. From a row you can stage a pre-listing limit sell: choose the shares to sell and the limit price, and see the estimated P&L before you confirm.' },
      { type: 'p', text: 'Allotted shares are also picked up automatically: a check runs every 30 minutes on weekdays between 06:00 and 20:00 IST, so the 09:00 listing-day job sees the right holdings.' },
      { type: 'callout', tone: 'warn', title: 'The sell step only uses real holdings', text: 'The listing-day sell works only on shares that were really allotted. Realized P&L is booked after the 10:05 IST check confirms the order was filled, not when it is placed.' },
    ],
  },
  {
    slug: 'ai-reports-and-settings',
    group: 'Using Kapitl',
    title: 'AI Reports and Settings',
    description: 'The research dossier view, and the settings that shape applications and alerts.',
    blocks: [
      { type: 'h2', text: 'AI Reports' },
      { type: 'p', text: 'AI Reports is a list-and-detail view of every IPO. Pick a company on the left; the right side shows the same listing-gain panel as the IPO report page: score, reasons, what the score is built from, red flags, the company facts found and the Run audit button.' },
      { type: 'ul', items: [
        'The score in the list on the left is the same number as in the panel: both come from the one scoring engine.',
        'If there is no offer-document link yet, a banner says so and lists what is missing (price band, issue size, dates).',
        'Financial history (revenue, profit, operating cash flow by year) appears only for IPOs where an earlier audit really extracted it.',
      ] },
      { type: 'h2', text: 'Settings' },
      { type: 'table', head: ['Section', 'What it holds'], rows: [
        ['ASBA UPI and bidding guardrails', 'The UPI ID used for mandate requests and limits that applications must respect.'],
        ['Broker session', 'The Angel One SmartAPI session used for balances, allotment checks and listing-day sells.'],
        ['AI engine', 'A provider and model preference shown in the app. The nightly analysis uses the keys and model set in the server environment.'],
        ['Notification channels', 'Where alerts go, with a Test Notification button.'],
      ] },
    ],
  },

  // ───────────────────────────── How scoring works ─────────────────────────────
  {
    slug: 'listing-gain-score',
    group: 'How scoring works',
    title: 'The listing-gain score',
    description: 'What goes into the 0 to 100 score and why grey-market premium is only a minor part.',
    blocks: [
      { type: 'callout', tone: 'note', title: 'One score everywhere', text: 'The IPO list, the report page, the badges and the optimizer all show this same score. Before the offer document has been analysed it is built from market data only (grey-market premium and subscription), which the page says; once the document is analysed, company quality and red flags are added and the score is recomputed with the latest market numbers.' },
      { type: 'p', text: 'The goal is narrow: estimate how likely an IPO is to list above its issue price, for someone who sells on listing day. The score combines five inputs. Inputs that are unknown are left out and the others share the weight; nothing is replaced by an invented number.' },
      { type: 'h2', text: 'The five inputs' },
      { type: 'table', head: ['Input', 'Weight', 'What it measures'], rows: [
        ['Company quality', '30%', 'Profit, growth, debt, cash flow, valuation and promoter holding read from the offer document.'],
        ['Demand', '30%', 'Total and QIB subscription multiples.'],
        ['Grey-market premium', '20%', 'The unofficial premium. Easy to manipulate, so it is capped and cross-checked.'],
        ['Issue size (float)', '10%', 'Smaller issues tend to react more.'],
        ['Market mood', '10%', 'Reserved for a market-regime input; ignored while it is not available.'],
      ] },
      { type: 'diagram', name: 'score-weights', caption: 'The weights are fixed; what changes is which inputs are known. Unknown inputs drop out and the rest are scaled up to 100%.' },
      { type: 'h2', text: 'How each input becomes 0–100' },
      { type: 'table', head: ['Input', 'Mapping'], rows: [
        ['Demand', 'Subscription of 20× or more scores 80 and up; 5× to 20× scores 60 to 80; 1× to 5× scores 40 to 60; under 1× scores 30. With both total and QIB numbers, the two scores are averaged.'],
        ['Grey-market premium', '50% or more scores 80 and up; 20% to 50% scores 60 to 80; 5% to 20% scores 40 to 60; 0% to 5% scores 25 to 40; a negative premium scores lower still. A quote of exactly 0 is treated as no quote.'],
        ['Issue size', 'Under ₹250 cr: 70. ₹250 to 1,000 cr: 60. ₹1,000 to 5,000 cr: 50. Larger: 35.'],
        ['Company quality', 'A 0–100 score from the offer-document facts. See Company quality score.'],
      ] },
      { type: 'h2', text: 'Safeguards' },
      { type: 'ul', items: [
        'If the grey-market premium is far stronger than demand supports, it is pulled down to just above demand and the reason says so.',
        'With fewer than two of company quality, demand and grey-market data, the score stays between 45 and 60 (Watch): one signal alone can neither recommend an IPO nor reject it. Only a quote-backed critical red flag can still veto.',
        'A critical red flag caps the score at 35 (a veto). High flags subtract 10 points and medium flags 4 (at most 25 together).',
      ] },
      { type: 'h2', text: 'Verdict bands' },
      { type: 'diagram', name: 'verdict-scale', caption: 'The bands are shared by the backend and the frontend, so a score always maps to the same badge.' },
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
    slug: 'score-walkthrough',
    group: 'How scoring works',
    title: 'A score, step by step',
    description: 'Two worked examples that follow the engine from raw inputs to a verdict.',
    blocks: [
      { type: 'p', text: 'The engine always runs the same five steps. Following one IPO through them is the quickest way to see why a score is what it is. The numbers below are produced by the real engine and checked by a test, so they stay in step with the code.' },
      { type: 'diagram', name: 'score-walkthrough', caption: 'Example 1 ends at 72 (Moderate apply). The dashed box shows Example 2, where an unbacked grey-market quote is cut back.' },
      { type: 'h2', text: 'Example 1: a well-supported IPO' },
      { type: 'ol', items: [
        'Inputs to 0–100: 40× total subscription maps to 90 and 80× QIB to 100, so demand is their average, 95. A 30% grey-market premium maps to 66. A ₹600 cr issue scores 60. Company quality is 68. Market mood is unknown.',
        'Grey-market check: 66 is not more than 30 points above demand (95), so it is kept.',
        'Weighted average: the known weights add up to 0.90, so (68×0.30 + 95×0.30 + 66×0.20 + 60×0.10) ÷ 0.90 = 75.7.',
        'Red flags: one medium flag (80% or more of the issue is an offer for sale) subtracts 4, giving 71.7.',
        'Caps: no critical flag, and all three core signals are known, so nothing caps it. Rounded: 72, Moderate apply, Apply badge, confidence High.',
      ] },
      { type: 'h2', text: 'Example 2: grey market without demand' },
      { type: 'p', text: 'A 60% grey-market premium maps to 84, but subscription is only 2× overall (45) and 1.5× from QIBs (42), so demand is 44. Because 84 is more than 30 points above 44, the grey-market value is cut to 44 + 15 = 59 and the page adds the signal “Grey-market premium is not backed by subscription demand; its weight was reduced.”' },
      { type: 'p', text: 'With no company score and no issue size, only demand (0.30) and grey market (0.20) are known: (44×0.30 + 59×0.20) ÷ 0.50 = 50. The verdict is Watch, with confidence Medium.' },
      { type: 'callout', tone: 'tip', title: 'What would change the verdict', text: 'In Example 2, stronger subscription in the last bidding days is what would lift the score, not a higher grey-market quote. That is deliberate: subscription is reported by the exchanges, the grey market is not.' },
    ],
  },
  {
    slug: 'company-quality',
    group: 'How scoring works',
    title: 'Company quality score',
    description: 'How the facts from the offer document become the 30% company input.',
    blocks: [
      { type: 'p', text: 'The company score is calculated in code from a handful of numbers. The language model only finds the numbers; it never sets the score.' },
      { type: 'diagram', name: 'company-score', caption: 'Every fact that is known moves the score from a neutral 50. Facts that are unknown change nothing.' },
      { type: 'h2', text: 'Rules' },
      { type: 'ul', items: [
        'At least three of these must be known, or there is no company score: net profit, revenue growth, net margin, debt-to-equity, operating cash flow, promoter holding, and P/E together with sector P/E.',
        'Banks, NBFCs and housing-finance companies skip the debt-to-equity and operating-cash-flow rules, because borrowing and lending are their business.',
        'Facts from the Groww company summary cap the score at 70; facts from a verified web search cap it at 60. Neither source covers leverage, cash flow, promoter holding or litigation.',
      ] },
      { type: 'h2', text: 'Accepted facts and ranges' },
      { type: 'p', text: 'Anything outside these ranges is dropped as implausible, and any other field the model returns is ignored.' },
      { type: 'table', head: ['Fact', 'Unit', 'Accepted range'], rows: [
        ['Net profit', '₹ crore', '−10,00,000 to 10,00,000'],
        ['Revenue growth', '%', '−100 to 1,000'],
        ['Offer-for-sale share', '%', '0 to 100'],
        ['Promoter holding after issue', '%', '0 to 100'],
        ['Debt-to-equity', 'ratio', '0 to 50'],
        ['P/E and sector P/E', 'ratio', '0 to 1,000'],
        ['Operating cash flow', '₹ crore', '−10,00,000 to 10,00,000'],
        ['Net margin', '%', '−1,000 to 100 (worked out from the Groww summary, never asked of the model)'],
      ] },
      { type: 'p', text: 'Yes/no facts: material litigation, regulatory action against the promoter or company, auditor qualification, and whether the company is a lender.' },
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
      { type: 'h2', text: 'What a flag does to the score' },
      { type: 'table', head: ['Severity', 'Effect'], rows: [
        ['Critical', 'Caps the final score at 35, so the badge is Avoid whatever else is known.'],
        ['High', 'Subtracts 10 points.'],
        ['Medium', 'Subtracts 4 points.'],
        ['High and medium together', 'At most 25 points in total.'],
      ] },
      { type: 'callout', tone: 'note', title: 'Banks and lenders', text: 'For banks, NBFCs and housing-finance companies the leverage and operating-cash-flow rules are skipped, and so are those two inputs in the company score. A lender borrows to lend, and its loan disbursements show up as negative operating cash flow, so those numbers do not mean what they mean for other businesses.' },
      { type: 'h2', text: 'Confidence' },
      { type: 'diagram', name: 'confidence', caption: 'Issue size and market mood do not count towards confidence; only the three core signals do.' },
      { type: 'ul', items: [
        'High: company quality, demand and grey-market data are all available.',
        'Medium: two of the three are available.',
        'Low: only one is available. The verdict is tentative and the page says so.',
      ] },
      { type: 'p', text: 'The language model only extracts facts from each chunk of the document. For regulatory action and auditor qualification it must also give an exact quote; the quote is checked against the text and a claim whose quote is not found is discarded. Its answer is filtered to a fixed list of fields with sensible ranges, so text hidden inside a document cannot change a verdict.' },
    ],
  },
  {
    slug: 'reading-documents',
    group: 'How scoring works',
    title: 'Reading the offer document',
    description: 'How a several-hundred-page filing is turned into a few checked facts, and why a document cannot steer the verdict.',
    blocks: [
      { type: 'diagram', name: 'doc-reading', caption: 'The model sees one chunk at a time and can only fill in a fixed form. Everything after that is ordinary code.' },
      { type: 'h2', text: 'Finding the document' },
      { type: 'p', text: 'The SEBI filing link from Groww is followed to the PDF on a regulator or exchange host (SEBI, NSE or BSE). If there is no SEBI link, the company’s own RHP PDF can be found through Groww’s IPO page. Only https is used, the host must resolve to public addresses, and the download size is capped. At most ten document-link look-ups are made per night.' },
      { type: 'h2', text: 'Chunking and ordering' },
      { type: 'ul', items: [
        'The text is split into chunks of about 6,000 characters, overlapping by 300 so a table split across a boundary is not lost.',
        'Chunks are ranked by how likely they are to hold the facts: restated financials, revenue from operations, profit after tax, cash flow, promoter shareholding, offer for sale, litigation, regulatory action and auditor remarks score highest.',
        'Chunks are read in batches of four. After each batch the run checks whether four of the five core facts are known; if so, and at least 12 chunks have been read, it stops early.',
        'Each chunk’s answer is saved as soon as it arrives, so a stopped run loses nothing and resumes the next night.',
      ] },
      { type: 'h2', text: 'Why a document cannot steer the verdict' },
      { type: 'steps', items: [
        { title: 'The excerpt is treated as data', text: 'The instruction to the model says the excerpt is untrusted and any instructions inside it must be ignored.' },
        { title: 'Fixed form', text: 'Only a fixed list of keys is accepted. Anything else in the answer is dropped.' },
        { title: 'Range checks', text: 'Each number must fall inside a plausible range for its field.' },
        { title: 'Quotes for serious claims', text: 'Regulatory action and auditor qualification need a 20 to 300 character quote that must actually appear in the excerpt. If it does not, the claim is discarded.' },
        { title: 'Scoring happens in code', text: 'The model never produces a score or a verdict; the rules on the previous pages do.' },
      ] },
      { type: 'h2', text: 'Which model reads it' },
      { type: 'p', text: 'The default is `openai/gpt-oss-120b` on Groq’s free tier. If a Gemini key is also set, Gemini carries on when Groq’s daily limit is reached. Both are set through environment variables; see Configuration.' },
    ],
  },
  {
    slug: 'allotment-odds',
    group: 'How scoring works',
    title: 'Allotment odds and the optimizer',
    description: 'Why a hot but heavily oversubscribed IPO is not always the best use of capital.',
    blocks: [
      { type: 'p', text: 'A listing gain only helps if you are allotted shares. The optimizer values each possible bid as the chance of allotment multiplied by the expected listing gain, per investor category (retail, small HNI, big HNI).' },
      { type: 'diagram', name: 'allotment-ev', caption: 'A 60% grey-market premium is worth less than a 15% one when the odds of getting shares are 2% against 67%.' },
      { type: 'ul', items: [
        'Chance of allotment is one divided by the category’s subscription multiple (certain when under-subscribed). If the category number is missing, the overall multiple is used.',
        'Expected gain comes from the grey-market premium, capped at 80%, and is zero when no quote exists.',
        'If the price band or lot size is not known yet, the IPO is skipped with a reason instead of being allocated with guessed terms.',
        'An account that already has a live application for an IPO is never offered that IPO again.',
      ] },
      { type: 'h2', text: 'Application rules the plan respects' },
      { type: 'diagram', name: 'category-bands', caption: 'The category follows the application amount. The UPI limit sits inside the sHNI band.' },
      { type: 'p', text: 'Each family PAN can bid once per IPO, and each application respects the UPI limit of ₹5 lakh. The solver is a heuristic: it finds a good plan under those rules, not a guaranteed best one.' },
      { type: 'table', head: ['Rule', 'Checked when'], rows: [
        ['IPO must be open (or closing today)', 'An order is created.'],
        ['Retail up to ₹2,00,000; sHNI ₹2,00,001 to ₹10,00,000; bHNI above ₹10,00,000', 'An order is created.'],
        ['Amount at most ₹5,00,000 for a UPI mandate', 'An order is created; above that, apply through net-banking ASBA in the broker app.'],
        ['One active application per PAN per IPO, across all family accounts', 'An order is created.'],
        ['A valid UPI handle (contains @)', 'An order is created.'],
      ] },
    ],
  },

  // ───────────────────────────── Data and automation ─────────────────────────────
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
        ['Groww company summary', 'Revenue and profit for recent years (the fallback when no offer document can be read)', 'Used only when the offer document is missing or cannot be downloaded. Read directly, without the language model.'],
        ['Issuer websites', 'The company’s own RHP PDF, found through Groww’s IPO page', 'Used only when there is no SEBI link. https only; the host must resolve to public addresses and the size is capped.'],
      ] },
      { type: 'h2', text: 'If the offer document is missing' },
      { type: 'p', text: 'Not every IPO has a document we can reach: the filing may not be published yet, or the exchange’s server may be slow. The system then works down a ladder and always tells you which step the score rests on:' },
      { type: 'diagram', name: 'fallback-ladder', caption: 'Each step down covers fewer facts, so it caps the company score lower.' },
      { type: 'ol', items: [
        'The official offer document from SEBI, NSE or BSE, or the company’s own PDF, read by the model (Groq, with Gemini as a backup when Groq’s daily limit is reached). Company quality, red flags and litigation are checked.',
        'Otherwise the company financials on Groww’s IPO page (revenue and profit for the last two years). Debt, cash flow, promoter holding and litigation are not checked, so the company score is capped at 70 and the page says so.',
        'Otherwise, as a last resort, a Gemini web search for a few numeric company facts (profit, debt-to-equity, promoter holding, P/E and similar). Nothing it says is trusted: each fact needs a quote that we find on the cited page ourselves, from a site the search really returned, and the number must be in the quote. Booleans such as regulatory action are never taken from the web. The score is capped at 60 and the sources are listed on the page.',
        'Otherwise market data only: grey-market premium and subscription. The page says the company has not been analysed.',
      ] },
      { type: 'p', text: 'When the offer document becomes available later, it replaces the summary. The earlier results stay in the history.' },
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
      { type: 'h2', text: 'Nightly limits' },
      { type: 'table', head: ['Limit', 'Default', 'Override'], rows: [
        ['Document chunks analysed', '60', 'NIGHTLY_MAX_CHUNKS'],
        ['IPOs worked on', '15 (IPOs with nothing to read do not count)', 'NIGHTLY_MAX_IPOS'],
        ['Model tokens', '150,000', 'NIGHTLY_MAX_TOKENS'],
        ['Web-search look-ups (last-resort tier)', '8', 'NIGHTLY_MAX_WEB_LOOKUPS'],
        ['Document-link look-ups', '10', 'fixed'],
      ] },
      { type: 'h2', text: 'The Run audit button' },
      { type: 'p', text: 'Anyone can open a report and read the stored analysis. The Run audit button never calls a model. It does one of three things:' },
      { type: 'diagram', name: 'run-audit-flow', caption: 'The limit is checked last, so a fresh or already-queued IPO never uses up one of the day’s requests.' },
      { type: 'ol', items: [
        'If an analysis newer than 24 hours exists, it is shown and no request is used.',
        'Otherwise the IPO is queued for the next nightly run and jumps ahead of the normal order.',
        'If the IPO is already queued, nothing new is queued.',
      ] },
      { type: 'p', text: 'Queued requests share a daily limit of 50 across all visitors. The limit is enforced in the database with a single conditional update, so simultaneous clicks cannot exceed it. When it is used up the button explains that and asks you to return tomorrow.' },
    ],
  },
  {
    slug: 'schedules',
    group: 'Data and automation',
    title: 'Scheduled jobs',
    description: 'Every job that runs on its own, when it runs and what it touches.',
    blocks: [
      { type: 'p', text: 'Two GitHub Actions workflows drive everything that happens without a click. The nightly analysis runs the analysis code directly; the market-hours jobs call protected webhooks on the API with the CRON_SECRET.' },
      { type: 'diagram', name: 'daily-schedule', caption: 'Only the 02:00 job uses the language model. Times are IST.' },
      { type: 'table', head: ['Time (IST)', 'Job', 'What it does'], rows: [
        ['02:00 daily', 'Nightly analysis', 'Source sync, document reading, scoring. The only job that calls a model.'],
        ['08:30 weekdays', 'Morning login', 'Logs in to the broker for each account and refreshes available balances.'],
        ['09:00 weekdays', 'Listing-day sell', 'For holdings listing today, stages pre-market limit sell orders with the broker.'],
        ['10:05 weekdays', 'Reconcile sells', 'Confirms which sell orders filled and only then books realized P&L.'],
        ['06:00–20:00 weekdays, every 30 min', 'Allotment check', 'Detects allotments in broker holdings so the 09:00 job sees them.'],
        ['17:00 weekdays', 'Source refresh', 'Re-reads the IPO sources during the day.'],
        ['22:00 daily', 'Maintenance', 'Allotment scan and a sweep of expired ASBA locks. No model is run here.'],
      ] },
      { type: 'callout', tone: 'warn', title: 'Schedules can start late', text: 'GitHub can start scheduled workflows several minutes after the set time. That is harmless for the nightly analysis but matters for the 09:00 listing-day sell.' },
      { type: 'p', text: 'Jobs that place or reconcile orders take a lock first, so if two runs overlap, the second one skips instead of acting twice. The lock is best-effort, not a guarantee.' },
    ],
  },

  // ───────────────────────────── Money and accounts ─────────────────────────────
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
      { type: 'h2', text: 'Where the money is at each step' },
      { type: 'table', head: ['Event', 'Available', 'In ASBA', 'Order status'], rows: [
        ['Application created', '− bid amount', '+ bid amount', 'PENDING … APPLIED'],
        ['Not allotted', '+ bid amount', '− bid amount', 'NOT_ALLOTTED'],
        ['Fully allotted', 'unchanged', '− bid amount (debited)', 'ALLOTTED'],
        ['Partly allotted', '+ the unallotted part', '− bid amount', 'ALLOTTED'],
        ['Cancelled while live', '+ bid amount', '− bid amount', 'CANCELLED'],
      ] },
      { type: 'diagram', name: 'order-lifecycle', caption: 'Recording the same result twice is safe: the second call reports “already processed” and changes nothing.' },
      { type: 'callout', tone: 'warn', title: 'Live applications are off by default', text: 'Submitting real IPO applications through the broker is disabled until ENABLE_LIVE_IPO_APPLY is set to true. Do this only after you have verified the broker endpoint yourself. Without it, the app refuses and tells you why instead of pretending to apply.' },
      { type: 'p', text: 'If the broker’s balance check fails, Kapitl keeps the last known balance and marks it unknown rather than showing zero.' },
      { type: 'p', text: 'Order creation locks the account row on PostgreSQL, so two applications made at the same moment cannot spend the same balance twice.' },
    ],
  },
  {
    slug: 'security',
    group: 'Money and accounts',
    title: 'Security and privacy',
    description: 'Who can see what, and how secrets are handled.',
    blocks: [
      { type: 'diagram', name: 'sign-in', caption: 'Three ways in, three different levels of access.' },
      { type: 'ul', items: [
        'Sign-in uses Google with an allow-listed email, followed by a one-time code (TOTP). Failed code attempts are rate limited.',
        'Guests can read public data and sample information. Account, order, fund and broker data need the admin session.',
        'Scheduled-job endpoints need a secret that only the scheduler knows.',
        'Broker credentials are encrypted with a key held in the environment. If that key is lost or changed, stored credentials cannot be decrypted.',
        'Server errors return a generic message. Details stay in the server log.',
      ] },
      { type: 'h2', text: 'Scheduler secret' },
      { type: 'p', text: 'The `/api/cron/*` endpoints accept the CRON_SECRET as `Authorization: Bearer …` or `X-API-Key`. If CRON_SECRET is not set, they refuse every call with 503 rather than run unprotected. The app’s own signing key is never accepted there.' },
      { type: 'callout', tone: 'note', title: 'Keep secrets out of the code', text: 'API keys, database URLs and encryption keys belong in environment variables or repository secrets, never in the repository. If a key has ever been committed, treat it as exposed and replace it.' },
    ],
  },

  // ───────────────────────────── Run it yourself ─────────────────────────────
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
        ['GET /analysis', 'Public', 'Badge and score of every IPO that has a score, for list views.'],
        ['GET /analysis/{id}', 'Public', 'Latest listing-gain analysis: score, badge, signals with reasons, red flags.'],
        ['POST /analysis/{id}/request', 'Public', 'Run audit: returns the stored analysis or queues the IPO. Shares the daily limit.'],
        ['GET /sources/health', 'Admin', 'Health of every data source.'],
        ['POST /cron/{job}', 'Scheduler', 'Market-hours jobs. Needs the CRON_SECRET.'],
      ] },
      { type: 'h3', text: 'Example: read an analysis' },
      { type: 'code', lang: 'bash', text: 'curl https://<your-deployment>/api/analysis/<ipo-id>' },
      { type: 'code', lang: 'json', title: 'Response (shortened)', text: '{\n  "ipo_id": "<ipo-id>",\n  "state": "ready",\n  "badge": "APPLY",\n  "score": 72,\n  "verdict": "MODERATE_APPLY",\n  "confidence": "high",\n  "facts_basis": "offer_document",\n  "signals": [\n    { "code": "demand", "direction": "positive", "reason": "Subscription demand scores 95/100 (retail 25.0x)." }\n  ],\n  "red_flags": [ ... ],\n  "queued": false\n}' },
      { type: 'h3', text: 'The state field' },
      { type: 'table', head: ['state', 'Meaning'], rows: [
        ['ready', 'Scored with facts from the offer document.'],
        ['summary_only', 'Company facts from the Groww summary.'],
        ['web_only', 'Company facts from the verified web search; sources listed in `sources`.'],
        ['market_only', 'Scored from market data; documents not analysed yet.'],
        ['not_analysed', 'Nothing to score from yet; score, badge and verdict are null.'],
        ['cached, queued, already_queued', 'Returned by the Run audit request only: fresh analysis shown, newly queued, or already in the queue.'],
      ] },
      { type: 'p', text: 'badge is APPLY, WATCH or AVOID (or null), and each signal has a direction of positive, negative or neutral with a plain-language reason.' },
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
      { type: 'steps', items: [
        { title: 'Start the API', text: 'Create a virtual environment, install the requirements, apply the migrations and start uvicorn on port 8000.' },
        { title: 'Start the web app', text: 'Install the packages and start Next.js in development mode.' },
        { title: 'Run the tests', text: 'Both suites run offline: the AI provider, broker and sources are mocked.' },
      ] },
      { type: 'code', lang: 'bash', title: 'API', text: 'cd apps/api\npython -m venv venv\nvenv\\Scripts\\activate        # Windows; use: source venv/bin/activate\npip install -r requirements.txt\nalembic upgrade head\nuvicorn app.main:app --reload --port 8000' },
      { type: 'code', lang: 'bash', title: 'Web', text: 'cd apps/web\nnpm install\nnpm run dev' },
      { type: 'p', text: 'Without a DATABASE_URL the API uses a local SQLite file, which is fine for development. Tests never contact live services: the AI provider, broker and sources are mocked.' },
      { type: 'code', lang: 'bash', title: 'Tests', text: 'cd apps/api && python -m pytest tests\ncd apps/web && npm test' },
      { type: 'h2', text: 'A small nightly run by hand' },
      { type: 'p', text: 'With GROQ_API_KEY (or GEMINI_API_KEY) set, you can run the nightly job yourself with small limits to see it work.' },
      { type: 'code', lang: 'bash', text: 'cd apps/api\nNIGHTLY_MAX_CHUNKS=6 NIGHTLY_MAX_IPOS=1 python -m app.jobs.nightly' },
    ],
  },
  {
    slug: 'configuration',
    group: 'Run it yourself',
    title: 'Configuration reference',
    description: 'Every environment variable that changes behaviour, with its default.',
    blocks: [
      { type: 'p', text: 'Settings are read from the environment (or a .env file in development). Anything not listed keeps a safe default.' },
      { type: 'h2', text: 'Core' },
      { type: 'table', head: ['Variable', 'Default', 'Purpose'], rows: [
        ['DATABASE_URL', 'local SQLite file', 'PostgreSQL connection in production (Supabase).'],
        ['SECRET_KEY', 'insecure development value', 'Signs sessions. Must be set in production.'],
        ['FERNET_KEY', 'empty', 'Encrypts broker credentials. Losing it makes stored credentials unreadable.'],
        ['CRON_SECRET', 'empty', 'Protects the scheduler webhooks. Empty means they refuse every call.'],
      ] },
      { type: 'h2', text: 'Sign-in' },
      { type: 'table', head: ['Variable', 'Default', 'Purpose'], rows: [
        ['GOOGLE_CLIENT_ID', 'project client ID', 'Google sign-in.'],
        ['ALLOWED_EMAIL', 'empty', 'The only email allowed to become admin.'],
        ['ADMIN_TOTP_SECRET', 'empty', 'Secret for the six-digit one-time code.'],
      ] },
      { type: 'h2', text: 'Analysis' },
      { type: 'table', head: ['Variable', 'Default', 'Purpose'], rows: [
        ['GROQ_API_KEY', 'empty', 'Primary model provider for the nightly job.'],
        ['DEFAULT_AI_MODEL', 'openai/gpt-oss-120b', 'Model used on Groq.'],
        ['GEMINI_API_KEY', 'empty', 'Backup extractor and the last-resort web search.'],
        ['GEMINI_MODEL', 'gemini-2.5-flash-lite', 'Backup extractor model.'],
        ['GEMINI_SEARCH_MODEL', 'gemini-2.5-flash', 'Model for the verified web search.'],
        ['WEB_RESEARCH_ENABLED', 'true', 'Turns the web-search tier on or off (it also needs GEMINI_API_KEY).'],
        ['NIGHTLY_MAX_CHUNKS / _IPOS / _TOKENS / _WEB_LOOKUPS', '60 / 15 / 150000 / 8', 'Per-night limits.'],
        ['AUDIT_DAILY_CAP', '50', 'Run audit requests per day, shared by all visitors.'],
      ] },
      { type: 'h2', text: 'Sources and broker' },
      { type: 'table', head: ['Variable', 'Default', 'Purpose'], rows: [
        ['SOURCE_GROWW_ENABLED / SOURCE_IPOWATCH_ENABLED / SOURCE_IPOALERTS_ENABLED', 'true', 'Switch a source off without a code change.'],
        ['IPOALERTS_API_KEY', 'empty', 'Free key from ipoalerts.in.'],
        ['IPOALERTS_DAILY_BUDGET', '20', 'Self-imposed cap on the 25-a-day free plan.'],
        ['ENABLE_LIVE_IPO_APPLY', 'false', 'Allows real applications through the broker. Leave off until verified.'],
      ] },
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
      { type: 'h2', text: 'Workflows' },
      { type: 'table', head: ['Workflow', 'Runs', 'Does'], rows: [
        ['CI', 'On push and pull request', 'API tests, web tests and the production build.'],
        ['Nightly IPO analysis', 'Daily, 02:00 IST', 'Source sync, document reading and scoring.'],
        ['Scheduled jobs', 'Market hours', 'Calls the /api/cron webhooks listed under Scheduled jobs.'],
        ['Database migrate', 'By hand', 'Dry run, then alembic upgrade head.'],
      ] },
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
  {
    slug: 'faq',
    group: 'Run it yourself',
    title: 'FAQ and troubleshooting',
    description: 'Answers to the questions that come up most, and what to check when something looks off.',
    blocks: [
      { type: 'h2', text: 'About the score' },
      { type: 'faq', items: [
        { q: 'Why does an IPO say “No score yet”?', a: 'There is no grey-market quote, no subscription number and no analysed document yet. This usually changes once bidding opens. It is not a negative verdict.' },
        { q: 'Why is a hot IPO only on Watch?', a: 'Usually because only one core signal is known (often the grey-market premium), which keeps the score between 45 and 60, or because the grey-market premium is not backed by subscription and was cut back. The signals list says which.' },
        { q: 'Why did the score change overnight?', a: 'Each night the score is recomputed with the latest subscription and grey-market numbers, and more of the offer document may have been read. Earlier results stay in the history.' },
        { q: 'Can the offer document trick the model into a good verdict?', a: 'No. The model only fills in a fixed set of fields that are range-checked, serious claims need a quote that is checked against the text, and the score is calculated in code.' },
      ] },
      { type: 'h2', text: 'About applications' },
      { type: 'faq', items: [
        { q: 'Why was my application refused?', a: 'The message names the rule: the IPO is not open, the amount does not fit the chosen category, it is above the ₹5 lakh UPI limit, the PAN already has an active application for this IPO, or the UPI handle is missing.' },
        { q: 'I cancelled in Kapitl. Is the bank block released?', a: 'Only in Kapitl. If the application had reached the exchange, also cancel it in your broker or UPI app so the bank releases the block.' },
        { q: 'I got fewer shares than I applied for.', a: 'Send the allotment result with the actual quantity (`allotted_qty`) through the API (the Orders screen buttons record the full quantity). The unallotted part is returned to the account’s available balance.' },
      ] },
      { type: 'h2', text: 'When something looks wrong' },
      { type: 'faq', items: [
        { q: 'Data has not updated for a day.', a: 'The top bar shows when the IPO sources last refreshed. For detail, check GET /api/sources/health (admin). A source with several consecutive failures has probably changed its layout. The nightly workflow is also marked failed in GitHub when a source fails.' },
        { q: 'Run audit says the limit is reached.', a: 'All 50 shared requests for the day are used. The stored analysis is still readable; try again tomorrow.' },
        { q: 'Scheduled jobs return 503.', a: 'CRON_SECRET is not set on the API. Set it in Vercel and in the GitHub secrets, with the same value.' },
      ] },
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

/** Estimated reading time in minutes (200 words a minute, at least 1). */
export function readingMinutes(page: DocPage): number {
  const words = `${page.description} ${page.blocks.map(plainText).join(' ')}`.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
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
      return `${b.title ?? ''} ${b.text}`
    case 'diagram':
      return b.caption
    case 'steps':
    case 'cards':
      return b.items.map((it) => `${it.title} ${it.text}`).join(' ')
    case 'defs':
      return b.items.map((it) => `${it.term} ${it.text}`).join(' ')
    case 'faq':
      return b.items.map((it) => `${it.q} ${it.a}`).join(' ')
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
