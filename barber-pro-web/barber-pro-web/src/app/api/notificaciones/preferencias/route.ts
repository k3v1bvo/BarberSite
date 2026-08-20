import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { DEFAULT_PREFERENCES } from '@/lib/notifications/types'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data } = await supabase
    .from('notificacion_preferencias')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    preferencias: data || { user_id: user.id, ...DEFAULT_PREFERENCES },
  })
}

export async function PUT(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const row = {
    user_id: user.id,
    email_reservas: !!body.email_reservas,
    email_ventas: !!body.email_ventas,
    email_recordatorios: !!body.email_recordatorios,
    email_alertas: !!body.email_alertas,
    push_reservas: !!body.push_reservas,
    push_ventas: !!body.push_ventas,
    push_recordatorios: !!body.push_recordatorios,
    push_alertas: !!body.push_alertas,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('notificacion_preferencias')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ preferencias: data })
}
