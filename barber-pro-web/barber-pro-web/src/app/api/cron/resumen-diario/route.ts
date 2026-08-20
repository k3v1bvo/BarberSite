import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { sendAdminEmail } from '@/lib/notifications/email'
import { NextResponse } from 'next/server'
import { getBoliviaDateString } from '@/lib/asistencia/helpers'

export async function GET(request: Request) {
  // Autenticación básica para el cron (usar un token en el header o query param)
  const authHeader = request.headers.get('authorization')
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin no configurado' }, { status: 500 })
  }

  try {
    // Obtener fecha actual en zona horaria de Bolivia (UTC-4)
    const fechaStr = getBoliviaDateString()

    // 1. Citas completadas hoy
    const { data: citas } = await supabase
      .from('citas')
      .select('id, precio')
      .eq('estado', 'completado')
      .gte('fecha_hora', `${fechaStr}T00:00:00.000Z`)
      .lte('fecha_hora', `${fechaStr}T23:59:59.999Z`)

    const totalCitas = citas?.length || 0
    const ingresosServicios = citas?.reduce((sum, c) => sum + Number(c.precio), 0) || 0

    // 2. Transacciones de ventas de productos hoy
    // Usamos el libro 'VENTAS' y fecha = hoy
    const { data: ventasProds } = await supabase
      .from('transactions')
      .select('id, costo, glosa')
      .eq('libro', 'VENTAS')
      .eq('fecha', fechaStr)
      .eq('tipo_movimiento', 'VENTA_PRODUCTO')

    const totalVentasProductos = ventasProds?.length || 0
    const ingresosProductos = ventasProds?.reduce((sum, v) => sum + Number(v.costo), 0) || 0

    const ingresoTotal = ingresosServicios + ingresosProductos

    // Enviar email usando la función admin
    const { ok, error } = await sendAdminEmail('resumen_diario_admin', {
      fecha: fechaStr,
      totalCitas: totalCitas.toString(),
      totalVentasProductos: totalVentasProductos.toString(),
      ingresosServicios: `Bs ${ingresosServicios.toFixed(2)}`,
      ingresosProductos: `Bs ${ingresosProductos.toFixed(2)}`,
      ingresoTotal: `Bs ${ingresoTotal.toFixed(2)}`
    })

    if (!ok) {
      throw new Error(error || 'Error enviando email')
    }

    return NextResponse.json({ 
      success: true, 
      mensaje: 'Resumen diario enviado exitosamente',
      datos: { fechaStr, totalCitas, ingresosServicios, totalVentasProductos, ingresosProductos }
    })
  } catch (error: any) {
    console.error('Error enviando resumen diario:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
