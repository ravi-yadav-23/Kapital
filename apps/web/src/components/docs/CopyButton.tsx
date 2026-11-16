'use client'

import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'

/** Copies a code block to the clipboard; shows a tick for a moment afterwards. */
export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      aria-label={done ? 'Copied' : 'Copy code'}
      className="rounded-sm p-1 text-ink-3 hover:bg-[var(--bg-selected)] hover:text-ink"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
    </button>
  )
}
