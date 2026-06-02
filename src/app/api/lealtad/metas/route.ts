import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Solo administradores' }, { status: 403 }) }
  }
  return { user }
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('lealtad_metas')
    .select('*')
    .order('orden', { ascending: true })

  if (error?.code === '42P01') {
    return NextResponse.json({ metas: [], aviso: 'Ejecuta supabase_modulos_completos.sql' })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ metas: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth && auth.error) return auth.error

  const body = await request.json()
  const { data, error } = await supabase.from('lealtad_metas').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meta: data })
}

export async function PUT(request: Request) {
  const supabase = await createServerSupabaseClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth && auth.error) return auth.error

  const { id, ...updates } = await request.json()
  const { data, error } = await supabase.from('lealtad_metas').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meta: data })
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth && auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase.from('lealtad_metas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
