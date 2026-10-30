import { createServerSupabaseClient, createServerAdminClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { NextRequest, NextResponse } from 'next/server'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminSupabase = await createServerAdminClient()
    const { id: barberoId } = await context.params

    const [dbRes, cfgRes] = await Promise.all([
      adminSupabase
        .from('barbero_horario_semanal')
        .select('*')
        .eq('barbero_id', barberoId)
        .order('dia_semana', { ascending: true }),
      adminSupabase
        .from('configuraciones')
        .select('valor')
        .eq('llave', `horario_fraccionado_${barberoId}`)
        .maybeSingle()
    ])

    const data = dbRes.data || []
    const cfgHorario = cfgRes.data?.valor?.horario as Array<any> | undefined

    const merged = DIAS.map((nombre, i) => {
      const dbDay = data.find((d: any) => Number(d.dia_semana) === i)
      const cfgDay = cfgHorario?.find((c: any) => Number(c.dia_semana) === i)

      const hasDbT2 = Boolean(dbDay?.hora_inicio_2 && dbDay?.hora_fin_2)
      const hasCfgT2 = Boolean(cfgDay?.fraccionado && cfgDay?.hora_inicio_2 && cfgDay?.hora_fin_2)
      const fraccionado = hasDbT2 || hasCfgT2

      const activo = cfgDay?.activo !== undefined 
        ? Boolean(cfgDay.activo) 
        : (dbDay?.activo !== undefined ? Boolean(dbDay.activo) : i !== 0)

      const hora_inicio = (cfgDay?.hora_inicio || dbDay?.hora_inicio || '09:00').slice(0, 5)
      const hora_fin = (cfgDay?.hora_fin || dbDay?.hora_fin || '20:00').slice(0, 5)
      const hora_inicio_2 = (cfgDay?.hora_inicio_2 || dbDay?.hora_inicio_2 || '16:00').slice(0, 5)
      const hora_fin_2 = (cfgDay?.hora_fin_2 || dbDay?.hora_fin_2 || '20:30').slice(0, 5)

      return {
        barbero_id: barberoId,
        dia_semana: i,
        nombre,
        activo,
        hora_inicio,
        hora_fin,
        fraccionado,
        hora_inicio_2,
        hora_fin_2,
      }
    })

    return NextResponse.json({ horario: merged })
  } catch (err: any) {
    console.error('[horario-laboral GET] Error:', err?.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(
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

    const isAdminOrCoord = profile?.role === 'admin' || profile?.role === 'coordinador'
    if (!isAdminOrCoord && user.id !== barberoId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { horario } = await request.json()
    if (!Array.isArray(horario)) {
      return NextResponse.json({ error: 'Formato de horario inválido' }, { status: 400 })
    }

    // Usar adminClient para bypasear RLS y asegurar escritura garantizada
    const dbWrite = await createServerAdminClient()

    for (const row of horario) {
      const diaNum = Number(row.dia_semana)
      const hIni = (row.hora_inicio || '09:00').slice(0, 5)
      const hFin = (row.hora_fin || '20:00').slice(0, 5)
      const isActivo = Boolean(row.activo)

      const payloadBase = {
        barbero_id: barberoId,
        dia_semana: diaNum,
        hora_inicio: hIni,
        hora_fin: hFin,
        activo: isActivo,
        tipo_horario: 'personalizado',
      }

      const { error: baseErr } = await dbWrite
        .from('barbero_horario_semanal')
        .upsert(payloadBase, { onConflict: 'barbero_id,dia_semana' })

      if (baseErr) {
        console.error(`[horario-laboral PUT] Error guardando día ${diaNum}:`, baseErr.message)
        throw new Error(`Error al guardar día ${diaNum}: ${baseErr.message}`)
      }
    }

    // Persistir siempre la configuración completa en configuraciones para máxima resiliencia
    const sanitizedConfig = horario.map((h: any) => ({
      dia_semana: Number(h.dia_semana),
      activo: Boolean(h.activo),
      hora_inicio: (h.hora_inicio || '09:00').slice(0, 5),
      hora_fin: (h.hora_fin || '20:00').slice(0, 5),
      fraccionado: Boolean(h.fraccionado),
      hora_inicio_2: h.fraccionado && h.hora_inicio_2 ? h.hora_inicio_2.slice(0, 5) : null,
      hora_fin_2: h.fraccionado && h.hora_fin_2 ? h.hora_fin_2.slice(0, 5) : null,
    }))

    try {
      await dbWrite.from('configuraciones').upsert({
        llave: `horario_fraccionado_${barberoId}`,
        valor: {
          barbero_id: barberoId,
          updated_at: new Date().toISOString(),
          horario: sanitizedConfig
        },
        descripcion: `Configuración de horarios fraccionados para barbero ${barberoId}`
      }, { onConflict: 'llave' })
    } catch (e: any) {
      console.error('[horario-laboral] Error guardando configuraciones:', e.message)
    }

    try {
      const db = getNotificationDbClient(supabase)
      await dispatchNotification(db, {
        event: 'horario_cambio',
        payload: { barberoId },
      })
    } catch (notifErr: any) {
      console.warn('[horario-laboral] No se pudo enviar notificación de horario:', notifErr?.message)
    }

    return NextResponse.json({ ok: true, horario: sanitizedConfig })
  } catch (err: any) {
    console.error('[horario-laboral PUT] Error interno:', err?.message)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}
