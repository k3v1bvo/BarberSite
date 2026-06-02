import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { isAfterAutoCloseHour, getHorarioEsperadoSalida } from '@/lib/asistencia/helpers'
import { calcularHorasExtras } from '@/lib/horarios/helpers'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Solo el administrador puede editar registros manualmente' },
        { status: 403 }
      )
    }

    const { id } = await context.params
    const body = await request.json()
    const { hora_entrada, hora_salida, notas } = body

    const { data: existing } = await supabase
      .from('asistencias')
      .select('*')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
    }

    const entrada = hora_entrada ? new Date(hora_entrada) : new Date(existing.hora_entrada)
    const salida = hora_salida
      ? new Date(hora_salida)
      : existing.hora_salida
        ? new Date(existing.hora_salida)
        : null

    let horas_trabajadas = existing.horas_trabajadas
    if (salida) {
      horas_trabajadas = Number(
        ((salida.getTime() - entrada.getTime()) / (1000 * 60 * 60)).toFixed(2)
      )
    }

    const { data, error } = await supabase
      .from('asistencias')
      .update({
        hora_entrada: entrada.toISOString(),
        hora_salida: salida?.toISOString() || null,
        horas_trabajadas,
        notas: notas ?? existing.notas,
        estado: salida ? 'finalizado' : existing.estado,
        editado_admin: true,
        cierre_automatico: existing.cierre_automatico,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ registro: data })
  } catch (err) {
    console.error('PATCH asistencia:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/** Empleado marca salida (bloqueado si ya pasó cierre automático del día) */
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

    const { id } = await context.params

    const { data: reg } = await supabase
      .from('asistencias')
      .select('*')
      .eq('id', id)
      .eq('profile_id', user.id)
      .single()

    if (!reg) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
    }

    if (reg.cierre_automatico) {
      return NextResponse.json(
        {
          error:
            'Este turno fue cerrado automáticamente a las 22:00. Contacta al administrador para correcciones.',
        },
        { status: 403 }
      )
    }

    if (isAfterAutoCloseHour() && !reg.hora_salida) {
      return NextResponse.json(
        {
          error:
            'Después de las 22:00 solo el administrador puede modificar la asistencia.',
        },
        { status: 403 }
      )
    }

    const now = new Date()
    const entrada = new Date(reg.hora_entrada)
    const horas = (now.getTime() - entrada.getTime()) / (1000 * 60 * 60)
    const horaFin = await getHorarioEsperadoSalida(supabase, user.id, reg.fecha)
    const horasExtras = calcularHorasExtras(now.toISOString(), horaFin)

    const { data, error } = await supabase
      .from('asistencias')
      .update({
        hora_salida: now.toISOString(),
        horas_trabajadas: Number(horas.toFixed(2)),
        horas_extras: horasExtras,
        estado: 'finalizado',
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ registro: data })
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
