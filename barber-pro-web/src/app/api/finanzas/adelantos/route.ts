import { createServerSupabaseClient, createServerAdminClient } from '@/lib/supabase/server'
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

    const adminSupabase = await createServerAdminClient()

    // Asegurar que ACT-001 existe en plan_cuentas
    await adminSupabase.from('plan_cuentas').upsert({
      codigo: 'ACT-001',
      detalle: 'Adelantos al Personal',
      tipo: 'ACTIVO',
      nivel: 1,
      es_sancion: false
    }, { onConflict: 'codigo', ignoreDuplicates: true })

    const { data: empProfile } = await adminSupabase
      .from('profiles')
      .select('full_name, ci')
      .eq('id', empleado_id)
      .single()

    const fechaHoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

    // Insertar en transactions como Egreso de Caja Chica
    const { data, error } = await adminSupabase
      .from('transactions')
      .insert({
        libro: 'CAJA_CHICA',
        fecha: fechaHoy,
        ci: empProfile?.ci || '0000000',
        nombre: empProfile?.full_name || 'Adelanto a Personal',
        cuenta_codigo: 'ACT-001',
        cuenta_detalle: 'Adelantos a Personal',
        glosa: glosa || `Adelanto a ${empProfile?.full_name || 'Personal'}`,
        costo: Number(monto),
        tipo_movimiento: 'EGRESO',
        subcategoria: 'ADELANTO',
        es_sancion: false,
        empleado_id: empleado_id,
        metodo_pago: 'efectivo',
        monto_efectivo: Number(monto),
        monto_qr: 0,
        usuario_registro: profile.full_name || user.email || 'Sistema',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '42703' || (error as any).code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache')) {
        const { data: fbData, error: fbError } = await adminSupabase
          .from('transactions')
          .insert({
            libro: 'CAJA_CHICA',
            fecha: fechaHoy,
            ci: empProfile?.ci || '0000000',
            nombre: empProfile?.full_name || 'Adelanto a Personal',
            cuenta_codigo: 'ACT-001',
            cuenta_detalle: 'Adelantos a Personal',
            glosa: glosa || 'Adelanto',
            costo: Number(monto),
            tipo_movimiento: 'EGRESO',
            es_sancion: false,
            empleado_id: empleado_id,
            usuario_registro: profile.full_name || user.email || 'Sistema',
          })
          .select()
          .single()
        if (fbError) return NextResponse.json({ error: fbError.message }, { status: 500 })
        return NextResponse.json(fbData, { status: 201 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
