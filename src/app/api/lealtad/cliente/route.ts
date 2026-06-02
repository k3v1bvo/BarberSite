import { createServerSupabaseClient } from '@/lib/supabase/server'
import { calcularDescuentoLealtad, getProgresoLealtad, type LealtadMeta } from '@/lib/lealtad/helpers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const clienteId = request.nextUrl.searchParams.get('cliente_id') || user.id
  const precio = parseFloat(request.nextUrl.searchParams.get('precio') || '0')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (clienteId !== user.id && profile?.role !== 'admin' && profile?.role !== 'recepcionista') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const [{ data: cliente }, { data: metas }, { data: canjes }] = await Promise.all([
    supabase.from('clientes').select('total_visitas, total_gastado, ultima_visita, nombre').eq('id', clienteId).single(),
    supabase.from('lealtad_metas').select('*').eq('is_active', true).order('visitas_requeridas', { ascending: true }),
    supabase
      .from('lealtad_canjes')
      .select('*, lealtad_metas(nombre)')
      .eq('cliente_id', clienteId)
      .order('canjeado_at', { ascending: false })
      .limit(20),
  ])

  const visitas = cliente?.total_visitas ?? 0
  const metasList = (metas ?? []) as LealtadMeta[]
  const progreso = getProgresoLealtad(visitas, metasList)
  const descuento = precio > 0 ? calcularDescuentoLealtad(visitas, metasList, precio) : null

  const { count: citasCompletadas } = await supabase
    .from('citas')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .eq('estado', 'completado')

  return NextResponse.json({
    cliente: cliente ?? { total_visitas: 0, total_gastado: 0 },
    progreso,
    descuento,
    canjes: canjes ?? [],
    total_servicios: citasCompletadas ?? visitas,
    metas: metasList,
  })
}
