import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getBoliviaDateString } from '@/lib/asistencia/helpers'
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
      searchParams.get('fecha_inicio') || getBoliviaDateString()
    const fechaFin =
      searchParams.get('fecha_fin') ||
      getBoliviaDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))

    const isAdmin = role === 'admin'
    const isCoordinador = role === 'coordinador'
    const isBarbero = role === 'barbero'

    if (!isAdmin && !isCoordinador && !isBarbero && !isCliente) {
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
        reprogramacion_estado,
        fecha_hora_solicitada,
        precio,
        notas,
        anticipo_monto,
        barbero_id,
        clientes (nombre, telefono, email),
        servicios (nombre, duracion_minutos),
        barberos:profiles!barbero_id (full_name, avatar_url)
      `)
      .gte('fecha_hora', `${fechaInicio}T00:00:00-04:00`)
      .lte('fecha_hora', `${fechaFin}T23:59:59-04:00`)
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
      const barberoData = Array.isArray(cita.barberos) ? cita.barberos[0] : cita.barberos
      const clienteData = Array.isArray(cita.clientes) ? cita.clientes[0] : cita.clientes
      
      const notasStr = cita.notas as string | null
      const matchStandard = notasStr?.match(/\[Comprobante\]:\s*(https?:\/\/[^\s\n\r]+)/i)
      const matchAnyUrl = notasStr?.match(/(https?:\/\/[^\s\n\r]+\.(?:jpg|jpeg|png|webp|gif|svg)|https?:\/\/(?:i\.)?ibb\.co\/[^\s\n\r]+|https?:\/\/res\.cloudinary\.com\/[^\s\n\r]+)/i)
      const comprobante_url = matchStandard ? matchStandard[1].trim() : (matchAnyUrl ? matchAnyUrl[1].trim() : undefined)

      return {
        id: cita.id,
        fecha_hora: cita.fecha_hora,
        duracion_minutos:
          cita.duracion_real_minutos || servicioData?.duracion_minutos || 30,
        estado: cita.estado,
        reprogramacion_estado: cita.reprogramacion_estado,
        fecha_hora_solicitada: cita.fecha_hora_solicitada,
        cliente_nombre: pickName(cita.clientes, 'Cliente'),
        cliente_telefono: clienteData?.telefono || undefined,
        cliente_email: clienteData?.email || undefined,
        servicio_nombre: pickName(cita.servicios, 'Servicio'),
        precio: cita.precio,
        anticipo_monto: cita.anticipo_monto,
        barbero_id: cita.barbero_id,
        barbero_nombre: pickName(cita.barberos, 'Barbero'),
        barbero_avatar_url: barberoData?.avatar_url || undefined,
        notas: cita.notas || undefined,
        comprobante_url
      }
    })

    return NextResponse.json({
      citas: citasTransformadas,
      periodo: { inicio: fechaInicio, fin: fechaFin }
    })
  } catch (e) {
    console.error('Agenda API:', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
