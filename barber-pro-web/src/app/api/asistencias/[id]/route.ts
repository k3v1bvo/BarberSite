import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { isAfterAutoCloseHour, getBoliviaDayOfWeek, getBoliviaTime } from '@/lib/asistencia/helpers'

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

    const { data, error } = await supabase
      .from('asistencias')
      .update({
        hora_salida: now.toISOString(),
        horas_trabajadas: Number(horas.toFixed(2)),
        estado: 'finalizado',
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    try {
      // Check for early departure (Salida temprano) — usar hora Bolivia
      const dayOfWeek = getBoliviaDayOfWeek()
      const { data: horario } = await supabase
        .from('barbero_horario_semanal')
        .select('hora_fin')
        .eq('barbero_id', user.id)
        .eq('dia_semana', dayOfWeek)
        .eq('activo', true)
        .single()

      if (horario && horario.hora_fin) {
        const bTime = getBoliviaTime()
        const currentHour = bTime.getUTCHours()
        const currentMinute = bTime.getUTCMinutes()
        const [endHour, endMinute] = horario.hora_fin.split(':').map(Number)
        
        const currentTime = currentHour * 60 + currentMinute
        const endTime = endHour * 60 + endMinute
        
        if (currentTime < endTime - 15) { // 15 minutes grace period
          // Fetch configuraciones and plan_cuentas for sanction type
          const { data: cuentasSancion } = await supabase.from('plan_cuentas').select('detalle').eq('es_sancion', true)
          let tipoSancion = 'salida_temprano'
          if (cuentasSancion && cuentasSancion.length > 0) {
            const match = cuentasSancion.find((c: any) => c.detalle.toLowerCase().includes('salida') || c.detalle.toLowerCase().includes('temprano'))
            tipoSancion = match ? match.detalle : cuentasSancion[0].detalle
          }

          await supabase.from('sanciones').insert({
            barbero_id: user.id,
            tipo: tipoSancion,
            descripcion: `Salida temprano (Salió a las ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}, turno hasta ${horario.hora_fin})`,
            monto: 12, // 30% of 40Bs
            estado: 'pendiente'
          })
        }
      }
    } catch (e) {
      console.error('Error evaluating early departure sanction', e)
    }

    return NextResponse.json({ registro: data })
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
