import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/arqueo?fecha=YYYY-MM-DD — resumen del día
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

    const fecha = request.nextUrl.searchParams.get('fecha') || new Date().toISOString().split('T')[0]

    // Traer todas las transacciones del día
    const { data: txDia } = await supabase
      .from('transactions')
      .select('libro, costo, metodo_pago, es_sancion')
      .eq('fecha', fecha)

    const resumen = {
      fecha,
      caja_chica: 0,
      ventas: 0,
      servicios: 0,
      banco: 0,
      uso_tienda: 0,
      total_registrado: 0,
      total_efectivo: 0,
      total_qr: 0,
      total_tarjeta: 0,
      total_descuento_caja: 0,
      sanciones: 0,
      movimientos: txDia?.length || 0,
    }

    txDia?.forEach((t) => {
      const costo = Number(t.costo)
      if (t.libro === 'CAJA_CHICA') resumen.caja_chica += costo
      else if (t.libro === 'VENTAS') resumen.ventas += costo
      else if (t.libro === 'SERVICIOS') resumen.servicios += costo
      else if (t.libro === 'BANCO') resumen.banco += costo
      else if (t.libro === 'USO_TIENDA') resumen.uso_tienda += costo
      resumen.total_registrado += costo
      if (t.es_sancion) resumen.sanciones += costo
      if (t.metodo_pago === 'efectivo') resumen.total_efectivo += costo
      else if (t.metodo_pago === 'qr') resumen.total_qr += costo
      else if (t.metodo_pago === 'tarjeta') resumen.total_tarjeta += costo
      else if (t.metodo_pago === 'descuento_caja') resumen.total_descuento_caja += costo
    })

    // Traer cierre existente
    const { data: cierre } = await supabase
      .from('daily_closures')
      .select('*')
      .eq('fecha', fecha)
      .maybeSingle()

    return NextResponse.json({ resumen, cierre })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/arqueo — cerrar el día (o actualizar cierre)
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

    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const fecha = body.fecha || new Date().toISOString().split('T')[0]

    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('daily_closures')
      .select('id, cerrado')
      .eq('fecha', fecha)
      .maybeSingle()

    if (existing?.cerrado) {
      return NextResponse.json({ error: 'El arqueo de este día ya fue cerrado' }, { status: 400 })
    }

    const row = {
      fecha,
      caja_chica: body.caja_chica || 0,
      ventas: body.ventas || 0,
      servicios: body.servicios || 0,
      banco: body.banco || 0,
      total_efectivo_fisico: body.total_efectivo_fisico || 0,
      total_qr: body.total_qr || 0,
      observaciones: body.observaciones || null,
      usuario_cierre: profile?.full_name || user.email || 'Sistema',
      cerrado: body.cerrado ?? false,
    }

    let result
    if (existing) {
      const { data, error } = await supabase
        .from('daily_closures')
        .update(row)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    } else {
      const { data, error } = await supabase
        .from('daily_closures')
        .insert(row)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    }

    return NextResponse.json(result, { status: existing ? 200 : 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
