import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/consignaciones/resumen-semanal - Resumen de ventas de productos consignados en la semana
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Determinar inicio de semana (lunes) y fin (domingo)
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

    // 1. Obtener todas las transacciones de tipo INGRESO, subcategoria PRODUCTO_VENTA de esta semana
    const { data: ventas } = await supabase
      .from('transactions')
      .select('costo, producto_id, glosa, cantidad_producto')
      .eq('tipo_movimiento', 'INGRESO')
      .eq('subcategoria', 'PRODUCTO_VENTA')
      .gte('creado_en', strInicio)
      .lte('creado_en', strFin)

    // 2. Obtener los productos que han sido consignados alguna vez o todos para saber su precio costo
    const { data: productos } = await supabase
      .from('productos')
      .select('id, precio_costo, precio_venta, nombre')

    let deudaTotal = 0
    let gananciaTotal = 0
    let productosVendidos = 0

    if (ventas && productos) {
      ventas.forEach((v) => {
        const prod = productos.find(p => p.id === v.producto_id)
        if (prod && prod.precio_costo) {
          // Extraer la cantidad de la glosa "Venta POS - Nx Producto" si cantidad_producto no está
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

    return NextResponse.json({
      inicio: strInicio,
      fin: strFin,
      deudaTotal,
      gananciaTotal,
      productosVendidos
    })
  } catch (error: any) {
    console.error('Error GET resumen-semanal:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
