'use client'

import React from 'react'
import { IpoScheduleEvent } from '@/types'
import { formatDate } from '@/lib/formatters'
import { Calendar, Clock, CheckCircle2 } from 'lucide-react'

interface IpoScheduleProps {
  schedule?: IpoScheduleEvent[]
}

export function IpoSchedule({ schedule = [] }: IpoScheduleProps) {
  if (!schedule || schedule.length === 0) {
    return (
      <div className="card p-4 text-center text-text-muted text-xs">
        No schedule timeline available.
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
        <Calendar className="w-4 h-4 text-brand-from" />
        <span>Issue Lifecycle Schedule</span>
      </div>

      <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-border-default">
        {schedule.map((item, index) => {
          const isPassed = item.date < today
          const isToday = item.date === today

          return (
            <div key={index} className="relative flex items-start justify-between gap-3 text-xs">
              {/* Dot on timeline */}
              <div
                className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full border-2 border-surface-card ${
                  isPassed
                    ? 'bg-accent-green'
                    : isToday
                    ? 'bg-accent-amber animate-ping'
                    : 'bg-border-strong'
                }`}
              />

              <div className="min-w-0 pr-2">
                <span
                  className={`block leading-snug ${
                    isToday
                      ? 'font-bold text-accent-amber'
                      : isPassed
                      ? 'text-text-muted line-through'
                      : 'text-text-primary font-medium'
                  }`}
                >
                  {item.event}
                </span>
                {isToday && (
                  <span className="text-[10px] uppercase tracking-wider font-bold text-accent-amber font-mono">
                    Happening Today
                  </span>
                )}
              </div>

              <span
                className={`font-mono text-2xs flex-shrink-0 ${
                  isToday
                    ? 'font-bold text-accent-amber'
                    : isPassed
                    ? 'text-text-muted'
                    : 'text-text-secondary'
                }`}
              >
                {formatDate(item.date)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
