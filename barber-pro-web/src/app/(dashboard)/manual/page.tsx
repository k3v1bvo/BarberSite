import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ManualCliente } from '@/components/manual/ManualCliente'
import { ManualStaff } from '@/components/manual/ManualStaff'

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

  const role = profile?.role || 'cliente'

  return (
    <div className="w-full">
      {role === 'cliente' ? (
        <ManualCliente />
      ) : (
        <ManualStaff role={role as 'admin' | 'coordinador' | 'barbero'} />
      )}
    </div>
  )
}
