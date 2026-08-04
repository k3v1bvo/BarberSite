import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/consignaciones - Listar consignaciones
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo el admin puede ver esto' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('consignaciones')
      .select(`
        *,
        consignacion_items (
          id,
          cantidad_recibida,
          precio_costo_unitario,
          productos ( id, nombre )
        ),
        consignacion_pagos (
          id,
          monto,
          metodo_pago,
          pagado_en
        )
      `)
      .order('creado_en', { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error GET consignaciones:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

// POST /api/consignaciones - Crear nueva consignacion (recibir lote)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo el admin puede hacer esto' }, { status: 403 })
    }

    const body = await request.json()
    const { proveedor_nombre, notas, items } = body
    // items: { producto_id: string, cantidad: number, precio_costo: number }[]

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No hay productos en la consignación' }, { status: 400 })
    }

    // Calcular costo total
    const totalCosto = items.reduce((sum: number, item: any) => sum + (item.cantidad * item.precio_costo), 0)

    // Crear consignacion
    const { data: consignacion, error: consError } = await supabase
      .from('consignaciones')
      .insert({
        proveedor_nombre: proveedor_nombre || 'Proveedor Principal',
        total_costo: totalCosto,
        notas: notas || null,
        estado: 'pendiente'
      })
      .select('id')
      .single()

    if (consError) throw consError

    // Insertar items y actualizar stock
    for (const item of items) {
      // 1. Insert item
      await supabase.from('consignacion_items').insert({
        consignacion_id: consignacion.id,
        producto_id: item.producto_id,
        cantidad_recibida: item.cantidad,
        precio_costo_unitario: item.precio_costo
      })

      // 2. Actualizar stock
      const { data: pActual } = await supabase.from('productos').select('stock_actual').eq('id', item.producto_id).single()
      const stockAnterior = pActual?.stock_actual || 0
      const nuevoStock = stockAnterior + item.cantidad

      await supabase.from('productos').update({
        stock_actual: nuevoStock,
        precio_costo: item.precio_costo // Actualizar el precio de costo del producto general
      }).eq('id', item.producto_id)

      // 3. Registrar movimiento inventario
      await supabase.from('inventario_movimientos').insert({
        producto_id: item.producto_id,
        tipo: 'ingreso',
        cantidad: item.cantidad,
        stock_anterior: stockAnterior,
        stock_nuevo: nuevoStock,
        referencia: consignacion.id,
        notas: 'Entrada por consignación',
        usuario_id: user.id
      })
    }

    return NextResponse.json({ success: true, consignacion_id: consignacion.id })
  } catch (error: any) {
    console.error('Error POST consignaciones:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
