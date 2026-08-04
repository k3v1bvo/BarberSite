import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { dispatchNotification } from '@/lib/notifications/dispatch'

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
      .select('id, nombre, cumpleanos, email')
      .eq('id', cliente_id)
      .single()

    if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const fechaAUsar = fecha_cumpleanos || cliente.cumpleanos
    if (fechaAUsar) {
      const parts = String(fechaAUsar).split('T')[0].split('-')
      if (parts.length === 3) {
        const mesCumple = parseInt(parts[1], 10)
        const diaCumple = parseInt(parts[2], 10)
        const hoy = new Date()
        // Validar que esté en su semana o mes de cumpleaños para aplicar la promo (ej. ±15 días o el mes en curso)
        let bdayThisYear = new Date(hoy.getFullYear(), mesCumple - 1, diaCumple)
        const diffInDays = Math.abs((hoy.getTime() - bdayThisYear.getTime()) / (1000 * 3600 * 24))
        if (diffInDays > 14 && diffInDays < 351) {
          return NextResponse.json({ error: `La fecha (${diaCumple}/${mesCumple}) de ${cliente.nombre} no está en su semana/mes de cumpleaños actual.` }, { status: 400 })
        }
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

    // Disparar Notificaciones al admin, coordinador y al cliente
    try {
      await dispatchNotification(supabase, {
        event: 'cumpleanos',
        payload: {
          clienteId: cliente_id,
          clienteNombre: cliente.nombre,
          clienteEmail: cliente.email || undefined,
        },
        userEmail: cliente.email || undefined,
      })

      await dispatchNotification(supabase, {
        event: 'cumpleanos_registro',
        payload: {
          clienteId: cliente_id,
          clienteNombre: cliente.nombre,
          fecha: fechaAUsar ? String(fechaAUsar).split('T')[0] : undefined,
          clienteEmail: cliente.email || undefined,
        },
        userEmail: cliente.email || undefined,
      })
    } catch (notifErr) {
      console.error('Error insertando notificaciones de cumpleaños:', notifErr)
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
