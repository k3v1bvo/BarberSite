import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/transactions — listar (filtro por libro, fecha, sanción, etc.)
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

    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const sp = request.nextUrl.searchParams
    const libro = sp.get('libro')
    const fecha = sp.get('fecha')
    const fechaDesde = sp.get('desde')
    const fechaHasta = sp.get('hasta')
    const esSancion = sp.get('sancion')
    const subcategoria = sp.get('subcategoria')
    const limit = parseInt(sp.get('limit') || '100')

    let query = supabase
      .from('transactions')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(limit)

    if (libro) query = query.eq('libro', libro)
    if (fecha) query = query.eq('fecha', fecha)
    if (fechaDesde) query = query.gte('fecha', fechaDesde)
    if (fechaHasta) query = query.lte('fecha', fechaHasta)
    if (esSancion === 'true') query = query.eq('es_sancion', true)
    if (subcategoria) query = query.eq('subcategoria', subcategoria)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/transactions — crear transacción
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coordinador', 'barbero'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // Barberos solo pueden registrar ventas/servicios
    const body = await request.json()
    if (profile.role === 'barbero' && body.libro !== 'VENTAS' && body.libro !== 'SERVICIOS') {
      return NextResponse.json({ error: 'Solo puedes registrar ventas' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        libro: body.libro,
        fecha: body.fecha || new Date().toISOString().split('T')[0],
        ci: body.ci,
        nombre: body.nombre,
        cuenta_codigo: body.cuenta_codigo,
        cuenta_detalle: body.cuenta_detalle,
        glosa: body.glosa,
        costo: body.costo,
        tipo_movimiento: body.tipo_movimiento,
        subcategoria: body.subcategoria || null,
        es_sancion: body.es_sancion || false,
        empleado_id: body.empleado_id || null,
        cliente_id: body.cliente_id || null,
        cita_id: body.cita_id || null,
        producto_id: body.producto_id || null,
        cantidad_producto: body.cantidad_producto || null,
        metodo_pago: body.metodo_pago || null,
        comprobante_url: body.comprobante_url || null,
        usuario_registro: profile.full_name || user.email || 'Sistema',
        notas: body.notas || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
