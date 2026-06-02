import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { format, parseISO, isAfter, isBefore, addMinutes } from 'date-fns'

export async function GET(
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
    const searchParams = request.nextUrl.searchParams
    const fechaInicio = searchParams.get('fecha_inicio') || new Date().toISOString().split('T')[0]
    const fechaFin = searchParams.get('fecha_fin') || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Validar permisos: solo admin, barbero mismo, o recepcionista pueden ver
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = userProfile?.role === 'admin'
    const isBarberoPropios = user.id === barberoId
    const isRecepcionista = userProfile?.role === 'recepcionista'

    if (!isAdmin && !isBarberoPropios && !isRecepcionista) {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    // Obtener información del barbero
    const { data: barberInfo } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('id', barberoId)
      .eq('role', 'barbero')
      .single()

    if (!barberInfo) {
      return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })
    }

    // Obtener citas del barbero en el período
    const { data: citas } = await supabase
      .from('citas')
      .select(`
        id,
        fecha_hora,
        duracion_real_minutos,
        estado,
        precio,
        clientes (nombre),
        servicios (nombre, duracion_minutos)
      `)
      .eq('barbero_id', barberoId)
      .gte('fecha_hora', `${fechaInicio}T00:00:00`)
      .lte('fecha_hora', `${fechaFin}T23:59:59`)
      .neq('estado', 'cancelado')
      .order('fecha_hora', { ascending: true })

    // Transformar citas
    const citasTransformadas = (citas || []).map(cita => {
      const clienteData = Array.isArray(cita.clientes) ? cita.clientes[0] : cita.clientes
      const servicioData = Array.isArray(cita.servicios) ? cita.servicios[0] : cita.servicios

      return {
        id: cita.id,
        fecha_hora: cita.fecha_hora,
        duracion_minutos: cita.duracion_real_minutos || servicioData?.duracion_minutos || 30,
        estado: cita.estado,
        cliente_nombre: clienteData?.nombre || 'Cliente',
        servicio_nombre: servicioData?.nombre || 'Servicio',
        precio: cita.precio
      }
    })

    // Calcular slots disponibles (30 minutos cada uno, 09:00-20:00)
    const slotsDisponibles: string[] = []
    const currentDate = new Date(`${fechaInicio}T09:00:00`)
    const endDate = new Date(`${fechaFin}T20:00:00`)

    while (currentDate <= endDate) {
      let hayConflicto = false

      // Verificar si hay conflicto con citas existentes
      for (const cita of citasTransformadas) {
        const citaStart = parseISO(cita.fecha_hora)
        const citaEnd = addMinutes(citaStart, cita.duracion_minutos)

        const slotStart = new Date(currentDate)
        const slotEnd = addMinutes(slotStart, 30)

        // Verificar solapamiento
        if (isBefore(slotStart, citaEnd) && isAfter(slotEnd, citaStart)) {
          hayConflicto = true
          break
        }
      }

      if (!hayConflicto) {
        slotsDisponibles.push(format(currentDate, 'yyyy-MM-dd HH:mm'))
      }

      currentDate.setMinutes(currentDate.getMinutes() + 30)
    }

    return NextResponse.json({
      barbero: {
        id: barberInfo.id,
        nombre: barberInfo.full_name,
        telefono: barberInfo.phone
      },
      periodo: {
        inicio: fechaInicio,
        fin: fechaFin
      },
      citas: citasTransformadas,
      slotsDisponibles,
      resumen: {
        totalCitas: citasTransformadas.length,
        slotsLibres: slotsDisponibles.length
      }
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error al obtener horarios' }, { status: 500 })
  }
}
