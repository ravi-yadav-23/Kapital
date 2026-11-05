'use client'

import React from 'react'
import {
  Sparkles,
  Info,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'

interface CalloutProps {
  type?: 'tip' | 'note' | 'warning' | 'sebi' | 'success'
  title?: string
  children: React.ReactNode
}

export function Callout({ type = 'note', title, children }: CalloutProps) {
  const configs = {
    tip: {
      border: 'border-[var(--accent)]/40',
      bg: 'bg-[var(--accent)]/5',
      icon: Sparkles,
      iconColor: 'text-[var(--accent)]',
      defaultTitle: 'PRO TIP',
    },
    note: {
      border: 'border-blue-500/40',
      bg: 'bg-blue-500/5',
      icon: Info,
      iconColor: 'text-blue-400',
      defaultTitle: 'NOTE',
    },
    warning: {
      border: 'border-red-500/40',
      bg: 'bg-red-500/5',
      icon: AlertTriangle,
      iconColor: 'text-red-400',
      defaultTitle: 'CRITICAL REGULATION',
    },
    sebi: {
      border: 'border-amber-500/40',
      bg: 'bg-amber-500/5',
      icon: ShieldCheck,
      iconColor: 'text-amber-400',
      defaultTitle: 'SEBI STATUTORY RULE',
    },
    success: {
      border: 'border-[var(--positive)]/40',
      bg: 'bg-[var(--positive)]/5',
      icon: CheckCircle2,
      iconColor: 'text-[var(--positive)]',
      defaultTitle: 'OPTIMIZATION ADVANTAGE',
    },
  }

  const cfg = configs[type] || configs.note
  const Icon = cfg.icon

  return (
    <div className={`my-4 p-4 rounded-md border ${cfg.border} ${cfg.bg} space-y-1.5 text-xs text-[var(--ink-2)] leading-relaxed`}>
      <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-wider font-bold">
        <Icon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
        <span className={cfg.iconColor}>{title || cfg.defaultTitle}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

