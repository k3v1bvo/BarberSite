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

    const afectaBanco = sp.get('afecta_banco') === 'true'

    if (afectaBanco) {
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
            descuento,
            fecha_hora,
            barbero_id,
            cliente_id,
            metodo_pago,
            anticipo_monto,
            notas,
            clientes (nombre, ci, telefono),
            servicios (nombre),
            barberos:profiles!barbero_id (full_name)
          `)
          .eq('estado', 'completado')
          .order('fecha_hora', { ascending: false })
          .limit(limit)

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
            const fechaCita = c.fecha_hora ? c.fecha_hora.split('T')[0] : (fecha || getTodayBolivia())
            const clienteNombre = (c.clientes as any)?.nombre || 'Cliente'
            const clienteCi = (c.clientes as any)?.ci || ''
            
            const matchNeto = (c.notas as string | null)?.match(/Neto cobrado:\s*Bs\s*(\d+(?:\.\d+)?)/i)
            const matchDesc = (c.notas as string | null)?.match(/Desc:\s*-Bs\s*(\d+(?:\.\d+)?)/i)
            const descValue = Number((c as any).descuento || 0)
            const precioCita = matchNeto 
              ? parseFloat(matchNeto[1]) 
              : (matchDesc 
                  ? Math.max(0, Number(c.precio) - parseFloat(matchDesc[1])) 
                  : (descValue > 0 ? Math.max(0, Number(c.precio || 0) - descValue) : Number(c.precio || 0)))

            const alreadyIn = finalData.some((t: any) => {
              if (t.cita_id && String(t.cita_id) === cIdStr) return true
              if (t.glosa && (t.glosa.includes(cIdShort) || t.glosa.includes(cIdStr))) return true

              const sameFecha = t.fecha === fechaCita
              const sameNombre = t.nombre && clienteNombre && clienteNombre !== 'Cliente' && t.nombre.toLowerCase().trim() === clienteNombre.toLowerCase().trim()
              const sameMonto = Math.abs(Number(t.costo || 0) - precioCita) < 1.5

              return sameFecha && sameNombre && sameMonto
            })

            if (!alreadyIn) {
              const barberoNombre = (c.barberos as any)?.full_name || 'Barbero'
              const servicioNombre = (c.servicios as any)?.nombre || 'Servicio de Barbería'
              const anticipoQr = Number(c.anticipo_monto || 0)
              const mpRaw = String(c.metodo_pago || 'efectivo').toLowerCase()

              let realEf = 0
              let realQr = anticipoQr
              let realMetodo = mpRaw

              const resto = Math.max(0, precioCita - anticipoQr)
              if (mpRaw === 'efectivo') {
                realEf = resto
              } else if (['qr', 'tarjeta', 'transferencia', 'banco'].includes(mpRaw)) {
                realQr += resto
              } else if (mpRaw === 'mixto') {
                realEf = resto // fallback
              }

              if (anticipoQr > 0 && realEf > 0) {
                realMetodo = 'mixto'
              } else if (anticipoQr > 0 && realEf === 0) {
                realMetodo = 'qr'
              }

              const totalDesc = descValue > 0 ? descValue : (matchDesc ? parseFloat(matchDesc[1]) : (Number(c.precio || 0) > precioCita ? Number(c.precio || 0) - precioCita : 0))
              let glosaFinal = `Atendido por ${barberoNombre} — Cita #${cIdShort}`
              if (totalDesc > 0) {
                glosaFinal += ` | ⭐ Desc. Especial: -Bs ${totalDesc}`
              }

              const notasParts: string[] = []
              if (c.notas) notasParts.push(c.notas)
              if (totalDesc > 0 && !c.notas?.includes('Desc')) {
                notasParts.push(`⭐ Precio Especial / Desc: -Bs ${totalDesc} (Original: Bs ${c.precio || (precioCita + totalDesc)} → Neto: Bs ${precioCita})`)
              }
              if (anticipoQr > 0 && !c.notas?.includes('Anticipo')) {
                notasParts.push(`Anticipo QR: Bs ${anticipoQr} | Cobrado en caja (${mpRaw}): Bs ${resto}`)
              }
              const notasFinales = notasParts.length > 0 ? notasParts.join(' | ') : null

              finalData.push({
                id: `virtual-cita-${cIdStr}`,
                libro: 'SERVICIOS',
                fecha: fechaCita,
                ci: clienteCi || '—',
                nombre: clienteNombre,
                cuenta_codigo: 'ING-001',
                cuenta_detalle: `Servicio: ${servicioNombre}`,
                glosa: glosaFinal,
                costo: precioCita,
                tipo_movimiento: 'INGRESO',
                subcategoria: 'SERVICIO',
                es_sancion: false,
                empleado_id: c.barbero_id,
                cliente_id: c.cliente_id,
                metodo_pago: realMetodo,
                monto_efectivo: realEf,
                monto_qr: realQr,
                notas: notasFinales,
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
        let egresosQuery = supabase
          .from('egresos')
          .select('*')
          .order('fecha', { ascending: false })
          .limit(limit)
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
                ci: e.ci || '—',
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
            barberos:profiles!barbero_id (full_name, ci)
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
            const barberoCi = (com.barberos as any)?.ci || '—'
            const alreadyIn = finalData.some((t: any) =>
              (t.glosa && t.glosa.includes(com.id)) ||
              (t.subcategoria === 'COMISION_PAGO' && t.empleado_id === com.barbero_id && t.fecha === comFecha)
            )
            if (!alreadyIn) {
              finalData.push({
                id: `virtual-comision-${com.id}`,
                libro: mp === 'qr' || mp === 'tarjeta' ? 'BANCO' : 'CAJA_CHICA',
                fecha: comFecha,
                ci: barberoCi,
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

    // Resolver CI real si no vino o es 0000000
    let ciFinal = body.ci && body.ci !== '0000000' && body.ci !== '0' ? body.ci : ''
    if (!ciFinal && body.cliente_id) {
      const { data: cData } = await supabase.from('clientes').select('ci').eq('id', body.cliente_id).single()
      if (cData?.ci) ciFinal = cData.ci
    }
    if (!ciFinal && body.nombre && body.nombre !== 'Sin nombre' && body.nombre !== 'Cliente General') {
      const { data: cData } = await supabase.from('clientes').select('ci').ilike('nombre', body.nombre.trim()).limit(1)
      if (cData && cData.length > 0 && cData[0].ci) ciFinal = cData[0].ci
    }

    // Auto-clasificar tipo de movimiento
    let tipoMovFinal = body.tipo_movimiento
    if (!tipoMovFinal) {
      if (cuentaCodigoFinal.startsWith('4') || body.libro === 'VENTAS' || body.libro === 'SERVICIOS') {
        tipoMovFinal = 'INGRESO'
      } else {
        tipoMovFinal = 'EGRESO'
      }
    }
    if (cuentaCodigoFinal.startsWith('5') || cuentaCodigoFinal.startsWith('6') || (body.glosa && body.glosa.toLowerCase().includes('devolucion'))) {
      tipoMovFinal = 'EGRESO'
    }

    // Asegurar que la cuenta exista en plan_cuentas para evitar violación de foreign key (transactions_cuenta_codigo_fkey)
    await supabase.from('plan_cuentas').upsert({
      codigo: cuentaCodigoFinal,
      detalle: body.cuenta_codigo ? (body.cuenta_detalle || 'Movimiento Financiero') : 'Movimiento General / Varios',
      tipo: tipoMovFinal === 'INGRESO' || tipoMovFinal === 'DEPOSITO' ? 'INGRESO' : 'EGRESO',
      nivel: cuentaCodigoFinal.split('.').length || 1,
      es_sancion: !!body.es_sancion
    }, { onConflict: 'codigo', ignoreDuplicates: true })

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        libro: body.libro,
        fecha: body.fecha || getTodayBolivia(),
        ci: ciFinal || '—',
        nombre: body.nombre || 'Sin nombre',
        cuenta_codigo: cuentaCodigoFinal,
        cuenta_detalle: body.cuenta_detalle || 'Movimiento manual',
        glosa: body.glosa || '',
        costo: Number(body.costo) || 0,
        tipo_movimiento: tipoMovFinal,
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
            ci: ciFinal || '—',
            nombre: body.nombre || 'Sin nombre',
            cuenta_codigo: cuentaCodigoFinal,
            cuenta_detalle: body.cuenta_detalle || 'Movimiento manual',
            glosa: body.glosa || '',
            costo: Number(body.costo) || 0,
            tipo_movimiento: tipoMovFinal,
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
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { id, comprobante_url, costo, nombre, ci, cuenta_codigo, cuenta_detalle, glosa, metodo_pago, monto_efectivo, monto_qr, tipo_movimiento, fecha, notas } = body
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    if (id.startsWith('virtual-cita-')) {
      const citaId = id.replace('virtual-cita-', '')
      const { data: cita } = await supabase
        .from('citas')
        .select('notas, cliente_id, barbero_id, servicio_id, precio, fecha_hora, metodo_pago, anticipo_monto, clientes(nombre, ci), servicios(nombre), profiles!barbero_id(full_name)')
        .eq('id', citaId)
        .single()

      if (cita) {
        let currentNotas = cita.notas || ''
        if (comprobante_url) {
          if (!currentNotas.includes('[Comprobante]:')) {
            currentNotas += `\n[Comprobante]: ${comprobante_url}`
          } else {
            currentNotas = currentNotas.replace(/\[Comprobante\]: .*/, `[Comprobante]: ${comprobante_url}`)
          }
          await supabase.from('citas').update({ notas: currentNotas }).eq('id', citaId)
        }

        const clienteNombre = nombre || (cita.clientes as any)?.nombre || 'Cliente'
        const clienteCi = ci || (cita.clientes as any)?.ci || '—'
        const barberoNombre = (cita.profiles as any)?.full_name || 'Barbero'
        const servicioNombre = (cita.servicios as any)?.nombre || 'Servicio'
        const precioCita = costo !== undefined ? Number(costo) : Number(cita.precio || 0)
        const anticipoQr = Number(cita.anticipo_monto || 0)
        const mpRaw = String(metodo_pago || cita.metodo_pago || 'qr').toLowerCase()
        const resto = Math.max(0, precioCita - anticipoQr)

        let realEf = monto_efectivo !== undefined ? Number(monto_efectivo) : (mpRaw === 'efectivo' ? resto : 0)
        let realQr = monto_qr !== undefined ? Number(monto_qr) : (anticipoQr + (['qr', 'tarjeta', 'transferencia', 'banco'].includes(mpRaw) ? resto : 0))
        let realMetodo = mpRaw

        if (anticipoQr > 0 && realEf > 0) realMetodo = 'mixto'
        else if (anticipoQr > 0 && realEf === 0) realMetodo = 'qr'

        const { data: txNueva } = await supabase.from('transactions').insert({
          libro: 'SERVICIOS',
          fecha: fecha || (cita.fecha_hora ? cita.fecha_hora.split('T')[0] : getTodayBolivia()),
          ci: clienteCi,
          nombre: clienteNombre,
          cuenta_codigo: cuenta_codigo || 'ING-001',
          cuenta_detalle: cuenta_detalle || `Servicio: ${servicioNombre}`,
          glosa: glosa || `Atendido por ${barberoNombre} — Cita #${citaId.slice(0, 6)}`,
          costo: precioCita,
          tipo_movimiento: tipo_movimiento || 'INGRESO',
          subcategoria: 'SERVICIO',
          es_sancion: false,
          empleado_id: cita.barbero_id,
          cliente_id: cita.cliente_id,
          cita_id: citaId,
          metodo_pago: realMetodo,
          monto_efectivo: realEf,
          monto_qr: realQr,
          comprobante_url: comprobante_url || null,
          notas: notas || (anticipoQr > 0 ? `Anticipo QR: Bs ${anticipoQr} | Cobrado (${mpRaw}): Bs ${resto}` : null),
          usuario_registro: profile?.full_name || 'Coordinador',
        }).select().single()

        return NextResponse.json({ success: true, data: txNueva })
      }
    }

    const updatePayload: any = {}
    if (comprobante_url !== undefined) updatePayload.comprobante_url = comprobante_url
    if (costo !== undefined) updatePayload.costo = Number(costo)
    if (nombre !== undefined) updatePayload.nombre = nombre
    if (ci !== undefined) updatePayload.ci = ci
    if (cuenta_codigo !== undefined) updatePayload.cuenta_codigo = cuenta_codigo
    if (cuenta_detalle !== undefined) updatePayload.cuenta_detalle = cuenta_detalle
    if (glosa !== undefined) updatePayload.glosa = glosa
    if (metodo_pago !== undefined) updatePayload.metodo_pago = metodo_pago
    if (monto_efectivo !== undefined) updatePayload.monto_efectivo = Number(monto_efectivo)
    if (monto_qr !== undefined) updatePayload.monto_qr = Number(monto_qr)
    if (tipo_movimiento !== undefined) updatePayload.tipo_movimiento = tipo_movimiento
    if (fecha !== undefined) updatePayload.fecha = fecha
    if (notas !== undefined) updatePayload.notas = notas

    const { data, error } = await supabase
      .from('transactions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    if (id.startsWith('virtual-cita-')) {
      return NextResponse.json({ error: 'No se puede eliminar una cita directamente desde transacciones. Cancelarla en citas.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
