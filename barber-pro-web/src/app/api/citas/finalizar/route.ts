import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { calcularNivelFidelidad } from '@/lib/lealtad/calcular-nivel'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { cita_id, metodo_pago, propinas } = body

    // Obtener la cita con el cliente_id
    const { data: cita } = await supabase
      .from('citas')
      .select('barbero_id, estado, precio, comision_barbero, cliente_id, servicio_id, fecha_hora, servicios(nombre)')
      .eq('id', cita_id)
      .single()

    if (!cita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const puedeFinalizar = profile?.role === 'admin' || 
                           profile?.role === 'coordinador' ||
                           (profile?.role === 'barbero' && cita.barbero_id === user.id)

    if (!puedeFinalizar) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    if (cita.estado !== 'en_proceso') {
      return NextResponse.json({ error: 'La cita no está en proceso' }, { status: 400 })
    }

    const comisionTotal = (cita.comision_barbero || 0) + ((propinas || 0) * 0.5)

    // ✅ ACTUALIZAR CITA Y ESTADÍSTICAS DEL CLIENTE
    const { error: updateCitaError } = await supabase
      .from('citas')
      .update({ 
        estado: 'completado',
        updated_at: new Date().toISOString(),
        metodo_pago,
        propinas: propinas || 0,
        comision_barbero: comisionTotal,
      })
      .eq('id', cita_id)

    if (updateCitaError) {
      return NextResponse.json({ error: updateCitaError.message }, { status: 500 })
    }

    // Actualizar cliente (Lealtad)
    if (cita.cliente_id) {
      const { data: clienteActual } = await supabase
        .from('clientes')
        .select('total_visitas, total_gastado, email, full_name, user_id')
        .eq('id', cita.cliente_id)
        .single()

      if (clienteActual) {
        // REGLA: Si el cliente hace varios servicios el mismo día, solo cuenta 1 en visitas
        const fechaCitaStr = (cita.fecha_hora || '').split('T')[0]
        let yaAtendidoEseDia = false

        if (cita.servicio_id && fechaCitaStr) {
          const { data: otrasHoy } = await supabase
            .from('citas')
            .select('id')
            .eq('cliente_id', cita.cliente_id)
            .eq('estado', 'completado')
            .not('servicio_id', 'is', null)
            .neq('id', cita_id)
            .gte('fecha_hora', `${fechaCitaStr}T00:00:00-04:00`)
            .lte('fecha_hora', `${fechaCitaStr}T23:59:59-04:00`)

          if ((otrasHoy || []).length > 0) {
            yaAtendidoEseDia = true
          }
        }

        const debeSumarVisita = Boolean(cita.servicio_id) && !yaAtendidoEseDia
        const nuevoTotalVisitas = (clienteActual.total_visitas || 0) + (debeSumarVisita ? 1 : 0)
        const nuevoNivel = await calcularNivelFidelidad(supabase, nuevoTotalVisitas)
        
        await supabase
          .from('clientes')
          .update({
            total_visitas: nuevoTotalVisitas,
            total_gastado: (clienteActual.total_gastado || 0) + Number(cita.precio || 0),
            nivel_fidelidad: nuevoNivel,
            ...(fechaCitaStr ? { ultima_visita: fechaCitaStr } : {})
          })
          .eq('id', cita.cliente_id)
      }
    }

    // ✅ REGISTRAR TRANSACCIÓN CONTABLE (Libro: SERVICIOS)
    const { data: barberoProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', cita.barbero_id)
      .single()

    const anticipoQr = Number((cita as any).anticipo_monto || 0)
    const precioCita = Number(cita.precio || 0)
    const mpRaw = String(metodo_pago || 'efectivo').toLowerCase()

    // Verificar si el anticipo ya fue registrado previamente en el Libro de BANCO (en la reserva)
    let anticipoEnBanco = false
    if (cita_id && anticipoQr > 0) {
      const { data: bTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('cita_id', cita_id)
        .eq('libro', 'BANCO')
        .maybeSingle()
      if (bTx) anticipoEnBanco = true
    }

    let realEf = 0
    let realQr = anticipoEnBanco ? 0 : anticipoQr
    let realMetodo = mpRaw

    const resto = Math.max(0, precioCita - anticipoQr)
    if (mpRaw === 'efectivo') {
      realEf = resto
    } else if (['qr', 'tarjeta', 'transferencia', 'banco'].includes(mpRaw)) {
      realQr += resto
    } else if (mpRaw === 'mixto') {
      realEf = resto
    }

    if (anticipoQr > 0 && realEf > 0 && !anticipoEnBanco) {
      realMetodo = 'mixto'
    } else if (anticipoQr > 0 && realEf === 0 && !anticipoEnBanco) {
      realMetodo = 'qr'
    }

    const txFinPayload = {
      libro: 'SERVICIOS',
      fecha: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
      ci: '0000000',
      nombre: 'Cliente',
      cuenta_codigo: '4.1.2',
      cuenta_detalle: `Servicio: ${(cita.servicios as any)?.nombre || ''}`,
      glosa: `Atendido por ${barberoProfile?.full_name || 'Desconocido'} — Cita #${cita_id.substring(0, 6)}`,
      costo: precioCita,
      tipo_movimiento: 'INGRESO',
      subcategoria: 'SERVICIO',
      es_sancion: false,
      empleado_id: cita.barbero_id,
      cliente_id: cita.cliente_id,
      cita_id: cita_id,
      metodo_pago: realMetodo,
      monto_efectivo: realEf,
      monto_qr: realQr,
      notas: anticipoQr > 0 ? `Anticipo QR: Bs ${anticipoQr}${anticipoEnBanco ? ' (Registrado en BANCO)' : ''} | Cobrado en local (${mpRaw}): Bs ${resto}` : null,
      usuario_registro: barberoProfile?.full_name || 'Sistema (Auto)',
    }

    const { data: existingServTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('cita_id', cita_id)
      .eq('libro', 'SERVICIOS')
      .maybeSingle()

    if (existingServTx?.id) {
      const { error: upTxErr } = await supabase
        .from('transactions')
        .update(txFinPayload)
        .eq('id', existingServTx.id)
      if (upTxErr) console.error('Error actualizando transaccion al finalizar cita:', upTxErr)
    } else {
      const { error: inTxErr } = await supabase
        .from('transactions')
        .insert(txFinPayload)
      if (inTxErr) console.error('Error al insertar transaccion al finalizar cita:', inTxErr)
    }

    // Obtener info del cliente si no se sacó arriba
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('email, full_name, user_id')
      .eq('id', cita.cliente_id)
      .single()

    const db = getNotificationDbClient(supabase)
    await dispatchNotification(db, {
      event: 'cita_completada',
      payload: { 
        citaId: cita_id, 
        barberoId: cita.barbero_id, 
        barberoNombre: barberoProfile?.full_name || 'Tu Barbero',
        monto: cita.precio,
        clienteId: clienteData?.user_id || undefined,
        clienteEmail: clienteData?.email || undefined,
        clienteNombre: clienteData?.full_name || undefined
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error al finalizar cita' }, { status: 500 })
  }
}