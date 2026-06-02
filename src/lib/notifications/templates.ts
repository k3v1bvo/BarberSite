const BRAND = 'Barber Pro'
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

function layout(content: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>${BRAND}</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Segoe UI',system-ui,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:24px 28px;">
            <p style="margin:0;font-size:22px;font-weight:900;color:#000;letter-spacing:-0.02em;">✂️ ${BRAND}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:#e4e4e7;font-size:15px;line-height:1.6;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px;border-top:1px solid #27272a;background:#0a0a0a;">
            <p style="margin:0;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.15em;">
              ${BRAND} · Notificación automática
            </p>
            <p style="margin:8px 0 0;font-size:12px;">
              <a href="${SITE}" style="color:#f59e0b;text-decoration:none;">Ir al sistema</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function detailBox(rows: { label: string; value: string }[]): string {
  const items = rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 0;color:#a1a1aa;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">${r.label}</td></tr>
         <tr><td style="padding:0 0 12px;color:#fff;font-size:15px;font-weight:600;">${r.value}</td></tr>`
    )
    .join('')
  return `<table width="100%" style="background:#27272a;border-radius:12px;padding:16px 20px;margin:20px 0;">${items}</table>`
}

function cta(href: string, label: string): string {
  return `<p style="margin:24px 0 0;">
    <a href="${href}" style="display:inline-block;background:#f59e0b;color:#000;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;">${label}</a>
  </p>`
}

export interface EmailTemplateInput {
  nombre?: string
  servicio?: string
  fecha?: string
  hora?: string
  barbero?: string
  cliente?: string
  monto?: string
  motivo?: string
  fechaAnterior?: string
  horaAnterior?: string
  pedidoId?: string
}

export function buildEmail(
  kind: string,
  data: EmailTemplateInput
): { subject: string; html: string } {
  const nombre = data.nombre || data.cliente || 'Cliente'

  switch (kind) {
    case 'reserva_confirmacion_cliente':
      return {
        subject: '✂️ Tu cita está confirmada',
        html: layout(
          `<h2 style="margin:0 0 8px;color:#fff;font-size:20px;">¡Hola ${nombre}!</h2>
          <p>Tu reserva quedó registrada correctamente.</p>
          ${detailBox([
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
            { label: 'Barbero', value: data.barbero || '—' },
          ])}
          <p>Te esperamos puntual. Si necesitas cambiar algo, contáctanos con anticipación.</p>
          ${cta(`${SITE}/cliente`, 'Ver mis citas')}`,
          'Tu cita en Barber Pro está confirmada'
        ),
      }

    case 'reserva_nueva_barbero':
      return {
        subject: `📅 Nueva cita: ${nombre}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#fff;font-size:20px;">Nueva reserva en tu agenda</h2>
          <p><strong>${nombre}</strong> agendó un servicio contigo.</p>
          ${detailBox([
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
          ])}
          ${cta(`${SITE}/agenda`, 'Abrir mi agenda')}`,
          'Tienes una nueva cita agendada'
        ),
      }

    case 'reserva_cancelada':
      return {
        subject: '❌ Cita cancelada',
        html: layout(
          `<h2 style="margin:0 0 8px;color:#fff;font-size:20px;">Reserva cancelada</h2>
          <p>La siguiente cita fue cancelada${data.motivo ? `: <em>${data.motivo}</em>` : ''}.</p>
          ${detailBox([
            { label: 'Cliente', value: nombre },
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
          ])}`,
          'Una cita fue cancelada'
        ),
      }

    case 'reserva_reprogramada':
      return {
        subject: '🔄 Cita reprogramada',
        html: layout(
          `<h2 style="margin:0 0 8px;color:#fff;font-size:20px;">Cambio de horario</h2>
          <p>Tu cita fue reprogramada.</p>
          ${detailBox([
            { label: 'Antes', value: `${data.fechaAnterior || '—'} ${data.horaAnterior || ''}`.trim() },
            { label: 'Nuevo', value: `${data.fecha || '—'} ${data.hora || ''}`.trim() },
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Barbero', value: data.barbero || '—' },
          ])}
          ${cta(`${SITE}/cliente`, 'Ver mis citas')}`,
          'Tu cita cambió de fecha u hora'
        ),
      }

    case 'recordatorio_cita':
      return {
        subject: '⏰ Recordatorio: tu cita es mañana',
        html: layout(
          `<h2 style="margin:0 0 8px;color:#fff;font-size:20px;">Te recordamos tu cita</h2>
          <p>Hola ${nombre}, mañana tienes servicio programado.</p>
          ${detailBox([
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
            { label: 'Barbero', value: data.barbero || '—' },
          ])}
          <p style="color:#a1a1aa;font-size:13px;">Si no puedes asistir, avísanos para liberar el horario.</p>`,
          'Recordatorio de cita mañana'
        ),
      }

    case 'venta_admin':
      return {
        subject: `🛍️ Nuevo pedido — ${nombre}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#fff;font-size:20px;">Nuevo pedido en tienda</h2>
          <p>Se registró un pedido que requiere gestión.</p>
          ${detailBox([
            { label: 'Cliente', value: nombre },
            { label: 'Total', value: data.monto || '—' },
          ])}
          ${cta(`${SITE}/admin/pedidos`, 'Gestionar pedidos')}`,
          'Nuevo pedido en la tienda'
        ),
      }

    case 'venta_cliente':
      return {
        subject: '✅ Pedido recibido',
        html: layout(
          `<h2 style="margin:0 0 8px;color:#fff;font-size:20px;">¡Gracias, ${nombre}!</h2>
          <p>Recibimos tu pedido y lo estamos procesando.</p>
          ${detailBox([{ label: 'Total', value: data.monto || '—' }])}
          <p>Te contactaremos si hace falta coordinar entrega.</p>`,
          'Tu pedido fue recibido'
        ),
      }

    case 'alerta_sistema':
      return {
        subject: `⚠️ ${data.motivo || 'Alerta del sistema'}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">Alerta importante</h2>
          <p style="color:#e4e4e7;">${data.motivo || 'Revisa el panel de administración.'}</p>
          ${cta(`${SITE}/admin`, 'Ir al panel')}`,
          'Alerta Barber Pro'
        ),
      }

    case 'horario_actualizado':
      return {
        subject: '📋 Horario laboral actualizado',
        html: layout(
          `<h2 style="margin:0 0 8px;color:#fff;font-size:20px;">Cambio en tu horario</h2>
          <p>Tu horario semanal fue actualizado por administración. Revisa tu agenda para ver disponibilidad.</p>
          ${cta(`${SITE}/agenda`, 'Ver agenda')}`,
          'Tu horario fue modificado'
        ),
      }

    default:
      return {
        subject: `Notificación — ${BRAND}`,
        html: layout(`<p>${data.motivo || 'Tienes una nueva notificación en el sistema.'}</p>`, 'Nueva notificación'),
      }
  }
}
