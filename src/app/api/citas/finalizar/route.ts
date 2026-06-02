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

  try {
    const body = await request.json()
    const { cita_id, metodo_pago, propinas } = body

    // Obtener la cita con el cliente_id
    const { data: cita } = await supabase
      .from('citas')
      .select('barbero_id, estado, precio, comision_barbero, cliente_id, servicio_id, servicios(comision_acumulable)')
      .eq('id', cita_id)
      .single()

    if (!cita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const puedeFinalizar = profile?.role === 'admin' || 
                           profile?.role === 'recepcionista' ||
                           (profile?.role === 'barbero' && cita.barbero_id === user.id)

    if (!puedeFinalizar) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    if (cita.estado !== 'en_proceso') {
      return NextResponse.json({ error: 'La cita no está en proceso' }, { status: 400 })
    }

    const servicio = Array.isArray(cita.servicios) ? cita.servicios[0] : cita.servicios
    const { agregarPropinaComision } = await import('@/lib/comisiones/helpers')
    const comisionTotal = agregarPropinaComision(
      cita.comision_barbero || 0,
      propinas || 0,
      servicio?.comision_acumulable ?? true
    )

    // ✅ ACTUALIZAR CITA Y ESTADÍSTICAS DEL CLIENTE
    const { error: updateCitaError } = await supabase
      .from('citas')
      .update({ 
        estado: 'completado',
        finished_at: new Date().toISOString(),
        metodo_pago,
        propinas: propinas || 0,
        comision_barbero: comisionTotal,
      })
      .eq('id', cita_id)

    if (updateCitaError) {
      return NextResponse.json({ error: updateCitaError.message }, { status: 500 })
    }

    if (cita.cliente_id) {
      const { registrarVisitaCliente } = await import('@/lib/lealtad/registrar-visita')
      await registrarVisitaCliente(supabase, cita.cliente_id, cita.precio, cita_id)
    }

    const db = getNotificationDbClient(supabase)
    await dispatchNotification(db, {
      event: 'cita_completada',
      payload: { citaId: cita_id, barberoId: cita.barbero_id, monto: cita.precio },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error al finalizar cita' }, { status: 500 })
  }
}