'use client'

import React, { useState } from 'react'
import { ChevronDown, ShieldCheck, Zap, Scale, DollarSign } from 'lucide-react'

interface FaqItem {
  question: string
  answer: string
  category: string
  icon: any
}

const FAQS: FaqItem[] = [
  {
    category: 'FUNDS & SECURITY',
    icon: ShieldCheck,
    question: 'Is my money safe? Does Kapitl hold my investment capital?',
    answer:
      'Kapitl NEVER holds your funds. Under SEBI ASBA (Application Supported by Blocked Amount), your capital never leaves your own verified bank account. Only a lien/hold is created by your bank via UPI mandate. You continue earning bank savings interest (3-4% p.a.) until allotment day. If no allotment is made, the hold is automatically unblocked directly by your bank within 24 hours.',
  },
  {
    category: 'SEBI COMPLIANCE',
    icon: Scale,
    question: 'Is applying through multiple family Demat accounts legal under SEBI regulations?',
    answer:
      'Yes, 100% legal. SEBI rules prohibit multiple applications under the SAME Permanent Account Number (PAN) for a single issue. However, separate family members with their own unique PAN, bank account, and Demat accounts are legally distinct individuals. Kapitl enforces strict PAN deduplication checks to ensure each application is tied to a distinct, verified PAN, strictly complying with SEBI Master Circulars.',
  },
  {
    category: 'SYSTEM ARCHITECTURE',
    icon: DollarSign,
    question: 'What does the AI analysis actually use?',
    answer:
      'Kapitl sends the configured LLM only structured feed data: price band, lot size, issue size, GMP, subscription multiples and the listed strengths and risks. It does not read prospectus PDFs, so restated financials, peer multiples, OFS split and litigation are shown as not assessed. Reports with no AI score are labelled preliminary.',
  },
  {
    category: 'AUTOMATION & BROKERS',
    icon: Zap,
    question: 'How does automated 09:00 AM listing day execution work via SmartAPI?',
    answer:
      'Kapitl can log in to Angel One SmartAPI with TOTP and, where the scheduler is running, place the limit sell price you staged on listing morning. Order placement has not been verified against a live broker account, and the schedule needs a running scheduler or the GitHub Actions cron; timing is best-effort.',
  },
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="py-16 border-t border-[var(--border-default)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)] block mb-1">
            Frequently Asked Questions
          </span>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-[var(--ink-1)]">
            Everything you need to know about Kapitl
          </h2>
          <p className="mt-3 text-sm text-[var(--ink-2)] leading-relaxed">
            Technical answers on ASBA fund security, SEBI regulations, AI architecture, and broker integrations.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index

            return (
              <div
                key={faq.question}
                className="card p-0 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggle(index)}
                  className="w-full text-left p-5 flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                >
                  <div className="space-y-1">
                    <span className="text-2xs uppercase font-mono text-[var(--ink-3)] block">
                      {faq.category}
                    </span>
                    <h3 className="text-sm font-medium text-[var(--ink-1)]">
                      {faq.question}
                    </h3>
                  </div>

                  <ChevronDown
                    className={`w-4 h-4 text-[var(--ink-3)] transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180 text-[var(--ink-1)]' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-[var(--ink-2)] leading-relaxed border-t border-[var(--border-default)]">
                    {faq.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
