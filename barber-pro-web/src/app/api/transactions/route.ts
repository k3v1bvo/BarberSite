import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getTodayBolivia } from '@/lib/utils'

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
    const search = sp.get('search')
    const limit = parseInt(sp.get('limit') || '100')

    const targetFecha = fecha || (fechaDesde && fechaHasta && fechaDesde === fechaHasta ? fechaDesde : null)
    if (targetFecha) {
      const dObj = new Date(`${targetFecha}T12:00:00Z`)
      const nextObj = new Date(dObj.getTime() + 86400000)
      const nextDayStr = nextObj.toISOString().split('T')[0]
      await supabase
        .from('transactions')
        .update({ fecha: targetFecha })
        .gte('creado_en', `${targetFecha}T04:00:00Z`)
        .lte('creado_en', `${nextDayStr}T03:59:59Z`)
        .neq('fecha', targetFecha)

    }

    let query = supabase
      .from('transactions')
      .select('*')
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false })
      .limit(limit)

    if (libro === 'BANCO') {
      query = query.or('libro.eq.BANCO,metodo_pago.eq.qr,metodo_pago.eq.tarjeta,metodo_pago.eq.mixto,monto_qr.gt.0')
    } else if (libro) {
      query = query.eq('libro', libro)
    }
    if (fecha) query = query.eq('fecha', fecha)
    if (fechaDesde) query = query.gte('fecha', fechaDesde)
    if (fechaHasta) query = query.lte('fecha', fechaHasta)
    if (esSancion === 'true') query = query.eq('es_sancion', true)
    if (subcategoria) query = query.eq('subcategoria', subcategoria)
    if (search) query = query.or(`nombre.ilike.%${search}%,glosa.ilike.%${search}%`)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let finalData = data || []
    try {
      if (!libro || libro === 'SERVICIOS') {
        let citasQuery = supabase
          .from('citas')
          .select(`
            id,
            precio,
            fecha_hora,
            barbero_id,
            cliente_id,
            clientes (nombre),
            servicios (nombre),
            barberos:profiles!barbero_id (full_name)
          `)
          .eq('estado', 'completado')
        if (fecha) {
          citasQuery = citasQuery.gte('fecha_hora', `${fecha}T00:00:00`).lte('fecha_hora', `${fecha}T23:59:59`)
        } else if (fechaDesde && fechaHasta) {
          citasQuery = citasQuery.gte('fecha_hora', `${fechaDesde}T00:00:00`).lte('fecha_hora', `${fechaHasta}T23:59:59`)
        }
        const { data: citasData, error: citasErr } = await citasQuery
        if (!citasErr && citasData && citasData.length > 0) {
          for (const c of citasData) {
            const cIdStr = String(c.id || '')
            const cIdShort = cIdStr.slice(0, 6)
            const alreadyIn = finalData.some((t: any) => t.glosa && (t.glosa.includes(cIdShort) || t.glosa.includes(cIdStr)))
            if (!alreadyIn) {
              const fechaCita = c.fecha_hora ? c.fecha_hora.split('T')[0] : (fecha || getTodayBolivia())
              const clienteNombre = (c.clientes as any)?.nombre || 'Cliente'
              const barberoNombre = (c.barberos as any)?.full_name || 'Barbero'
              const servicioNombre = (c.servicios as any)?.nombre || 'Servicio de Barbería'

              finalData.push({
                id: `virtual-cita-${cIdStr}`,
                libro: 'SERVICIOS',
                fecha: fechaCita,
                ci: '0000000',
                nombre: clienteNombre,
                cuenta_codigo: 'ING-001',
                cuenta_detalle: `Servicio: ${servicioNombre}`,
                glosa: `Atendido por ${barberoNombre} — Cita #${cIdShort}`,
                costo: Number(c.precio || 0),
                tipo_movimiento: 'INGRESO',
                subcategoria: 'SERVICIO',
                es_sancion: false,
                empleado_id: c.barbero_id,
                cliente_id: c.cliente_id,
                metodo_pago: 'efectivo',
                usuario_registro: barberoNombre,
                creado_en: c.fecha_hora || new Date().toISOString()
              })
            }
          }
          finalData.sort((a: any, b: any) => {
            if (b.fecha !== a.fecha) return b.fecha.localeCompare(a.fecha)
            return (String(b.creado_en || '')).localeCompare(String(a.creado_en || ''))
          })
        }
      }

      // Safely merge egresos table
      if (!libro || libro === 'CAJA_CHICA' || libro === 'EGRESOS' || libro === 'BANCO') {
        let egresosQuery = supabase.from('egresos').select('*')
        if (fecha) {
          egresosQuery = egresosQuery.eq('fecha', fecha)
        } else if (fechaDesde && fechaHasta) {
          egresosQuery = egresosQuery.gte('fecha', fechaDesde).lte('fecha', fechaHasta)
        }
        const { data: egrData, error: egrErr } = await egresosQuery
        if (!egrErr && egrData && egrData.length > 0) {
          for (const e of egrData) {
            const alreadyIn = finalData.some((t: any) =>
              (t.glosa && t.glosa.includes(e.concepto)) ||
              (t.cuenta_detalle && t.cuenta_detalle.includes(e.concepto)) ||
              (Number(t.costo) === Number(e.monto_bruto) && t.fecha === e.fecha && t.tipo_movimiento === 'EGRESO')
            )
            if (!alreadyIn) {
              const mp = e.metodo_pago || 'efectivo'
              if (libro === 'BANCO' && mp !== 'qr' && mp !== 'tarjeta') continue
              if (libro === 'CAJA_CHICA' && mp !== 'efectivo' && mp !== 'mixto') continue

              finalData.push({
                id: `virtual-egreso-${e.id}`,
                libro: mp === 'qr' || mp === 'tarjeta' ? 'BANCO' : 'CAJA_CHICA',
                fecha: e.fecha,
                ci: '0000000',
                nombre: e.proveedor || 'Egreso General',
                cuenta_codigo: e.cuenta_codigo || 'EGR-GEN',
                cuenta_detalle: e.concepto,
                glosa: e.notas || e.concepto,
                costo: Number(e.monto_bruto || 0),
                tipo_movimiento: 'EGRESO',
                subcategoria: 'GASTO_GENERAL',
                es_sancion: false,
                metodo_pago: mp,
                monto_efectivo: Number(e.monto_efectivo || (mp === 'efectivo' ? e.monto_bruto : 0)),
                monto_qr: Number(e.monto_qr || (mp === 'qr' ? e.monto_bruto : 0)),
                usuario_registro: e.usuario_registro || 'Sistema',
                creado_en: e.creado_en || new Date().toISOString()
              })
            }
          }
        }

        // Safely merge comisiones_pagos table
        let comisionesQuery = supabase
          .from('comisiones_pagos')
          .select(`
            id,
            monto_total,
            periodo_tipo,
            fecha_inicio,
            fecha_fin,
            metodo_pago,
            creado_en,
            barbero_id,
            barberos:profiles!barbero_id (full_name)
          `)
        const { data: comData, error: comErr } = await comisionesQuery
        if (!comErr && comData && comData.length > 0) {
          for (const com of comData) {
            const comFecha = com.creado_en ? com.creado_en.split('T')[0] : (fecha || getTodayBolivia())
            if (fecha && comFecha !== fecha) continue
            if (fechaDesde && fechaHasta && (comFecha < fechaDesde || comFecha > fechaHasta)) continue

            const mp = com.metodo_pago || 'efectivo'
            if (libro === 'BANCO' && mp !== 'qr' && mp !== 'tarjeta') continue
            if (libro === 'CAJA_CHICA' && mp !== 'efectivo' && mp !== 'mixto') continue

            const barberoName = (com.barberos as any)?.full_name || 'Barbero'
            const alreadyIn = finalData.some((t: any) =>
              (t.glosa && t.glosa.includes(com.id)) ||
              (t.subcategoria === 'COMISION_PAGO' && t.empleado_id === com.barbero_id && t.fecha === comFecha)
            )
            if (!alreadyIn) {
              finalData.push({
                id: `virtual-comision-${com.id}`,
                libro: mp === 'qr' || mp === 'tarjeta' ? 'BANCO' : 'CAJA_CHICA',
                fecha: comFecha,
                ci: '0000000',
                nombre: `Pago Comisiones a ${barberoName}`,
                cuenta_codigo: 'EGR-COM',
                cuenta_detalle: 'Pago de Comisiones / Sueldos',
                glosa: `Pago ${com.periodo_tipo || ''} (${comFecha}) (Pago ID: ${com.id})`,
                costo: Number(com.monto_total || 0),
                tipo_movimiento: 'EGRESO',
                subcategoria: 'COMISION_PAGO',
                es_sancion: false,
                empleado_id: com.barbero_id,
                metodo_pago: mp,
                monto_efectivo: mp === 'efectivo' ? Number(com.monto_total || 0) : 0,
                monto_qr: mp === 'qr' || mp === 'tarjeta' ? Number(com.monto_total || 0) : 0,
                usuario_registro: 'Sistema',
                creado_en: com.creado_en || new Date().toISOString()
              })
            }
          }
        }
      }

      finalData.sort((a: any, b: any) => {
        if (b.fecha !== a.fecha) return b.fecha.localeCompare(a.fecha)
        return (String(b.creado_en || '')).localeCompare(String(a.creado_en || ''))
      })
    } catch (mergeErr) {
      console.error('Error safely merging:', mergeErr)
    }

    return NextResponse.json(finalData)
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

    const cuentaCodigoFinal = body.cuenta_codigo || '000'
    // Asegurar que la cuenta exista en plan_cuentas para evitar violación de foreign key (transactions_cuenta_codigo_fkey)
    await supabase.from('plan_cuentas').upsert({
      codigo: cuentaCodigoFinal,
      detalle: body.cuenta_codigo ? (body.cuenta_detalle || 'Movimiento Financiero') : 'Movimiento General / Varios',
      tipo: body.tipo_movimiento === 'INGRESO' || body.tipo_movimiento === 'DEPOSITO' ? 'INGRESO' : 'EGRESO',
      nivel: cuentaCodigoFinal.split('.').length || 1,
      es_sancion: !!body.es_sancion
    }, { onConflict: 'codigo', ignoreDuplicates: true })

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        libro: body.libro,
        fecha: body.fecha || getTodayBolivia(),
        ci: body.ci || '0000000',
        nombre: body.nombre || 'Sin nombre',
        cuenta_codigo: cuentaCodigoFinal,
        cuenta_detalle: body.cuenta_detalle || 'Movimiento manual',
        glosa: body.glosa || '',
        costo: Number(body.costo) || 0,
        tipo_movimiento: body.tipo_movimiento || 'EGRESO',
        subcategoria: body.subcategoria || null,
        es_sancion: body.es_sancion || false,
        empleado_id: body.empleado_id || null,
        cliente_id: body.cliente_id || null,
        metodo_pago: body.metodo_pago || 'efectivo',
        monto_efectivo: body.monto_efectivo !== undefined ? Number(body.monto_efectivo) : (body.metodo_pago === 'mixto' ? Number(body.monto_efectivo || 0) : ((!body.metodo_pago || body.metodo_pago === 'efectivo') && body.libro !== 'BANCO' ? Number(body.costo || 0) : 0)),
        monto_qr: body.monto_qr !== undefined ? Number(body.monto_qr) : (body.metodo_pago === 'mixto' ? Number(body.monto_qr || 0) : (body.metodo_pago === 'qr' || body.metodo_pago === 'tarjeta' || body.libro === 'BANCO' ? Number(body.costo || 0) : 0)),
        comprobante_url: body.comprobante_url || null,
        usuario_registro: profile.full_name || user.email || 'Sistema',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('subcategoria') || error.message?.includes('monto_')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('transactions')
          .insert({
            libro: body.libro,
            fecha: body.fecha || getTodayBolivia(),
            ci: body.ci || '0000000',
            nombre: body.nombre || 'Sin nombre',
            cuenta_codigo: cuentaCodigoFinal,
            cuenta_detalle: body.cuenta_detalle || 'Movimiento manual',
            glosa: body.glosa || '',
            costo: Number(body.costo) || 0,
            tipo_movimiento: body.tipo_movimiento || 'EGRESO',
            es_sancion: body.es_sancion || false,
            empleado_id: body.empleado_id || null,
            cliente_id: body.cliente_id || null,
            metodo_pago: body.metodo_pago || 'efectivo',
            comprobante_url: body.comprobante_url || null,
            usuario_registro: profile.full_name || user.email || 'Sistema',
          })
          .select()
          .single()
        if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 500 })
        return NextResponse.json(fallbackData, { status: 201 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { id, comprobante_url } = body
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const { data, error } = await supabase
      .from('transactions')
      .update({ comprobante_url })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
