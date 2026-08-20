import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { error: e1 } = await supabase
    .from('notificaciones')
    .update({ leido: true })
    .eq('user_id', user.id)
    .eq('leido', false)

  const { error: e2 } = await supabase
    .from('notificaciones')
    .update({ leido: true })
    .eq('rol_destino', profile?.role || '')
    .eq('leido', false)

  if (e1 || e2) {
    return NextResponse.json({ error: e1?.message || e2?.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
