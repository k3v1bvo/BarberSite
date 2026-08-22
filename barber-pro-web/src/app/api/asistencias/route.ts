import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { computeEstadoFromRecord, getBusinessDateString } from '@/lib/asistencia/helpers'

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

    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const params = request.nextUrl.searchParams
    const fecha = params.get('fecha') || getBusinessDateString()
    const barberoId = params.get('barbero_id')
    const estadoFiltro = params.get('estado')
    const soloAbiertos = params.get('solo_abiertos') === 'true'

    let query = supabase
      .from('asistencias')
      .select(`
        id, fecha, hora_entrada, hora_salida, horas_trabajadas,
        estado, cierre_automatico, editado_admin, notas,
        selfie_url, lat, lng, en_almuerzo,
        profiles (id, full_name, role, avatar_url)
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

    // Consultar solicitudes de permisos aprobadas para la fecha seleccionada
    let permisosAprobados: any[] = []
    const { data: dbPermisos } = await supabase
      .from('solicitudes_permisos')
      .select(`
        id, fecha, fecha_fin, tipo_permiso, motivo, comprobante_url, estado, barbero_id,
        barbero:profiles!solicitudes_permisos_barbero_id_fkey (id, full_name, role, avatar_url)
      `)
      .eq('estado', 'aprobado')
      .lte('fecha', fecha)

    if (dbPermisos && dbPermisos.length > 0) {
      permisosAprobados = dbPermisos.filter((p: any) => {
        const hasta = p.fecha_fin || p.fecha
        return p.fecha <= fecha && hasta >= fecha
      })
    } else {
      const { data: cfg } = await supabase
        .from('configuraciones')
        .select('valor')
        .eq('llave', 'solicitudes_permisos_data')
        .maybeSingle()
      if (cfg?.valor) {
        try {
          const list = typeof cfg.valor === 'string' ? JSON.parse(cfg.valor) : cfg.valor
          permisosAprobados = list.filter((p: any) => {
            const hasta = p.fecha_fin || p.fecha
            return p.estado === 'aprobado' && p.fecha <= fecha && hasta >= fecha
          })
        } catch {
          permisosAprobados = []
        }
      }
    }

    for (const perm of permisosAprobados) {
      const pProfile = Array.isArray(perm.barbero) ? perm.barbero[0] : (perm.barbero || { id: perm.barbero_id })
      const bId = pProfile?.id || perm.barbero_id
      if (barberoId && bId !== barberoId) continue
      const alreadyInList = registros.some(r => r.profiles?.id === bId || (r as any).profile_id === bId)
      if (!alreadyInList) {
        registros.push({
          id: perm.id,
          fecha: fecha,
          hora_entrada: `${fecha}T09:00:00-04:00`,
          hora_salida: `${fecha}T21:00:00-04:00`,
          horas_trabajadas: 0,
          estado: 'permiso',
          cierre_automatico: false,
          editado_admin: true,
          notas: `PERMISO JUSTIFICADO [${perm.tipo_permiso || 'Jornada Completa'}]: ${perm.motivo || ''} ${perm.comprobante_url ? `[COMPROBANTE](${perm.comprobante_url})` : ''}`.trim(),
          selfie_url: perm.comprobante_url || null,
          lat: null,
          lng: null,
          en_almuerzo: false,
          profiles: pProfile,
          estado_calculado: 'permiso',
        })
      }
    }

    const filtrados = estadoFiltro
      ? registros.filter((r) => r.estado_calculado === estadoFiltro)
      : registros

    const turnosAbiertos = registros.filter((r) => !r.hora_salida && r.estado_calculado !== 'permiso' && r.estado_calculado !== 'ausente').length

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
