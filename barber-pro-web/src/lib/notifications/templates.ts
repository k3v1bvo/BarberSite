export let BRAND = 'BarberSite'
export let LOGO_URL = ''

let activeTemplateData: any = null

export function setBrandIdentity(nombre: string, logoUrl: string = '') {
  if (nombre) BRAND = nombre
  LOGO_URL = logoUrl
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

function layout(content: string, preheader: string, customBrand?: string, customLogo?: string): string {
  const brandName = customBrand || activeTemplateData?._brandName || BRAND
  const logoUrl = customLogo !== undefined ? customLogo : (activeTemplateData?._brandLogo !== undefined ? activeTemplateData._brandLogo : LOGO_URL)

  const headerContent = logoUrl
    ? `<table border="0" cellpadding="0" cellspacing="0">
         <tr>
           <td style="padding-right:12px;vertical-align:middle;">
             <img src="${logoUrl}" alt="${brandName}" style="max-height:45px;max-width:160px;display:block;" />
           </td>
           <td style="vertical-align:middle;">
             <span style="font-size:22px;font-weight:900;color:#000;letter-spacing:-0.02em;">${brandName}</span>
           </td>
         </tr>
       </table>`
    : `<p style="margin:0;font-size:22px;font-weight:900;color:#000;letter-spacing:-0.02em;">✂️ ${brandName}</p>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>${brandName}</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Segoe UI',system-ui,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:24px 28px;">
            ${headerContent}
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
              ${brandName} · Notificación automática
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
        `<tr>
          <td style="padding:10px 14px;color:#a1a1aa;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid rgba(255,255,255,0.06);width:38%;">${r.label}</td>
          <td style="padding:10px 14px;color:#ffffff;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);">${r.value}</td>
        </tr>`
    )
    .join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#1e1e24;border:1px solid #2d2d35;border-radius:14px;overflow:hidden;margin:20px 0;">${items}</table>`
}

function cta(href: string, label: string): string {
  return `<p style="margin:26px 0 0;text-align:center;">
    <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#ea580c 100%);color:#000;font-weight:900;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;box-shadow:0 4px 15px rgba(245,158,11,0.3);">${label}</a>
  </p>`
}

export interface EmailTemplateInput {
  link?: string
  nombre?: string
  email?: string
  password?: string
  servicio?: string
  fecha?: string
  hora?: string
  barbero?: string
  cliente?: string
  clienteNombre?: string
  acompananteNombre?: string
  monto?: string
  motivo?: string
  fechaAnterior?: string
  horaAnterior?: string
  pedidoId?: string
  anticipo?: string
  verificadoPor?: string
  comprobante_url?: string | null
  // Resumen Diario Admin
  totalCitas?: string
  totalVentasProductos?: string
  ingresosServicios?: string
  ingresosProductos?: string
  ingresoTotal?: string
  nuevoRol?: string
  [key: string]: any
}

export function replaceTemplateVariables(text: string, data: EmailTemplateInput): string {
  if (!text) return ''

  const varsMap: Record<string, string> = {
    nombre: data.nombre || data.cliente || data.clienteNombre || 'Cliente',
    cliente: data.cliente || data.nombre || 'Cliente',
    email: data.email || '',
    servicio: data.servicio || 'Servicio de Barbería',
    fecha: data.fecha || '',
    hora: data.hora || '',
    barbero: data.barbero || 'Tu barbero',
    monto: data.monto ? (String(data.monto).startsWith('Bs') ? String(data.monto) : `Bs. ${data.monto}`) : '',
    codigo: data.codigo || data.pedidoId || '',
    motivo: data.motivo || '',
    barberia: BRAND,
    link: data.link || SITE,
    acompananteNombre: data.acompananteNombre || 'Acompañante',
    clienteNombre: data.clienteNombre || data.nombre || 'Cliente',
  }

  let result = text
  for (const [key, val] of Object.entries(varsMap)) {
    const regexDouble = new RegExp(`{{\\s*${key}\\s*}}`, 'gi')
    const regexSingle = new RegExp(`{\\s*${key}\\s*}`, 'gi')
    result = result.replace(regexDouble, val).replace(regexSingle, val)
  }

  return result
}

export function buildEmail(
  kind: string,
  data: EmailTemplateInput
): { subject: string; html: string } {
  activeTemplateData = data
  const nombre = data.nombre || data.cliente || 'Cliente'

  const res = (() => {
    switch (kind) {
      case 'promocion_masiva':
        return {
          subject: data.asuntoCustom || `📣 ¡Novedades y Beneficios Especiales de ${BRAND}!`,
          html: layout(
            `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Hola {{nombre}}!</h2>
            <div style="margin:16px 0;line-height:1.6;font-size:15px;color:#e4e4e7;white-space:pre-line;">${data.mensajeCustom || 'Tenemos promociones y beneficios especiales esperándote en la barbería.'}</div>
            ${cta(data.link || `${SITE}/reservar`, 'Ver Promoción / Agendar Cita')}`,
            data.asuntoCustom || 'Promoción especial para ti'
          ),
        }

    case 'reserva_confirmacion_cliente':
      return {
        subject: `✂️ Tu cita en ${BRAND} está confirmada`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">¡Hola ${nombre}!</h2>
          <p style="color:#d4d4d8;margin:0 0 16px;">Tu reserva en <strong>${BRAND}</strong> ha quedado confirmada y programada en la agenda.</p>
          ${detailBox([
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: `${data.hora || '—'} hrs` },
            { label: 'Especialista', value: data.barbero || 'Barbero asignado' },
            { label: 'Modalidad de Pago', value: data.metodoPago || 'Pago en el local' },
          ])}
          <div style="margin:20px 0;padding:14px 16px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:12px;color:#fcd34d;font-size:13px;line-height:1.5;">
            📍 <strong>Instrucciones para tu visita:</strong> Preséntate 5 minutos antes de tu hora e indica tu nombre al barbero en recepción. Tu horario ya está reservado y garantizado.
          </div>
          <p style="color:#a1a1aa;font-size:13px;">Si necesitas reprogramar o cancelar, puedes hacerlo ingresando a tu cuenta con anticipación.</p>
          ${cta(`${SITE}/cliente`, 'Ver Mi Comprobante de Cita')}`,
          `Tu cita en ${BRAND} está confirmada`
        ),
      }

    case 'reserva_nueva_barbero':
      return {
        subject: `📅 Nueva cita en ${BRAND}: ${nombre}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:22px;font-weight:800;">Nueva reserva en tu agenda</h2>
          <p style="color:#d4d4d8;">Hola, el cliente <strong>${nombre}</strong> ha agendado una cita contigo.</p>
          ${detailBox([
            { label: 'Cliente', value: nombre },
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: `${data.hora || '—'} hrs` },
            { label: 'Modalidad de Pago', value: data.metodoPago || 'Pago en el local' },
          ])}
          <div style="margin:16px 0;padding:12px 16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;color:#6ee7b7;font-size:13px;">
            ✅ Este turno ha sido bloqueado en tu agenda para que te prepares adecuadamente.
          </div>
          ${cta(`${SITE}/agenda`, 'Abrir Mi Agenda')}`,
          `Tienes una nueva cita agendada en ${BRAND}`
        ),
      }

    case 'reserva_nueva_admin':
      return {
        subject: `🎉 ¡Nueva Reserva en ${BRAND}! — ${nombre}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:22px;font-weight:800;">Nueva Reserva Registrada</h2>
          <p style="color:#d4d4d8;">Se ha registrado una nueva reserva en el sistema de <strong>${BRAND}</strong>.</p>
          ${detailBox([
            { label: 'Cliente', value: nombre },
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: `${data.hora || '—'} hrs` },
            { label: 'Especialista', value: data.barbero || '—' },
            { label: 'Modalidad de Pago', value: data.metodoPago || 'Pago en el local' },
          ])}
          ${cta(`${SITE}/admin`, 'Ver Agenda General')}`,
          `Nueva reserva en ${BRAND}`
        ),
      }

    case 'solicitud_resena':
      return {
        subject: `⭐ ¿Cómo te fue hoy, ${nombre}?`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Esperamos que hayas disfrutado tu servicio!</h2>
          <p>Tu cita con <strong>${data.barbero || 'tu barbero'}</strong> acaba de finalizar. Nos encantaría saber qué tal te pareció.</p>
          <p>Tu opinión nos ayuda a seguir mejorando para darte el mejor estilo.</p>
          ${cta(data.link || `${SITE}/cliente`, 'Dejar una Reseña')}`,
          'Queremos saber tu opinión'
        ),
      }

    case 'invitacion_referido':
      return {
        subject: `🎁 ¡${data.acompananteNombre || 'Un amigo'} te ha recomendado ${BRAND}!`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:22px;font-weight:800;">¡Hola ${data.clienteNombre || 'Cliente'}!</h2>
          <p style="color:#d4d4d8;">Tu amigo <strong>${data.acompananteNombre || 'alguien especial'}</strong> nos contó sobre ti y te ha enviado una invitación exclusiva para visitarnos en <strong>${BRAND}</strong>.</p>
          <p style="color:#d4d4d8;">Ven y descubre el mejor estilo y atención profesional. Regístrate en nuestra plataforma para agendar tu primera cita y empezar a disfrutar de beneficios y puntos de fidelidad.</p>
          ${cta(`${SITE}/login`, 'Crear mi cuenta')}`,
          `Tienes una invitación especial en ${BRAND}`
        ),
      }

    case 'reserva_cancelada':
      return {
        subject: `❌ Cita cancelada en ${BRAND}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#ef4444;font-size:22px;font-weight:800;">Reserva Cancelada</h2>
          <p style="color:#d4d4d8;">La siguiente cita en <strong>${BRAND}</strong> fue cancelada${data.motivo ? `: <em>${data.motivo}</em>` : ''}.</p>
          ${detailBox([
            { label: 'Cliente', value: nombre },
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: `${data.hora || '—'} hrs` },
          ])}
          <p style="color:#a1a1aa;font-size:13px;">El horario ha quedado libre. Cuando gustes puedes agendar un nuevo turno en línea.</p>
          ${cta(`${SITE}/reservar`, 'Agendar Nueva Cita')}`,
          `Una cita fue cancelada en ${BRAND}`
        ),
      }

    case 'reserva_reprogramada':
      return {
        subject: `🔄 Cita reprogramada: ${data.servicio || 'Servicio'} · ${data.fecha} ${data.hora}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Hola ${nombre}!</h2>
          <p>Tu cita en <strong>${BRAND}</strong> ha sido reprogramada o actualizada exitosamente.</p>
          ${detailBox([
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Especialista / Barbero', value: data.barbero || '—' },
            { label: 'Horario Anterior', value: `${data.fechaAnterior || '—'} ${data.horaAnterior || ''}`.trim() },
            { label: 'Nuevo Horario Confirmado', value: `✨ ${data.fecha || '—'} a las ${data.hora || ''} hrs` },
          ])}
          <p style="color:#a1a1aa;font-size:13px;">Te esperamos en nuestro local. Recuerda estar 5 minutos antes.</p>
          ${cta(`${SITE}/cliente`, 'Ver Mis Citas')}`,
          'Tu cita ha sido actualizada con éxito'
        ),
      }

    case 'reserva_reprogramada_barbero':
      return {
        subject: `🔄 Cita modificada/reprogramada: ${nombre} (${data.fecha} ${data.hora})`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">Actualización en tu Agenda</h2>
          <p>La cita de tu cliente <strong>${nombre}</strong> ha sido reprogramada o reasignada a tu turno.</p>
          ${detailBox([
            { label: 'Cliente', value: nombre },
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Horario Anterior', value: `${data.fechaAnterior || '—'} ${data.horaAnterior || ''}`.trim() },
            { label: 'Nuevo Horario', value: `🗓️ ${data.fecha || '—'} a las ${data.hora || ''} hrs` },
          ])}
          ${cta(`${SITE}/agenda`, 'Abrir Mi Agenda')}`,
          'Una cita en tu agenda ha sido modificada'
        ),
      }

    case 'reserva_reasignada_barbero_anterior':
      return {
        subject: `ℹ️ Cita reasignada a otro barbero: ${nombre}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#fff;font-size:20px;">Cita Reasignada</h2>
          <p>La cita del cliente <strong>${nombre}</strong> (originalmente programada para ${data.fechaAnterior || ''} ${data.horaAnterior || ''}) ha sido transferida al especialista <strong>${data.nuevoBarbero || 'otro compañero'}</strong> por administración/coordinación.</p>
          <p style="color:#a1a1aa;font-size:13px;">Ese espacio en tu agenda ha quedado libre para nuevos clientes o reservas.</p>
          ${cta(`${SITE}/agenda`, 'Ver Mi Agenda')}`,
          'Una cita fue transferida a otro barbero'
        ),
      }

    case 'reserva_reprogramada_admin':
      return {
        subject: `🔄 Cita Modificada en Agenda: ${nombre} (${data.fecha} ${data.hora})`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">Modificación de Reserva</h2>
          <p>Se ha realizado un cambio en la cita del cliente <strong>${nombre}</strong>.</p>
          ${detailBox([
            { label: 'Cliente', value: nombre },
            { label: 'Especialista Asignado', value: data.barbero || '—' },
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Horario Anterior', value: `${data.fechaAnterior || '—'} ${data.horaAnterior || ''}`.trim() },
            { label: 'Nuevo Horario', value: `🗓️ ${data.fecha || '—'} a las ${data.hora || ''} hrs` },
          ])}
          ${cta(`${SITE}/agenda`, 'Abrir Agenda General')}`,
          'Cambio de cita registrado en el sistema'
        ),
      }

    case 'recordatorio_cita':
      return {
        subject: `⏰ Recordatorio: Tu cita en ${BRAND} es en breve`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:22px;font-weight:800;">Te recordamos tu cita</h2>
          <p style="color:#d4d4d8;">Hola <strong>${nombre}</strong>, en breve tienes un servicio programado con nosotros en <strong>${BRAND}</strong>.</p>
          ${detailBox([
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: `${data.hora || '—'} hrs` },
            { label: 'Especialista', value: data.barbero || 'Barbero asignado' },
          ])}
          <div style="margin:16px 0;padding:12px 16px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;color:#fcd34d;font-size:13px;line-height:1.5;">
            📍 <strong>Instrucciones:</strong> Preséntate 5 minutos antes con tu nombre en <strong>${BRAND}</strong>.
          </div>
          <p style="color:#a1a1aa;font-size:13px;">Si no puedes asistir, por favor avísanos o cancela desde tu cuenta para liberar el turno.</p>
          ${cta(`${SITE}/cliente`, 'Ver Mi Comprobante')}`,
          `Recordatorio de cita en ${BRAND}`
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
          `Alerta ${BRAND}`
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

    case 'pago_pendiente_cliente':
      return {
        subject: `⏳ Tu comprobante QR está en revisión — ${BRAND}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Recibimos tu comprobante, ${nombre}!</h2>
          <p>Tu pago QR fue registrado exitosamente. Nuestro equipo lo está revisando para confirmar tu reserva.</p>
          ${detailBox([
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Anticipo enviado', value: data.anticipo || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
            { label: 'Barbero', value: data.barbero || '—' },
          ])}
          ${data.comprobante_url ? `<div style="margin-top:16px;margin-bottom:16px;text-align:center;background-color:#09090b;padding:12px;border-radius:12px;border:1px solid #27272a;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:bold;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;">📷 Comprobante de Pago QR Enviado</p>
            <img src="${data.comprobante_url}" style="max-width:100%;max-height:280px;object-fit:contain;border-radius:8px;border:1px solid #3f3f46;" alt="Comprobante QR" />
            ${!data.comprobante_url.startsWith('data:') ? `<p style="margin:8px 0 0;"><a href="${data.comprobante_url}" target="_blank" style="color:#f59e0b;font-size:12px;font-weight:bold;text-decoration:underline;">🔍 Ver foto completa</a></p>` : ''}
          </div>` : ''}
          <p style="margin-top:16px;">Te enviaremos un correo de <strong style="color:#22c55e;">confirmación</strong> en cuanto verifiquemos el depósito. ¡No te preocupes, será rápido!</p>
          <p style="color:#a1a1aa;font-size:13px;margin-top:8px;">Si tienes alguna duda, contáctanos por WhatsApp o redes sociales.</p>
          ${cta(`${SITE}/cliente`, 'Ver estado de mi reserva')}`,
          'Tu comprobante QR está siendo revisado'
        ),
      }

    case 'pago_pendiente_equipo':
      return {
        subject: `💰 Anticipo QR pendiente — ${nombre}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">Pago QR por verificar</h2>
          <p><strong>${nombre}</strong> dice que realizó un pago QR como anticipo para su cita. Verifica el comprobante en tu app bancaria.</p>
          ${detailBox([
            { label: 'Cliente', value: nombre },
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Anticipo', value: data.anticipo || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
          ])}
          ${data.comprobante_url ? `<div style="margin-top:16px;margin-bottom:16px;text-align:center;background-color:#09090b;padding:12px;border-radius:12px;border:1px solid #27272a;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:bold;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;">📷 Comprobante de Pago QR Adjunto</p>
            <img src="${data.comprobante_url}" style="max-width:100%;max-height:280px;object-fit:contain;border-radius:8px;border:1px solid #3f3f46;" alt="Comprobante QR" />
            ${!data.comprobante_url.startsWith('data:') ? `<p style="margin:8px 0 0;"><a href="${data.comprobante_url}" target="_blank" style="color:#f59e0b;font-size:12px;font-weight:bold;text-decoration:underline;">🔍 Ver foto completa</a></p>` : ''}
          </div>` : ''}
          <p style="color:#a1a1aa;font-size:13px;">Ingresa al sistema y presiona <strong>"Verificar Pago"</strong> una vez confirmes el depósito.</p>
          ${cta(`${SITE}/barbero`, 'Ir al panel')}`,
          'Hay un pago QR pendiente de verificar'
        ),
      }

    case 'pago_pendiente_admin':
      return {
        subject: `💰 Acción Requerida: QR por Verificar — ${nombre}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Atención Administrador!</h2>
          <p><strong>${nombre}</strong> ha subido un comprobante de pago por QR como anticipo de su reserva. ¡Es hora de verificarlo!</p>
          ${detailBox([
            { label: 'Cliente', value: nombre },
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Anticipo', value: data.anticipo || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
            { label: 'Barbero', value: data.barbero || '—' },
          ])}
          ${data.comprobante_url ? `<div style="margin-top:16px;margin-bottom:16px;text-align:center;background-color:#09090b;padding:12px;border-radius:12px;border:1px solid #27272a;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:bold;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;">📷 Comprobante de Pago QR Adjunto</p>
            <img src="${data.comprobante_url}" style="max-width:100%;max-height:280px;object-fit:contain;border-radius:8px;border:1px solid #3f3f46;" alt="Comprobante QR" />
            ${!data.comprobante_url.startsWith('data:') ? `<p style="margin:8px 0 0;"><a href="${data.comprobante_url}" target="_blank" style="color:#f59e0b;font-size:12px;font-weight:bold;text-decoration:underline;">🔍 Ver foto completa</a></p>` : ''}
          </div>` : ''}
          <p style="color:#a1a1aa;font-size:13px;">Revisa tu banco o notifica al barbero para que presione <strong>"Aprobar Pago"</strong>.</p>
          ${cta(`${SITE}/admin`, 'Ir al Panel Admin')}`,
          'Tienes un comprobante de reserva pendiente de revisión'
        ),
      }

    case 'pago_verificado_cliente':
      return {
        subject: `✅ ¡Reserva Confirmada y Verificada! — ${BRAND}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#22c55e;font-size:22px;font-weight:800;">¡Tu reserva está 100% confirmada!</h2>
          <p style="color:#d4d4d8;">Hola <strong>${nombre}</strong>, tu comprobante de pago fue revisado y <strong style="color:#22c55e;">aprobado</strong> exitosamente.</p>
          ${detailBox([
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Anticipo pagado', value: data.anticipo || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: `${data.hora || '—'} hrs` },
            { label: 'Especialista', value: data.barbero || 'Barbero asignado' },
          ])}
          ${data.comprobante_url ? `<div style="margin-top:16px;margin-bottom:16px;text-align:center;background-color:#09090b;padding:12px;border-radius:12px;border:1px solid #27272a;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:bold;color:#22c55e;text-transform:uppercase;letter-spacing:1px;">📷 Comprobante Aprobado</p>
            <img src="${data.comprobante_url}" style="max-width:100%;max-height:280px;object-fit:contain;border-radius:8px;border:1px solid #3f3f46;" alt="Comprobante QR" />
            ${!data.comprobante_url.startsWith('data:') ? `<p style="margin:8px 0 0;"><a href="${data.comprobante_url}" target="_blank" style="color:#f59e0b;font-size:12px;font-weight:bold;text-decoration:underline;">🔍 Ver foto completa</a></p>` : ''}
          </div>` : ''}
          <div style="margin:16px 0;padding:12px 16px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;color:#fcd34d;font-size:13px;line-height:1.5;">
            📍 <strong>Instrucciones:</strong> Te esperamos puntual en <strong>${BRAND}</strong>. Indica tu nombre al llegar. El saldo restante se cancela directamente en caja.
          </div>
          ${cta(`${SITE}/cliente`, 'Ver Mi Comprobante de Cita')}`,
          `Tu anticipo fue verificado y la cita confirmada en ${BRAND}`
        ),
      }

    case 'pago_verificado_admin':
      return {
        subject: `✅ ¡Excelente! Pago Verificado — ${nombre}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#22c55e;font-size:20px;">¡Pago Verificado con Éxito!</h2>
          <p>El sistema registró que el pago QR de <strong>${nombre}</strong> fue verificado por <strong>${data.verificadoPor || 'el equipo'}</strong>. La cita está 100% confirmada.</p>
          ${detailBox([
            { label: 'Cliente', value: nombre },
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Anticipo', value: data.anticipo || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
          ])}
          ${data.comprobante_url ? `<div style="margin-top:16px;margin-bottom:16px;text-align:center;background-color:#09090b;padding:12px;border-radius:12px;border:1px solid #27272a;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:bold;color:#22c55e;text-transform:uppercase;letter-spacing:1px;">📷 Comprobante Aprobado</p>
            <img src="${data.comprobante_url}" style="max-width:100%;max-height:280px;object-fit:contain;border-radius:8px;border:1px solid #3f3f46;" alt="Comprobante QR" />
            ${!data.comprobante_url.startsWith('data:') ? `<p style="margin:8px 0 0;"><a href="${data.comprobante_url}" target="_blank" style="color:#f59e0b;font-size:12px;font-weight:bold;text-decoration:underline;">🔍 Ver foto completa</a></p>` : ''}
          </div>` : ''}
          ${cta(`${SITE}/admin`, 'Ir al Panel Admin')}`,
          'Un pago QR ha sido verificado y la cita confirmada'
        ),
      }

    case 'resumen_diario_admin':
      return {
        subject: `📊 Resumen Diario — ${data.fecha}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#fff;font-size:20px;">Resumen del Día</h2>
          <p>Este es el reporte automático de cierre del día <strong>${data.fecha}</strong>.</p>
          ${detailBox([
            { label: 'Citas Atendidas', value: data.totalCitas || '0' },
            { label: 'Ventas de Productos', value: data.totalVentasProductos || '0' },
            { label: 'Ingresos por Servicios', value: data.ingresosServicios || 'Bs 0.00' },
            { label: 'Ingresos por Productos', value: data.ingresosProductos || 'Bs 0.00' },
            { label: 'Ingreso Total', value: data.ingresoTotal || 'Bs 0.00' },
          ])}
          ${cta(`${SITE}/admin/reportes`, 'Ver reportes completos')}`,
          'Resumen de ventas y citas del día'
        ),
      }

    case 'invitacion_2x1':
      return {
        subject: `🎁 ¡Tienes una Cita 2×1 en ${BRAND}! — ${nombre}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:22px;font-weight:800;">¡Tienes una cita 2×1 reservada!</h2>
          <p style="color:#d4d4d8;">Hola <strong>${nombre}</strong>, tu amigo/a <strong>${data.clienteNombre}</strong> ha agendado una cita con la promoción 2×1 para ti en <strong>${BRAND}</strong>.</p>
          ${detailBox([
            { label: 'Invitado por', value: data.clienteNombre || 'Un amigo' },
            { label: 'Servicio', value: data.servicioNombre || 'Corte 2×1 (Gratis Bs 0)' },
            { label: 'Especialista', value: data.barberoNombre || BRAND },
            { label: 'Fecha de la Cita', value: data.fecha || '—' },
            { label: 'Hora Asignada', value: data.hora ? `${data.hora} hrs` : '—' },
          ])}
          <div style="margin:16px 0;padding:12px 16px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;color:#fcd34d;font-size:13px;line-height:1.5;">
            📍 <strong>Instrucciones de llegada:</strong> Preséntate 5 minutos antes de tu hora en <strong>${BRAND}</strong> e indica tu nombre al barbero o recepción. Tu turno ya está asegurado en la agenda sin necesidad de escanear nada.
          </div>
          <p style="color:#a1a1aa;font-size:13px;">Si deseas llevar el control de tus citas, acumular visitas y ganar cortes gratis, puedes acceder a tu cuenta:</p>
          ${cta(`${SITE}/login`, 'Ver Mi Portal de Cliente')}`,
          `Tienes una cita 2×1 reservada en ${BRAND}`
        ),
      }

    case 'invitacion_cliente':
      return {
        subject: `🎉 ¡Bienvenido a ${BRAND}! — Activa tu cuenta digital`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Te damos la bienvenida a ${BRAND}!</h2>
          <p>Hola <strong>${nombre}</strong>, hemos registrado tu visita y enlazado tu correo electrónico en nuestro sistema digital.</p>
          <p>Con tu cuenta en línea podrás:</p>
          <ul style="color:#a1a1aa;padding-left:20px;line-height:1.6;">
            <li>Agendar citas en línea 24/7 con tus barberos preferidos</li>
            <li>Acumular visitas para ganar cortes gratis y recompensas de fidelidad</li>
            <li>Consultar tu historial y acceder a promociones exclusivas</li>
          </ul>
          <p>Para activar tu cuenta y ver tus visitas o puntos acumulados, haz clic abajo:</p>
          ${cta(`${SITE}/login`, 'Acceder a Mi Cuenta')}`,
          'Bienvenido a nuestro sistema de reservas y fidelidad'
        ),
      }

    case 'bienvenida_nuevo_usuario':
      return {
        subject: `🎉 ¡Bienvenido a ${BRAND}! — Tus Datos de Acceso`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Te damos la bienvenida a ${BRAND}!</h2>
          <p>Hola <strong>${data.nombre}</strong>, tu cuenta ha sido creada exitosamente en nuestra plataforma web.</p>
          <p>Tus credenciales de acceso iniciales son las siguientes:</p>
          ${detailBox([
            { label: 'Correo de Usuario', value: String(data.email) },
            { label: 'Contraseña Inicial', value: String(data.password) },
          ])}
          <p style="margin-top:16px;padding:12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;color:#fcd34d;font-size:13px;line-height:1.5;">
            🔒 <strong>Contraseña Provisional:</strong> Esta es tu clave de primer acceso asignada por el sistema. Por tu seguridad, te recomendamos cambiarla ingresando a tu perfil web en la sección de seguridad.
          </p>
          ${cta(`${SITE}/login`, 'Iniciar Sesión en la Web')}`,
          'Tus credenciales de acceso a la plataforma'
        ),
      }

    case 'cambio_rol':
      return {
        subject: `👑 Actualización de Rol en ${BRAND} — ${String(data.nuevoRol || 'USUARIO').toUpperCase()}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Actualización de Rol y Permisos!</h2>
          <p>Hola <strong>${data.nombre || 'Usuario'}</strong>, te informamos que la Administración ha actualizado tu rol en la plataforma web de ${BRAND}.</p>
          ${detailBox([
            { label: 'Rol Asignado', value: String(data.nuevoRol || 'USUARIO').toUpperCase() },
            { label: 'Fecha de Cambio', value: new Date().toLocaleDateString('es-BO') },
          ])}
          <p>Al iniciar sesión ahora podrás acceder a las herramientas, paneles y notificaciones correspondientes a tu nuevo rol.</p>
          ${cta(`${SITE}/login`, 'Ingresar con mi Nuevo Rol')}`,
          `Tu rol en ${BRAND} ha sido cambiado a ${data.nuevoRol}`
        ),
      }

    case 'invitacion_referido':
      return {
        subject: `🎉 ¡Ganaste un Bono por Referir a un Amigo! — ${BRAND}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Gracias por recomendarnos!</h2>
          <p>Hola <strong>${data.acompananteNombre || nombre}</strong>, tu amigo/a <strong>${data.clienteNombre}</strong> acaba de completar un servicio con nosotros y te nombró como su referidor.</p>
          <p>¡Como agradecimiento, has ganado un bono de descuento en nuestro sistema que podrás usar en tu próximo corte o compra de productos!</p>
          ${detailBox([
            { label: 'Referido', value: data.clienteNombre || 'Un amigo' },
            { label: 'Bono Ganado', value: `Bs. ${data.montoBono || '10'}` },
          ])}
          <p>Para ver y usar tus bonos, accede a tu cuenta desde el siguiente enlace.</p>
          ${cta(`${SITE}/login`, 'Ver mis bonos')}`,
          '¡Ganaste un bono de descuento por referir a un amigo!'
        ),
      }

    case 'cumpleanos':
      return {
        subject: `🎂 ¡Feliz Cumpleaños de parte de ${BRAND}! 🎉`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Feliz Cumpleaños ${nombre}!</h2>
          <p>Te deseamos un muy feliz cumpleaños de parte de todo el equipo de <strong>${BRAND}</strong>.</p>
          <p>Hemos verificado tu documento de identidad y se ha habilitado tu regalo de cumpleaños en nuestro sistema.</p>
          <p>Tienes una promoción exclusiva que puedes aprovechar durante la semana o el mes de tu cumpleaños.</p>
          ${cta(`${SITE}/reservar`, 'Agendar cita ahora')}`,
          '¡Tienes un regalo esperando por ti!'
        ),
      }

    case 'cumpleanos_registro':
      return {
        subject: data.asuntoCustom || `🎂 ¡Fecha de Cumpleaños Registrada en {{barberia}}!`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Hola {{nombre}}!</h2>
          <p>Hemos registrado tu fecha de cumpleaños exitosamente en <strong>{{barberia}}</strong>.</p>
          <div style="margin:16px 0;line-height:1.6;font-size:15px;color:#e4e4e7;">${data.mensajeCustom || '¡Prepárate! Una semana antes de tu gran día te enviaremos una promoción exclusiva y tu regalo de cumpleaños para que celebres luciendo tu mejor corte y estilo.'}</div>
          ${detailBox([
            { label: 'Fecha Guardada', value: data.fecha || 'Registrada' },
            { label: 'Beneficio', value: 'Regalo y Descuento Exclusivo en tu Semana' }
          ])}
          ${cta(data.link || `${SITE}/reservar`, 'Ver Barbería / Agendar Cita')}`,
          'Tu fecha de cumpleaños ha sido guardada'
        ),
      }

    case 'cumpleanos_semana_antes':
      return {
        subject: data.asuntoCustom || `🎂 ¡Se acerca tu Cumpleaños {{nombre}}! Tu regalo en {{barberia}} te espera`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Falta solo 1 semana para tu cumpleaños {{nombre}}! 🎉</h2>
          <div style="margin:16px 0;line-height:1.6;font-size:15px;color:#e4e4e7;">${data.mensajeCustom || 'En {{barberia}} queremos celebrar contigo. Tienes habilitado un regalo y descuento especial de cumpleaños durante toda esta semana.'}</div>
          <p>Ven y disfruta el mejor ambiente, bebidas de cortesía y el estilo perfecto para tu día especial.</p>
          ${cta(data.link || `${SITE}/reservar`, 'Agendar mi Cita de Cumpleaños')}`,
          '¡Falta solo 1 semana para tu cumpleaños!'
        ),
      }

    case 'registro_bienvenida_nuevo':
      return {
        subject: `🎉 ¡Bienvenido a ${BRAND}! — Registro Exitoso`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Hola ${nombre}!</h2>
          <p>Tu cuenta ha sido creada exitosamente en <strong>${BRAND}</strong>.</p>
          <p>Ya puedes ingresar a nuestro portal web para agendar tus citas, elegir a tu barbero preferido y acumular beneficios de fidelidad.</p>
          ${cta(`${SITE}/login`, 'Iniciar Sesión en la Web')}`,
          `Registro exitoso en ${BRAND}`
        ),
      }

    case 'registro_bienvenida_sync':
      return {
        subject: `🎉 ¡Bienvenido a ${BRAND}! — Historial Sincronizado`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Hola ${nombre}!</h2>
          <p>Tu cuenta ha sido creada exitosamente. Hemos vinculado de manera segura todo tu historial previo de atenciones, consumos y puntos de lealtad a tu perfil web.</p>
          ${detailBox([
            { label: 'Visitas Sincronizadas', value: data.visitas || '0' },
            { label: 'Historial de Consumo', value: data.gastado || 'Bs. 0' },
          ])}
          <p style="color:#a1a1aa;font-size:13px;">Ya puedes ingresar a la web para agendar tus citas y ver tu historial completo de visitas.</p>
          ${cta(`${SITE}/login`, 'Iniciar Sesión en la Web')}`,
          `Sincronización de cuenta exitosa en ${BRAND}`
        ),
      }

    case 'pago_rechazado_admin':
      return {
        subject: `🚫 Comprobante Rechazado — ${nombre}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#ef4444;font-size:20px;">⚠️ Comprobante de Pago Rechazado</h2>
          <p>El comprobante QR de <strong>${nombre}</strong> fue revisado y <strong style="color:#ef4444;">rechazado como falso/no válido</strong> por <strong>${data.verificadoPor || 'el equipo'}</strong>.</p>
          <p style="color:#fbbf24;font-size:13px;margin-top:8px;">La cita fue cancelada automáticamente. El cliente ha sido notificado.</p>
          ${detailBox([
            { label: 'Cliente', value: nombre },
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Anticipo declarado', value: data.anticipo || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
            { label: 'Barbero asignado', value: data.barbero || '—' },
            { label: 'Rechazado por', value: data.verificadoPor || '—' },
          ])}
          ${data.comprobante_url ? `<div style="margin-top:16px;margin-bottom:16px;text-align:center;background-color:#09090b;padding:12px;border-radius:12px;border:1px solid #dc2626;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:bold;color:#ef4444;text-transform:uppercase;letter-spacing:1px;">🚫 Comprobante Rechazado</p>
            <img src="${data.comprobante_url}" style="max-width:100%;max-height:280px;object-fit:contain;border-radius:8px;border:1px solid #3f3f46;opacity:0.7;" alt="Comprobante rechazado" />
            ${!data.comprobante_url.startsWith('data:') ? `<p style="margin:8px 0 0;"><a href="${data.comprobante_url}" target="_blank" style="color:#f59e0b;font-size:12px;font-weight:bold;text-decoration:underline;">🔍 Ver foto completa</a></p>` : ''}
          </div>` : ''}
          <p style="color:#a1a1aa;font-size:13px;">Revisa si es necesario tomar acciones adicionales con este cliente.</p>
          ${cta(`${SITE}/admin`, 'Ir al Panel Admin')}`,
          'Un comprobante de pago fue rechazado como falso'
        ),
      }

    case 'pago_rechazado_cliente':
      return {
        subject: `❌ Comprobante No Válido — Tu reserva no pudo ser confirmada`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#ef4444;font-size:20px;">Tu comprobante no pudo ser verificado</h2>
          <p>Hola <strong>${nombre}</strong>, lamentamos informarte que el comprobante de pago QR que enviaste <strong style="color:#ef4444;">no pudo ser validado</strong> por nuestro equipo.</p>
          <p>Tu reserva ha sido cancelada. Si crees que esto es un error, contáctanos por WhatsApp o redes sociales con el comprobante original de tu banco.</p>
          ${detailBox([
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Anticipo declarado', value: data.anticipo || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
            { label: 'Barbero', value: data.barbero || '—' },
          ])}
          <p style="margin-top:16px;">Si deseas volver a agendar, puedes hacerlo desde nuestro sitio web con un nuevo comprobante válido.</p>
          <p style="color:#a1a1aa;font-size:13px;margin-top:8px;">Si tienes dudas, no dudes en contactarnos.</p>
          ${cta(`${SITE}/reservar`, 'Agendar nueva cita')}`,
          'Tu comprobante de pago no pasó la verificación'
        ),
      }

    case 'permiso_solicitado_admin':
      const barberoSolicitante = data.barberoNombre || data.nombre || 'Un barbero'
      return {
        subject: `📋 Solicitud de Permiso: ${barberoSolicitante} — ${data.fecha || 'Fecha'}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">Nueva Solicitud de Permiso</h2>
          <p><strong>${barberoSolicitante}</strong> ha registrado una solicitud de permiso laboral en el sistema y requiere tu revisión.</p>
          ${detailBox([
            { label: 'Barbero', value: barberoSolicitante },
            { label: 'Fecha Solicitada', value: data.fechaFin && data.fechaFin !== data.fecha ? `${data.fecha} al ${data.fechaFin}` : (data.fecha || '—') },
            { label: 'Horario / Cobertura', value: data.todo_el_dia ? 'Día Completo (Toda la Jornada)' : `${data.horaInicio || '09:00'} a ${data.horaFin || '20:00'}` },
            { label: 'Tipo de Permiso', value: data.tipoPermiso || 'Permiso General' },
            { label: 'Motivo / Justificación', value: data.motivo || 'Sin motivo especificado' },
          ])}
          ${data.comprobante_url ? `
            <div style="margin:20px 0;padding:16px;background:#27272a;border-radius:12px;border:1px solid #3f3f46;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#a1a1aa;text-transform:uppercase;font-weight:bold;letter-spacing:0.05em;">📄 Documento / Justificativo Adjunto</p>
              <p style="margin:0 0 12px;color:#fff;font-size:14px;font-weight:600;">${data.archivoNombre || 'Archivo Justificativo (PDF/Imagen)'}</p>
              <a href="${data.comprobante_url}" target="_blank" style="display:inline-block;background:#f59e0b;color:#000;font-weight:800;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:12px;text-transform:uppercase;">
                🔍 Abrir Documento Adjunto
              </a>
            </div>
          ` : '<p style="color:#71717a;font-size:13px;">No se adjuntó ningún archivo PDF o imagen.</p>'}
          <p style="color:#e4e4e7;font-size:14px;margin-top:16px;">Por favor ingresa al panel de Asistencia para <strong>Aprobar</strong> o <strong>Rechazar</strong> la solicitud.</p>
          ${cta(`${SITE}/admin/asistencia`, 'Revisar en Panel de Asistencia')}`,
          `Nueva solicitud de permiso de ${barberoSolicitante}`
        ),
      }

    case 'permiso_aprobado_barbero':
      return {
        subject: `✅ Tu solicitud de permiso ha sido APROBADA — ${BRAND}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#22c55e;font-size:20px;">¡Permiso Aprobado!</h2>
          <p>Hola <strong>${nombre}</strong>, tu solicitud de permiso laboral ha sido revisada y <strong style="color:#22c55e;">Aprobada</strong> por la Administración.</p>
          ${detailBox([
            { label: 'Fecha Aprobada', value: data.fechaFin && data.fechaFin !== data.fecha ? `${data.fecha} al ${data.fechaFin}` : (data.fecha || '—') },
            { label: 'Horario Cubierto', value: data.todo_el_dia ? 'Día Completo' : `${data.horaInicio || '09:00'} a ${data.horaFin || '20:00'}` },
            { label: 'Tipo de Permiso', value: data.tipoPermiso || 'Permiso General' },
            { label: 'Aprobado Por', value: data.revisadoPor || 'Administración' },
          ])}
          <p style="color:#a1a1aa;font-size:13px;margin-top:16px;">Tu asistencia ha sido registrada debidamente como <strong>Permiso Justificado</strong>, por lo que no incurrirás en faltas ni sanciones.</p>
          ${cta(`${SITE}/barbero`, 'Ir a Mi Panel de Barbero')}`,
          `Tu permiso para el ${data.fecha} fue aprobado`
        ),
      }

    case 'permiso_rechazado_barbero':
      return {
        subject: `❌ Tu solicitud de permiso fue RECHAZADA — ${BRAND}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#ef4444;font-size:20px;">Solicitud de Permiso Rechazada</h2>
          <p>Hola <strong>${nombre}</strong>, lamentamos informarte que tu solicitud de permiso para el <strong>${data.fecha}</strong> no pudo ser aprobada.</p>
          ${detailBox([
            { label: 'Fecha Solicitada', value: data.fecha || '—' },
            { label: 'Horario', value: data.todo_el_dia ? 'Día Completo' : `${data.horaInicio || '09:00'} a ${data.horaFin || '20:00'}` },
            { label: 'Motivo del Rechazo', value: data.motivoRechazo || 'No especificado por la administración' },
            { label: 'Revisado Por', value: data.revisadoPor || 'Administración' },
          ])}
          <p style="color:#a1a1aa;font-size:13px;margin-top:16px;">Si necesitas coordinar una reprogramación o tienes dudas sobre el motivo, comunícate directamente con tu coordinador o administrador.</p>
          ${cta(`${SITE}/barbero`, 'Ir a Mi Panel de Barbero')}`,
          `Tu solicitud de permiso fue rechazada`
        ),
      }

    default:
      return {
        subject: `Notificación — ${BRAND}`,
        html: layout(`<p>${data.motivo || 'Tienes una nueva notificación en el sistema.'}</p>`, 'Nueva notificación'),
      }
  }
  })()

  return {
    subject: replaceTemplateVariables(res.subject, data),
    html: replaceTemplateVariables(res.html, data),
  }
}
