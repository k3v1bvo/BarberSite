'use client'

import { ReactNode } from 'react'
import { SidebarProvider } from '@/components/providers/SidebarProvider'
import { Sidebar } from '@/components/ui/Sidebar'
import { Navbar } from '@/components/ui/Navbar'
import { DashboardContent } from '@/components/ui/DashboardContent'

interface DashboardClientProps {
  children: ReactNode
  role?: string
  userId: string
}

export function DashboardClient({
  children,
  role,
  userId,
}: DashboardClientProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-zinc-950">
        {/* Sidebar for Desktop + Mobile overlay */}
        <Sidebar role={role} userId={userId} />

        {/* Content area with responsive margin */}
        <DashboardContent>
          {/* Navbar acting as Header & Mobile Nav */}
          <Navbar />

          <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </DashboardContent>
      </div>
    </SidebarProvider>
  )
}
