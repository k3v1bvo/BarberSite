import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { empleado_id, monto, glosa, cuenta_codigo, cuenta_detalle } = body

    if (!empleado_id || !monto || monto <= 0 || !cuenta_codigo) {
      return NextResponse.json({ error: 'Datos requeridos incompletos' }, { status: 400 })
    }

    // Insertar en transactions como Ingreso a Caja Chica
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        libro: 'CAJA_CHICA',
        fecha: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
        ci: '0000000',
        nombre: 'Sanción Administrativa',
        cuenta_codigo: cuenta_codigo,
        cuenta_detalle: cuenta_detalle,
        glosa: glosa || 'Sanción',
        costo: monto,
        tipo_movimiento: 'INGRESO',
        es_sancion: true,
        empleado_id: empleado_id,
        usuario_registro: profile.full_name || user.email || 'Sistema',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
