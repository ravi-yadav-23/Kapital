'use client'

import React from 'react'
import { CheckCircle2, AlertTriangle, Sparkles, RefreshCw, Activity } from 'lucide-react'

export interface ActivityItem {
  id: string
  title: string
  description: string
  timestamp: string
  type: 'allotment' | 'score' | 'funds' | 'alert'
  badge?: string
}

interface ActivityFeedProps {
  activities?: ActivityItem[]
}

export function ActivityFeed({ activities = [] }: ActivityFeedProps) {
  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'allotment':
        return <CheckCircle2 className="w-4 h-4 text-accent-green" />
      case 'score':
        return <Sparkles className="w-4 h-4 text-brand-from" />
      case 'alert':
        return <AlertTriangle className="w-4 h-4 text-accent-amber" />
      case 'funds':
        return <RefreshCw className="w-4 h-4 text-accent-cyan" />
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Recent Activity & Signals
        </h3>
        <span className="text-2xs text-text-muted">Live Stream</span>
      </div>

      {activities.length > 0 ? (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-2.5 rounded-lg bg-surface-elevated/50 hover:bg-surface-elevated transition-colors border border-border-subtle"
            >
              <div className="p-1.5 rounded-md bg-surface-card border border-border-subtle flex-shrink-0 mt-0.5">
                {getIcon(activity.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-text-primary truncate">
                    {activity.title}
                  </span>
                  {activity.badge && (
                    <span className="text-2xs font-mono font-bold px-1.5 py-0.2 rounded bg-accent-green/10 text-accent-green flex-shrink-0">
                      {activity.badge}
                    </span>
                  )}
                </div>

                <p className="text-2xs text-text-secondary mt-0.5 line-clamp-2">
                  {activity.description}
                </p>

                <span className="text-[10px] text-text-muted mt-1 block font-mono">
                  {activity.timestamp}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center rounded-xl bg-surface-elevated/40 border border-border-subtle flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-full bg-surface-card border border-border-subtle flex items-center justify-center text-text-muted mb-1">
            <Activity className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-text-primary">No Activity Yet</p>
          <p className="text-2xs text-text-muted max-w-xs">
            Live updates for staged orders, mandate approvals, AI scores, and allotment listing alerts will appear here in real-time.
          </p>
        </div>
      )}
    </div>
  )
}

