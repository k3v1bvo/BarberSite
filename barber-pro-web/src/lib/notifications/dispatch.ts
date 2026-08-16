import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DispatchInput,
  InAppNotificationInsert,
  NotificationCategory,
  NotificationPayload,
} from './types'
import { sendAdminEmail, sendNotificationEmail } from './email'
import { getUserPreferences, shouldSendEmail, shouldSendPush } from './preferences'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

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
    const res = await sendNotificationEmail(email.to, email.template, email.data)
    if (!res.ok) console.error('[notifyUser] Error email:', res.error)
  }
}

async function notifyRole(
  db: SupabaseClient,
  rol: string,
  inApp: InAppNotificationInsert,
  emailConfig?: { template: string; data: Record<string, string | undefined> }
): Promise<void> {
  await insertNotifications(db, [{ ...inApp, rol_destino: rol }])
  
  if (emailConfig) {
    const emailsToSend = new Set<string>()

    const { data: users } = await db.from('profiles').select('id, email').eq('role', rol).eq('is_active', true)
    if (users && users.length > 0) {
      for (const u of users) {
        if (u.email) emailsToSend.add(u.email.toLowerCase().trim())
      }
    }

    // Si el rol es admin, asegurar envio al correo maestro de administracion
    if (rol === 'admin') {
      const masterAdminEmail = (process.env.SMTP_USER || 'barbersiteadmin@gmail.com').toLowerCase().trim()
      if (masterAdminEmail) emailsToSend.add(masterAdminEmail)
    }

    for (const targetEmail of Array.from(emailsToSend)) {
      const res = await sendNotificationEmail(targetEmail, emailConfig.template, emailConfig.data)
      if (!res.ok) {
        console.error(`[notifyRole ${rol}] Error enviando correo a ${targetEmail}:`, res.error)
      } else {
        console.log(`[notifyRole ${rol}] Correo enviado exitosamente a ${targetEmail}`)
      }
    }
  }
}

