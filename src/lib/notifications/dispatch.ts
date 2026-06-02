import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DispatchInput,
  InAppNotificationInsert,
  NotificationCategory,
  NotificationPayload,
} from './types'
import { sendAdminEmail, sendNotificationEmail } from './email'
import { getUserPreferences, shouldSendEmail, shouldSendPush } from './preferences'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

async function insertNotifications(
  db: SupabaseClient,
  rows: InAppNotificationInsert[]
): Promise<void> {
  if (!rows.length) return
  const { error } = await db.from('notificaciones').insert(
    rows.map((r) => ({
      user_id: r.user_id ?? null,
      rol_destino: r.rol_destino ?? null,
      titulo: r.titulo,
      mensaje: r.mensaje,
      tipo: r.tipo,
      categoria: r.categoria,
      link: r.link ?? null,
      metadata: r.metadata ?? {},
      leido: false,
    }))
  )
  if (error) console.error('[notifications] insert error:', error.message)
}

async function notifyUser(
  db: SupabaseClient,
  userId: string,
  category: NotificationCategory,
  inApp: InAppNotificationInsert,
  email?: { template: string; data: Record<string, string | undefined>; to: string }
): Promise<void> {
  const prefs = await getUserPreferences(db, userId)
  const rows: InAppNotificationInsert[] = []

  if (shouldSendPush(prefs, category)) {
    rows.push({ ...inApp, user_id: userId })
  }

  await insertNotifications(db, rows)

  if (email && shouldSendEmail(prefs, category)) {
    await sendNotificationEmail(email.to, email.template, email.data)
  }
}

async function notifyRole(
  db: SupabaseClient,
  rol: string,
  inApp: InAppNotificationInsert
): Promise<void> {
  await insertNotifications(db, [{ ...inApp, rol_destino: rol }])
}

function agendaLink(barberoId?: string): string {
  if (barberoId) return `${SITE}/agenda/${barberoId}`
  return `${SITE}/agenda`
}

