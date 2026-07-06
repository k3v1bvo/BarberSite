import { createAdminSupabaseClient, getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { NextRequest, NextResponse } from 'next/server'

// Este endpoint debería ser llamado por un cron job (ej. Vercel Cron) cada Sábado en la noche
// GET /api/cron/consignacion-sabado
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const supabase = createAdminSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database client could not be initialized' }, { status: 500 })
    }

    // 1. Llamar a la lógica de resumen-semanal
    const hoy = new Date()
    const diaSemana = hoy.getDay() // 0 = Domingo, 1 = Lunes
    const diffLunes = hoy.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1)
    const inicioSemana = new Date(hoy.setDate(diffLunes))
    inicioSemana.setHours(0,0,0,0)
    const finSemana = new Date(inicioSemana)
    finSemana.setDate(finSemana.getDate() + 6)
    finSemana.setHours(23,59,59,999)

    const strInicio = inicioSemana.toISOString()
    const strFin = finSemana.toISOString()

    const { data: ventas } = await supabase
      .from('transactions')
      .select('costo, producto_id, glosa, cantidad_producto')
      .eq('tipo_movimiento', 'INGRESO')
      .eq('subcategoria', 'PRODUCTO_VENTA')
      .gte('creado_en', strInicio)
      .lte('creado_en', strFin)

    const { data: productos } = await supabase
      .from('productos')
      .select('id, precio_costo, precio_venta')

    let deudaTotal = 0
    let gananciaTotal = 0
    let productosVendidos = 0

    if (ventas && productos) {
      ventas.forEach((v) => {
        const prod = productos.find(p => p.id === v.producto_id)
        if (prod && prod.precio_costo) {
          let cantidad = Number(v.cantidad_producto || 1)
          if (!v.cantidad_producto && v.glosa) {
            const match = v.glosa.match(/Venta POS - (\d+)x/)
            if (match && match[1]) {
              cantidad = parseInt(match[1])
            }
          }

          const costoConsignacion = Number(prod.precio_costo) * cantidad
          const precioVentaTotal = Number(prod.precio_venta) * cantidad

          deudaTotal += costoConsignacion
          gananciaTotal += (precioVentaTotal - costoConsignacion)
          productosVendidos += cantidad
        }
      })
    }

    // 2. Si hay deuda, enviar notificación a admins y coordinadores
    if (deudaTotal > 0) {
      const { data: staff } = await supabase
        .from('profiles')
        .select('user_id, role')
        .in('role', ['admin', 'coordinador'])
      
      const db = getNotificationDbClient(supabase)
      
      if (staff) {
        for (const user of staff) {
          await db.from('notificaciones').insert({
            user_id: user.user_id,
            titulo: '📦 Pago Semanal de Consignación',
            mensaje: `Esta semana se vendieron ${productosVendidos} productos de consignación. Deuda total: Bs ${deudaTotal}. Tu ganancia neta: Bs ${gananciaTotal}. ¡Recuerda pagar al proveedor!`,
            tipo: 'sistema',
            link: '/admin/consignaciones',
            leido: false
          })
        }
      }
    }

    return NextResponse.json({ success: true, notificados: true, deudaTotal, productosVendidos })
  } catch (error: any) {
    console.error('Error cron consignacion-sabado:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
