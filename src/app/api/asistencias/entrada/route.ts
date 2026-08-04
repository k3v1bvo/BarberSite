import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { computeEstadoFromRecord, getBusinessDateString } from '@/lib/asistencia/helpers'

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

    // Prevenir doble marcación
    const { data: existente } = await supabase
      .from('asistencias')
      .select('id')
      .eq('profile_id', user.id)
      .eq('fecha', hoy)
      .maybeSingle()

    if (existente) {
      return NextResponse.json({ error: 'Ya marcaste tu entrada hoy' }, { status: 409 })
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

    // Validar geolocalización si está configurada
    const { data: ubicacionConfig } = await supabase
      .from('configuraciones')
      .select('valor')
      .eq('llave', 'ubicacion_negocio')
      .maybeSingle()

    const ubicacion = ubicacionConfig?.valor as { lat?: number; lng?: number; radio_metros?: number; activa?: boolean } | null

    if (ubicacion?.activa && lat != null && lng != null) {
      const distancia = haversineDistance(lat, lng, ubicacion.lat!, ubicacion.lng!)
      const radioMax = ubicacion.radio_metros ?? 200

      if (distancia > radioMax) {
        return NextResponse.json(
          { error: `Estás fuera del rango permitido (${Math.round(distancia)}m). Debes estar a menos de ${radioMax}m de la barbería.` },
          { status: 403 }
        )
      }
    }

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

    const requiereFoto = configRes.data?.valor?.requiere_foto ?? false
    if (requiereFoto && !selfie_url) {
      return NextResponse.json({ error: 'La foto/selfie de entrada es obligatoria según la configuración del local.' }, { status: 400 })
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
        lat,
        lng,
        selfie_url,
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
