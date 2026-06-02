import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'recepcionista') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { cliente_id, servicio_id, barbero_id, fecha_hora } = body

    const { data: servicio } = await supabase
      .from('servicios')
      .select('precio, duracion_minutos, comision_activa, comision_tipo, comision_valor, comision_acumulable')
      .eq('id', servicio_id)
      .single()

    if (!servicio) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    }

    const { data: barbero } = await supabase
      .from('profiles')
      .select('comision_porcentaje')
      .eq('id', barbero_id)
      .single()

    const { calcularComisionServicio } = await import('@/lib/comisiones/helpers')
    const comisionBarbero = calcularComisionServicio(servicio, barbero ?? undefined)

    const { data: cita, error } = await supabase
      .from('citas')
      .insert({
        cliente_id,
        servicio_id,
        barbero_id,
        fecha_hora,
        precio: servicio.precio,
        comision_barbero: comisionBarbero,
        duracion_real_minutos: servicio.duracion_minutos,
        estado: 'pendiente',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const db = getNotificationDbClient(supabase)
    const fh = new Date(fecha_hora)
    const [{ data: cliente }, { data: servicioRow }, { data: barberoRow }] = await Promise.all([
      supabase.from('clientes').select('nombre, email').eq('id', cliente_id).single(),
      supabase.from('servicios').select('nombre').eq('id', servicio_id).single(),
      supabase.from('profiles').select('full_name, email').eq('id', barbero_id).single(),
    ])

    await dispatchNotification(db, {
      event: 'reserva_nueva',
      payload: {
        citaId: cita.id,
        barberoId: barbero_id,
        barberoNombre: barberoRow?.full_name,
        barberoEmail: barberoRow?.email,
        clienteNombre: cliente?.nombre,
        clienteEmail: cliente?.email ?? undefined,
        servicioNombre: servicioRow?.nombre,
        fecha: fh.toLocaleDateString('es-BO'),
        hora: fh.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
      },
    })

    return NextResponse.json({ success: true, data: cita })
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear cita' }, { status: 500 })
  }
}