function agendaLink(barberoId?: string): string {
  if (barberoId) return `/agenda/${barberoId}`
  return `/agenda`
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
        const metodoPagoLabel = p.metodoPago || (p.monto != null ? `Pago en el local (Bs ${Number(p.monto).toFixed(2)})` : 'Pago en el local')
        const msg = `${p.clienteNombre || 'Cliente'} — ${p.servicioNombre || 'Servicio'} · ${p.fecha} ${p.hora} (${metodoPagoLabel})`
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
                    metodoPago: metodoPagoLabel,
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
          link: '/agenda' + (p.citaId ? `?cita_id=${p.citaId}` : ''),
          metadata: meta,
        })

        await notifyRole(db, 'coordinador', {
          titulo: '📅 Nueva reserva',
          mensaje: msg,
          tipo: 'info',
          categoria: event,
          link: '/agenda' + (p.citaId ? `?cita_id=${p.citaId}` : ''),
          metadata: meta,
        })

        if (p.clienteEmail) {
          await sendNotificationEmail(p.clienteEmail, 'reserva_confirmacion_cliente', {
            nombre: p.clienteNombre,
            servicio: p.servicioNombre,
            fecha: p.fecha,
            hora: p.hora,
            barbero: p.barberoNombre,
            metodoPago: metodoPagoLabel,
          })
        }

        await sendAdminEmail('reserva_nueva_admin', {
          nombre: p.clienteNombre,
          servicio: p.servicioNombre,
          fecha: p.fecha,
          hora: p.hora,
          barbero: p.barberoNombre,
          metodoPago: metodoPagoLabel,
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

        if (p.clienteId) {
          await notifyUser(
            db,
            p.clienteId,
            event,
            {
              titulo: '⭐ ¿Cómo te fue?',
              mensaje: `Tu cita ha finalizado. Por favor déjanos tu reseña.`,
              tipo: 'info',
              categoria: event,
              link: '/cliente',
              metadata: { cita_id: p.citaId },
            },
            p.clienteEmail
              ? {
                  to: p.clienteEmail,
                  template: 'solicitud_resena',
                  data: {
                    nombre: p.clienteNombre,
                    barbero: p.barberoNombre,
                    link: `${SITE}/cliente`,
                  },
                }
              : undefined
          )
        }
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
        await notifyRole(db, 'coordinador', {
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
            mensaje: `${p.clienteNombre} · en breve a las ${p.hora}`,
            tipo: 'info',
            categoria: event,
            link: agendaLink(p.barberoId),
            metadata: { cita_id: p.citaId },
          })
        }
        if (p.clienteId) {
          await notifyUser(db, p.clienteId as string, event, {
            titulo: '⏰ Recordatorio de cita',
            mensaje: `En breve tienes cita a las ${p.hora} con ${p.barberoNombre || 'tu barbero'}`,
            tipo: 'info',
            categoria: event,
            link: '/cliente',
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

      case 'pago_pendiente': {
        const anticipo = p.monto != null ? `Bs ${Number(p.monto).toFixed(2)}` : '—'
        const msg = `💰 ${p.clienteNombre || 'Cliente'} pagó anticipo QR (${anticipo}) — ${p.servicioNombre || 'Servicio'} · ${p.fecha} ${p.hora}`
        const meta = { cita_id: p.citaId, barbero_id: p.barberoId }

        // Notificar al barbero asignado
        if (p.barberoId) {
          await notifyUser(
            db,
            p.barberoId,
            event,
            {
              titulo: '💰 Pago QR por verificar',
              mensaje: msg,
              tipo: 'warning',
              categoria: event,
              link: '/barbero' + (p.citaId ? `?cita_id=${p.citaId}` : ''),
              metadata: meta,
            },
            p.barberoEmail
              ? {
                  to: p.barberoEmail,
                  template: 'pago_pendiente_equipo',
                  data: {
                    nombre: p.clienteNombre,
                    servicio: p.servicioNombre,
                    anticipo,
                    fecha: p.fecha,
                    hora: p.hora,
                    comprobante_url: typeof p.comprobante_url === 'string' ? p.comprobante_url : undefined,
                  },
                }
              : undefined
          )
        }

        // Notificar al admin
        await notifyRole(
          db, 
          'admin', 
          {
            titulo: '💰 Anticipo QR pendiente',
            mensaje: msg + (p.barberoNombre ? ` · Barbero: ${p.barberoNombre}` : ''),
            tipo: 'warning',
            categoria: event,
            link: '/agenda' + (p.citaId ? `?cita_id=${p.citaId}` : ''),
            metadata: meta,
          },
          {
            template: 'pago_pendiente_equipo',
            data: {
              nombre: p.clienteNombre,
              servicio: p.servicioNombre,
              anticipo,
              fecha: p.fecha,
              hora: p.hora,
              comprobante_url: typeof p.comprobante_url === 'string' ? p.comprobante_url : undefined,
            }
          }
        )

        // Notificar al coordinador
        await notifyRole(
          db, 
          'coordinador', 
          {
            titulo: '💰 Anticipo QR pendiente',
            mensaje: msg,
            tipo: 'warning',
            categoria: event,
            link: '/agenda' + (p.citaId ? `?cita_id=${p.citaId}` : ''),
            metadata: meta,
          },
          {
            template: 'pago_pendiente_equipo',
            data: {
              nombre: p.clienteNombre,
              servicio: p.servicioNombre,
              anticipo,
              fecha: p.fecha,
              hora: p.hora,
              comprobante_url: typeof p.comprobante_url === 'string' ? p.comprobante_url : undefined,
            }
          }
        )

        // Email al cliente indicando que su QR está pendiente
        if (p.clienteEmail) {
          const emailRes = await sendNotificationEmail(p.clienteEmail, 'pago_pendiente_cliente', {
            nombre: p.clienteNombre,
            servicio: p.servicioNombre,
            anticipo,
            fecha: p.fecha,
            hora: p.hora,
            barbero: p.barberoNombre,
            comprobante_url: typeof p.comprobante_url === 'string' ? p.comprobante_url : undefined,
          })
          if (!emailRes.ok) {
            console.error('[dispatch] Error enviando email pago_pendiente_cliente a', p.clienteEmail, emailRes.error)
          }
        }
        break
      }

      case 'pago_verificado': {
        const anticipo = p.monto != null ? `Bs ${Number(p.monto).toFixed(2)}` : '—'
        const verificador = p.motivo || 'Equipo'
        const msg = `✅ Pago verificado por ${verificador} — ${p.clienteNombre || 'Cliente'} · ${anticipo}`
        const meta = { cita_id: p.citaId }

        // Notificar al admin (in-app y email a todos los admins)
        await notifyRole(
          db, 
          'admin', 
          {
            titulo: '✅ Reserva confirmada + pago verificado',
            mensaje: msg,
            tipo: 'success',
            categoria: event,
            link: '/agenda' + (p.citaId ? `?cita_id=${p.citaId}` : ''),
            metadata: meta,
          },
          {
            template: 'pago_verificado_admin',
            data: {
              nombre: p.clienteNombre,
              servicio: p.servicioNombre,
              anticipo,
              fecha: p.fecha,
              hora: p.hora,
              barbero: p.barberoNombre,
              verificadoPor: verificador,
              comprobante_url: typeof p.comprobante_url === 'string' ? p.comprobante_url : undefined,
            }
          }
        )

        // Notificar al coordinador
        await notifyRole(
          db, 
          'coordinador', 
          {
            titulo: '✅ Reserva confirmada + pago verificado',
            mensaje: msg,
            tipo: 'success',
            categoria: event,
            link: '/agenda' + (p.citaId ? `?cita_id=${p.citaId}` : ''),
            metadata: meta,
          },
          {
            template: 'pago_verificado_admin', // Reusamos la misma plantilla del admin
            data: {
              nombre: p.clienteNombre,
              servicio: p.servicioNombre,
              anticipo,
              fecha: p.fecha,
              hora: p.hora,
              barbero: p.barberoNombre,
              verificadoPor: verificador,
              comprobante_url: typeof p.comprobante_url === 'string' ? p.comprobante_url : undefined,
            }
          }
        )

        // Notificar al barbero (si no fue él quien verificó)
        if (p.barberoId) {
          await notifyUser(db, p.barberoId, event, {
            titulo: '✅ Pago verificado',
            mensaje: `Cita confirmada con ${p.clienteNombre} — ${anticipo} anticipo verificado`,
            tipo: 'success',
            categoria: event,
            link: '/barbero' + (p.citaId ? `?cita_id=${p.citaId}` : ''),
            metadata: meta,
          })
        }

        // Notificación in-app al cliente
        if (p.clienteId) {
          await notifyUser(db, p.clienteId as string, event, {
            titulo: '✅ ¡Reserva Aceptada!',
            mensaje: `Tu comprobante fue verificado. Te esperamos el ${p.fecha} a las ${p.hora} con ${p.barberoNombre || 'tu barbero'}`,
            tipo: 'success',
            categoria: event,
            link: '/cliente',
            metadata: meta,
          })
        }

        // Email al cliente
        if (p.clienteEmail) {
          const emailRes = await sendNotificationEmail(p.clienteEmail, 'pago_verificado_cliente', {
            nombre: p.clienteNombre,
            servicio: p.servicioNombre,
            anticipo,
            fecha: p.fecha,
            hora: p.hora,
            barbero: p.barberoNombre,
            comprobante_url: typeof p.comprobante_url === 'string' ? p.comprobante_url : undefined,
          })
          if (!emailRes.ok) {
            console.error('[dispatch] Error enviando email pago_verificado_cliente a', p.clienteEmail, emailRes.error)
          }
        }
        break
      }

      case 'pago_rechazado': {
        const anticipo = p.monto != null ? `Bs ${Number(p.monto).toFixed(2)}` : '—'
        const rechazadoPor = p.motivo || 'Equipo'
        const msg = `🚫 Comprobante RECHAZADO por ${rechazadoPor} — ${p.clienteNombre || 'Cliente'} · ${anticipo}`
        const meta = { cita_id: p.citaId }

        // Notificar al admin (in-app y email)
        await notifyRole(
          db,
          'admin',
          {
            titulo: '🚫 Comprobante rechazado como falso',
            mensaje: msg,
            tipo: 'danger',
            categoria: event,
            link: '/agenda' + (p.citaId ? `?cita_id=${p.citaId}` : ''),
            metadata: meta,
          },
          {
            template: 'pago_rechazado_admin',
            data: {
              nombre: p.clienteNombre,
              servicio: p.servicioNombre,
              anticipo,
              fecha: p.fecha,
              hora: p.hora,
              barbero: p.barberoNombre,
              verificadoPor: rechazadoPor,
              comprobante_url: typeof p.comprobante_url === 'string' ? p.comprobante_url : undefined,
            }
          }
        )

        // Notificar al coordinador (in-app y email)
        await notifyRole(
          db,
          'coordinador',
          {
            titulo: '🚫 Comprobante rechazado como falso',
            mensaje: msg,
            tipo: 'danger',
            categoria: event,
            link: '/agenda' + (p.citaId ? `?cita_id=${p.citaId}` : ''),
            metadata: meta,
          },
          {
            template: 'pago_rechazado_admin',
            data: {
              nombre: p.clienteNombre,
              servicio: p.servicioNombre,
              anticipo,
              fecha: p.fecha,
              hora: p.hora,
              barbero: p.barberoNombre,
              verificadoPor: rechazadoPor,
              comprobante_url: typeof p.comprobante_url === 'string' ? p.comprobante_url : undefined,
            }
          }
        )

        // Notificar al barbero asignado (in-app)
        if (p.barberoId) {
          await notifyUser(db, p.barberoId, event, {
            titulo: '🚫 Comprobante rechazado',
            mensaje: `El comprobante de ${p.clienteNombre} fue rechazado como falso — cita cancelada`,
            tipo: 'danger',
            categoria: event,
            link: '/barbero' + (p.citaId ? `?cita_id=${p.citaId}` : ''),
            metadata: meta,
          })
        }

        // Notificación in-app al cliente
        if (p.clienteId) {
          await notifyUser(db, p.clienteId as string, event, {
            titulo: '❌ Comprobante No Válido',
            mensaje: `Tu comprobante de pago no pudo ser verificado. Tu reserva fue cancelada. Si crees que es un error, contáctanos.`,
            tipo: 'danger',
            categoria: event,
            link: '/cliente',
            metadata: meta,
          })
        }

        // Email al cliente
        if (p.clienteEmail) {
          const emailRes = await sendNotificationEmail(p.clienteEmail, 'pago_rechazado_cliente', {
            nombre: p.clienteNombre,
            servicio: p.servicioNombre,
            anticipo,
            fecha: p.fecha,
            hora: p.hora,
            barbero: p.barberoNombre,
            comprobante_url: typeof p.comprobante_url === 'string' ? p.comprobante_url : undefined,
          })
          if (!emailRes.ok) {
            console.error('[dispatch] Error enviando email pago_rechazado_cliente a', p.clienteEmail, emailRes.error)
          }
        }
        break
      }
      case 'invitacion_2x1': {
        if (p.acompananteEmail) {
          await sendNotificationEmail(p.acompananteEmail, 'invitacion_2x1', {
            nombre: p.acompananteNombre,
            clienteNombre: p.clienteNombre,
            fecha: p.fecha,
            hora: p.hora,
          })
        }
        break
      }
      case 'invitacion_referido': {
        if (input.userEmail) {
          await sendNotificationEmail(input.userEmail, 'invitacion_referido', {
            clienteNombre: p.clienteNombre,
            acompananteNombre: p.acompananteNombre, // Recomendante
            monto: p.montoBono
          })
        }
        break
      }
      case 'invitacion_cliente': {
        if (input.userEmail) {
          await sendNotificationEmail(input.userEmail, 'invitacion_cliente', {
            nombre: String(p.clienteNombre || p.nombre || 'Cliente')
          })
        }
        break
      }

      case 'reprogramacion_solicitada': {
        const msg = `Cliente solicita reprogramar a: ${p.nuevaFecha} ${p.nuevaHora}`
        if (p.barberoId) {
          await notifyUser(db, p.barberoId, event, {
            titulo: '🔄 Solicitud de Reprogramación',
            mensaje: msg,
            tipo: 'warning',
            categoria: event,
            link: agendaLink(p.barberoId),
            metadata: { cita_id: p.citaId },
          })
        }
        await notifyRole(db, 'admin', {
          titulo: '🔄 Solicitud de Reprogramación',
          mensaje: msg,
          tipo: 'info',
          categoria: event,
          link: '/agenda',
        })
        break
      }

      case 'reprogramacion_aceptada': {
        const msg = `Tu solicitud para el ${p.nuevaFecha} fue ACEPTADA.`
        if (p.clienteId) {
          await notifyUser(db, p.clienteId as string, event, {
            titulo: '✅ Reprogramación Aceptada',
            mensaje: msg,
            tipo: 'success',
            categoria: event,
            link: '/cliente',
            metadata: { cita_id: p.citaId },
          })
        }
        // Send basic email if needed (can be implemented later)
        break
      }

      case 'reprogramacion_rechazada': {
        const msg = `Tu solicitud para el ${p.nuevaFecha} fue RECHAZADA. Se mantiene horario original: ${p.fechaOriginal}.`
        if (p.clienteId) {
          await notifyUser(db, p.clienteId as string, event, {
            titulo: '❌ Reprogramación Rechazada',
            mensaje: msg,
            tipo: 'danger',
            categoria: event,
            link: '/cliente',
            metadata: { cita_id: p.citaId },
          })
        }
        break
      }

      case 'bienvenida_nuevo_usuario': {
        if (input.userEmail) {
          await sendNotificationEmail(input.userEmail, 'bienvenida_nuevo_usuario', {
            nombre: p.nombre as string,
            email: p.email as string,
            password: p.password as string,
          })
        }

        const emailStaffAlert = {
          template: 'alerta_sistema',
          data: {
            motivo: `👤 Nuevo cliente registrado en la plataforma: ${p.nombre || 'Cliente'} (${p.email}). Ya puede agendar citas en línea.`,
            link: `${SITE}/admin/clientes`
          }
        }

        // Notificar al Admin y Coordinador por Sistema WEB y por EMAIL (Gmail SMTP)
        await notifyRole(db, 'admin', {
          titulo: `👤 Nuevo Usuario Registrado: ${(p.nombre as string) || 'Cliente'}`,
          mensaje: `Se ha registrado la cuenta de ${p.nombre || 'un nuevo cliente'} (${p.email}).`,
          tipo: 'success',
          categoria: 'sistema',
          link: '/admin/clientes',
        }, emailStaffAlert)

        await notifyRole(db, 'coordinador', {
          titulo: `👤 Nuevo Usuario Registrado: ${(p.nombre as string) || 'Cliente'}`,
          mensaje: `Se ha registrado la cuenta de ${p.nombre || 'un nuevo cliente'} (${p.email}).`,
          tipo: 'success',
          categoria: 'sistema',
          link: '/coordinador',
        }, emailStaffAlert)
        break
      }

      case 'cambio_rol': {
        if (p.usuarioId) {
          await notifyUser(db, p.usuarioId as string, 'sistema', {
            titulo: '👑 Cambio de Rol',
            mensaje: `Tu rol en el sistema se actualizó a: ${String(p.nuevoRol || '').toUpperCase()}`,
            tipo: 'info',
            categoria: 'sistema',
            link: '/perfil',
          })
        }
        if (input.userEmail) {
          await sendNotificationEmail(input.userEmail, 'cambio_rol', {
            nombre: (p.nombre as string) || 'Usuario',
            nuevoRol: String(p.nuevoRol || 'USUARIO'),
          })
        }
        break
      }

      case 'cumpleanos': {
        const msgAdmin = `Se verificó exitosamente el carnet/documento de ${p.clienteNombre} y se le habilitó su beneficio de cumpleaños.`
        
        await notifyRole(db, 'admin', {
          titulo: `🎂 ¡Cumpleañero Registrado y Verificado! (${p.clienteNombre})`,
          mensaje: msgAdmin,
          tipo: 'info',
          categoria: 'sistema',
          link: '/coordinador/cumpleanos',
          metadata: { cliente_id: p.clienteId }
        })

        await notifyRole(db, 'coordinador', {
          titulo: `🎂 ¡Cumpleañero Registrado y Verificado! (${p.clienteNombre})`,
          mensaje: msgAdmin,
          tipo: 'info',
          categoria: 'sistema',
          link: '/coordinador/cumpleanos',
          metadata: { cliente_id: p.clienteId }
        })

        if (p.clienteId) {
          await notifyUser(db, p.clienteId as string, 'sistema', {
            titulo: `🎉 ¡Feliz Cumpleaños ${p.clienteNombre}! 🎂`,
            mensaje: `¡Te deseamos un muy feliz cumpleaños de parte de todo el equipo de Barber Pro! Tu documento y fecha han sido verificados en el sistema. Ven en tu semana de cumpleaños a disfrutar tu regalo o descuento especial. ¡Te esperamos!`,
            tipo: 'info',
            categoria: 'sistema',
            link: '/reservar',
          })
        }

        if (input.userEmail) {
          await sendNotificationEmail(input.userEmail, 'cumpleanos', {
            nombre: (p.clienteNombre as string) || 'Cliente'
          })
        }
        break
      }

      case 'cumpleanos_registro': {
        if (p.clienteId) {
          await notifyUser(db, p.clienteId as string, 'sistema', {
            titulo: `🎂 Fecha de Cumpleaños Registrada`,
            mensaje: `¡Hola ${p.clienteNombre || 'Cliente'}! Guardamos tu fecha de cumpleaños (${p.fecha || ''}). Una semana antes de tu día especial te notificaremos con tu regalo y beneficio exclusivo.`,
            tipo: 'info',
            categoria: 'cumpleanos_registro',
            link: '/perfil',
          })
        }
        if (input.userEmail) {
          await sendNotificationEmail(input.userEmail, 'cumpleanos_registro', {
            nombre: (p.clienteNombre as string) || 'Cliente',
            fecha: p.fecha || undefined,
          })
        }
        break
      }

      case 'cumpleanos_semana_antes': {
        if (p.clienteId) {
          await notifyUser(db, p.clienteId as string, 'sistema', {
            titulo: `🎂 ¡Falta 1 Semana para tu Cumpleaños! 🎉`,
            mensaje: `¡Hola ${p.clienteNombre || 'Cliente'}! Se acerca tu cumpleaños. Ven esta semana a la barbería y disfruta tu regalo y descuento especial.`,
            tipo: 'info',
            categoria: 'cumpleanos_semana_antes',
            link: '/reservar',
          })
        }
        if (input.userEmail) {
          await sendNotificationEmail(input.userEmail, 'cumpleanos_semana_antes', {
            nombre: (p.clienteNombre as string) || 'Cliente',
            fecha: p.fecha || undefined,
          })
        }
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
  const clienteRaw = Array.isArray(cita.clientes) ? cita.clientes[0] : cita.clientes
  const servicioRaw = Array.isArray(cita.servicios) ? cita.servicios[0] : cita.servicios
  const cliente = clienteRaw as { nombre?: string; email?: string } | null
  const servicio = servicioRaw as { nombre?: string } | null
  const barbero = barberoProfile

  await dispatchNotification(db, {
    event: 'reserva_reprogramada',
    payload: {
      citaId,
      barberoId: cita.barbero_id,
      clienteNombre: cliente?.nombre || 'Cliente',
      clienteEmail: cliente?.email ?? undefined,
      barberoNombre: barbero?.full_name || 'Tu barbero',
      servicioNombre: servicio?.nombre || 'Cita de barbería',
      fecha: next.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }),
      hora: next.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hour12: false }),
      fechaAnterior: prev.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }),
      horaAnterior: prev.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hour12: false }),
    },
  })
}

