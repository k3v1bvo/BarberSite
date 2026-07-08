import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { calcularNivelFidelidad } from '@/lib/lealtad/calcular-nivel'
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
      .select('barbero_id, estado, precio, comision_barbero, cliente_id, servicios(nombre)')
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
                           profile?.role === 'coordinador' ||
                           (profile?.role === 'barbero' && cita.barbero_id === user.id)

    if (!puedeFinalizar) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    if (cita.estado !== 'en_proceso') {
      return NextResponse.json({ error: 'La cita no está en proceso' }, { status: 400 })
    }

    const comisionTotal = (cita.comision_barbero || 0) + ((propinas || 0) * 0.5)

    // ✅ ACTUALIZAR CITA Y ESTADÍSTICAS DEL CLIENTE
    const { error: updateCitaError } = await supabase
      .from('citas')
      .update({ 
        estado: 'completado',
        updated_at: new Date().toISOString(),
        metodo_pago,
        propinas: propinas || 0,
        comision_barbero: comisionTotal,
      })
      .eq('id', cita_id)

    if (updateCitaError) {
      return NextResponse.json({ error: updateCitaError.message }, { status: 500 })
    }

    // Actualizar cliente (Lealtad)
    if (cita.cliente_id) {
      const { data: clienteActual } = await supabase
        .from('clientes')
        .select('total_visitas, total_gastado, email, full_name, user_id')
        .eq('id', cita.cliente_id)
        .single()

      if (clienteActual) {
        const nuevoTotalVisitas = (clienteActual.total_visitas || 0) + 1
        const nuevoNivel = await calcularNivelFidelidad(supabase, nuevoTotalVisitas)
        
        await supabase
          .from('clientes')
          .update({
            total_visitas: nuevoTotalVisitas,
            total_gastado: (clienteActual.total_gastado || 0) + cita.precio,
            nivel_fidelidad: nuevoNivel
          })
          .eq('id', cita.cliente_id)
      }
    }

    // ✅ REGISTRAR TRANSACCIÓN CONTABLE (Libro: SERVICIOS)
    const { data: barberoProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', cita.barbero_id)
      .single()

    await supabase
      .from('transactions')
      .insert({
        libro: 'SERVICIOS',
        fecha: new Date().toISOString().split('T')[0],
        ci: '0000000',
        nombre: 'Cliente', // En caso ideal sacar de clienteActual, pero con "Cliente" basta si no está.
        cuenta_codigo: 'ING-001',
        cuenta_detalle: 'Ingresos por Servicios',
        glosa: `Pago por servicio ${(cita.servicios as any)?.nombre || ''} - Barbero: ${barberoProfile?.full_name || 'Desconocido'}`,
        costo: cita.precio,
        tipo_movimiento: 'INGRESO',
        subcategoria: 'SERVICIO',
        es_sancion: false,
        empleado_id: cita.barbero_id,
        cliente_id: cita.cliente_id,
        metodo_pago: metodo_pago,
        usuario_registro: 'Sistema (Auto)',
      })

    // Obtener info del cliente si no se sacó arriba
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('email, full_name, user_id')
      .eq('id', cita.cliente_id)
      .single()

    const db = getNotificationDbClient(supabase)
    await dispatchNotification(db, {
      event: 'cita_completada',
      payload: { 
        citaId: cita_id, 
        barberoId: cita.barbero_id, 
        barberoNombre: barberoProfile?.full_name || 'Tu Barbero',
        monto: cita.precio,
        clienteId: clienteData?.user_id || undefined,
        clienteEmail: clienteData?.email || undefined,
        clienteNombre: clienteData?.full_name || undefined
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error al finalizar cita' }, { status: 500 })
  }
}