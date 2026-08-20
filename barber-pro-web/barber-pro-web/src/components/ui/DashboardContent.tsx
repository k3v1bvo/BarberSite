'use client'

import { useSidebar } from '@/components/providers/SidebarProvider'
import { cn } from '@/lib/utils'

/**
 * Client wrapper that adjusts its left margin / width
 * based on whether the sidebar is collapsed or expanded.
 */
export function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()

  return (
    <div
      className={cn(
        'dashboard-content-area',
        collapsed
          ? 'dashboard-content-area--collapsed'
          : 'dashboard-content-area--expanded'
      )}
    >
      {children}
    </div>
  )
}
