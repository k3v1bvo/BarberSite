import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { calcularComisionBarbero } from '@/lib/comisiones/calcular'
import { NextResponse } from 'next/server'

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

    // 1. Resolver o Crear Cliente
    if (!cliente_id) {
      if (!nombre_cliente || !nombre_cliente.trim()) {
        return NextResponse.json({ error: 'Ingresa el nombre del cliente' }, { status: 400 })
      }

      const cleanNombre = nombre_cliente.trim()
      const cleanTelefono = telefono_cliente ? telefono_cliente.trim() : null
      const cleanCi = ci_cliente ? ci_cliente.trim() : null
      const cleanEmail = email_cliente && email_cliente.includes('@') ? email_cliente.trim() : null

      // Buscar si ya existe por CI, teléfono o nombre
      let query = supabase.from('clientes').select('id')
      if (cleanCi) query = query.eq('ci', cleanCi)
      else if (cleanTelefono) query = query.eq('telefono', cleanTelefono)
      else query = query.eq('nombre', cleanNombre)

      const { data: exCliente } = await query.maybeSingle()

      if (exCliente?.id) {
        cliente_id = exCliente.id
      } else {
        const { data: newCliente, error: clError } = await adminSupabase
          .from('clientes')
          .insert({
            nombre: cleanNombre,
            telefono: cleanTelefono,
            ci: cleanCi,
            email: cleanEmail, // Opcional (null si no tiene correo)
            total_visitas: 0,
            total_gastado: 0
          })
          .select('id')
          .single()

        if (clError) throw clError
        cliente_id = newCliente.id
      }
    }

    // 2. Obtener datos del servicio
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

    let formattedFechaHora = fecha_hora
    if (typeof formattedFechaHora === 'string' && !formattedFechaHora.includes('Z') && !formattedFechaHora.match(/[+-]\d{2}:\d{2}$/)) {
      formattedFechaHora = `${formattedFechaHora.length === 16 ? formattedFechaHora + ':00' : formattedFechaHora}-04:00`
    }

    // 3. Insertar la cita manual
    const { data: cita, error: citaError } = await supabase
      .from('citas')
      .insert({
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
      })
      .select()
      .single()

    if (citaError) throw citaError

    return NextResponse.json({
      success: true,
      cita,
      message: '¡Cita manual agendada con éxito!'
    }, { status: 201 })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
