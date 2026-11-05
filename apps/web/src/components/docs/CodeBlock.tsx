'use client'

import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CodeBlockProps {
  code: string
  language?: string
  title?: string
}

export function CodeBlock({ code, language = 'bash', title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <div className="my-4 rounded-md border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--border-default)] bg-[var(--bg-elevated)]/60">
        <div className="flex items-center gap-2 text-2xs text-[var(--ink-3)] font-medium uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]/80 inline-block" />
          <span>{title || language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs text-[var(--ink-2)] hover:text-[var(--ink-1)] hover:bg-[var(--bg-subtle)] transition-colors"
          title="Copy to clipboard"
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[var(--positive)]" />
              <span className="text-[var(--positive)] font-mono">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-[var(--ink-1)] leading-relaxed bg-[#0a0907]">
        <pre className="font-mono text-2xs sm:text-xs">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}