export async function dispatchNotification(
  db: SupabaseClient,
  input: DispatchInput
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = []
  const { event, payload } = input
  const p = payload

  try {
    switch (event) {
      case 'reserva_nueva': {
        const msg = `${p.clienteNombre || 'Cliente'} — ${p.servicioNombre || 'Servicio'} · ${p.fecha} ${p.hora}`
        const meta = { cita_id: p.citaId, barbero_id: p.barberoId }

        if (p.barberoId) {
          await notifyUser(
            db,
            p.barberoId,
            event,
            {
              titulo: '📅 Nueva cita',
              mensaje: msg,
              tipo: 'info',
              categoria: event,
              link: agendaLink(p.barberoId),
              metadata: meta,
            },
            p.barberoEmail
              ? {
                  to: p.barberoEmail,
                  template: 'reserva_nueva_barbero',
                  data: {
                    nombre: p.clienteNombre,
                    servicio: p.servicioNombre,
                    fecha: p.fecha,
                    hora: p.hora,
                  },
                }
              : undefined
          )
        }

        await notifyRole(db, 'admin', {
          titulo: '📅 Nueva reserva',
          mensaje: msg + (p.barberoNombre ? ` · ${p.barberoNombre}` : ''),
          tipo: 'info',
          categoria: event,
          link: '/agenda',
          metadata: meta,
        })

        await notifyRole(db, 'recepcionista', {
          titulo: '📅 Nueva reserva',
          mensaje: msg,
          tipo: 'info',
          categoria: event,
          link: '/recepcion',
          metadata: meta,
        })

        if (p.clienteEmail) {
          await sendNotificationEmail(p.clienteEmail, 'reserva_confirmacion_cliente', {
            nombre: p.clienteNombre,
            servicio: p.servicioNombre,
            fecha: p.fecha,
            hora: p.hora,
            barbero: p.barberoNombre,
          })
        }

        await sendAdminEmail('reserva_nueva_barbero', {
          nombre: p.clienteNombre,
          servicio: p.servicioNombre,
          fecha: p.fecha,
          hora: p.hora,
          barbero: p.barberoNombre,
        })
        break
      }

      case 'reserva_cancelada': {
        const msg = `Cancelada: ${p.clienteNombre} · ${p.fecha} ${p.hora}`
        const meta = { cita_id: p.citaId }

        if (p.barberoId) {
          await notifyUser(db, p.barberoId, event, {
            titulo: '❌ Cita cancelada',
            mensaje: msg,
            tipo: 'warning',
            categoria: event,
            link: agendaLink(p.barberoId),
            metadata: meta,
          })
        }

        await notifyRole(db, 'admin', {
          titulo: '❌ Cancelación',
          mensaje: msg,
          tipo: 'warning',
          categoria: event,
          link: '/agenda',
          metadata: meta,
        })

        if (p.clienteEmail) {
          await sendNotificationEmail(p.clienteEmail, 'reserva_cancelada', {
            nombre: p.clienteNombre,
            servicio: p.servicioNombre,
            fecha: p.fecha,
            hora: p.hora,
            motivo: p.motivo,
          })
        }
        break
      }

      case 'reserva_reprogramada': {
        const msg = `${p.clienteNombre}: ${p.fechaAnterior} ${p.horaAnterior} → ${p.fecha} ${p.hora}`

        if (p.barberoId) {
          await notifyUser(db, p.barberoId, event, {
            titulo: '🔄 Cita reprogramada',
            mensaje: msg,
            tipo: 'info',
            categoria: event,
            link: agendaLink(p.barberoId),
            metadata: { cita_id: p.citaId },
          })
        }

        await notifyRole(db, 'admin', {
          titulo: '🔄 Reprogramación',
          mensaje: msg,
          tipo: 'info',
          categoria: event,
          link: '/agenda',
        })

        if (p.clienteEmail) {
          await sendNotificationEmail(p.clienteEmail, 'reserva_reprogramada', {
            nombre: p.clienteNombre,
            servicio: p.servicioNombre,
            fecha: p.fecha,
            hora: p.hora,
            fechaAnterior: p.fechaAnterior,
            horaAnterior: p.horaAnterior,
            barbero: p.barberoNombre,
          })
        }
        break
      }

      case 'cita_completada': {
        const monto = p.monto != null ? `$${Number(p.monto).toFixed(2)}` : ''
        if (p.barberoId) {
          await notifyUser(db, p.barberoId, event, {
            titulo: '💰 Cita completada',
            mensaje: `Servicio finalizado${monto ? ` · ${monto}` : ''}`,
            tipo: 'success',
            categoria: event,
            link: '/barbero',
          })
        }
        await notifyRole(db, 'admin', {
          titulo: '💳 Ingreso registrado',
          mensaje: `Pago de cita${monto ? `: ${monto}` : ''}`,
          tipo: 'success',
          categoria: event,
          link: '/admin/reportes',
          metadata: { cita_id: p.citaId },
        })
        break
      }

      case 'venta_nueva': {
        const monto = p.monto != null ? `$${Number(p.monto).toFixed(2)}` : '—'
        await notifyRole(db, 'admin', {
          titulo: '🛍️ Nuevo pedido',
          mensaje: `${p.clienteNombre || 'Cliente'} · ${monto}`,
          tipo: 'info',
          categoria: event,
          link: '/admin/pedidos',
          metadata: { pedido_id: p.pedidoId },
        })
        await notifyRole(db, 'recepcionista', {
          titulo: '🛍️ Nuevo pedido',
          mensaje: `${p.clienteNombre} · ${monto}`,
          tipo: 'info',
          categoria: event,
          link: '/admin/pedidos',
        })
        await sendAdminEmail('venta_admin', {
          nombre: p.clienteNombre,
          monto,
        })
        if (p.clienteEmail) {
          await sendNotificationEmail(p.clienteEmail, 'venta_cliente', {
            nombre: p.clienteNombre,
            monto,
          })
        }
        break
      }

      case 'horario_cambio': {
        if (p.barberoId) {
          const { data: profile } = await db
            .from('profiles')
            .select('email')
            .eq('id', p.barberoId)
            .single()

          await notifyUser(
            db,
            p.barberoId,
            event,
            {
              titulo: '📋 Horario actualizado',
              mensaje: 'Tu horario semanal fue modificado. Revisa tu disponibilidad.',
              tipo: 'info',
              categoria: event,
              link: agendaLink(p.barberoId),
            },
            profile?.email
              ? { to: profile.email, template: 'horario_actualizado', data: {} }
              : undefined
          )
        }
        break
      }

      case 'asistencia': {
        await notifyRole(db, 'admin', {
          titulo: p.motivo || '⏰ Asistencia',
          mensaje: p.clienteNombre || 'Evento de personal',
          tipo: (p.motivo as string)?.includes('retraso') ? 'warning' : 'info',
          categoria: event,
          link: '/admin/asistencia',
        })
        break
      }

      case 'recordatorio': {
        if (p.barberoId) {
          await notifyUser(db, p.barberoId, event, {
            titulo: '⏰ Recordatorio de cita',
            mensaje: `${p.clienteNombre} · mañana ${p.hora}`,
            tipo: 'info',
            categoria: event,
            link: agendaLink(p.barberoId),
            metadata: { cita_id: p.citaId },
          })
        }
        if (p.clienteEmail) {
          await sendNotificationEmail(p.clienteEmail, 'recordatorio_cita', {
            nombre: p.clienteNombre,
            servicio: p.servicioNombre,
            fecha: p.fecha,
            hora: p.hora,
            barbero: p.barberoNombre,
          })
        }
        break
      }

      case 'sistema': {
        await notifyRole(db, 'admin', {
          titulo: '⚠️ Alerta del sistema',
          mensaje: p.motivo || 'Revisa el panel de administración',
          tipo: 'warning',
          categoria: event,
          link: p.link || '/admin',
        })
        await sendAdminEmail('alerta_sistema', { motivo: p.motivo })
        break
      }

      default:
        errors.push(`Evento desconocido: ${event}`)
    }

    return { success: errors.length === 0, errors }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error en dispatch'
    console.error('[notifications]', msg)
    return { success: false, errors: [msg] }
  }
}

