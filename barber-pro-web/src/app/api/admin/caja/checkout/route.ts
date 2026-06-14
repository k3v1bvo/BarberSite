import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient, getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { calcularNivelFidelidad } from '@/lib/lealtad/calcular-nivel'
import { NextRequest, NextResponse } from 'next/server'

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

    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      cliente_id, nombre, email, telefono, 
      servicio_id, barbero_id, 
      metodo_pago, propinas, estado, notas 
    } = body

    if (!servicio_id || !barbero_id) {
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
          // Intentar invitar al usuario para cruzar datos
          try {
             await adminSupabase.auth.admin.inviteUserByEmail(email, {
               data: { full_name: nombre }
             })
          } catch(e) { console.error("Error invitando usuario:", e) }
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
        }
      }
    } else if (finalClienteId && email) {
      // Actualizar email si se seleccionó cliente existente
       const { data: exCliente } = await supabase.from('clientes').select('email').eq('id', finalClienteId).single()
       if (!exCliente?.email) {
          await adminSupabase.from('clientes').update({ email }).eq('id', finalClienteId)
          clienteEmail = email
          try {
             await adminSupabase.auth.admin.inviteUserByEmail(email, {
               data: { full_name: nombre || 'Cliente' }
             })
          } catch(e) {}
       }
    }

    // 2. Obtener precio del servicio y calcular comisión si aplica
    const { data: serv } = await supabase
      .from('servicios')
      .select('precio, nombre, duracion_minutos, comision_activa, comision_tipo, comision_valor, comision_acumulable')
      .eq('id', servicio_id)
      .single()
      
    if (!serv) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

    const precioBase = serv.precio || 0
    let comisionTotal = 0

    if (estado === 'completado') {
      const { data: barbero } = await supabase.from('profiles').select('comision_porcentaje, full_name').eq('id', barbero_id).single()
      const barberoComision = barbero?.comision_porcentaje || 0
      
      let baseComision = 0
      if (serv.comision_activa !== false && serv.comision_tipo !== 'ninguna') {
        if (serv.comision_tipo === 'fija') {
          baseComision = serv.comision_valor || 0
        } else if (serv.comision_tipo === 'porcentaje') {
          baseComision = (precioBase * (serv.comision_valor || 0)) / 100
        } else {
          baseComision = (precioBase * barberoComision) / 100
        }
      }
      const extraPropinas = serv.comision_acumulable !== false ? (propinas || 0) : 0
      comisionTotal = baseComision + (extraPropinas * 0.5) // Ejemplo: 50% de propina como extra, asumiendo política
    }

    // 3. Crear la cita
    const ahora = new Date()
    const inicio = new Date(ahora.getTime() - (serv.duracion_minutos || 30) * 60000)

    const insertData: any = {
      cliente_id: finalClienteId,
      barbero_id,
      servicio_id,
      fecha_hora: estado === 'completado' ? inicio.toISOString() : ahora.toISOString(),
      precio: precioBase,
      duracion_real_minutos: serv.duracion_minutos || 30,
      estado: estado || 'en_proceso',
      notas: notas || 'Venta desde Caja',
    }

    if (estado === 'completado') {
      insertData.finished_at = ahora.toISOString()
      insertData.metodo_pago = metodo_pago || 'efectivo'
      insertData.propinas = propinas || 0
      insertData.comision_barbero = comisionTotal
    }

    const { data: citaNueva, error: citaError } = await supabase
      .from('citas')
      .insert(insertData)
      .select('id')
      .single()

    if (citaError) throw citaError

    // 4. Si el estado es "completado", impactar contabilidad y lealtad
    if (estado === 'completado') {
      // 4.a Lealtad
      if (finalClienteId) {
        const { data: cData } = await supabase.from('clientes').select('total_visitas, total_gastado').eq('id', finalClienteId).single()
        if (cData) {
          const nuevoTotalVisitas = (cData.total_visitas || 0) + 1
          const nuevoNivel = await calcularNivelFidelidad(supabase, nuevoTotalVisitas)
          
          await adminSupabase.from('clientes')
            .update({
              total_visitas: nuevoTotalVisitas,
              total_gastado: (cData.total_gastado || 0) + precioBase,
              nivel_fidelidad: nuevoNivel
            })
            .eq('id', finalClienteId)
        }
      }

      // 4.b Transacción Contable
      const { data: barberoProfile } = await supabase.from('profiles').select('full_name').eq('id', barbero_id).single()
      
      await adminSupabase
        .from('transactions')
        .insert({
          libro: 'SERVICIOS',
          fecha: ahora.toISOString().split('T')[0],
          ci: '0000000',
          nombre: nombre || 'Cliente en Caja',
          cuenta_codigo: 'ING-001',
          cuenta_detalle: 'Ingresos por Servicios (POS)',
          glosa: `Venta desde Caja - Servicio ${serv.nombre} - Barbero: ${barberoProfile?.full_name || 'Desconocido'}`,
          costo: precioBase,
          tipo_movimiento: 'PAGO_CLIENTE',
          es_sancion: false,
          empleado_id: barbero_id,
          cliente_id: finalClienteId,
          metodo_pago: metodo_pago || 'efectivo',
          usuario_registro: profile.full_name || 'Coordinador',
        })
        
      // Despachar notificacion
      const db = getNotificationDbClient(supabase)
      await dispatchNotification(db, {
        event: 'cita_completada',
        payload: { citaId: citaNueva.id, barberoId: barbero_id, monto: precioBase },
      })
    } else {
      // Si fue "en_proceso", notificar al barbero para que empiece
       const db = getNotificationDbClient(supabase)
       await dispatchNotification(db, {
         event: 'reserva_nueva',
         payload: { citaId: citaNueva.id, barberoId: barbero_id, monto: precioBase },
       })
    }

    return NextResponse.json({ success: true, cita_id: citaNueva.id })
  } catch (error: any) {
    console.error('Error Checkout Caja:', error)
    return NextResponse.json({ error: error.message || 'Error procesando la venta' }, { status: 500 })
  }
}
