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
    const supabase = await createServerSupabaseClient()
    const { id: barberoId } = await context.params

    const [dbRes, cfgRes] = await Promise.all([
      supabase
        .from('barbero_horario_semanal')
        .select('*')
        .eq('barbero_id', barberoId)
        .order('dia_semana', { ascending: true }),
      supabase
        .from('configuraciones')
        .select('valor')
        .eq('llave', `horario_fraccionado_${barberoId}`)
        .maybeSingle()
    ])

    const { data, error } = dbRes
    const cfgHorario = cfgRes.data?.valor?.horario as Array<any> | undefined

    if (error && error.code !== '42P01') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const baseHorario = data?.length ? data : DIAS.map((_, i) => ({
      barbero_id: barberoId,
      dia_semana: i,
      hora_inicio: '09:00',
      hora_fin: '20:00',
      activo: i !== 0,
    }))

    // Combinar con la configuración de turnos fraccionados
    const merged = baseHorario.map((d: any) => {
      const cfgDay = cfgHorario?.find((c: any) => Number(c.dia_semana) === Number(d.dia_semana))
      const hasDbT2 = Boolean(d.hora_inicio_2 && d.hora_fin_2)
      const hasCfgT2 = Boolean(cfgDay?.fraccionado && cfgDay?.hora_inicio_2 && cfgDay?.hora_fin_2)

      const fraccionado = hasDbT2 || hasCfgT2
      const hora_inicio_2 = d.hora_inicio_2 || cfgDay?.hora_inicio_2 || '17:00'
      const hora_fin_2 = d.hora_fin_2 || cfgDay?.hora_fin_2 || '21:00'

      return {
        ...d,
        hora_inicio: d.hora_inicio?.slice(0, 5) || '09:00',
        hora_fin: d.hora_fin?.slice(0, 5) || '20:00',
        fraccionado,
        hora_inicio_2: hora_inicio_2?.slice(0, 5) || '17:00',
        hora_fin_2: hora_fin_2?.slice(0, 5) || '21:00',
      }
    })

    return NextResponse.json({ horario: merged })
  } catch (err) {
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

    // Usar adminClient para bypasear RLS cuando es admin/coordinador
    const dbWrite = isAdminOrCoord ? await createServerAdminClient() : supabase

    for (const row of horario) {
      const payloadConT2: any = {
        barbero_id: barberoId,
        dia_semana: row.dia_semana,
        hora_inicio: row.hora_inicio,
        hora_fin: row.hora_fin,
        activo: row.activo,
        hora_inicio_2: row.fraccionado ? (row.hora_inicio_2 || null) : null,
        hora_fin_2: row.fraccionado ? (row.hora_fin_2 || null) : null,
      }

      // Intentar primero con las columnas de turno 2
      const { error: upsertErr } = await dbWrite
        .from('barbero_horario_semanal')
        .upsert(payloadConT2, { onConflict: 'barbero_id,dia_semana' })

      if (upsertErr) {
        // Si las columnas aún no existen en la base de datos (código 42703), upsert base
        if (upsertErr.code === '42703') {
          const { error: fallbackErr } = await dbWrite.from('barbero_horario_semanal').upsert(
            {
              barbero_id: barberoId,
              dia_semana: row.dia_semana,
              hora_inicio: row.hora_inicio,
              hora_fin: row.hora_fin,
              activo: row.activo,
            },
            { onConflict: 'barbero_id,dia_semana' }
          )
          if (fallbackErr) {
            console.error(`[horario-laboral] Error fallback dia ${row.dia_semana}:`, fallbackErr.message)
          }
        } else {
          console.error(`[horario-laboral] Error upsert dia ${row.dia_semana}:`, upsertErr.message)
        }
      }
    }

    // Persistir siempre la configuración completa de turnos fraccionados en configuraciones para máxima resiliencia
    try {
      await dbWrite.from('configuraciones').upsert({
        llave: `horario_fraccionado_${barberoId}`,
        valor: {
          barbero_id: barberoId,
          updated_at: new Date().toISOString(),
          horario: horario.map((h: any) => ({
            dia_semana: h.dia_semana,
            activo: h.activo,
            hora_inicio: h.hora_inicio,
            hora_fin: h.hora_fin,
            fraccionado: Boolean(h.fraccionado),
            hora_inicio_2: h.fraccionado ? h.hora_inicio_2 : null,
            hora_fin_2: h.fraccionado ? h.hora_fin_2 : null,
          }))
        },
        descripcion: `Configuración de horarios fraccionados para barbero ${barberoId}`
      }, { onConflict: 'llave' })
    } catch (e: any) {
      console.error('[horario-laboral] Error guardando configuraciones:', e.message)
    }

    const db = getNotificationDbClient(supabase)
    await dispatchNotification(db, {
      event: 'horario_cambio',
      payload: { barberoId },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[horario-laboral] Error interno:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
