import { createServerSupabaseClient } from '@/lib/supabase/server'
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

    const { data, error } = await supabase
      .from('barbero_horario_semanal')
      .select('*')
      .eq('barbero_id', barberoId)
      .order('dia_semana', { ascending: true })

    if (error) {
      if (error.code === '42P01') {
        const defaultHorario = DIAS.map((_, i) => ({
          dia_semana: i,
          hora_inicio: '09:00',
          hora_fin: '20:00',
          activo: i !== 0,
        }))
        return NextResponse.json({ horario: defaultHorario, aviso: 'Ejecuta supabase_calendario_asistencia.sql' })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data?.length) {
      const defaultHorario = DIAS.map((_, i) => ({
        barbero_id: barberoId,
        dia_semana: i,
        hora_inicio: '09:00',
        hora_fin: '20:00',
        activo: i !== 0,
      }))
      return NextResponse.json({ horario: defaultHorario })
    }

    return NextResponse.json({ horario: data })
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

    if (profile?.role !== 'admin' && user.id !== barberoId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { horario } = await request.json()

    for (const row of horario) {
      await supabase.from('barbero_horario_semanal').upsert(
        {
          barbero_id: barberoId,
          dia_semana: row.dia_semana,
          hora_inicio: row.hora_inicio,
          hora_fin: row.hora_fin,
          activo: row.activo,
        },
        { onConflict: 'barbero_id,dia_semana' }
      )
    }

    const db = getNotificationDbClient(supabase)
    await dispatchNotification(db, {
      event: 'horario_cambio',
      payload: { barberoId },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
