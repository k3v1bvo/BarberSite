import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET: verificaciones de cumpleaños de hoy
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const fecha = searchParams.get('fecha') ?? new Date().toISOString().split('T')[0]
    const cliente_id = searchParams.get('cliente_id')

    let query = supabase
      .from('cumpleanos_verificados')
      .select('*, cliente:clientes(nombre, cumpleanos, email), verificador:profiles!verificado_por(full_name), promo:promociones(nombre)')
      .eq('fecha_verificacion', fecha)
      .order('created_at', { ascending: false })

    if (cliente_id) query = query.eq('cliente_id', cliente_id)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ verificaciones: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: registrar verificación de cumpleaños de un cliente
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { cliente_id, foto_documento_url, tipo_documento, promo_id, notas, fecha_cumpleanos } = body

    if (!cliente_id) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

    if (fecha_cumpleanos) {
      await supabase.from('clientes').update({ cumpleanos: fecha_cumpleanos }).eq('id', cliente_id)
    }

    // Verificar que el cliente existe
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nombre, cumpleanos')
      .eq('id', cliente_id)
      .single()

    if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    if (cliente.cumpleanos) {
      const hoy = new Date()
      const cumple = new Date(cliente.cumpleanos)
      const esCumple = cumple.getMonth() === hoy.getMonth() && cumple.getDate() === hoy.getDate()
      if (!esCumple) {
        return NextResponse.json({ error: `Hoy no es el cumpleaños de ${cliente.nombre}` }, { status: 400 })
      }
    }

    const hoyStr = new Date().toISOString().split('T')[0]

    // Evitar duplicado: ¿ya fue verificado hoy?
    const { data: existente } = await supabase
      .from('cumpleanos_verificados')
      .select('id')
      .eq('cliente_id', cliente_id)
      .eq('fecha_verificacion', hoyStr)
      .single()

    if (existente) {
      return NextResponse.json({ error: 'Este cliente ya fue verificado hoy' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('cumpleanos_verificados')
      .insert({
        cliente_id,
        fecha_verificacion: hoyStr,
        foto_documento_url: foto_documento_url || null,
        tipo_documento: tipo_documento || 'carnet',
        promo_id: promo_id || null,
        verificado_por: user.id,
        notas: notas || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
