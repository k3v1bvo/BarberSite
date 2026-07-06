import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/consignaciones/pagos - Registrar pago al proveedor
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
      return NextResponse.json({ error: 'Solo administradores y coordinadores pueden hacer esto' }, { status: 403 })
    }

    const body = await request.json()
    const { consignacion_id, monto, metodo_pago, monto_efectivo, monto_qr, notas } = body

    if (!monto || Number(monto) <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
    }

    const mEfectivo = metodo_pago === 'mixto' ? Number(monto_efectivo) : (metodo_pago === 'efectivo' ? Number(monto) : 0)
    const mQr = metodo_pago === 'mixto' ? Number(monto_qr) : (metodo_pago === 'qr' ? Number(monto) : 0)

    // 1. Crear el pago
    const { error: pagoError } = await supabase
      .from('consignacion_pagos')
      .insert({
        consignacion_id: consignacion_id || null, // null significa un pago general
        monto: Number(monto),
        metodo_pago,
        monto_efectivo: mEfectivo,
        monto_qr: mQr,
        notas: notas || null,
        registrado_por: profile?.full_name || 'Admin'
      })

    if (pagoError) throw pagoError

    // 2. Si se especificó una consignación, actualizar el total pagado y estado
    if (consignacion_id) {
      const { data: cons } = await supabase.from('consignaciones').select('total_costo, total_pagado').eq('id', consignacion_id).single()
      if (cons) {
        const nuevoTotal = (cons.total_pagado || 0) + Number(monto)
        const nuevoEstado = nuevoTotal >= cons.total_costo ? 'pagado' : 'pagado_parcial'
        
        await supabase.from('consignaciones').update({
          total_pagado: nuevoTotal,
          estado: nuevoEstado
        }).eq('id', consignacion_id)
      }
    }

    // 3. Crear el Egreso contable para reflejar la salida de dinero
    await supabase.from('transactions').insert({
      libro: 'EGRESOS',
      fecha: new Date().toISOString().split('T')[0],
      ci: 'S/N',
      nombre: 'Pago Consignación Proveedor',
      cuenta_codigo: 'EGRESO',
      cuenta_detalle: 'Pago Consignación',
      glosa: notas || 'Pago semanal por productos en consignación',
      costo: Number(monto),
      tipo_movimiento: 'EGRESO',
      subcategoria: 'CONSIGNACION_PAGO',
      metodo_pago,
      monto_efectivo: mEfectivo,
      monto_qr: mQr,
      usuario_registro: profile?.full_name || 'Admin'
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error POST pago consignacion:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
