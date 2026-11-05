export interface DocSection {
  id: string
  title: string
  badge?: string
  description: string
  chapter: string
}

export interface Chapter {
  id: string
  title: string
  iconName: string
  sections: DocSection[]
}

export const DOCS_CHAPTERS: Chapter[] = [
  {
    id: 'getting-started',
    title: '1. Getting Started & Overview',
    iconName: 'Compass',
    sections: [
      {
        id: 'executive-summary',
        title: 'Executive Summary & The Problem',
        chapter: 'getting-started',
        badge: 'Core',
        description: 'Why retail and family IPO investors lose out in Indian primary markets, and how Kapitl solves it.',
      },
      {
        id: 'system-architecture',
        title: 'End-to-End System Architecture',
        chapter: 'getting-started',
        badge: 'Design',
        description: 'Microservices flow: from SEBI EDGAR prospectuses to SmartAPI execution matching.',
      },
      {
        id: 'quick-start',
        title: 'Quick Start & Local Environment',
        chapter: 'getting-started',
        badge: 'Setup',
        description: 'Clone, configure virtual environments, run migrations, and spin up the frontend and backend.',
      },
    ],
  },
  {
    id: 'ai-forensics',
    title: '2. Multi-Agent AI Due Diligence',
    iconName: 'Sparkles',
    sections: [
      {
        id: 'multi-agent-pipeline',
        title: 'Dual-Agent LLM Orchestrator',
        chapter: 'ai-forensics',
        badge: 'Claude & Gemini',
        description: 'How Claude 3.5 Sonnet and Gemini 2.5 Flash parse 400-page DRHPs without hallucination.',
      },
      {
        id: 'listing-gatekeepers',
        title: '5 SEBI Listing Gatekeepers',
        chapter: 'ai-forensics',
        badge: 'Deal-Breakers',
        description: 'Rigorous deal-breaker forensic filters: promoter dilution, litigation, debt, and auditor qualifications.',
      },
      {
        id: 'conviction-formula',
        title: 'Deterministic Conviction Score',
        chapter: 'ai-forensics',
        badge: '0–100 Math',
        description: 'Weighted composite radar vector math and severe red-flag penalty deductions.',
      },
    ],
  },
  {
    id: 'operations-research',
    title: '3. Operations Research & MILP',
    iconName: 'Cpu',
    sections: [
      {
        id: 'sebi-allotment-rules',
        title: 'SEBI Quota & Category Mechanics',
        chapter: 'operations-research',
        badge: 'SEBI Rules',
        description: 'Retail lottery odds, sHNI (₹2L-₹10L), bHNI (>₹10L), and SME mandatory minimum lot calculations.',
      },
      {
        id: 'milp-formulation',
        title: 'PuLP MILP Mathematical Formulation',
        chapter: 'operations-research',
        badge: 'Operations Research',
        description: 'Mixed-Integer Linear Programming objective function, constraints, and CBC solver logic.',
      },
      {
        id: 'asba-lock-recycling',
        title: 'ASBA Fund Lock & Recycling Timeline',
        chapter: 'operations-research',
        badge: 'Liquidity',
        description: 'Dynamic overlap conflict detection preserving capital for upcoming high-conviction IPOs.',
      },
    ],
  },
  {
    id: 'execution-engine',
    title: '4. Broker Execution & Tracking',
    iconName: 'TrendingUp',
    sections: [
      {
        id: 'smartapi-integration',
        title: 'Angel One SmartAPI & TOTP Protocol',
        chapter: 'execution-engine',
        badge: 'Broker API',
        description: 'RFC 6238 hardware TOTP token refresh, session persistence, and broker order generation.',
      },
      {
        id: 'asba-upi-workflow',
        title: 'UPI Mandate & ASBA Fund Safety',
        chapter: 'execution-engine',
        badge: 'Security',
        description: 'Why money never leaves the investor bank account until allotment day.',
      },
      {
        id: 'registrar-scrapers',
        title: 'Registrar Scraping & Listing Strategy',
        chapter: 'execution-engine',
        badge: '09:00 AM Exit',
        description: 'Link Intime, KFintech, and Bigshare scrapers + 09:00:00 AM IST pre-market limit orders.',
      },
    ],
  },
  {
    id: 'technical-specs',
    title: '5. Architecture & API Specs',
    iconName: 'Terminal',
    sections: [
      {
        id: 'tech-stack-deep-dive',
        title: 'Full Tech Stack & Patterns',
        chapter: 'technical-specs',
        badge: 'Next.js & FastAPI',
        description: 'App Router, Tailwind CSS, Async SQLAlchemy, SWR in-memory caching, and WebSocket feeds.',
      },
      {
        id: 'rest-api-reference',
        title: 'REST API & WebSocket Reference',
        chapter: 'technical-specs',
        badge: 'Endpoints',
        description: 'Complete endpoint parameters, status codes, and JSON payload contracts.',
      },
    ],
  },
  {
    id: 'author-contact',
    title: '6. Creator & Ecosystem',
    iconName: 'User',
    sections: [
      {
        id: 'developer-profile',
        title: 'About the Author: Ravi Yadav',
        chapter: 'author-contact',
        badge: 'Engineering Lead',
        description: 'Background, philosophy, and verified developer social links.',
      },
      {
        id: 'contact-section',
        title: 'Contact Us & Collaboration',
        chapter: 'author-contact',
        badge: 'Get in Touch',
        description: 'Direct inquiry form, email contact, bug reports, and partnership avenues.',
      },
      {
        id: 'legal-disclaimer',
        title: 'Compliance & Safe-Harbor Disclaimer',
        chapter: 'author-contact',
        badge: 'SEBI Notice',
        description: 'Educational and algorithmic research platform disclaimer & regulatory terms.',
      },
    ],
  },
]

