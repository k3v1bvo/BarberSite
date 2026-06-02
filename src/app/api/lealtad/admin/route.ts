import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Solo administradores' }, { status: 403 }) }
  }
  return { user }
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth && auth.error) return auth.error

  const filtro = request.nextUrl.searchParams.get('filtro') || ''
  const metaId = request.nextUrl.searchParams.get('meta_id')

  let query = supabase
    .from('clientes')
    .select('id, nombre, telefono, email, total_visitas, total_gastado, ultima_visita')
    .order('total_visitas', { ascending: false })
    .limit(100)

  if (filtro) {
    query = query.or(`nombre.ilike.%${filtro}%,telefono.ilike.%${filtro}%,email.ilike.%${filtro}%`)
  }

  const { data: clientes, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: metas } = await supabase.from('lealtad_metas').select('*').order('visitas_requeridas')

  let filtered = clientes ?? []
  if (metaId && metas) {
    const meta = metas.find((m) => m.id === metaId)
    if (meta) {
      filtered = filtered.filter((c) => (c.total_visitas ?? 0) >= meta.visitas_requeridas)
    }
  }

  const { data: canjesRecientes } = await supabase
    .from('lealtad_canjes')
    .select('*, clientes(nombre), lealtad_metas(nombre)')
    .order('canjeado_at', { ascending: false })
    .limit(30)

  return NextResponse.json({
    clientes: filtered,
    metas: metas ?? [],
    canjes: canjesRecientes ?? [],
  })
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth && auth.error) return auth.error

  const body = await request.json()
  const { accion, cliente_id, visitas_delta, visitas_total, descripcion, meta_id } = body

  if (accion === 'ajustar_visitas') {
    const { data: actual } = await supabase.from('clientes').select('total_visitas').eq('id', cliente_id).single()
    const nuevoTotal =
      visitas_total != null
        ? visitas_total
        : Math.max(0, (actual?.total_visitas ?? 0) + (visitas_delta ?? 0))

    const { error } = await supabase.from('clientes').update({ total_visitas: nuevoTotal }).eq('id', cliente_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ total_visitas: nuevoTotal })
  }

  if (accion === 'otorgar_recompensa') {
    const { error } = await supabase.from('lealtad_canjes').insert({
      cliente_id,
      meta_id: meta_id || null,
      descripcion: descripcion || 'Recompensa otorgada manualmente',
      otorgado_por: auth.user!.id,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
