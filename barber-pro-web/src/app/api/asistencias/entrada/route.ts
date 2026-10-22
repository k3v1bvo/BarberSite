import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { computeEstadoFromRecord, getBusinessDateString, getBusinessNow } from '@/lib/asistencia/helpers'

// Fórmula Haversine para calcular distancia en metros entre dos coordenadas
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Radio de la Tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const hoy = getBusinessDateString()

    // Auto-cerrar turnos viejos sin salida de este barbero de días anteriores
    const { data: turnosViejos } = await supabase
      .from('asistencias')
      .select('id, fecha, hora_entrada')
      .eq('profile_id', user.id)
      .lt('fecha', hoy)
      .is('hora_salida', null)

    for (const viejo of turnosViejos || []) {
      const fechaVieja = viejo.fecha || hoy
      const cierreTs = `${fechaVieja}T22:00:00-04:00`
      const entradaT = new Date(viejo.hora_entrada)
      const salidaT = new Date(cierreTs)
      const horas = Math.max(0, (salidaT.getTime() - entradaT.getTime()) / (1000 * 60 * 60))

      await supabase
        .from('asistencias')
        .update({
          hora_salida: cierreTs,
          horas_trabajadas: Number(horas.toFixed(2)),
          estado: 'finalizado',
          cierre_automatico: true,
        })
        .eq('id', viejo.id)
    }

    // Prevenir doble marcación del turno actual
    const { data: existente } = await supabase
      .from('asistencias')
      .select('id, hora_salida, estado, notas, horas_trabajadas, hora_entrada')
      .eq('profile_id', user.id)
      .eq('fecha', hoy)
      .maybeSingle()

    if (existente && !existente.hora_salida) {
      return NextResponse.json({ error: 'Ya tienes un turno activo abierto hoy. Debes marcar salida antes de registrar un nuevo ingreso.' }, { status: 409 })
    }

    // Leer body con coordenadas y selfie
    let lat: number | null = null
    let lng: number | null = null
    let selfie_url: string | null = null

    try {
      const body = await request.json()
      lat = body.lat ?? null
      lng = body.lng ?? null
      selfie_url = body.selfie_url ?? null
    } catch {
      // Body vacío es válido (retrocompatibilidad)
    }

    // Validar geolocalización si está configurada en el negocio
    const { data: ubicacionConfig } = await supabase
      .from('configuraciones')
      .select('valor')
      .eq('llave', 'ubicacion_negocio')
      .maybeSingle()

    const ubicacion = ubicacionConfig?.valor as { lat?: number; lng?: number; radio_metros?: number; activa?: boolean } | null

    if (ubicacion?.activa) {
      if (lat == null || lng == null) {
        return NextResponse.json(
          { error: 'Debes activar tu ubicación (GPS) para verificar que estás dentro del local.' },
          { status: 403 }
        )
      }

      const distancia = haversineDistance(lat, lng, ubicacion.lat!, ubicacion.lng!)
      const radioMax = ubicacion.radio_metros ?? 200

      if (distancia > radioMax) {
        return NextResponse.json(
          { error: `Estás fuera del rango permitido (${Math.round(distancia)}m). Debes estar a menos de ${radioMax}m de la barbería para marcar entrada.` },
          { status: 403 }
        )
      }
    }

    const entradaUtc = new Date() // Real UTC timestamp for DB storage
    const entrada = getBusinessNow() // Bolivia local time for calculations
    const dayOfWeek = entrada.getUTCDay() // Day of week in Bolivia time
    
    // 1. Fetch configuraciones, plan_cuentas, horario y configuración de turnos fraccionados
    const [configRes, cuentasRes, horarioRes, configFraccionadoRes] = await Promise.all([
      supabase.from('configuraciones').select('valor').eq('llave', 'asistencia_config').single(),
      supabase.from('plan_cuentas').select('detalle').eq('es_sancion', true),
      supabase.from('barbero_horario_semanal')
        .select('*')
        .eq('barbero_id', user.id)
        .eq('dia_semana', dayOfWeek)
        .eq('activo', true)
        .maybeSingle(),
      supabase.from('configuraciones')
        .select('valor')
        .eq('llave', `horario_fraccionado_${user.id}`)
        .maybeSingle()
    ])

    const requiereFoto = configRes.data?.valor?.requiere_foto ?? true
    if (requiereFoto && !selfie_url) {
      return NextResponse.json({ error: 'La foto/selfie en vivo tomada por cámara es obligatoria para marcar entrada.' }, { status: 400 })
    }

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

    // Determinar si es segundo turno de un horario fraccionado
    const cfgList = configFraccionadoRes.data?.valor?.horario as any[] | undefined
    const cfgDay = cfgList?.find((c: any) => Number(c.dia_semana) === dayOfWeek)

    const tieneT2 = Boolean(horarioRes.data?.hora_inicio_2 || cfgDay?.hora_inicio_2)
    const esSegundoTurno = Boolean(existente && existente.hora_salida)

    if (esSegundoTurno && tieneT2) {
      turnoInicioStr = (horarioRes.data?.hora_inicio_2 || cfgDay?.hora_inicio_2 || '17:00').slice(0, 5)
    } else if (horarioRes.data?.hora_inicio || cfgDay?.hora_inicio) {
      turnoInicioStr = (horarioRes.data?.hora_inicio || cfgDay?.hora_inicio || '09:00').slice(0, 5)
    }

    if (turnoInicioStr) {
      const [startHour, startMinute] = turnoInicioStr.split(':').map(Number)
      const currentHour = entrada.getUTCHours()
      const currentMinute = entrada.getUTCMinutes()
      
      const currentTimeInMins = currentHour * 60 + currentMinute
      const startTimeInMins = startHour * 60 + startMinute
      
      if (currentTimeInMins > startTimeInMins + toleranciaMinutos) {
        estadoFinal = 'atrasado'
        minutosAtraso = currentTimeInMins - startTimeInMins
      }
    } else {
      // Fallback a lógica global si no tiene horario asignado hoy
      const estadoInicial = computeEstadoFromRecord({
        hora_entrada: entradaUtc.toISOString(),
        hora_salida: null,
      })
      if (estadoInicial === 'atrasado') estadoFinal = 'atrasado'
    }

    let data: any
    if (existente && existente.hora_salida) {
      // Re-apertura para segundo turno (horario fraccionado)
      const t1Entrada = new Date(existente.hora_entrada).toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit' })
      const t1Salida = new Date(existente.hora_salida).toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit' })
      const prevHoras = Number(existente.horas_trabajadas || 0)
      const logTurno1 = `[Turno 1: ${t1Entrada} a ${t1Salida} (${prevHoras.toFixed(2)}h)]`
      const notasAcumuladas = existente.notas ? `${existente.notas} | ${logTurno1}` : logTurno1

      const { data: updated, error: updError } = await supabase
        .from('asistencias')
        .update({
          hora_entrada: entradaUtc.toISOString(),
          hora_salida: null,
          horas_trabajadas: prevHoras,
          estado: estadoFinal,
          lat,
          lng,
          selfie_url,
          notas: notasAcumuladas,
          cierre_automatico: false,
        })
        .eq('id', existente.id)
        .select()
        .single()

      if (updError) throw updError
      data = updated
    } else {
      const { data: inserted, error: insError } = await supabase
        .from('asistencias')
        .insert({
          profile_id: user.id,
          fecha: hoy,
          hora_entrada: entradaUtc.toISOString(),
          estado: estadoFinal,
          lat,
          lng,
          selfie_url,
        })
        .select()
        .single()

      if (insError) throw insError
      data = inserted
    }

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

      // Enviar email al admin por atraso (fire-and-forget)
      try {
        const { sendEmail } = await import('@/lib/notifications/email')
        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('email')
          .eq('role', 'admin')
          .limit(1)
          .single()

        if (adminProfile?.email) {
          const { data: barberoProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()

          const nombre = barberoProfile?.full_name || 'Un barbero'
          await sendEmail({
            to: adminProfile.email,
            subject: `⚠️ Atraso: ${nombre} llegó tarde`,
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color: #f59e0b;">⚠️ Alerta de Atraso</h2>
                <p><strong>${nombre}</strong> marcó entrada con <strong>${minutosAtraso} minutos de retraso</strong>.</p>
                ${turnoInicioStr ? `<p>Horario programado: <strong>${turnoInicioStr}</strong></p>` : ''}
                <p>Se generó una sanción automática de <strong>Bs 12</strong>.</p>
                <p style="color: #888; font-size: 12px;">— Sistema BarberPro</p>
              </div>
            `,
          })
        }
      } catch (emailErr) {
        console.error('Error enviando email de atraso (no bloqueante):', emailErr)
      }
    }

    return NextResponse.json({ registro: data, estadoInicial: estadoFinal })
  } catch (err) {
    console.error('POST asistencias/entrada:', err)
    return NextResponse.json({ error: 'Error interno al registrar entrada' }, { status: 500 })
  }
}
