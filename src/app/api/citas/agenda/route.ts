import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { AgendaCita, AgendaResponse } from '@/lib/agenda/types'

function pickName(
  joined: { nombre?: string; full_name?: string } | { nombre?: string; full_name?: string }[] | null | undefined,
  fallback: string
): string {
  if (!joined) return fallback
  const row = Array.isArray(joined) ? joined[0] : joined
  return row?.nombre || row?.full_name || fallback
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = userProfile?.role
    const isCliente = role === 'cliente'
    const searchParams = request.nextUrl.searchParams
    const barberoId = searchParams.get('barbero_id')
    const fechaInicio =
      searchParams.get('fecha_inicio') || new Date().toISOString().split('T')[0]
    const fechaFin =
      searchParams.get('fecha_fin') ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const isAdmin = role === 'admin'
    const isRecepcionista = role === 'recepcionista'
    const isBarbero = role === 'barbero'

    if (!isAdmin && !isRecepcionista && !isBarbero && !isCliente) {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    if (isBarbero) {
      if (barberoId && barberoId !== user.id) {
        return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
      }
    }

    if (isCliente && barberoId) {
      /* clientes pueden filtrar por barbero */
    }

    let query = supabase
      .from('citas')
      .select(`
        id,
        fecha_hora,
        duracion_real_minutos,
        estado,
        precio,
        barbero_id,
        clientes (nombre),
        servicios (nombre, duracion_minutos),
        barberos:profiles!barbero_id (full_name)
      `)
      .gte('fecha_hora', `${fechaInicio}T00:00:00`)
      .lte('fecha_hora', `${fechaFin}T23:59:59`)
      .neq('estado', 'cancelado')
      .order('fecha_hora', { ascending: true })

    if (barberoId) {
      query = query.eq('barbero_id', barberoId)
    } else if (isBarbero) {
      query = query.eq('barbero_id', user.id)
    }

    const { data: citas, error } = await query

    if (error) {
      console.error('Error agenda:', error)
      return NextResponse.json({ error: 'Error al cargar citas' }, { status: 500 })
    }

    const citasTransformadas: AgendaCita[] = (citas || []).map((cita) => {
      const servicioData = Array.isArray(cita.servicios) ? cita.servicios[0] : cita.servicios
      return {
        id: cita.id,
        fecha_hora: cita.fecha_hora,
        duracion_minutos:
          cita.duracion_real_minutos || servicioData?.duracion_minutos || 30,
        estado: cita.estado,
        cliente_nombre: pickName(cita.clientes, 'Cliente'),
        servicio_nombre: pickName(cita.servicios, 'Servicio'),
        precio: cita.precio,
        barbero_id: cita.barbero_id,
        barbero_nombre: pickName(cita.barberos, 'Barbero'),
      }
    })

    const response: AgendaResponse = {
      citas: citasTransformadas,
      periodo: { inicio: fechaInicio, fin: fechaFin },
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Error en agenda API:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
