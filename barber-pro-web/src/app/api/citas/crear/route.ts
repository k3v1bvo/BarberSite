import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { calcularComisionBarbero } from '@/lib/comisiones/calcular'
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

  if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const contentType = request.headers.get('content-type') || ''
    let cliente_id: string, servicio_id: string, barbero_id: string, raw_fecha_hora: string

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      cliente_id = String(formData.get('cliente_id') || '')
      servicio_id = String(formData.get('servicio_id') || '')
      barbero_id = String(formData.get('barbero_id') || '')
      raw_fecha_hora = String(formData.get('fecha_hora') || '')
    } else {
      const body = await request.json()
      cliente_id = body.cliente_id
      servicio_id = body.servicio_id
      barbero_id = body.barbero_id
      raw_fecha_hora = body.fecha_hora
    }

    let fecha_hora = raw_fecha_hora
    if (typeof fecha_hora === 'string' && !fecha_hora.includes('Z') && !fecha_hora.match(/[+-]\d{2}:\d{2}$/)) {
      fecha_hora = `${fecha_hora.length === 16 ? fecha_hora + ':00' : fecha_hora}-04:00`
    }

    const { data: servicio } = await supabase
      .from('servicios')
      .select('precio, duracion_minutos, comision_activa, comision_tipo, comision_valor')
      .eq('id', servicio_id)
      .single()

    if (!servicio) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    }

    // Calcular comisión personalizada por barbero
    const fechaCita = fecha_hora ? new Date(fecha_hora) : new Date()
    const comResult = await calcularComisionBarbero(
      supabase, barbero_id, servicio_id, servicio.precio, fechaCita,
      { comision_activa: servicio.comision_activa, comision_tipo: servicio.comision_tipo, comision_valor: servicio.comision_valor }
    )

    const { data: cita, error } = await supabase
      .from('citas')
      .insert({
        cliente_id,
        servicio_id,
        barbero_id,
        fecha_hora,
        precio: servicio.precio,
        comision_barbero: comResult.monto,
        comision_categoria: comResult.categoria_nombre,
        comision_herramientas: comResult.tiene_herramientas,
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

    let finalBarberoEmail = barberoRow?.email
    if (!finalBarberoEmail) {
      const { data: authUser } = await db.auth.admin.getUserById(barbero_id)
      if (authUser?.user?.email) {
        finalBarberoEmail = authUser.user.email
        // Sincronizar el email en profiles para la próxima vez
        await db.from('profiles').update({ email: authUser.user.email }).eq('id', barbero_id)
      }
    }

    await dispatchNotification(db, {
      event: 'reserva_nueva',
      payload: {
        citaId: cita.id,
        barberoId: barbero_id,
        barberoNombre: barberoRow?.full_name,
        barberoEmail: finalBarberoEmail,
        clienteNombre: cliente?.nombre,
        clienteEmail: cliente?.email ?? undefined,
        servicioNombre: servicioRow?.nombre,
        fecha: fh.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }),
        hora: fh.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hour12: false }),
        metodoPago: 'Pago en el local',
        monto: servicio.precio,
      },
    })

    return NextResponse.json({ success: true, data: cita })
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear cita' }, { status: 500 })
  }
}