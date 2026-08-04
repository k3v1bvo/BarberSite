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
    const { empleado_id, monto, glosa } = body

    if (!empleado_id || !monto || monto <= 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    // Insertar en transactions como Egreso de Caja Chica
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        libro: 'CAJA_CHICA',
        fecha: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
        ci: '0000000', // Valor por defecto
        nombre: 'Adelanto a Personal',
        cuenta_codigo: 'ACT-001', // Código que definimos para adelantos
        cuenta_detalle: 'Adelantos a Personal',
        glosa: glosa || 'Adelanto',
        costo: monto,
        tipo_movimiento: 'EGRESO',
        es_sancion: false,
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
