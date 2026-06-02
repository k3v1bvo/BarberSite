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
        'flex-1 flex flex-col min-w-0 transition-all duration-300',
        collapsed
          ? 'lg:ml-20'
          : 'lg:ml-64'
      )}
    >
      {children}
    </div>
  )
}
