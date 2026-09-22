'use client'

import React from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title: string
  message?: string
  icon?: React.ReactNode
}

export function EmptyState({ title, message, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center text-text-muted mb-3">
        {icon ?? <Inbox className="w-5 h-5" />}
      </div>
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {message && <p className="text-2xs text-text-muted mt-1 max-w-sm">{message}</p>}
    </div>
  )
}
