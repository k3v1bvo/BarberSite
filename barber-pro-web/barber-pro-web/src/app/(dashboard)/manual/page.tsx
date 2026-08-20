import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ManualInteractivo } from '@/components/manual/ManualInteractivo'

export default async function ManualPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'cliente') as 'admin' | 'coordinador' | 'barbero' | 'cliente'

  return (
    <div className="w-full">
      <ManualInteractivo userRole={role} />
    </div>
  )
}
