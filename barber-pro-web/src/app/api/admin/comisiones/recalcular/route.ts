import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const adminClient = createAdminSupabaseClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Falta configurar variables de admin' }, { status: 500 })
    }

    // 1. Obtener todas las citas que tengan comision_barbero = 0 o null y estén completadas
    const { data: citas } = await adminClient
      .from('citas')
      .select('id, precio, barbero_id, servicio_id, comision_barbero, propinas, estado')
      .eq('estado', 'completado')
      .or('comision_barbero.eq.0,comision_barbero.is.null')

    if (!citas || citas.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay citas para recalcular.' })
    }

    // 2. Ya no se usan comisiones de perfiles

    // 3. Obtener servicios y sus reglas de comisión
    const { data: servicios } = await adminClient.from('servicios').select('id, comision_activa, comision_tipo, comision_valor, comision_acumulable')
    const servMap = new Map()
    if (servicios) {
      servicios.forEach(s => servMap.set(s.id, s))
    }

    let actualizadas = 0

    // 4. Recalcular
    for (const cita of citas) {
      const precioBase = Number(cita.precio) || 0
      const serv = servMap.get(cita.servicio_id)

      let baseComision = 0
      
      if (serv) {
        if (serv.comision_activa !== false && serv.comision_tipo !== 'ninguna') {
          if (serv.comision_tipo === 'fija') {
            baseComision = serv.comision_valor || 0
          } else if (serv.comision_tipo === 'porcentaje') {
            baseComision = (precioBase * (serv.comision_valor || 0)) / 100
          }
        }
      } else {
        // Si el servicio fue borrado o no tiene comision definida, es 0
        baseComision = 0
      }

      const extraPropinas = (serv && serv.comision_acumulable !== false) ? (cita.propinas || 0) : 0
      const comisionTotal = baseComision + (extraPropinas * 0.5)

      if (comisionTotal > 0) {
        await adminClient.from('citas').update({ comision_barbero: comisionTotal }).eq('id', cita.id)
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
