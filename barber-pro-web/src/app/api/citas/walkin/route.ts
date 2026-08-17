import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { calcularComisionBarbero } from '@/lib/comisiones/calcular'
import { NextResponse } from 'next/server'

interface ProductoWalkin {
  id: string
  nombre: string
  precio: number
  cantidad: number
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const adminSupabase = createAdminSupabaseClient() || supabase
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { nombreCliente, emailCliente, telefonoCliente, servicio_id, metodo_pago, propinas, productos_carrito } = body
    const productosCarrito: ProductoWalkin[] = productos_carrito || []

    if (!servicio_id && productosCarrito.length === 0) {
      return NextResponse.json({ error: 'Selecciona un servicio o agrega un producto' }, { status: 400 })
    }

    // 1. Manejar el Cliente
    let clienteId = null
    
    if (nombreCliente || emailCliente || telefonoCliente) {
      let query = supabase.from('clientes').select('id, total_visitas, total_gastado')
      if (emailCliente) query = query.eq('email', emailCliente)
      else if (telefonoCliente) query = query.eq('telefono', telefonoCliente)
      else query = query.eq('nombre', nombreCliente)
        
      const { data: exCliente } = await query.single()
      
      if (exCliente) {
        clienteId = exCliente.id
      } else {
        // Crear cliente
        const { data: newCliente, error: clError } = await adminSupabase
          .from('clientes')
          .insert({
            nombre: nombreCliente || 'Cliente Walk-in',
            email: emailCliente || null,
            telefono: telefonoCliente || null,
            total_visitas: 0,
            total_gastado: 0
          })
          .select('id')
          .single()
          
        if (clError) throw clError
        clienteId = newCliente.id
      }
    }

    const ahora = new Date()
    let precioBase = 0

    // 2. Servicio (si existe)
    if (servicio_id) {
      const { data: serv } = await supabase.from('servicios').select('precio, comision_activa, comision_tipo, comision_valor, comision_acumulable').eq('id', servicio_id).single()
      precioBase = serv?.precio || 0
      
      // Calcular comisión personalizada por barbero
      const comResult = await calcularComisionBarbero(
        supabase, user.id, servicio_id, precioBase, new Date(),
        { comision_activa: serv?.comision_activa, comision_tipo: serv?.comision_tipo, comision_valor: serv?.comision_valor, comision_acumulable: serv?.comision_acumulable }
      )
      
      const extraPropinas = serv?.comision_acumulable !== false ? (propinas || 0) : 0
      const comisionTotal = comResult.monto + extraPropinas

      // Crear Cita Completada
      const inicio = new Date(ahora.getTime() - 30 * 60000)
      const citaData: any = {
        cliente_id: clienteId,
        barbero_id: user.id,
        servicio_id,
        fecha_hora: inicio.toISOString(),
        updated_at: ahora.toISOString(),
        precio: precioBase,
        duracion_real_minutos: 30,
        estado: 'completado',
        metodo_pago,
        propinas: propinas || 0,
        comision_barbero: comisionTotal,
        comision_categoria: comResult.categoria_nombre,
        comision_herramientas: comResult.tiene_herramientas,
        notas: 'Venta Rápida (Walk-in)',
      }

      let { error: citaError } = await supabase.from('citas').insert(citaData)
      if (citaError && (citaError.message?.includes('comision_') || citaError.message?.includes('column') || (citaError as any).code === 'PGRST204')) {
        delete citaData.comision_categoria
        delete citaData.comision_herramientas
        const retry = await supabase.from('citas').insert(citaData)
        citaError = retry.error
      }
      if (citaError) throw citaError

      const { data: barberoProfileServ } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      const fechaBolivia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)

      await adminSupabase.from('transactions').insert({
        libro: 'SERVICIOS',
        fecha: fechaBolivia,
        ci: '0000000',
        nombre: nombreCliente || 'Cliente Walk-in',
        cuenta_codigo: 'ING-001',
        cuenta_detalle: 'Ingresos por Servicios (Walk-in)',
        glosa: `Venta Rápida Walk-in - Barbero: ${barberoProfileServ?.full_name || 'Desconocido'}`,
        costo: precioBase,
        tipo_movimiento: 'INGRESO',
        subcategoria: 'SERVICIO',
        es_sancion: false,
        empleado_id: user.id,
        cliente_id: clienteId,
        metodo_pago: metodo_pago || 'efectivo',
        usuario_registro: barberoProfileServ?.full_name || 'Barbero',
      })
    }

    // 3. Procesar Productos
    const totalProductos = productosCarrito.reduce((s: number, p: ProductoWalkin) => s + p.precio * p.cantidad, 0)
    
    if (productosCarrito.length > 0) {
      const { data: barberoProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      
      for (const item of productosCarrito) {
        const { data: pActual } = await supabase.from('productos').select('stock_actual').eq('id', item.id).single()
        const stockAnterior = pActual?.stock_actual || 0
        const nuevoStock = Math.max(0, stockAnterior - item.cantidad)
        
        await adminSupabase.from('productos').update({ stock_actual: nuevoStock }).eq('id', item.id)

        // Movimiento de inventario
        try {
          await adminSupabase.from('inventario_movimientos').insert({
            producto_id: item.id,
            tipo: 'venta',
            cantidad: -item.cantidad,
            stock_anterior: stockAnterior,
            stock_nuevo: nuevoStock,
            referencia: 'venta-walkin',
            notas: `Venta Walk-in Barbero - ${item.cantidad}x ${item.nombre}`,
            usuario_id: user.id,
          })
        } catch (e) { console.error('Error mov inventario:', e) }

        // Transacción contable
        await adminSupabase.from('transactions').insert({
          libro: 'VENTAS',
          fecha: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora),
          ci: '0000000',
          nombre: nombreCliente || 'Cliente Walk-in',
          cuenta_codigo: '4.1.2',
          cuenta_detalle: item.nombre,
          producto_id: item.id,
          glosa: `Venta Walk-in - ${item.cantidad}x ${item.nombre} - Barbero: ${barberoProfile?.full_name || 'Desconocido'}`,
          costo: item.precio * item.cantidad,
          tipo_movimiento: 'VENTA_PRODUCTO',
          es_sancion: false,
          empleado_id: user.id,
          cliente_id: clienteId,
          metodo_pago: metodo_pago || 'efectivo',
          usuario_registro: barberoProfile?.full_name || 'Barbero',
        })
      }
    }

    // 4. Actualizar Lealtad
    if (clienteId) {
      const { data: cData } = await supabase.from('clientes').select('total_visitas, total_gastado').eq('id', clienteId).single()
      if (cData) {
        await adminSupabase.from('clientes')
          .update({
            total_visitas: (cData.total_visitas || 0) + (servicio_id ? 1 : 0),
            total_gastado: (cData.total_gastado || 0) + precioBase + totalProductos
          })
          .eq('id', clienteId)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error Walk-in:', error)
    return NextResponse.json({ error: 'Error procesando la venta' }, { status: 500 })
  }
}
