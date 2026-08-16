import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/permisos
 * Lista las solicitudes de permiso de barberos.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'barbero'
    const sp = request.nextUrl.searchParams
    const targetBarberoId = sp.get('barbero_id')
    const estado = sp.get('estado')
    const desde = sp.get('desde')
    const hasta = sp.get('hasta')

    const adminDb = getNotificationDbClient(supabase)

    // Intentar consultar la tabla solicitudes_permisos
    let query = adminDb
      .from('solicitudes_permisos')
      .select(`
        *,
        barbero:profiles!solicitudes_permisos_barbero_id_fkey (
          id, full_name, email, phone, avatar_url, role, ci
        )
      `)
      .order('created_at', { ascending: false })

    if (role === 'barbero') {
      // Los barberos solo ven sus propias solicitudes
      query = query.eq('barbero_id', user.id)
    } else if (targetBarberoId) {
      query = query.eq('barbero_id', targetBarberoId)
    }

    if (estado && estado !== 'todos') {
      query = query.eq('estado', estado)
    }

    if (desde) {
      query = query.gte('fecha', desde)
    }
    if (hasta) {
      query = query.lte('fecha', hasta)
    }

    const { data, error } = await query

    if (error) {
      // Fallback si la tabla aún no fue creada: buscar en configuraciones o asistencias
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        const { data: cfg } = await adminDb
          .from('configuraciones')
          .select('valor')
          .eq('llave', 'solicitudes_permisos_data')
          .single()

        let list: any[] = []
        if (cfg?.valor) {
          try {
            list = typeof cfg.valor === 'string' ? JSON.parse(cfg.valor) : cfg.valor
          } catch {
            list = []
          }
        }

        if (role === 'barbero') {
          list = list.filter(item => item.barbero_id === user.id)
        } else if (targetBarberoId) {
          list = list.filter(item => item.barbero_id === targetBarberoId)
        }

        if (estado && estado !== 'todos') {
          list = list.filter(item => item.estado === estado)
        }

        return NextResponse.json({
          solicitudes: list,
          source: 'config_fallback',
          aviso: 'Ejecuta supabase_permisos.sql en Supabase para habilitar la tabla nativa.'
        })
      }

      console.error('GET /api/permisos error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ solicitudes: data || [] })
  } catch (err: any) {
    console.error('GET /api/permisos error interno:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/permisos
 * Crea una nueva solicitud de permiso para un barbero.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('id, role, full_name, email')
      .eq('id', user.id)
      .single()

    const body = await request.json()
    const {
      barbero_id,
      fecha,
      fecha_fin,
      hora_inicio,
      hora_fin,
      todo_el_dia,
      tipo_permiso,
      motivo,
      comprobante_url,
      archivo_nombre,
    } = body

    const targetBarberoId = (currentProfile?.role === 'admin' || currentProfile?.role === 'coordinador') && barbero_id
      ? barbero_id
      : user.id

    if (!fecha || !motivo) {
      return NextResponse.json({ error: 'La fecha y el motivo son obligatorios' }, { status: 400 })
    }

    const adminDb = getNotificationDbClient(supabase)

    // Obtener datos completos del barbero solicitante
    const { data: barberoProfile } = await adminDb
      .from('profiles')
      .select('id, full_name, email, phone, ci, avatar_url')
      .eq('id', targetBarberoId)
      .single()

    const barberoNombre = barberoProfile?.full_name || currentProfile?.full_name || 'Barbero'
    const barberoEmail = barberoProfile?.email || currentProfile?.email

    const nuevoRegistro = {
      barbero_id: targetBarberoId,
      fecha,
      fecha_fin: fecha_fin || null,
      hora_inicio: todo_el_dia ? null : (hora_inicio || '09:00'),
      hora_fin: todo_el_dia ? null : (hora_fin || '20:00'),
      todo_el_dia: todo_el_dia !== false,
      tipo_permiso: tipo_permiso || 'jornada_completa',
      motivo: motivo.trim(),
      comprobante_url: comprobante_url || null,
      archivo_nombre: archivo_nombre || (comprobante_url?.includes('.pdf') ? 'comprobante_permiso.pdf' : 'comprobante.jpg'),
      estado: 'pendiente',
    }

    let insertedData: any = null

    const { data, error } = await adminDb
      .from('solicitudes_permisos')
      .insert(nuevoRegistro)
      .select(`
        *,
        barbero:profiles!solicitudes_permisos_barbero_id_fkey (
          id, full_name, email, phone, avatar_url, role, ci
        )
      `)
      .single()

    if (error) {
      // Fallback a configuraciones si la tabla nativa no existe aún
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        const { data: cfg } = await adminDb
          .from('configuraciones')
          .select('valor')
          .eq('llave', 'solicitudes_permisos_data')
          .single()

        let list: any[] = []
        if (cfg?.valor) {
          try {
            list = typeof cfg.valor === 'string' ? JSON.parse(cfg.valor) : cfg.valor
          } catch {
            list = []
          }
        }

        const fallbackItem = {
          ...nuevoRegistro,
          id: `permiso_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          created_at: new Date().toISOString(),
          barbero: barberoProfile || currentProfile,
        }

        list.unshift(fallbackItem)

        await adminDb
          .from('configuraciones')
          .upsert({
            llave: 'solicitudes_permisos_data',
            valor: JSON.stringify(list),
            descripcion: 'Registro de solicitudes de permisos de barberos (Fallback)',
          }, { onConflict: 'llave' })

        insertedData = fallbackItem
      } else {
        console.error('Error insertando solicitud de permiso:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      insertedData = data
    }

    // ── Disparar Notificaciones (In-App y Correo Gmail SMTP a Admin y Coordinador) ──
    const tipoLabelMap: Record<string, string> = {
      jornada_completa: 'Jornada Completa',
      horas: 'Permiso por Horas',
      medico: 'Cita / Reposo Médico',
      emergencia: 'Salida de Emergencia',
      enfermedad_grave: 'Enfermedad / Salud',
      personal: 'Asunto Personal / Familiar',
      otro: 'Otro Motivo',
    }

    await dispatchNotification(adminDb, {
      event: 'permiso_solicitado',
      payload: {
        permisoId: insertedData?.id,
        barberoId: targetBarberoId,
        barberoNombre,
        barberoEmail,
        fecha,
        fechaFin: fecha_fin || undefined,
        horaInicio: hora_inicio || undefined,
        horaFin: hora_fin || undefined,
        todo_el_dia: todo_el_dia !== false ? 1 : 0,
        tipoPermiso: tipoLabelMap[tipo_permiso] || tipo_permiso || 'Permiso General',
        motivo,
        comprobante_url: comprobante_url || undefined,
        archivoNombre: archivo_nombre || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      solicitud: insertedData,
      message: 'Solicitud de permiso enviada correctamente. El Administrador y Coordinador han sido notificados.',
    })
  } catch (err: any) {
    console.error('POST /api/permisos error interno:', err)
    return NextResponse.json({ error: err.message || 'Error interno al crear solicitud' }, { status: 500 })
  }
}
