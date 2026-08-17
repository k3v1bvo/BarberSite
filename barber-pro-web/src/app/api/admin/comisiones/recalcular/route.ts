import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { calcularComisionBarbero } from '@/lib/comisiones/calcular'

export async function POST(request: Request) {
  try {
    const adminClient = createAdminSupabaseClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Falta configurar variables de admin' }, { status: 500 })
    }

    // 1. Obtener todas las citas que tengan comision_barbero = 0 o null y estén completadas
    const { data: citas } = await adminClient
      .from('citas')
      .select('id, precio, barbero_id, servicio_id, comision_barbero, propinas, estado, fecha_hora')
      .eq('estado', 'completado')
      .or('comision_barbero.eq.0,comision_barbero.is.null')

    if (!citas || citas.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay citas para recalcular.' })
    }

    // 2. Obtener servicios y sus reglas de comisión (para fallback global)
    const { data: servicios } = await adminClient.from('servicios').select('id, comision_activa, comision_tipo, comision_valor, comision_acumulable')
    const servMap = new Map()
    if (servicios) {
      servicios.forEach(s => servMap.set(s.id, s))
    }

    let actualizadas = 0

    // 3. Recalcular usando el sistema por barbero
    for (const cita of citas) {
      const precioBase = Number(cita.precio) || 0
      const serv = servMap.get(cita.servicio_id)

      if (!cita.barbero_id || !cita.servicio_id) continue

      const comResult = await calcularComisionBarbero(
        adminClient, cita.barbero_id, cita.servicio_id, precioBase,
        cita.fecha_hora ? new Date(cita.fecha_hora) : new Date(),
        serv ? { comision_activa: serv.comision_activa, comision_tipo: serv.comision_tipo, comision_valor: serv.comision_valor, comision_acumulable: serv.comision_acumulable } : undefined
      )

      const extraPropinas = (serv && serv.comision_acumulable !== false) ? (cita.propinas || 0) : 0
      const comisionTotal = comResult.monto + (extraPropinas * 0.5)

      if (comisionTotal > 0) {
        await adminClient.from('citas').update({
          comision_barbero: comisionTotal,
          comision_categoria: comResult.categoria_nombre,
          comision_herramientas: comResult.tiene_herramientas,
        }).eq('id', cita.id)
        actualizadas++
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Se recalcularon ${actualizadas} citas exitosamente.`,
      encontradas: citas.length
    })

  } catch (error: any) {
    console.error('Error al recalcular comisiones:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
