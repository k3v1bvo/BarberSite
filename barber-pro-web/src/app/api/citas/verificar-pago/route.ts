import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient, getNotificationDbClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'

export async function POST(request: Request) {
  try {
    const { citaId } = await request.json()
    if (!citaId) {
      return NextResponse.json({ error: 'citaId es requerido' }, { status: 400 })
    }

    const serverDb = await createServerSupabaseClient()
    const {
      data: { user },
      error: userError,
    } = await serverDb.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener rol del usuario
    const { data: profile } = await serverDb
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 })
    }

    // Obtener la cita con notas, fecha de creación y comprobante
    const { data: cita, error: citaError } = await serverDb
      .from('citas')
      .select('id, barbero_id, cliente_id, estado, anticipo_monto, fecha_hora, created_at, notas, clientes(nombre, ci, email), servicios(nombre)')
      .eq('id', citaId)
      .single()

    if (citaError || !cita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }

    // Verificar si tiene permiso: Admin, Coordinador, o el Barbero asignado
    const isAllowed =
      profile.role === 'admin' || profile.role === 'coordinador' || cita.barbero_id === user.id
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'No tienes permiso para verificar este pago' },
        { status: 403 }
      )
    }

    if (cita.estado !== 'pendiente_pago') {
      return NextResponse.json(
        { error: 'La cita no está pendiente de pago' },
        { status: 400 }
      )
    }

    // Actualizar la cita
    const { error: updateError } = await serverDb
      .from('citas')
      .update({
        estado: 'confirmado',
        anticipo_verificado: true,
        anticipo_verificado_por: user.id,
        anticipo_verificado_at: new Date().toISOString(),
      })
      .eq('id', citaId)

    if (updateError) {
      console.error('[verificar-pago] Error update:', updateError)
      return NextResponse.json({ error: 'Error al verificar pago' }, { status: 500 })
    }

    // Obtener nombre del barbero
    let barberoNombre = 'Equipo'
    if (cita.barbero_id) {
      const { data: barberoProfile } = await serverDb
        .from('profiles')
        .select('full_name')
        .eq('id', cita.barbero_id)
        .single()
      barberoNombre = barberoProfile?.full_name || 'Equipo'
    }

    // Extraer comprobante_url de notas
    const notasStr = cita.notas as string | null
    const matchStandard = notasStr?.match(/\[Comprobante\]:\s*([^\s\n\r]+)/i)
    const matchBase64 = notasStr?.match(/(data:image\/[a-zA-Z0-9+]+;base64,[^\s\n\r]+)/i)
    const matchAnyUrl = notasStr?.match(/(https?:\/\/[^\s\n\r]+\.(?:jpg|jpeg|png|webp|gif|svg)|https?:\/\/(?:i\.)?ibb\.co\/[^\s\n\r]+|https?:\/\/res\.cloudinary\.com\/[^\s\n\r]+)/i)
    const comprobante_url = matchStandard ? matchStandard[1].trim() : (matchBase64 ? matchBase64[1].trim() : (matchAnyUrl ? matchAnyUrl[1].trim() : undefined))

    const cliente = cita.clientes as { nombre?: string; ci?: string; email?: string } | null
    const servicio = cita.servicios as { nombre?: string } | null
    const fh = new Date(cita.fecha_hora)
    const fechaCitaStr = fh.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' })
    const horaCitaStr = fh.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hour12: false })

    // Registrar en el Libro de BANCO el anticipo con la fecha y hora en que se reservó
    const anticipoMonto = Number(cita.anticipo_monto || 0)
    if (anticipoMonto > 0) {
      try {
        const adminDb = createAdminSupabaseClient() || serverDb

        // Verificar que no exista ya un registro previo en BANCO para esta cita
        const { data: existingTx } = await adminDb
          .from('transactions')
          .select('id')
          .eq('cita_id', citaId)
          .eq('libro', 'BANCO')
          .maybeSingle()

        if (!existingTx) {
          // Extraer fecha en hora de Bolivia a partir del momento en que el cliente reservó (created_at)
          const resDate = cita.created_at ? new Date(cita.created_at) : new Date()
          const fechaReservaBolivia = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/La_Paz',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(resDate)
          const horaReservaBolivia = resDate.toLocaleTimeString('es-BO', {
            timeZone: 'America/La_Paz',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })

          const clienteCi = cliente?.ci && cliente.ci !== '0' && cliente.ci !== '0000000' ? cliente.ci : '—'
          const clienteNom = cliente?.nombre || 'Cliente'
          const servNom = servicio?.nombre || 'Servicio'

          const glosaAnticipo = `Anticipo QR por reserva #${citaId.slice(0, 6)} (${servNom} con ${barberoNombre} para el ${fechaCitaStr} a las ${horaCitaStr}) [Reservado el ${fechaReservaBolivia} a las ${horaReservaBolivia}]`

          const { error: txError } = await adminDb
            .from('transactions')
            .insert({
              libro: 'BANCO',
              fecha: fechaReservaBolivia,
              creado_en: cita.created_at || new Date().toISOString(),
              ci: clienteCi,
              nombre: clienteNom,
              cuenta_codigo: '1.1.1.4.1',
              cuenta_detalle: `Caja de ahorro M.N. BANCO GANADERO (Anticipo QR - ${servNom})`,
              glosa: glosaAnticipo,
              costo: anticipoMonto,
              tipo_movimiento: 'DEPOSITO',
              subcategoria: 'ANTICIPO_RESERVA',
              es_sancion: false,
              empleado_id: cita.barbero_id || null,
              cliente_id: cita.cliente_id || null,
              cita_id: citaId,
              metodo_pago: 'qr',
              monto_efectivo: 0,
              monto_qr: anticipoMonto,
              comprobante_url: comprobante_url || null,
              usuario_registro: profile.full_name || 'Sistema',
              notas: `Reserva realizada el ${fechaReservaBolivia} ${horaReservaBolivia} para cita del ${fechaCitaStr} ${horaCitaStr}`
            })

          if (txError) {
            console.error('[verificar-pago] Error al registrar anticipo en transactions (BANCO):', txError)
          }
        }
      } catch (errTx) {
        console.error('[verificar-pago] Excepción al registrar transacción de banco:', errTx)
      }
    }

    // Disparar notificaciones
    const notifDb = getNotificationDbClient(serverDb)
    await dispatchNotification(notifDb, {
      event: 'pago_verificado',
      payload: {
        citaId,
        clienteId: cita.cliente_id,
        barberoId: cita.barbero_id,
        barberoNombre,
        clienteNombre: cliente?.nombre,
        clienteEmail: cliente?.email ?? undefined,
        servicioNombre: servicio?.nombre,
        monto: cita.anticipo_monto,
        fecha: fechaCitaStr,
        hora: horaCitaStr,
        motivo: profile.full_name,
        comprobante_url,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[api/citas/verificar-pago]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
