import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET  — Obtener config de comisión de un barbero
// POST — Guardar config completa (horario semanal + servicios por categoría)

interface HorarioItem {
  dia_semana: number
  categoria_id: string
  tiene_herramientas: boolean
}

interface ServicioComision {
  servicio_id: string
  categoria_id: string
  comision_tipo_con: string
  comision_valor_con: number
  comision_tipo_sin: string
  comision_valor_sin: number
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(req.url)
    const barbero_id = searchParams.get('barbero_id')

    if (!barbero_id) return NextResponse.json({ error: 'barbero_id requerido' }, { status: 400 })

    // 1. Obtener horario semanal (silenciar error si la tabla aún no existe)
    let horario: any[] = []
    try {
      const { data: hData } = await supabase
        .from('comision_barbero_horario')
        .select('*, categoria:comision_categorias(id, nombre, requiere_herramientas)')
        .eq('barbero_id', barbero_id)
        .order('dia_semana', { ascending: true })
      if (hData) horario = hData
    } catch (_) {}

    // 2. Obtener comisiones por servicio (silenciar error si la tabla aún no existe)
    let servicios: any[] = []
    try {
      const { data: sData } = await supabase
        .from('comision_barbero_servicios')
        .select('*, servicio:servicios(id, nombre, precio, is_active), categoria:comision_categorias(id, nombre)')
        .eq('barbero_id', barbero_id)
      if (sData) servicios = sData
    } catch (_) {}

    // 3. Obtener categorías activas (con fallback a categorías estándar)
    let categorias: any[] = []
    try {
      const { data: cData } = await supabase
        .from('comision_categorias')
        .select('*')
        .eq('is_active', true)
        .order('orden', { ascending: true })
      if (cData && cData.length > 0) {
        categorias = cData
      }
    } catch (_) {}

    // Fallback de categorías estándar si la tabla aún no existe o está vacía
    if (categorias.length === 0) {
      categorias = [
        { id: 'cat-8h', nombre: '8 Horas', descripcion: 'Turno de 8 horas estándar', requiere_herramientas: false, is_active: true, orden: 1 },
        { id: 'cat-comp', nombre: 'Completo', descripcion: 'Horario completo del día', requiere_herramientas: false, is_active: true, orden: 2 },
        { id: 'cat-plus', nombre: 'Plus', descripcion: 'Horario plus extendido', requiere_herramientas: false, is_active: true, orden: 3 },
        { id: 'cat-dom', nombre: 'Domingo o Feriado', descripcion: 'Domingos y días feriados', requiere_herramientas: true, is_active: true, orden: 4 },
        { id: 'cat-dom-plus', nombre: 'Domingo o Feriado Plus', descripcion: 'Domingos y feriados plus', requiere_herramientas: true, is_active: true, orden: 5 },
      ]
    }

    // 4. Obtener todos los servicios activos
    const { data: todosServicios } = await supabase
      .from('servicios')
      .select('id, nombre, precio, categoria, is_active')
      .eq('is_active', true)
      .order('nombre', { ascending: true })

    return NextResponse.json({
      horario: horario || [],
      servicios_comision: servicios || [],
      categorias: categorias || [],
      todos_servicios: todosServicios || [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json()
    const { barbero_id, horario, servicios } = body as {
      barbero_id: string
      horario: HorarioItem[]
      servicios: ServicioComision[]
    }

    if (!barbero_id) return NextResponse.json({ error: 'barbero_id requerido' }, { status: 400 })

    // ── 1. Guardar horario semanal ──
    if (horario && horario.length > 0) {
      await supabase
        .from('comision_barbero_horario')
        .delete()
        .eq('barbero_id', barbero_id)

      const horarioRows = horario.map(h => ({
        barbero_id,
        dia_semana: h.dia_semana,
        categoria_id: h.categoria_id,
        tiene_herramientas: h.tiene_herramientas,
      }))

      const { error: hInsErr } = await supabase
        .from('comision_barbero_horario')
        .insert(horarioRows)

      if (hInsErr) {
        if (hInsErr.message?.includes('does not exist')) {
          return NextResponse.json({
            error: 'Las tablas de comisiones aún no han sido creadas en Supabase. Ejecuta el archivo supabase_comisiones_barbero.sql en el SQL Editor de Supabase.'
          }, { status: 400 })
        }
        throw hInsErr
      }
    }

    // ── 2. Guardar comisiones por servicio ──
    if (servicios && servicios.length > 0) {
      await supabase
        .from('comision_barbero_servicios')
        .delete()
        .eq('barbero_id', barbero_id)

      const servicioRows = servicios.map(s => ({
        barbero_id,
        servicio_id: s.servicio_id,
        categoria_id: s.categoria_id,
        comision_tipo_con: s.comision_tipo_con || 'porcentaje',
        comision_valor_con: s.comision_valor_con || 0,
        comision_tipo_sin: s.comision_tipo_sin || 'porcentaje',
        comision_valor_sin: s.comision_valor_sin || 0,
      }))

      const { error: sInsErr } = await supabase
        .from('comision_barbero_servicios')
        .insert(servicioRows)

      if (sInsErr) {
        if (sInsErr.message?.includes('does not exist')) {
          return NextResponse.json({
            error: 'Las tablas de comisiones aún no han sido creadas en Supabase. Ejecuta el archivo supabase_comisiones_barbero.sql en el SQL Editor de Supabase.'
          }, { status: 400 })
        }
        throw sInsErr
      }
    } else {
      await supabase
        .from('comision_barbero_servicios')
        .delete()
        .eq('barbero_id', barbero_id)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
