'use client'

import React, { useState } from 'react'
import { ChevronDown, HelpCircle, ShieldCheck, Zap, Scale, DollarSign } from 'lucide-react'

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
    question: 'How does Kapitl keep AI analysis costs under ₹200/month?',
    answer:
      'Rather than streaming entire 400-page DRHP PDFs through expensive frontier LLMs on every query, Kapitl employs an intelligent hybrid pipeline: Python-based PyPDF/LlamaIndex chunks and filters key financial tables, auditor notes, and peer comps first. Only targeted high-signal extracts are passed to Gemini 2.5 Flash and Claude 3.5 with strict prompt caching, keeping monthly AI operating costs under ₹200 per active user.',
  },
  {
    category: 'AUTOMATION & BROKERS',
    icon: Zap,
    question: 'How does automated 09:00 AM listing day execution work via SmartAPI?',
    answer:
      'Kapitl integrates with Angel One SmartAPI using TOTP session management. On listing morning, between 09:00 AM and 09:45 AM (NSE/BSE pre-open price discovery call auction), Kapitl checks your configured exit strategy (e.g., "Exit at pre-open price if GMP > 15%", or "Set 5% trailing stop"). Once discovered, pre-open limit orders are queued directly at exchange tick, capturing gains before intraday post-listing volatility.',
  },
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="py-20 border-t border-[#2d2520] bg-[#0c0a09]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1a1612] border border-[#2d2520] text-xs font-semibold text-[#f59e0b] mb-4">
            <HelpCircle className="w-3.5 h-3.5" /> FREQUENTLY ASKED QUESTIONS
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#fafaf9]">
            Everything you need to know about Kapitl
          </h2>
          <p className="mt-4 text-[#a8a29e] text-base">
            Technical answers on ASBA fund safety, SEBI compliance, AI architecture, and broker integrations.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index
            const Icon = faq.icon

            return (
              <div
                key={faq.question}
                className={`border rounded-2xl transition-all duration-200 overflow-hidden ${
                  isOpen
                    ? 'bg-[#1a1612] border-[#f59e0b]/40 shadow-lg shadow-[#f59e0b]/5'
                    : 'bg-[#14100c] border-[#2d2520] hover:border-[#3d322b]'
                }`}
              >
                <button
                  onClick={() => toggle(index)}
                  className="w-full text-left p-6 flex items-start justify-between gap-4 cursor-pointer focus:outline-none"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isOpen
                          ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30'
                          : 'bg-[#0c0a09] text-[#a8a29e] border-[#2d2520]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-[#f59e0b]">
                        {faq.category}
                      </span>
                      <h3 className="font-heading text-base sm:text-lg font-bold text-[#fafaf9] mt-0.5">
                        {faq.question}
                      </h3>
                    </div>
                  </div>

                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center border border-[#2d2520] shrink-0 text-[#a8a29e] transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-[#0c0a09] text-[#fafaf9]' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-0 text-sm text-[#a8a29e] leading-relaxed border-t border-[#2d2520]/60 mt-2">
                    <p className="pt-4">{faq.answer}</p>
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
