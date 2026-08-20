import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/ui/Sidebar'
import { Navbar } from '@/components/ui/Navbar'
import { SidebarProvider } from '@/components/providers/SidebarProvider'
import { DashboardContent } from '@/components/ui/DashboardContent'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-zinc-950">
        {/* Sidebar for Desktop + Mobile overlay */}
        <Sidebar role={profile?.role} userId={user.id} />

        {/* Content area with responsive margin */}
        <DashboardContent>
          {/* Navbar acting as Header & Mobile Nav */}
          <Navbar />

          <main className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </DashboardContent>
      </div>
    </SidebarProvider>
  )
}
