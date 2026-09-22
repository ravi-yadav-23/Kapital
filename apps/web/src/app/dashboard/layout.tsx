import React, { ReactNode } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

export default function Layout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>
}
