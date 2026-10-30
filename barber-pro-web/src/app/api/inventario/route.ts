import { createServerSupabaseClient, createServerAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: List inventory movements
export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const adminSupabase = await createServerAdminClient()
    const { searchParams } = new URL(request.url)
    const productoId = searchParams.get('producto_id')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = adminSupabase
      .from('inventario_movimientos')
      .select(`
        *,
        productos(nombre, sku),
        profiles!usuario_id(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (productoId) query = query.eq('producto_id', productoId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}

// POST: Register physical count adjustment
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const adminSupabase = await createServerAdminClient()
    const body = await request.json()
    const { producto_id, conteo_fisico, motivo } = body

    if (!producto_id || conteo_fisico === undefined) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    // Get current stock
    const { data: producto, error: pError } = await adminSupabase
      .from('productos')
      .select('stock_actual, nombre')
      .eq('id', producto_id)
      .single()

    if (pError || !producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    const diferencia = conteo_fisico - (producto.stock_actual || 0)

    // Update stock to physical count
    const { error: updateError } = await adminSupabase
      .from('productos')
      .update({ stock_actual: conteo_fisico })
      .eq('id', producto_id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Log the movement
    const { error: logError } = await adminSupabase
      .from('inventario_movimientos')
      .insert({
        producto_id,
        tipo: diferencia >= 0 ? 'entrada' : 'salida',
        cantidad: Math.abs(diferencia),
        motivo: motivo || `Conteo físico: ${producto.stock_actual} → ${conteo_fisico} (dif: ${diferencia > 0 ? '+' : ''}${diferencia})`,
        usuario_id: user.id,
      })

    if (logError) console.error('Error logging movement:', logError)

    return NextResponse.json({
      producto_id,
      nombre: producto.nombre,
      stock_anterior: producto.stock_actual,
      conteo_fisico,
      diferencia,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
