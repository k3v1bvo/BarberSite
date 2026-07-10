import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient, getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { calcularNivelFidelidad } from '@/lib/lealtad/calcular-nivel'
import { NextRequest, NextResponse } from 'next/server'

interface ProductoCarrito {
  id: string
  nombre: string
  precio: number
  cantidad: number
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const adminSupabase = createAdminSupabaseClient() || supabase

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coordinador', 'barbero'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      cliente_id, nombre, email, telefono, ci,
      servicio_id, barbero_id, cita_id,
      metodo_pago, propinas, estado, notas,
      productos_carrito,
      descuento, promo_id, referral_ids, comprobante_url,
      reserva_fecha, reserva_hora,
      acompanante_2x1,
      referido_por_id,
      monto_efectivo,
      monto_qr
    } = body
    const descuentoTotal = Number(descuento) || 0
    const referralIdsToMark: string[] = referral_ids || []

    const productosCarrito: ProductoCarrito[] = productos_carrito || []

    if (!servicio_id && productosCarrito.length === 0) {
      return NextResponse.json({ error: 'Selecciona un servicio o agrega un producto' }, { status: 400 })
    }

    if (!barbero_id) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
    }

    let finalClienteId = cliente_id
    let clienteEmail = email
    let isNewClient = false

    // 1. GESTIÓN DEL CLIENTE
    if (!finalClienteId && nombre) {
      // Buscar cliente por nombre o email
      let query = supabase.from('clientes').select('id, email, total_visitas, total_gastado')
      if (email) {
        query = query.or(`email.eq."${email}",nombre.ilike."${nombre}"`)
      } else {
        query = query.eq('nombre', nombre)
      }

      const { data: exClientes } = await query

      if (exClientes && exClientes.length > 0) {
        finalClienteId = exClientes[0].id
        // Actualizar el correo si se proporcionó uno nuevo y antes no tenía
        if (email && !exClientes[0].email) {
          await adminSupabase.from('clientes').update({ email }).eq('id', finalClienteId)
          clienteEmail = email
          // Intentar invitar al usuario para cruzar datos y enviar notificación
          try {
             await adminSupabase.auth.admin.inviteUserByEmail(email, {
               data: { full_name: nombre }
             })
          } catch(e) { console.error("Error invitando usuario:", e) }
          try {
             await dispatchNotification(adminSupabase, {
               event: 'invitacion_cliente',
               payload: { clienteNombre: nombre },
               userEmail: email
             })
          } catch(e) { console.error("Error enviando email de invitación:", e) }
        }
      } else {
        // Crear cliente nuevo
        isNewClient = true
        const { data: newCliente, error: clError } = await adminSupabase
          .from('clientes')
          .insert({
            nombre: nombre,
            email: email || null,
            telefono: telefono || null,
            ci: ci || null,
            total_visitas: 0,
            total_gastado: 0
          })
          .select('id')
          .single()

        if (clError) throw clError
        finalClienteId = newCliente.id

        // Invitar si hay correo
        if (email) {
          try {
             await adminSupabase.auth.admin.inviteUserByEmail(email, {
               data: { full_name: nombre }
             })
          } catch(e) { console.error("Error invitando nuevo usuario:", e) }
          try {
             await dispatchNotification(adminSupabase, {
               event: 'invitacion_cliente',
               payload: { clienteNombre: nombre },
               userEmail: email
             })
          } catch(e) { console.error("Error enviando email de invitación:", e) }
        }
      }
    } else if (finalClienteId && email) {
      // Actualizar email si se seleccionó cliente existente
       const { data: exCliente } = await supabase.from('clientes').select('email, nombre').eq('id', finalClienteId).single()
       if (!exCliente?.email) {
          await adminSupabase.from('clientes').update({ email }).eq('id', finalClienteId)
          clienteEmail = email
          try {
             await adminSupabase.auth.admin.inviteUserByEmail(email, {
               data: { full_name: nombre || exCliente?.nombre || 'Cliente' }
             })
          } catch(e) {}
          try {
             await dispatchNotification(adminSupabase, {
               event: 'invitacion_cliente',
               payload: { clienteNombre: nombre || exCliente?.nombre || 'Cliente' },
               userEmail: email
             })
          } catch(e) { console.error("Error enviando email de invitación:", e) }
       }
    }
    
    // Asignar referidor si se pasó y no lo tiene aún
    if (finalClienteId && referido_por_id) {
      const { data: currentClient } = await supabase.from('clientes').select('referido_por').eq('id', finalClienteId).single()
      if (!currentClient?.referido_por) {
        await adminSupabase.from('clientes').update({ referido_por: referido_por_id }).eq('id', finalClienteId)
        
        const { data: confMonto } = await adminSupabase.from('configuraciones').select('valor').eq('llave', 'monto_bono_referido').single()
        const montoReferido = Number(confMonto?.valor?.monto) || 10
        
        await adminSupabase.from('referrals').insert({
          cliente_recomendante_id: referido_por_id,
          cliente_recomendado_id: finalClienteId,
          monto_bono: montoReferido,
          bono_otorgado: false // Se procesará más abajo
        })
      }
    }

    // 2. Obtener precio del servicio y calcular comisión si aplica
    let serv: any = null
    let precioBase = 0
    let comisionTotal = 0

    if (servicio_id) {
      const { data: servData } = await supabase
        .from('servicios')
        .select('precio, nombre, duracion_minutos, comision_activa, comision_tipo, comision_valor, comision_acumulable')
        .eq('id', servicio_id)
        .single()
        
      if (!servData) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
      serv = servData
      precioBase = serv.precio || 0

      if (estado === 'completado') {
        // (La comisión base de perfil ya no se usa, ahora es estrictamente por servicio)
        
        let baseComision = 0
        if (serv.comision_activa !== false && serv.comision_tipo !== 'ninguna') {
          if (serv.comision_tipo === 'fija') {
            baseComision = serv.comision_valor || 0
          } else if (serv.comision_tipo === 'porcentaje') {
            baseComision = (precioBase * (serv.comision_valor || 0)) / 100
          }
        }
        const extraPropinas = serv.comision_acumulable !== false ? (propinas || 0) : 0
        comisionTotal = baseComision + (extraPropinas * 0.5)
      }
    }

    // Calcular total de productos
    const totalProductos = productosCarrito.reduce((sum: number, item: ProductoCarrito) => sum + (item.precio * item.cantidad), 0)

    // 3. Crear la cita (si hay servicio)
    const ahora = new Date()
    let citaId: string | null = null

    if (servicio_id && serv) {
      // Determine the datetime to use
      let baseDate = ahora
      if (reserva_fecha && reserva_hora) {
        baseDate = new Date(`${reserva_fecha}T${reserva_hora}:00`)
      }

      // If completed immediately, the start was 'duracion' minutes ago. 
      // If scheduled (reserva) or 'en_proceso' now, start is the baseDate.
      const inicio = estado === 'completado' && !(reserva_fecha && reserva_hora)
        ? new Date(baseDate.getTime() - (serv.duracion_minutos || 30) * 60000)
        : baseDate

      let finalNotas = notas || 'Venta desde Caja'
      if (acompanante_2x1 && acompanante_2x1.nombre) {
        finalNotas += `\n[PROMO 2x1] Acompañante: ${acompanante_2x1.nombre}${acompanante_2x1.email ? ` (${acompanante_2x1.email})` : ''}`
      }

      const insertData: any = {
        cliente_id: finalClienteId,
        barbero_id,
        servicio_id,
        fecha_hora: inicio.toISOString(),
        precio: precioBase,
        duracion_real_minutos: serv.duracion_minutos || 30,
        estado: estado || 'en_proceso',
        notas: finalNotas,
      }

      if (estado === 'completado') {
        insertData.updated_at = ahora.toISOString()
        insertData.metodo_pago = metodo_pago || 'efectivo'
        insertData.propinas = propinas || 0
        insertData.comision_barbero = comisionTotal
        if (descuentoTotal > 0) insertData.descuento = descuentoTotal
        if (comprobante_url) {
          insertData.notas = `${insertData.notas}\n[Comprobante]: ${comprobante_url}`
        }
      }

      let citaNueva, citaError
      
      if (cita_id) {
        // Solo no sobrescribir fecha original si NO estamos reprogramando (reserva_fecha vacía)
        if (!reserva_fecha || !reserva_hora) {
          delete insertData.fecha_hora
        }
        
        const res = await supabase
          .from('citas')
          .update(insertData)
          .eq('id', cita_id)
          .select('id')
          .single()
        citaNueva = res.data
        citaError = res.error
      } else {
        const res = await supabase
          .from('citas')
          .insert(insertData)
          .select('id')
          .single()
        citaNueva = res.data
        citaError = res.error
      }

      if (citaError) throw citaError
      if (!citaNueva) throw new Error('Error guardando cita')
      citaId = citaNueva.id
    } else if (productosCarrito.length > 0 && !servicio_id) {
      // Si solo hay productos sin servicio, crear una cita "virtual" para registro
      // No se crea cita, solo se registra la transacción contable abajo
    }

    // 3.1. Enviar notificación 2x1 si hay acompañante con correo
    if (acompanante_2x1?.email && citaId && estado !== 'completado') {
      try {
        const d = ahora
        const fechaFormat = d.toLocaleDateString('es-BO')
        const horaFormat = d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
        
        await dispatchNotification(adminSupabase, {
          event: 'invitacion_2x1',
          payload: {
            citaId,
            acompananteNombre: acompanante_2x1.nombre,
            acompananteEmail: acompanante_2x1.email,
            clienteNombre: nombre || 'Un amigo',
            fecha: fechaFormat,
            hora: horaFormat
          }
        })
      } catch (e) { console.error('Error dispatching 2x1 invite', e) }
    }

    // 4. Procesar productos: actualizar stock y registrar transacciones
    if (productosCarrito.length > 0 && estado === 'completado') {
      for (const item of productosCarrito) {
        // Descontar stock
        const { data: pActual } = await supabase.from('productos').select('stock_actual').eq('id', item.id).single()
        const stockAnterior = pActual?.stock_actual || 0
        const nuevoStock = Math.max(0, stockAnterior - item.cantidad)
        if (pActual) {
          await adminSupabase.from('productos')
            .update({ stock_actual: nuevoStock })
            .eq('id', item.id)
        }

        // Registrar movimiento de inventario
        try {
          await adminSupabase.from('inventario_movimientos').insert({
            producto_id: item.id,
            tipo: 'venta',
            cantidad: -item.cantidad,
            stock_anterior: stockAnterior,
            stock_nuevo: nuevoStock,
            referencia: citaId || 'venta-pos',
            notas: `Venta POS - ${item.cantidad}x ${item.nombre}`,
            usuario_id: user.id,
          })
        } catch (e) { console.error('Error registrando movimiento inventario:', e) }

        // Registrar transacción contable por producto
        await adminSupabase
          .from('transactions')
          .insert({
            libro: 'VENTAS',
            fecha: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora),
            ci: ci || '0000000',
            nombre: nombre || 'Cliente en Caja',
            cuenta_codigo: '4.1.2',
            cuenta_detalle: item.nombre,
            producto_id: item.id,
            glosa: `Venta POS - ${item.cantidad}x ${item.nombre}`,
            costo: item.precio * item.cantidad,
            tipo_movimiento: 'INGRESO',
            subcategoria: 'PRODUCTO_VENTA',
            es_sancion: false,
            empleado_id: barbero_id,
            cliente_id: finalClienteId,
            metodo_pago: metodo_pago || 'efectivo',
            notas: metodo_pago === 'mixto' ? `Efectivo: Bs ${Number(monto_efectivo || 0)} | QR: Bs ${Number(monto_qr || 0)}` : null,
            comprobante_url: comprobante_url || null,
            usuario_registro: profile.full_name || 'Coordinador',
          })
      }
    }

    // Mark referral bonuses as used (when the referrer USES their bonus)
    if (referralIdsToMark.length > 0 && estado === 'completado') {
      for (const refId of referralIdsToMark) {
        await adminSupabase.from('referrals').update({ bono_usado: true }).eq('id', refId)
      }
    }

    // Auto-complete pending referral bonus for the referrer (when the referred client COMPLETES their first service)
    if (finalClienteId && estado === 'completado') {
      const { data: pendingReferral } = await adminSupabase
        .from('referrals')
        .select('id, cliente_recomendante_id, monto_bono, recomendante:clientes!cliente_recomendante_id(nombre, email)')
        .eq('cliente_recomendado_id', finalClienteId)
        .eq('bono_otorgado', false)
        .maybeSingle()
        
      if (pendingReferral) {
        await adminSupabase.from('referrals').update({ bono_otorgado: true }).eq('id', pendingReferral.id)
        
        try {
          // Type cast to any because Supabase may infer `never` depending on how joins are typed in the DB types
          const recInfo: any = pendingReferral.recomendante
          const recEmail = Array.isArray(recInfo) ? recInfo[0]?.email : recInfo?.email
          const recNombre = Array.isArray(recInfo) ? recInfo[0]?.nombre : recInfo?.nombre
          
          if (recEmail) {
            await dispatchNotification(adminSupabase, {
              event: 'invitacion_referido',
              payload: {
                acompananteNombre: recNombre || 'Amigo',
                clienteNombre: (nombre as string) || 'Tu amigo',
                montoBono: pendingReferral.monto_bono.toString()
              },
              userEmail: recEmail
            })
          }
        } catch (e) { console.error('Error dispatching referral bonus notification', e) }
      }
    }

    // 5. Si el estado es "completado", impactar contabilidad de servicio y lealtad
    if (estado === 'completado') {
      // 5.a Lealtad (solo sumar productos de venta normal, no tienda)
      if (finalClienteId) {
        const totalProductosCliente = productosCarrito
          .reduce((sum, p) => sum + (p.precio * p.cantidad), 0)

        const { data: cData } = await supabase.from('clientes').select('total_visitas, total_gastado').eq('id', finalClienteId).single()
        if (cData) {
          const nuevoTotalVisitas = (cData.total_visitas || 0) + 1
          const nuevoNivel = await calcularNivelFidelidad(supabase, nuevoTotalVisitas)
          
          await adminSupabase.from('clientes')
            .update({
              total_visitas: nuevoTotalVisitas,
              total_gastado: (cData.total_gastado || 0) + precioBase + totalProductosCliente,
              nivel_fidelidad: nuevoNivel
            })
            .eq('id', finalClienteId)
        }
      }

      // 5.b Transacción Contable del servicio (solo si hay servicio)
      if (servicio_id && serv) {
        const { data: barberoProfile } = await supabase.from('profiles').select('full_name').eq('id', barbero_id).single()
        
        await adminSupabase
          .from('transactions')
          .insert({
            libro: 'SERVICIOS',
            fecha: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora),
            ci: ci || '0000000',
            nombre: nombre || 'Cliente en Caja',
            cuenta_codigo: 'ING-001',
            cuenta_detalle: 'Ingresos por Servicios (POS)',
            glosa: `Venta desde Caja - Servicio ${serv.nombre} - Barbero: ${barberoProfile?.full_name || 'Desconocido'}`,
            costo: precioBase,
            tipo_movimiento: 'INGRESO',
            subcategoria: 'SERVICIO',
            es_sancion: false,
            empleado_id: barbero_id,
            cliente_id: finalClienteId,
            metodo_pago: metodo_pago || 'efectivo',
            notas: metodo_pago === 'mixto' ? `Efectivo: Bs ${Number(monto_efectivo || 0)} | QR: Bs ${Number(monto_qr || 0)}` : null,
            comprobante_url: comprobante_url || null,
            usuario_registro: profile.full_name || 'Coordinador',
          })
      }
        
      // Despachar notificacion
      if (citaId) {
        let clienteDataForNotif = null
        if (finalClienteId) {
          const { data } = await supabase.from('clientes').select('user_id, email, full_name').eq('id', finalClienteId).single()
          clienteDataForNotif = data
        }
        
        let finalBarberoNombre = 'Tu Barbero'
        if (barbero_id) {
          const { data: bData } = await supabase.from('profiles').select('full_name').eq('id', barbero_id).single()
          if (bData?.full_name) finalBarberoNombre = bData.full_name
        }
        
        const db = getNotificationDbClient(supabase)
        await dispatchNotification(db, {
          event: 'cita_completada',
          payload: { 
            citaId, 
            barberoId: barbero_id, 
            barberoNombre: finalBarberoNombre,
            monto: precioBase + totalProductos,
            clienteId: clienteDataForNotif?.user_id || undefined,
            clienteEmail: clienteDataForNotif?.email || undefined,
            clienteNombre: clienteDataForNotif?.full_name || undefined
          },
        })
      }
    } else {
      // Si fue "en_proceso", notificar al barbero para que empiece
      if (citaId) {
        const db = getNotificationDbClient(supabase)
        await dispatchNotification(db, {
          event: 'reserva_nueva',
          payload: { citaId, barberoId: barbero_id, monto: precioBase },
        })
      }
    }

    return NextResponse.json({ success: true, cita_id: citaId })
  } catch (error: any) {
    console.error('Error Checkout Caja:', error)
    return NextResponse.json({ error: error.message || 'Error procesando la venta' }, { status: 500 })
  }
}
