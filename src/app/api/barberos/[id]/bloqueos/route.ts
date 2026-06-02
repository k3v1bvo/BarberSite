import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id: barberoId } = await context.params
    const desde = request.nextUrl.searchParams.get('desde')
    const hasta = request.nextUrl.searchParams.get('hasta')

    let query = supabase
      .from('barbero_bloqueos')
      .select('*')
      .eq('barbero_id', barberoId)
      .order('fecha_inicio', { ascending: true })

    if (desde) query = query.gte('fecha_fin', desde)
    if (hasta) query = query.lte('fecha_inicio', hasta)

    const { data, error } = await query

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ bloqueos: [], aviso: 'Ejecuta supabase_calendario_asistencia.sql' })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ bloqueos: data || [] })
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id: barberoId } = await context.params
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const canEdit =
      profile?.role === 'admin' ||
      profile?.role === 'recepcionista' ||
      user.id === barberoId

    if (!canEdit) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { fecha_inicio, fecha_fin, tipo, motivo, todo_el_dia } = body

    const { data, error } = await supabase
      .from('barbero_bloqueos')
      .insert({
        barbero_id: barberoId,
        fecha_inicio,
        fecha_fin,
        tipo: tipo || 'bloqueo',
        motivo: motivo || null,
        todo_el_dia: todo_el_dia ?? false,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ bloqueo: data })
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const bloqueoId = request.nextUrl.searchParams.get('bloqueo_id')
    if (!bloqueoId) {
      return NextResponse.json({ error: 'bloqueo_id requerido' }, { status: 400 })
    }

    const { error } = await supabase.from('barbero_bloqueos').delete().eq('id', bloqueoId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
