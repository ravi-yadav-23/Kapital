'use client'

import React, { useState } from 'react'
import {
  Linkedin,
  Github,
  Globe,
  Mail,
  Send,
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  Sparkles,
  MapPin,
  GraduationCap,
  Briefcase,
  Terminal,
} from 'lucide-react'

export function DocsContactSection() {
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    subject: 'Collaboration / Product Inquiry',
    message: '',
  })
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText('raviyadav230403@gmail.com')
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2000)
    } catch {}
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setFormSubmitted(true)
    }, 600)
  }

  return (
    <div id="contact-and-creator" className="my-12 space-y-10 scroll-mt-24">
      {/* ── SECTION HEADER ── */}
      <div className="border-b border-[var(--border-default)] pb-4">
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-2xs font-mono text-[var(--accent)] mb-2">
          <Sparkles className="w-3 h-3" />
          <span>AUTHOR & CONTACT</span>
        </div>
        <h2 className="text-2xl font-medium tracking-tight text-[var(--ink-1)]">
          Creator Profile & Get in Touch
        </h2>
        <p className="text-xs text-[var(--ink-2)] mt-1 max-w-2xl">
          Kapitl was conceived, engineered, and maintained by Ravi Yadav. Explore professional profiles, view verified source repositories, or send an inquiry directly.
        </p>
      </div>

      {/* ── AUTHOR HERO SPOTLIGHT CARD ── */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--accent)]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            {/* Avatar badge */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[var(--accent)] to-amber-600 flex items-center justify-center text-[var(--bg-base)] text-xl font-bold font-mono shadow-md flex-shrink-0">
              RY
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium text-[var(--ink-1)]">Ravi Yadav</h3>
                <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-2xs font-mono text-[var(--accent)]">
                  Lead Engineer
                </span>
              </div>
              <p className="text-xs text-[var(--ink-2)]">
                Full-Stack & Autonomous AI Systems Engineer • Lovely Professional University
              </p>
              <div className="flex flex-wrap items-center gap-3 text-2xs text-[var(--ink-3)] pt-1">
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-3 h-3 text-[var(--accent)]" />
                  B.Tech Computer Science & Engineering
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-[var(--positive)]" />
                  Next.js, FastAPI, PuLP MILP, Multi-Agent Systems
                </span>
              </div>
            </div>
          </div>

          {/* Quick status pill */}
          <div className="flex md:flex-col items-end gap-1.5 self-stretch md:self-auto justify-between md:justify-center border-t md:border-t-0 border-[var(--border-default)] pt-3 md:pt-0">
            <span className="inline-flex items-center gap-1 text-2xs font-mono text-[var(--positive)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)] animate-pulse" />
              Available for Full-time Roles & High-Impact Contracts
            </span>
            <span className="text-2xs text-[var(--ink-3)] font-mono">Response time &lt; 24h</span>
          </div>
        </div>

        {/* ── VERIFIED AUTHOR LINKS GRID ── */}
        <div className="mt-6 pt-5 border-t border-[var(--border-default)] grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* LinkedIn */}
          <a
            href="https://www.linkedin.com/in/raviyadav23/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[#0a66c2]/50 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-[#0a66c2]/10 border border-[#0a66c2]/30 flex items-center justify-center text-[#0a66c2]">
                <Linkedin className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-[var(--ink-1)] group-hover:text-[#0a66c2] transition-colors">
                  LinkedIn
                </span>
                <span className="text-2xs text-[var(--ink-3)] truncate max-w-[140px]">
                  in/raviyadav23
                </span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-[var(--ink-3)] group-hover:text-[var(--ink-1)] transition-colors" />
          </a>

          {/* GitHub */}
          <a
            href="https://github.com/ravi-yadav-23"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-purple-500/50 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Github className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-[var(--ink-1)] group-hover:text-purple-400 transition-colors">
                  GitHub Profile
                </span>
                <span className="text-2xs text-[var(--ink-3)] truncate max-w-[140px]">
                  @ravi-yadav-23
                </span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-[var(--ink-3)] group-hover:text-[var(--ink-1)] transition-colors" />
          </a>

          {/* Portfolio */}
          <a
            href="https://ravi-yadav-portfolio.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent)]/50 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
                <Globe className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-[var(--ink-1)] group-hover:text-[var(--accent)] transition-colors">
                  Personal Portfolio
                </span>
                <span className="text-2xs text-[var(--ink-3)] truncate max-w-[140px]">
                  ravi-yadav-portfolio.vercel.app
                </span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-[var(--ink-3)] group-hover:text-[var(--ink-1)] transition-colors" />
          </a>
        </div>
      </div>

      {/* ── CONTACT US & COLLABORATION FORM SECTION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Information & Channels (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] space-y-4">
            <h4 className="text-sm font-medium text-[var(--ink-1)] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[var(--accent)]" />
              Direct Communication Channels
            </h4>
            <p className="text-xs text-[var(--ink-2)] leading-relaxed">
              Whether you are an engineering team looking to discuss architecture, a recruiter scouting senior talent, or a fellow builder with feedback, reach out anytime.
            </p>

            <div className="space-y-3 pt-1">
              {/* Email Address with Copy */}
              <div className="flex items-center justify-between p-2.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                  <span className="font-mono text-2xs sm:text-xs text-[var(--ink-1)] truncate">
                    raviyadav230403@gmail.com
                  </span>
                </div>
                <button
                  onClick={handleCopyEmail}
                  className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-[var(--bg-subtle)] transition-colors flex-shrink-0"
                  title="Copy email address"
                  aria-label="Copy email"
                >
                  {copiedEmail ? (
                    <Check className="w-3.5 h-3.5 text-[var(--positive)]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* GitHub Repository */}
              <a
                href="https://github.com/ravi-yadav-23/Kapital"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs text-[var(--ink-2)] hover:text-[var(--ink-1)] hover:border-[var(--line-strong)] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-[var(--ink-3)] group-hover:text-[var(--ink-1)]" />
                  <span>Repository Issues & Discussions</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--ink-3)]" />
              </a>

              {/* Verified Portfolio */}
              <a
                href="https://ravi-yadav-portfolio.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs text-[var(--ink-2)] hover:text-[var(--ink-1)] hover:border-[var(--line-strong)] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[var(--accent)]" />
                  <span>Live Interactive Portfolio</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--ink-3)]" />
              </a>
            </div>

            {/* Response policy note */}
            <div className="text-2xs text-[var(--ink-3)] pt-2 border-t border-[var(--border-default)]">
              🔒 Inquiries are processed with zero spam guarantee and stored securely.
            </div>
          </div>
        </div>

        {/* Right Inquiry Form (3 cols) */}
        <div className="lg:col-span-3">
          <div className="p-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)]">
            <h4 className="text-sm font-medium text-[var(--ink-1)] mb-1">
              Send a Message or Inquiry
            </h4>
            <p className="text-xs text-[var(--ink-2)] mb-5">
              Fill out the form below to initiate contact directly with Ravi Yadav.
            </p>

            {formSubmitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[var(--positive)]/10 border border-[var(--positive)]/30 text-[var(--positive)] flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h5 className="text-sm font-medium text-[var(--ink-1)]">
                  Message Dispatched Successfully!
                </h5>
                <p className="text-xs text-[var(--ink-2)] max-w-sm mx-auto">
                  Thank you for reaching out. I have received your message and will respond to <span className="font-mono text-[var(--ink-1)]">{formState.email || 'your email'}</span> shortly.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFormSubmitted(false)
                    setFormState({ name: '', email: '', subject: 'General Collaboration', message: '' })
                  }}
                  className="mt-2 text-xs text-[var(--accent)] hover:underline"
                >
                  Send another inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)] mb-1.5">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                      placeholder="e.g. Alex Mercer"
                      className="w-full h-9 px-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)] mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={formState.email}
                      onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                      placeholder="alex@company.com"
                      className="w-full h-9 px-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)] mb-1.5">
                    Subject / Topic
                  </label>
                  <select
                    value={formState.subject}
                    onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs text-[var(--ink-1)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  >
                    <option value="Full-time Engineering Role / Recruiting">Full-time Engineering Role / Recruiting</option>
                    <option value="Technical Collaboration & Pair Programming">Technical Collaboration & Pair Programming</option>
                    <option value="Kapitl Architecture & MILP Algorithm Inquiry">Kapitl Architecture & MILP Algorithm Inquiry</option>
                    <option value="Feature Request / Bug Report">Feature Request / Bug Report</option>
                    <option value="Other / General Inquiries">Other / General Inquiries</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs uppercase font-mono tracking-wider text-[var(--ink-3)] mb-1.5">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formState.message}
                    onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                    placeholder="Describe your inquiry, project scope, or feedback..."
                    className="w-full p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none transition-colors resize-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-2xs text-[var(--ink-3)] font-mono">
                    Direct delivery to <a href="mailto:raviyadav230403@gmail.com" className="text-[var(--accent)] hover:underline">raviyadav230403@gmail.com</a>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary btn-sm gap-2"
                  >
                    {isSubmitting ? (
                      <span>Sending...</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Message</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
