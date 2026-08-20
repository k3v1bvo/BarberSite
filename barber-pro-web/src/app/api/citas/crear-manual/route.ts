import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { calcularComisionBarbero } from '@/lib/comisiones/calcular'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

function generarPasswordCliente(): string {
  const digits = crypto.randomInt(1000, 9999)
  return `barber${digits}`
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const adminSupabase = createAdminSupabaseClient() || supabase

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coordinador', 'barbero'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para agendar citas' }, { status: 403 })
    }

    const body = await request.json()
    let { cliente_id, nombre_cliente, telefono_cliente, ci_cliente, email_cliente, servicio_id, barbero_id, fecha_hora, notas } = body

    if (!servicio_id || !fecha_hora) {
      return NextResponse.json({ error: 'Servicio y Fecha/Hora son obligatorios' }, { status: 400 })
    }

    // Si es un barbero, por defecto se auto-asigna a sí mismo si no seleccionó otro
    if (profile.role === 'barbero' && !barbero_id) {
      barbero_id = user.id
    }

    if (!barbero_id) {
      return NextResponse.json({ error: 'Debes seleccionar un barbero para la cita' }, { status: 400 })
    }

    const cleanNombre = nombre_cliente ? nombre_cliente.trim() : ''
    const cleanTelefono = telefono_cliente ? telefono_cliente.trim() : null
    const cleanCi = (ci_cliente && ci_cliente.trim() !== '0000000' && ci_cliente.trim() !== '0') ? ci_cliente.trim() : null
    const cleanEmail = email_cliente && email_cliente.includes('@') ? email_cliente.trim() : null
    let isNewClient = false

    // 1. Resolver o Crear Cliente y asegurar CI
    if (!cliente_id) {
      if (!cleanNombre) {
        return NextResponse.json({ error: 'Ingresa el nombre del cliente' }, { status: 400 })
      }

      // Buscar si ya existe por CI, email o nombre
      const orClauses: string[] = []
      if (cleanCi) orClauses.push(`ci.eq."${cleanCi}"`)
      if (cleanEmail) orClauses.push(`email.eq."${cleanEmail}"`)
      if (cleanNombre) orClauses.push(`nombre.ilike."${cleanNombre}"`)

      let exCliente: any = null
      if (orClauses.length > 0) {
        const { data: found } = await adminSupabase
          .from('clientes')
          .select('id, nombre, email, telefono, ci')
          .or(orClauses.join(','))
          .limit(1)
          .maybeSingle()
        exCliente = found
      }

      if (exCliente?.id) {
        cliente_id = exCliente.id
        const updates: any = {}
        if (cleanCi && exCliente.ci !== cleanCi) updates.ci = cleanCi
        if (cleanTelefono && exCliente.telefono !== cleanTelefono) updates.telefono = cleanTelefono
        if (cleanEmail && exCliente.email !== cleanEmail) updates.email = cleanEmail
        if (Object.keys(updates).length > 0) {
          await adminSupabase.from('clientes').update(updates).eq('id', cliente_id)
        }
      } else {
        isNewClient = true
        const { data: newCliente, error: clError } = await adminSupabase
          .from('clientes')
          .insert({
            nombre: cleanNombre,
            telefono: cleanTelefono,
            ci: cleanCi,
            email: cleanEmail,
            total_visitas: 0,
            total_gastado: 0
          })
          .select('id')
          .single()

        if (clError) throw clError
        cliente_id = newCliente.id
      }
    } else {
      // Cliente existente seleccionado: actualizar datos proporcionados
      const { data: exCliente } = await adminSupabase
        .from('clientes')
        .select('id, nombre, email, telefono, ci')
        .eq('id', cliente_id)
        .single()

      if (exCliente) {
        const updates: any = {}
        if (cleanCi && exCliente.ci !== cleanCi) updates.ci = cleanCi
        if (cleanTelefono && exCliente.telefono !== cleanTelefono) updates.telefono = cleanTelefono
        if (cleanEmail && exCliente.email !== cleanEmail) updates.email = cleanEmail
        if (Object.keys(updates).length > 0) {
          await adminSupabase.from('clientes').update(updates).eq('id', cliente_id)
        }
      }
    }

    // Gestionar cuenta Auth del usuario si tiene correo
    if (cleanEmail) {
      try {
        const generatedPwd = generarPasswordCliente()
        const { data: authData, error: createErr } = await adminSupabase.auth.admin.createUser({
          email: cleanEmail,
          password: generatedPwd,
          email_confirm: true,
          user_metadata: { full_name: cleanNombre || 'Cliente' }
        })

        if (!createErr && authData?.user) {
          await adminSupabase.from('profiles').update({
            full_name: cleanNombre || 'Cliente',
            phone: cleanTelefono || null,
            ci: cleanCi || null,
            role: 'cliente'
          }).eq('id', authData.user.id)

          try {
            await dispatchNotification(adminSupabase, {
              event: 'bienvenida_nuevo_usuario',
              userEmail: cleanEmail,
              payload: {
                nombre: cleanNombre || 'Cliente',
                email: cleanEmail,
                password: generatedPwd
              }
            })
          } catch (e) { console.error("Error enviando bienvenida:", e) }
        }
      } catch (e) { console.error("Error creando auth en crear-manual:", e) }
    } else if (isNewClient) {
      try {
        await dispatchNotification(adminSupabase, {
          event: 'bienvenida_nuevo_usuario',
          payload: {
            nombre: cleanNombre || 'Cliente',
            email: cleanCi ? `CI: ${cleanCi}` : 'Registrado en Agenda',
            password: ''
          }
        })
      } catch (_) {}
    }

    // 2. Obtener datos del servicio
    const { data: servicio } = await supabase
      .from('servicios')
      .select('nombre, precio, duracion_minutos, comision_activa, comision_tipo, comision_valor')
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

    let formattedFechaHora = fecha_hora
    if (typeof formattedFechaHora === 'string' && !formattedFechaHora.includes('Z') && !formattedFechaHora.match(/[+-]\d{2}:\d{2}$/)) {
      formattedFechaHora = `${formattedFechaHora.length === 16 ? formattedFechaHora + ':00' : formattedFechaHora}-04:00`
    }

    // 3. Insertar la cita manual
    const insertData: any = {
      cliente_id,
      barbero_id,
      servicio_id,
      fecha_hora: formattedFechaHora,
      precio: servicio.precio,
      comision_barbero: comResult.monto,
      comision_categoria: comResult.categoria_nombre,
      comision_herramientas: comResult.tiene_herramientas,
      duracion_real_minutos: servicio.duracion_minutos,
      estado: 'confirmado',
      notas: notas || `Cita manual agendada por ${profile.full_name || profile.role}`,
    }

    let { data: cita, error: citaError } = await supabase
      .from('citas')
      .insert(insertData)
      .select()
      .single()

    if (citaError && (citaError.message?.includes('comision_') || citaError.message?.includes('column') || (citaError as any).code === 'PGRST204')) {
      delete insertData.comision_categoria
      delete insertData.comision_herramientas
      const retry = await supabase.from('citas').insert(insertData).select().single()
      cita = retry.data
      citaError = retry.error
    }

    if (citaError) throw citaError

    // Despachar notificaciones de reserva nueva (Barbero, Admin, Coordinador y Cliente)
    try {
      const fh = new Date(formattedFechaHora)
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

      await dispatchNotification(adminSupabase, {
        event: 'reserva_nueva',
        payload: {
          citaId: cita.id,
          barberoId: barbero_id,
          barberoNombre: barberoRow?.full_name || 'Barbero',
          barberoEmail: finalBarberoEmail,
          clienteNombre: cleanNombre || 'Cliente',
          clienteEmail: cleanEmail || undefined,
          servicioNombre: servicio.nombre,
          fecha: fh.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }),
          hora: fh.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hour12: false }),
          metodoPago: 'Pago en el local',
          monto: servicio.precio,
        },
      })
    } catch (notifErr) {
      console.error('Error enviando notificación de cita manual:', notifErr)
    }

    return NextResponse.json({
      success: true,
      cita,
      message: '¡Cita manual agendada con éxito!'
    }, { status: 201 })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
