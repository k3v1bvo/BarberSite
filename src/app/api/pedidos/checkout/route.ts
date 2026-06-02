import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  
  try {
    const body = await request.json()
    const { clienteData, cart, metodo_entrega, notas } = body
    
    // 1. Manejar Cliente (Buscar o Crear)
    let clienteId = null
    let emailAEnviar = clienteData.email

    if (clienteData.usuario_registrado_id) {
      clienteId = clienteData.usuario_registrado_id
    } else if (clienteData.email || clienteData.telefono) {
      // Buscar si existe un perfil/cliente con ese correo o teléfono
      let query = supabase.from('clientes').select('id')
      if (clienteData.email) query = query.eq('email', clienteData.email)
      else query = query.eq('telefono', clienteData.telefono)
        
      const { data: exCliente } = await query.single()
      
      if (exCliente) {
        clienteId = exCliente.id
      } else {
        // Crear cliente "shadow" (solo registro de negocio, no Auth)
        const { data: newCliente, error: clError } = await supabase
          .from('clientes')
          .insert({
            nombre: clienteData.nombre,
            email: clienteData.email,
            telefono: clienteData.telefono,
            total_visitas: 0,
            total_gastado: 0
          })
          .select('id')
          .single()
          
        if (clError) throw clError
        clienteId = newCliente.id
      }
    }

    if (!clienteId) {
       return NextResponse.json({ error: 'Se requiere información del cliente válida' }, { status: 400 })
    }

    // 2. Calcular Totales y Crear Pedido
    let total = 0
    for (const item of cart) {
      total += (item.precio_venta * item.cantidad)
    }

    const { data: pedidoNuevo, error: pedError } = await supabase
      .from('pedidos')
      .insert({
        cliente_id: clienteId,
        metodo_entrega,
        total,
        estado: 'pendiente'
      })
      .select('id')
      .single()

    if (pedError) throw pedError

    // 3. Crear Items del Pedido y Descontar Stock
    for (const item of cart) {
      await supabase.from('pedido_items').insert({
        pedido_id: pedidoNuevo.id,
        producto_id: item.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_venta
      })
      
      // Restar stock
      const { data: pActual } = await supabase.from('productos').select('stock_actual').eq('id', item.id).single()
      if (pActual) {
        await supabase.from('productos')
          .update({ stock_actual: pActual.stock_actual - item.cantidad })
          .eq('id', item.id)
      }
    }

    const db = getNotificationDbClient(supabase)
    await dispatchNotification(db, {
      event: 'venta_nueva',
      payload: {
        pedidoId: pedidoNuevo.id,
        clienteNombre: clienteData.nombre,
        clienteEmail: emailAEnviar,
        monto: total,
      },
    })

    return NextResponse.json({ success: true, pedidoId: pedidoNuevo.id })
  } catch (error: any) {
    console.error('Error Checkout:', error)
    return NextResponse.json({ error: 'Error procesando el pedido' }, { status: 500 })
  }
}
