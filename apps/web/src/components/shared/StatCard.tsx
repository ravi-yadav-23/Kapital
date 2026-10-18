'use client'

import React, { ReactNode } from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | ReactNode
  subtitle?: string
  icon?: ReactNode
  delta?: {
    value: string
    isPositive: boolean
    label?: string
  }
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  className?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  delta,
  action,
  className = '',
}: StatCardProps) {
  return (
    <div className={`card flex flex-col justify-between relative overflow-hidden group hover:border-brand-from/40 transition-all duration-300 ${className}`}>
      {/* Background glow on hover */}
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-brand-from/5 rounded-full blur-2xl group-hover:bg-brand-from/10 transition-all duration-500 pointer-events-none" />

      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="stat-label">{title}</span>
        {icon && <div className="p-2 rounded-lg bg-surface-elevated text-text-accent">{icon}</div>}
      </div>

      <div className="flex flex-col gap-1">
        <div className="stat-value">{value}</div>
        {(delta || subtitle) && (
          <div className="flex items-center gap-2 mt-1">
            {delta && (
              <span className={`stat-delta ${delta.isPositive ? 'up' : 'down'}`}>
                {delta.isPositive ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {delta.value}
              </span>
            )}
            {subtitle && <span className="text-2xs text-text-muted">{subtitle}</span>}
          </div>
        )}
        {action && (
          <div className="mt-2 pt-2 border-t border-border-subtle/60">
            {action.href ? (
              <a
                href={action.href}
                className="text-xs font-semibold text-brand-from hover:text-brand-to inline-flex items-center gap-1 transition"
              >
                <span>{action.label}</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className="text-xs font-semibold text-brand-from hover:text-brand-to inline-flex items-center gap-1 transition cursor-pointer"
              >
                <span>{action.label}</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
