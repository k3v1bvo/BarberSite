import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { computeEstadoFromRecord } from '@/lib/asistencia/helpers'

export async function GET(request: NextRequest) {
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

    if (profile?.role !== 'admin' && profile?.role !== 'recepcionista') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const params = request.nextUrl.searchParams
    const fecha = params.get('fecha') || new Date().toISOString().split('T')[0]
    const barberoId = params.get('barbero_id')
    const estadoFiltro = params.get('estado')
    const soloAbiertos = params.get('solo_abiertos') === 'true'

    let query = supabase
      .from('asistencias')
      .select(`
        id, fecha, hora_entrada, hora_salida, horas_trabajadas,
        estado, cierre_automatico, editado_admin, notas,
        profiles (id, full_name, role)
      `)
      .eq('fecha', fecha)
      .order('hora_entrada', { ascending: false })

    if (barberoId) query = query.eq('profile_id', barberoId)
    if (soloAbiertos) query = query.is('hora_salida', null)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const registros = (data || []).map((r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      const estadoCalc = computeEstadoFromRecord(r)
      return {
        ...r,
        profiles: p,
        estado_calculado: estadoCalc,
      }
    })

    const filtrados = estadoFiltro
      ? registros.filter((r) => r.estado_calculado === estadoFiltro)
      : registros

    const turnosAbiertos = registros.filter((r) => !r.hora_salida).length

    return NextResponse.json({
      registros: filtrados,
      resumen: {
        total: registros.length,
        turnos_abiertos: turnosAbiertos,
        finalizados: registros.filter((r) => r.hora_salida).length,
      },
    })
  } catch (err) {
    console.error('GET asistencias:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
