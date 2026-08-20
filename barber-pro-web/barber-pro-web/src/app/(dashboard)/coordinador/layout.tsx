import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function CoordinadorLayout({
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

  // Solo admin y coordinador pueden acceder
  if (profile?.role !== 'coordinador' && profile?.role !== 'admin') {
    redirect('/')
  }

  return <>{children}</>
}
