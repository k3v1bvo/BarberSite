import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function getSupabase(cookieStore: ReturnType<typeof cookies> extends Promise<infer T> ? T : never) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )
}

// GET: List inventory movements
export async function GET(request: Request) {
  const cookieStore = await cookies()
  const supabase = getSupabase(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const productoId = searchParams.get('producto_id')
  const limit = parseInt(searchParams.get('limit') || '100')

  let query = supabase
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
}

// POST: Register physical count adjustment
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = getSupabase(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { producto_id, conteo_fisico, motivo } = body

  if (!producto_id || conteo_fisico === undefined) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  // Get current stock
  const { data: producto, error: pError } = await supabase
    .from('productos')
    .select('stock_actual, nombre')
    .eq('id', producto_id)
    .single()

  if (pError || !producto) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  const diferencia = conteo_fisico - producto.stock_actual

  // Update stock to physical count
  const { error: updateError } = await supabase
    .from('productos')
    .update({ stock_actual: conteo_fisico })
    .eq('id', producto_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Log the movement
  const { error: logError } = await supabase
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
}
