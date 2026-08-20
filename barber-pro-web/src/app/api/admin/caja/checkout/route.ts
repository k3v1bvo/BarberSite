import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient, getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification, dispatchCitaReprogramada } from '@/lib/notifications/dispatch'
import { calcularNivelFidelidad } from '@/lib/lealtad/calcular-nivel'
import { calcularComisionBarbero } from '@/lib/comisiones/calcular'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/** Genera una contraseña legible para enviar al cliente (ej: barber7392) */
function generarPasswordCliente(): string {
  const digits = crypto.randomInt(1000, 9999)
  return `barber${digits}`
}

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
      monto_qr,
      anticipo_monto,
      descuento_manual
    } = body
    const anticipoQr = Number(anticipo_monto || 0)
    const descuentoManual = Number(descuento_manual || 0)
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
    let clienteEmail = email ? email.trim() : null
    let clienteNombre = nombre ? nombre.trim() : ''
    let clienteTelefono = telefono ? telefono.trim() : null
    let clienteCi = (ci && String(ci).trim() !== '0000000' && String(ci).trim() !== '0' && String(ci).trim() !== '') ? String(ci).trim() : null
    let isNewClient = false
    let authUserId: string | null = null

    // 1. GESTIÓN DEL CLIENTE Y PERSISTENCIA DE CI
    if (!finalClienteId && clienteNombre) {
      // Buscar cliente existente por CI, Email o Nombre
      const orClauses: string[] = []
      if (clienteCi) orClauses.push(`ci.eq."${clienteCi}"`)
      if (clienteEmail) orClauses.push(`email.eq."${clienteEmail}"`)
      if (clienteNombre) orClauses.push(`nombre.ilike."${clienteNombre}"`)

      let exClientes: any[] | null = null
      if (orClauses.length > 0) {
        const { data } = await adminSupabase
          .from('clientes')
          .select('id, nombre, email, telefono, ci, total_visitas, total_gastado')
          .or(orClauses.join(','))
          .limit(5)
        exClientes = data
      }

      if (exClientes && exClientes.length > 0) {
        finalClienteId = exClientes[0].id
        // Actualizar datos del cliente (CI, teléfono, email, nombre) en la tabla clientes
        const updates: any = {}
        if (clienteCi && exClientes[0].ci !== clienteCi) updates.ci = clienteCi
        if (clienteTelefono && exClientes[0].telefono !== clienteTelefono) updates.telefono = clienteTelefono
        if (clienteEmail && exClientes[0].email !== clienteEmail) updates.email = clienteEmail
        if (!exClientes[0].nombre && clienteNombre) updates.nombre = clienteNombre

        if (Object.keys(updates).length > 0) {
          await adminSupabase.from('clientes').update(updates).eq('id', finalClienteId)
        }

        if (!clienteEmail && exClientes[0].email) clienteEmail = exClientes[0].email
        if (!clienteCi && exClientes[0].ci) clienteCi = exClientes[0].ci
        if (!clienteTelefono && exClientes[0].telefono) clienteTelefono = exClientes[0].telefono
      } else {
        // Crear cliente nuevo
        isNewClient = true
        const { data: newCliente, error: clError } = await adminSupabase
          .from('clientes')
          .insert({
            nombre: clienteNombre,
            email: clienteEmail || null,
            telefono: clienteTelefono || null,
            ci: clienteCi || null,
            total_visitas: 0,
            total_gastado: 0
          })
          .select('id')
          .single()

        if (clError) throw clError
        finalClienteId = newCliente.id
      }
    } else if (finalClienteId) {
      // Si ya venía un cliente_id seleccionado, actualizar los campos proporcionados en clientes
      const { data: exCliente } = await adminSupabase
        .from('clientes')
        .select('id, nombre, email, telefono, ci')
        .eq('id', finalClienteId)
        .single()

      if (exCliente) {
        const updates: any = {}
        if (clienteCi && exCliente.ci !== clienteCi) updates.ci = clienteCi
        if (clienteTelefono && exCliente.telefono !== clienteTelefono) updates.telefono = clienteTelefono
        if (clienteEmail && exCliente.email !== clienteEmail) updates.email = clienteEmail
        if (clienteNombre && exCliente.nombre !== clienteNombre) updates.nombre = clienteNombre

        if (Object.keys(updates).length > 0) {
          await adminSupabase.from('clientes').update(updates).eq('id', finalClienteId)
        }

        if (!clienteEmail && exCliente.email) clienteEmail = exCliente.email
        if (!clienteCi && exCliente.ci) clienteCi = exCliente.ci
        if (!clienteTelefono && exCliente.telefono) clienteTelefono = exCliente.telefono
      }
    }

    // Gestionar cuenta Auth del usuario y envío de credenciales por email + alerta sistema
    if (clienteEmail) {
      try {
        const generatedPwd = generarPasswordCliente()
        const { data: authData, error: createErr } = await adminSupabase.auth.admin.createUser({
          email: clienteEmail,
          password: generatedPwd,
          email_confirm: true,
          user_metadata: { full_name: clienteNombre || 'Cliente' }
        })

        if (!createErr && authData?.user) {
          authUserId = authData.user.id
          // Actualizar perfil con CI, teléfono y rol cliente
          await adminSupabase.from('profiles').update({
            full_name: clienteNombre || 'Cliente',
            phone: clienteTelefono || null,
            ci: clienteCi || null,
            role: 'cliente'
          }).eq('id', authUserId)

          // Despachar correo de bienvenida y notificaciones al sistema
          try {
            await dispatchNotification(adminSupabase, {
              event: 'bienvenida_nuevo_usuario',
              userEmail: clienteEmail,
              payload: {
                nombre: clienteNombre || 'Cliente',
                email: clienteEmail,
                password: generatedPwd
              }
            })
          } catch(e) { console.error("Error enviando bienvenida de nuevo usuario:", e) }
        } else {
          // El usuario ya existe en auth. Sincronizar perfiles
          const { data: existingProf } = await adminSupabase.from('profiles').select('id, full_name, phone, ci').eq('email', clienteEmail).maybeSingle()
          if (existingProf?.id) {
            authUserId = existingProf.id
            const profUpdates: any = {}
            if (clienteCi && !existingProf.ci) profUpdates.ci = clienteCi
            if (clienteTelefono && !existingProf.phone) profUpdates.phone = clienteTelefono
            if (clienteNombre && !existingProf.full_name) profUpdates.full_name = clienteNombre
            if (Object.keys(profUpdates).length > 0) {
              await adminSupabase.from('profiles').update(profUpdates).eq('id', authUserId)
            }
          }
        }
      } catch(e) { console.error("Error gestionando cuenta Auth del cliente:", e) }
    } else if (isNewClient) {
      // Cliente nuevo creado en POS sin correo: Notificar a Admin y Coordinador por sistema web
      try {
        await dispatchNotification(adminSupabase, {
          event: 'bienvenida_nuevo_usuario',
          payload: {
            nombre: clienteNombre || 'Cliente en Caja',
            email: clienteCi ? `CI: ${clienteCi}` : 'Registrado en POS',
            password: ''
          }
        })
      } catch(e) { console.error("Error notificando nuevo cliente en POS:", e) }
    }

    // Resolver el CI real del cliente desde la BD (para que no quede '0000000' en transacciones)
    let ciReal = clienteCi || ''
    if (finalClienteId && !ciReal) {
      const { data: ciData } = await adminSupabase.from('clientes').select('ci').eq('id', finalClienteId).single()
      if (ciData?.ci) ciReal = ciData.ci
    }
    if (!ciReal && clienteNombre && clienteNombre !== 'Cliente General') {
      const { data: ciByName } = await adminSupabase.from('clientes').select('ci').ilike('nombre', clienteNombre.trim()).limit(1)
      if (ciByName && ciByName.length > 0 && ciByName[0].ci) ciReal = ciByName[0].ci
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
    let comisionCategoria: string | null = null
    let comisionHerramientas: boolean | null = null

    if (servicio_id) {
      const { data: servData } = await supabase
        .from('servicios')
        .select('precio, nombre, duracion_minutos, comision_activa, comision_tipo, comision_valor, comision_acumulable')
        .eq('id', servicio_id)
        .single()
        
      if (!servData) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
      serv = servData
      precioBase = serv.precio || 0

      if (estado === 'completado' && barbero_id) {
        // Calcular comisión personalizada por barbero
        const fechaCita = reserva_fecha ? new Date(`${reserva_fecha}T12:00:00-04:00`) : new Date()
        const comResult = await calcularComisionBarbero(
          supabase, barbero_id, servicio_id, precioBase, fechaCita,
          { comision_activa: serv.comision_activa, comision_tipo: serv.comision_tipo, comision_valor: serv.comision_valor, comision_acumulable: serv.comision_acumulable }
        )
        const extraPropinas = serv.comision_acumulable !== false ? (propinas || 0) : 0
        comisionTotal = comResult.monto + (extraPropinas * 0.5)
        comisionCategoria = comResult.categoria_nombre
        comisionHerramientas = comResult.tiene_herramientas
      }
    }

    // Calcular total de productos
    const totalProductos = productosCarrito.reduce((sum: number, item: ProductoCarrito) => sum + (item.precio * item.cantidad), 0)

    // 3. Crear la cita (si hay servicio)
    const ahora = new Date()
    let citaId: string | null = null
    let wasRescheduled = false
    let oldFechaHora = ''
    let citaFechaHoraFinal: string = ahora.toISOString()

    if (servicio_id && serv) {
      // Determine the datetime to use
      let baseDate = ahora
      if (reserva_fecha && reserva_hora) {
        baseDate = new Date(`${reserva_fecha}T${reserva_hora}:00-04:00`)
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

      // Calcular el precio neto del servicio (después de descuentos, sin contar productos/propinas)
      const precioNetoServicio = Math.max(0, precioBase - descuentoTotal)
      // Total real a cobrar (servicio neto + productos + propinas - anticipo)
      const totalRealACobrar = Math.max(0, precioNetoServicio + totalProductos + (propinas || 0) - anticipoQr)

      if (descuentoTotal > 0) {
        if (descuentoManual > 0) {
          finalNotas += `\n⭐ Precio Especial / Desc: -Bs ${descuentoManual}`
        }
        finalNotas += `\nPrecio original: Bs ${precioBase} → Neto cobrado: Bs ${precioNetoServicio}`
      }

      const insertData: any = {
        cliente_id: finalClienteId,
        barbero_id,
        servicio_id,
        fecha_hora: inicio.toISOString(),
        precio: precioNetoServicio,
        duracion_real_minutos: serv.duracion_minutos || 30,
        estado: estado || 'en_proceso',
        notas: finalNotas,
      }
      citaFechaHoraFinal = insertData.fecha_hora

      if (estado === 'completado') {
        insertData.updated_at = ahora.toISOString()
        insertData.metodo_pago = metodo_pago || 'efectivo'
        insertData.propinas = propinas || 0
        insertData.comision_barbero = comisionTotal
        insertData.comision_categoria = comisionCategoria
        insertData.comision_herramientas = comisionHerramientas
        // Nota: 'total' y 'descuento' no se guardan en la tabla citas (no existen como columnas).
        // El total queda registrado en la transacción contable más abajo.
        if (comprobante_url) {
          insertData.notas = `${insertData.notas}\n[Comprobante]: ${comprobante_url}`
        }
      }

      let citaNueva, citaError
      
      if (cita_id) {
        if (!reserva_fecha || !reserva_hora) {
          delete insertData.fecha_hora
        } else {
          const { data: oldCita } = await supabase.from('citas').select('fecha_hora').eq('id', cita_id).single()
          if (oldCita?.fecha_hora && oldCita.fecha_hora !== insertData.fecha_hora) {
            wasRescheduled = true
            oldFechaHora = oldCita.fecha_hora
          }
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

      if (citaError) {
        if (citaError.message?.includes('comision_') || citaError.message?.includes('column') || (citaError as any).code === 'PGRST204') {
          // Limpiar columnas que pueden no existir en la tabla citas
          delete insertData.comision_categoria
          delete insertData.comision_herramientas
          delete insertData.total
          delete insertData.descuento
          const retryRes = cita_id
            ? await supabase.from('citas').update(insertData).eq('id', cita_id).select('id').single()
            : await supabase.from('citas').insert(insertData).select('id').single()
          citaNueva = retryRes.data
          citaError = retryRes.error
        }
      }

      if (citaError) throw citaError
      if (!citaNueva) throw new Error('Error guardando cita')
      citaId = citaNueva.id
    } else if (productosCarrito.length > 0 && !servicio_id) {
      // Si solo hay productos sin servicio, crear una cita "virtual" para registro
      // No se crea cita, solo se registra la transacción contable abajo
    }

    // 3.1. Notificación de Nueva Reserva / Turno si no es completada inmediata
    const esReservaOPendiente = (reserva_fecha && reserva_hora) || estado !== 'completado'
    if (servicio_id && serv && citaId && esReservaOPendiente && !wasRescheduled) {
      try {
        const fh = (reserva_fecha && reserva_hora)
          ? new Date(`${reserva_fecha}T${reserva_hora}:00-04:00`)
          : ahora

        const { data: barberoRow } = await adminSupabase.from('profiles').select('full_name, email').eq('id', barbero_id).single()
        let finalBarberoEmail = barberoRow?.email
        if (!finalBarberoEmail && adminSupabase?.auth?.admin) {
          try {
            const { data: authUser } = await adminSupabase.auth.admin.getUserById(barbero_id)
            if (authUser?.user?.email) {
              finalBarberoEmail = authUser.user.email
              await adminSupabase.from('profiles').update({ email: authUser.user.email }).eq('id', barbero_id)
            }
          } catch (_) {}
        }

        const precioNetoServicio = Math.max(0, precioBase - descuentoTotal)
        await dispatchNotification(adminSupabase, {
          event: 'reserva_nueva',
          payload: {
            citaId,
            barberoId: barbero_id,
            barberoNombre: barberoRow?.full_name || 'Barbero',
            barberoEmail: finalBarberoEmail,
            clienteNombre: clienteNombre || 'Cliente',
            clienteEmail: clienteEmail || undefined,
            servicioNombre: serv.nombre,
            fecha: fh.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }),
            hora: fh.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hour12: false }),
            metodoPago: metodo_pago ? (metodo_pago === 'efectivo' ? 'Efectivo en Caja' : metodo_pago === 'qr' ? 'Pago QR' : metodo_pago) : 'Pago en el local',
            monto: precioNetoServicio,
          },
        })
      } catch (e) {
        console.error('Error enviando notificación de nueva reserva desde POS:', e)
      }
    }

    // 3.2. Notificación de Reprogramación si cambió el horario
    if (servicio_id && serv && citaId && wasRescheduled) {
      try {
        const { data: barberoRow } = await adminSupabase.from('profiles').select('full_name').eq('id', barbero_id).single()
        const dNueva = new Date(citaFechaHoraFinal)
        const dVieja = oldFechaHora ? new Date(oldFechaHora) : null

        await dispatchNotification(adminSupabase, {
          event: 'reserva_reprogramada',
          payload: {
            citaId,
            barberoId: barbero_id,
            barberoNombre: barberoRow?.full_name || 'Barbero',
            clienteNombre: clienteNombre || 'Cliente',
            clienteEmail: clienteEmail || undefined,
            servicioNombre: serv.nombre,
            fecha: dNueva.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }),
            hora: dNueva.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hour12: false }),
            fechaAnterior: dVieja ? dVieja.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }) : 'Horario anterior',
            horaAnterior: dVieja ? dVieja.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hour12: false }) : '',
          }
        })
      } catch (e) { console.error('Error dispatching reprogramacion notification:', e) }
    }

    // 3.3. Enviar notificación 2x1 si hay acompañante con correo
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
            clienteNombre: clienteNombre || 'Un amigo',
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
            ci: ciReal || '—',
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
            cita_id: citaId || null,
            metodo_pago: metodo_pago || 'efectivo',
            monto_efectivo: metodo_pago === 'mixto' ? Number(monto_efectivo || 0) : (metodo_pago === 'efectivo' ? item.precio * item.cantidad : 0),
            monto_qr: metodo_pago === 'mixto' ? Number(monto_qr || 0) : (metodo_pago === 'qr' || metodo_pago === 'tarjeta' ? item.precio * item.cantidad : 0),
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
        await adminSupabase.from('referrals').update({ bono_otorgado: true, bono_usado: false }).eq('id', pendingReferral.id)
        
        try {
          // Type cast to any because Supabase may infer `never` depending on how joins are typed in the DB types
          const recInfo: any = pendingReferral.recomendante
          const recEmail = Array.isArray(recInfo) ? recInfo[0]?.email : recInfo?.email
          const recNombre = Array.isArray(recInfo) ? recInfo[0]?.nombre : recInfo?.nombre
          
          if (pendingReferral.cliente_recomendante_id) {
            try {
              await adminSupabase.from('notificaciones').insert({
                usuario_id: pendingReferral.cliente_recomendante_id,
                tipo: 'bono_referido',
                titulo: '🎉 ¡Bono de Referido Acreditado!',
                mensaje: `Tu amigo ${(nombre as string) || 'referido'} acaba de atenderse en BarberSite. Te acreditamos Bs ${pendingReferral.monto_bono} en tu billetera.`,
                leido: false,
                created_at: new Date().toISOString()
              })
            } catch (_) {}
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
          
          // Usar el precio NETO (después de descuentos) para el total gastado del cliente
          const gastoRealCliente = Math.max(0, precioBase - descuentoTotal) + totalProductosCliente
          await adminSupabase.from('clientes')
            .update({
              total_visitas: nuevoTotalVisitas,
              total_gastado: (cData.total_gastado || 0) + gastoRealCliente,
              nivel_fidelidad: nuevoNivel
            })
            .eq('id', finalClienteId)
        }
      }

      // 5.b Transacción Contable del servicio (solo si hay servicio)
      if (servicio_id && serv) {
        const { data: barberoProfile } = await supabase.from('profiles').select('full_name').eq('id', barbero_id).single()
        const barberoNombre = barberoProfile?.full_name || 'Desconocido'

        // --- Calcular montos reales considerando anticipo (QR) ---
        const precioNetoServicio = Math.max(0, precioBase - descuentoTotal)
        const restoPagar = Math.max(0, precioNetoServicio - anticipoQr)
        const metodoResto = metodo_pago || 'efectivo'

        let realEfectivo = 0
        let realQr = anticipoQr // El anticipo siempre fue QR
        let realMetodo = metodoResto

        if (metodoResto === 'efectivo') {
          realEfectivo = restoPagar
        } else if (metodoResto === 'qr' || metodoResto === 'tarjeta') {
          realQr += restoPagar
        } else if (metodoResto === 'mixto') {
          realEfectivo = Number(monto_efectivo || 0)
          realQr += Number(monto_qr || 0)
        }

        // Si hubo anticipo QR + efectivo en caja => es mixto real
        if (anticipoQr > 0 && realEfectivo > 0) {
          realMetodo = 'mixto'
        } else if (anticipoQr > 0 && realEfectivo === 0) {
          realMetodo = 'qr'
        }

        // Construir glosa y notas detalladas
        let glosaFinal = `Servicio: ${serv.nombre}`
        if (descuentoTotal > 0) {
          glosaFinal += ` (Original: Bs ${precioBase} → Neto: Bs ${precioNetoServicio})`
        }
        glosaFinal += `\nAtendido por ${barberoNombre}`
        if (citaId) glosaFinal += ` — Cita #${citaId.substring(0, 6)}`

        const notasParts: string[] = []
        if (anticipoQr > 0) notasParts.push(`Anticipo QR: Bs ${anticipoQr}`)
        if (realMetodo === 'mixto') {
          notasParts.push(`Efectivo: Bs ${realEfectivo} | QR: Bs ${realQr}`)
        } else if (realMetodo === 'qr') {
          if (anticipoQr > 0) notasParts.push(`Cobrado en caja (QR): Bs ${restoPagar}`)
        } else {
          if (anticipoQr > 0) notasParts.push(`Cobrado en caja (Efectivo): Bs ${restoPagar}`)
        }
        if (descuentoManual > 0) notasParts.push(`⭐ Precio Especial / Desc: -Bs ${descuentoManual}`)
        if (descuentoTotal > 0 && descuentoTotal !== descuentoManual) notasParts.push(`Descuento total: -Bs ${descuentoTotal}`)
        if (descuentoTotal > 0) notasParts.push(`Precio original: Bs ${precioBase} → Neto cobrado: Bs ${precioNetoServicio}`)
        const notasFinales = notasParts.length > 0 ? notasParts.join(' | ') : null

        // IMPORTANTE: costo debe ser el precio NETO (después de descuentos)
        // para que el resumen de caja chica refleje lo realmente cobrado
        await adminSupabase
          .from('transactions')
          .insert({
            libro: 'SERVICIOS',
            fecha: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora),
            ci: ciReal || '—',
            nombre: nombre || 'Cliente en Caja',
            cuenta_codigo: 'ING-001',
            cuenta_detalle: serv.nombre,
            glosa: glosaFinal,
            costo: precioNetoServicio,
            tipo_movimiento: 'INGRESO',
            subcategoria: 'SERVICIO',
            es_sancion: false,
            empleado_id: barbero_id,
            cliente_id: finalClienteId,
            cita_id: citaId || null,
            metodo_pago: realMetodo,
            monto_efectivo: realEfectivo,
            monto_qr: realQr,
            notas: notasFinales,
            comprobante_url: comprobante_url || null,
            usuario_registro: profile.full_name || 'Coordinador',
          })
      }
        
      // Despachar notificacion de cobro / cita completada
      if (citaId) {
        let finalBarberoNombre = 'Tu Barbero'
        if (barbero_id) {
          const { data: bData } = await adminSupabase.from('profiles').select('full_name').eq('id', barbero_id).single()
          if (bData?.full_name) finalBarberoNombre = bData.full_name
        }
        
        let clientUserIdForNotif = authUserId
        if (!clientUserIdForNotif && clienteEmail) {
          const { data: cProf } = await adminSupabase.from('profiles').select('id').eq('email', clienteEmail).maybeSingle()
          if (cProf?.id) clientUserIdForNotif = cProf.id
        }

        const precioNetoServicio = Math.max(0, precioBase - descuentoTotal)
        const db = getNotificationDbClient(adminSupabase)
        await dispatchNotification(db, {
          event: 'cita_completada',
          payload: { 
            citaId, 
            barberoId: barbero_id, 
            barberoNombre: finalBarberoNombre,
            monto: precioNetoServicio + totalProductos,
            clienteId: clientUserIdForNotif || undefined,
            clienteEmail: clienteEmail || undefined,
            clienteNombre: clienteNombre || 'Cliente'
          },
        })
      }
    }

    return NextResponse.json({ success: true, cita_id: citaId })
  } catch (error: any) {
    console.error('Error Checkout Caja:', error)
    return NextResponse.json({ error: error.message || 'Error procesando la venta' }, { status: 500 })
  }
}
