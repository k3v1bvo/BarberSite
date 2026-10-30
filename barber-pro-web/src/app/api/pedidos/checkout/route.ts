import { createServerAdminClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const adminSupabase = await createServerAdminClient()
    const body = await request.json()
    const { clienteData, cart, metodo_entrega } = body
    
    // 1. Manejar Cliente (Buscar o Crear)
    let clienteId = null
    const emailAEnviar = clienteData.email

    if (clienteData.usuario_registrado_id) {
      clienteId = clienteData.usuario_registrado_id
    } else if (clienteData.email || clienteData.telefono) {
      // Buscar si existe un perfil/cliente con ese correo o teléfono
      let query = adminSupabase.from('clientes').select('id')
      if (clienteData.email) query = query.eq('email', clienteData.email)
      else query = query.eq('telefono', clienteData.telefono)
        
      const { data: exCliente } = await query.maybeSingle()
      
      if (exCliente) {
        clienteId = exCliente.id
      } else {
        // Crear cliente "shadow" (solo registro de negocio, no Auth)
        const { data: newCliente, error: clError } = await adminSupabase
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
      total += ((Number(item.precio_venta) || 0) * (Number(item.cantidad) || 1))
    }

    if (metodo_entrega === 'con_reserva' && cart.length > 0) {
      total = Math.max(0, total - 10)
    }

    const { data: pedidoNuevo, error: pedError } = await adminSupabase
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
      await adminSupabase.from('pedido_items').insert({
        pedido_id: pedidoNuevo.id,
        producto_id: item.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_venta
      })
      
      // Restar stock y registrar movimiento de inventario
      const { data: pActual } = await adminSupabase.from('productos').select('stock_actual').eq('id', item.id).single()
      if (pActual) {
        const stockAnt = pActual.stock_actual || 0
        const nuevoStock = Math.max(0, stockAnt - item.cantidad)
        await adminSupabase.from('productos')
          .update({ stock_actual: nuevoStock })
          .eq('id', item.id)

        try {
          await adminSupabase.from('inventario_movimientos').insert({
            producto_id: item.id,
            tipo: 'venta',
            cantidad: -item.cantidad,
            stock_anterior: stockAnt,
            stock_nuevo: nuevoStock,
            referencia: `pedido-${pedidoNuevo.id.slice(0, 8)}`,
            notas: `Pedido Online #${pedidoNuevo.id.slice(0, 8)} (${clienteData.nombre || 'Cliente'})`,
          })
        } catch (e) {
          console.error('Error insertando movimiento de inventario en pedido:', e)
        }
      }
    }

    const db = getNotificationDbClient(adminSupabase)
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
    return NextResponse.json({ error: error.message || 'Error procesando el pedido' }, { status: 500 })
  }
}