/** Carga datos de cita y dispara cancelación */
export async function dispatchCitaCancelada(
  db: SupabaseClient,
  citaId: string,
  motivo?: string
): Promise<void> {
  const { data: cita } = await db
    .from('citas')
    .select('id, barbero_id, fecha_hora, clientes(nombre, email), servicios(nombre)')
    .eq('id', citaId)
    .single()

  if (!cita) return

  const { data: barberoProfile } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', cita.barbero_id)
    .maybeSingle()

  const fh = new Date(cita.fecha_hora)
  const cliente = cita.clientes as { nombre?: string; email?: string } | null
  const servicio = cita.servicios as { nombre?: string } | null
  const barbero = barberoProfile

  await dispatchNotification(db, {
    event: 'reserva_cancelada',
    payload: {
      citaId,
      barberoId: cita.barbero_id,
      clienteNombre: cliente?.nombre,
      clienteEmail: cliente?.email ?? undefined,
      barberoNombre: barbero?.full_name,
      barberoEmail: barbero?.email,
      servicioNombre: servicio?.nombre,
      fecha: fh.toLocaleDateString('es-BO'),
      hora: fh.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
      motivo,
    },
  })
}

export async function dispatchCitaReprogramada(
  db: SupabaseClient,
  citaId: string,
  fechaHoraAnterior: string,
  fechaHoraNueva: string
): Promise<void> {
  const { data: cita } = await db
    .from('citas')
    .select('id, barbero_id, clientes(nombre, email), servicios(nombre)')
    .eq('id', citaId)
    .single()

  if (!cita) return

  const { data: barberoProfile } = await db
    .from('profiles')
    .select('full_name')
    .eq('id', cita.barbero_id)
    .maybeSingle()

  const prev = new Date(fechaHoraAnterior)
  const next = new Date(fechaHoraNueva)
  const cliente = cita.clientes as { nombre?: string; email?: string } | null
  const servicio = cita.servicios as { nombre?: string } | null
  const barbero = barberoProfile

  await dispatchNotification(db, {
    event: 'reserva_reprogramada',
    payload: {
      citaId,
      barberoId: cita.barbero_id,
      clienteNombre: cliente?.nombre,
      clienteEmail: cliente?.email ?? undefined,
      barberoNombre: barbero?.full_name,
      servicioNombre: servicio?.nombre,
      fecha: next.toLocaleDateString('es-BO'),
      hora: next.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
      fechaAnterior: prev.toLocaleDateString('es-BO'),
      horaAnterior: prev.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
    },
  })
}
