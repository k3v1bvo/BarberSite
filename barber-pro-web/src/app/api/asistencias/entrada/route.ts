import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { computeEstadoFromRecord } from '@/lib/asistencia/helpers'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const hoy = new Date().toISOString().split('T')[0]
    const entrada = new Date()
    const dayOfWeek = entrada.getDay()
    
    // 1. Fetch configuraciones and plan_cuentas and horario
    const [configRes, cuentasRes, horarioRes] = await Promise.all([
      supabase.from('configuraciones').select('valor').eq('llave', 'asistencia_config').single(),
      supabase.from('plan_cuentas').select('detalle').eq('es_sancion', true),
      supabase.from('barbero_horario_semanal')
        .select('hora_inicio')
        .eq('barbero_id', user.id)
        .eq('dia_semana', dayOfWeek)
        .eq('activo', true)
        .single()
    ])

    const toleranciaMinutos = configRes.data?.valor?.tolerancia_minutos ?? 15
    const cuentasSancion = cuentasRes.data ?? []
    let tipoSancion = 'llegada_tarde'
    if (cuentasSancion.length > 0) {
      const match = cuentasSancion.find(c => c.detalle.toLowerCase().includes('tarde'))
      tipoSancion = match ? match.detalle : cuentasSancion[0].detalle
    }

    let estadoFinal = 'presente'
    let minutosAtraso = 0
    let turnoInicioStr = ''

    if (horarioRes.data && horarioRes.data.hora_inicio) {
      turnoInicioStr = horarioRes.data.hora_inicio
      const [startHour, startMinute] = turnoInicioStr.split(':').map(Number)
      const currentHour = entrada.getHours()
      const currentMinute = entrada.getMinutes()
      
      const currentTimeInMins = currentHour * 60 + currentMinute
      const startTimeInMins = startHour * 60 + startMinute
      
      if (currentTimeInMins > startTimeInMins + toleranciaMinutos) {
        estadoFinal = 'atrasado'
        minutosAtraso = currentTimeInMins - startTimeInMins
      }
    } else {
      // Fallback a lógica global si no tiene horario asignado hoy
      const estadoInicial = computeEstadoFromRecord({
        hora_entrada: entrada.toISOString(),
        hora_salida: null,
      })
      if (estadoInicial === 'atrasado') estadoFinal = 'atrasado'
    }

    const { data, error } = await supabase
      .from('asistencias')
      .insert({
        profile_id: user.id,
        fecha: hoy,
        hora_entrada: entrada.toISOString(),
        estado: estadoFinal,
      })
      .select()
      .single()

    if (error) throw error

    // Si está atrasado, generar sanción automática
    if (estadoFinal === 'atrasado') {
      const desc = minutosAtraso > 0 
        ? `Llegada tarde (${minutosAtraso} min de retraso. Turno: ${turnoInicioStr})`
        : 'Llegada tarde registrada automáticamente por el sistema'
        
      await supabase.from('sanciones').insert({
        barbero_id: user.id,
        tipo: tipoSancion,
        descripcion: desc,
        monto: 12, // Default, editable en config o manual
        estado: 'pendiente'
      })
    }

    return NextResponse.json({ registro: data, estadoInicial: estadoFinal })
  } catch (err) {
    console.error('POST asistencias/entrada:', err)
    return NextResponse.json({ error: 'Error interno al registrar entrada' }, { status: 500 })
  }
}
