'use client'

import React, { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="main-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <main className="page-content animate-fade-in">{children}</main>
      </div>
    </div>
  )
}
