const BRAND = 'Barber Pro'
const SITE = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

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
  link?: string
  nombre?: string
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

    case 'reserva_nueva_admin':
      return {
        subject: `🎉 ¡Nueva Reserva Confirmada! — ${nombre}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Gran noticia, Administrador!</h2>
          <p>Se ha registrado una <strong>nueva reserva</strong> en el sistema exitosamente.</p>
          ${detailBox([
            { label: 'Cliente', value: nombre },
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
            { label: 'Barbero', value: data.barbero || '—' },
          ])}
          <p>Todo está fluyendo excelente. Puedes revisar los detalles en tu agenda administrativa.</p>
          ${cta(`${SITE}/admin`, 'Ver Agenda Admin')}`,
          'Una nueva reserva ingresó al sistema'
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
        subject: `🎁 ¡${data.acompananteNombre || 'Un amigo'} te ha recomendado nuestra barbería!`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#fff;font-size:20px;">¡Hola ${data.clienteNombre || 'Cliente'}!</h2>
          <p>Tu amigo <strong>${data.acompananteNombre || 'alguien especial'}</strong> nos contó sobre ti y te ha enviado una invitación exclusiva para visitarnos.</p>
          <p>Ven y descubre el mejor estilo en nuestra barbería. Regístrate en nuestra plataforma para agendar tu primera cita y empezar a disfrutar de beneficios y puntos de fidelidad.</p>
          ${cta(`${SITE}/login`, 'Crear mi cuenta')}`,
          'Tienes una invitación especial'
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
        subject: '⏰ Recordatorio: tu cita es en breve',
        html: layout(
          `<h2 style="margin:0 0 8px;color:#fff;font-size:20px;">Te recordamos tu cita</h2>
          <p>Hola ${nombre}, en breve tienes un servicio programado con nosotros.</p>
          ${detailBox([
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
            { label: 'Barbero', value: data.barbero || '—' },
          ])}
          <p style="color:#a1a1aa;font-size:13px;">Si no puedes asistir, avísanos para liberar el horario.</p>`,
          'Recordatorio de cita en breve'
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

    case 'pago_pendiente_cliente':
      return {
        subject: '⏳ Tu comprobante QR está en revisión — Barber Pro',
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
          ${data.comprobante_url ? `<p style="margin-top:12px;"><a href="${data.comprobante_url}" style="color:#f59e0b;font-weight:bold;text-decoration:none;">📷 Ver tu comprobante enviado</a></p>` : ''}
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
          ${data.comprobante_url ? `<p><a href="${data.comprobante_url}" style="color:#f59e0b;font-weight:bold;text-decoration:none;">📥 Ver Comprobante Adjunto</a></p>` : ''}
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
          ${data.comprobante_url ? `<p><a href="${data.comprobante_url}" style="color:#f59e0b;font-weight:bold;text-decoration:none;">📥 Ver Comprobante de Pago</a></p>` : ''}
          <p style="color:#a1a1aa;font-size:13px;">Revisa tu banco o notifica al barbero para que presione <strong>"Aprobar Pago"</strong>.</p>
          ${cta(`${SITE}/admin`, 'Ir al Panel Admin')}`,
          'Tienes un comprobante de reserva pendiente de revisión'
        ),
      }

    case 'pago_verificado_cliente':
      return {
        subject: '✅ ¡Reserva Aceptada y Verificada! — Te esperamos',
        html: layout(
          `<h2 style="margin:0 0 8px;color:#22c55e;font-size:20px;">¡Tu reserva está confirmada!</h2>
          <p>Hola <strong>${nombre}</strong>, tu comprobante de pago fue revisado y <strong style="color:#22c55e;">aceptado</strong>. Tu cita quedó 100% confirmada.</p>
          ${detailBox([
            { label: 'Servicio', value: data.servicio || '—' },
            { label: 'Anticipo pagado', value: data.anticipo || '—' },
            { label: 'Fecha', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
            { label: 'Barbero', value: data.barbero || '—' },
          ])}
          ${data.comprobante_url ? `<p style="margin-top:12px;"><a href="${data.comprobante_url}" style="color:#f59e0b;font-weight:bold;text-decoration:none;">📷 Ver tu comprobante de pago</a></p>` : ''}
          <p style="margin-top:16px;">Te esperamos puntual el <strong>${data.fecha || ''}</strong> a las <strong>${data.hora || ''}</strong> con <strong>${data.barbero || 'tu barbero'}</strong>. El saldo restante se paga directamente en la barbería.</p>
          <p style="color:#a1a1aa;font-size:13px;margin-top:8px;">Recibirás un recordatorio antes de tu cita. Si no puedes asistir, avísanos con tiempo.</p>
          ${cta(`${SITE}/cliente`, 'Ver mis citas')}`,
          'Tu anticipo fue verificado y la cita confirmada'
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
          ${data.comprobante_url ? `<p style="margin-top:12px;"><a href="${data.comprobante_url}" style="color:#f59e0b;font-weight:bold;text-decoration:none;">📷 Ver comprobante de pago</a></p>` : ''}
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
        subject: `🎁 ¡Estás invitado a un 2x1! — ${BRAND}`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Tienes una promoción 2x1!</h2>
          <p>Hola <strong>${nombre}</strong>, tu amigo/a <strong>${data.clienteNombre}</strong> te ha invitado a aprovechar una promoción 2x1 en nuestra barbería.</p>
          ${detailBox([
            { label: 'Invitado por', value: data.clienteNombre || 'Un amigo' },
            { label: 'Fecha de la Cita', value: data.fecha || '—' },
            { label: 'Hora', value: data.hora || '—' },
          ])}
          <p>Si aún no tienes cuenta en nuestro sistema, puedes registrarte haciendo clic abajo y así tener todo tu historial y bonos guardados.</p>
          ${cta(`${SITE}/login`, 'Registrarme / Iniciar Sesión')}`,
          'Un amigo te ha invitado a una promoción 2x1'
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
        subject: `¡Bienvenido al equipo de ${BRAND}!`,
        html: layout(
          `<h2 style="margin:0 0 8px;color:#f59e0b;font-size:20px;">¡Te damos la bienvenida a ${BRAND}!</h2>
          <p>Hola <strong>${data.nombre}</strong>, tu cuenta ha sido creada exitosamente en nuestro sistema.</p>
          <p>Para ingresar, utiliza las siguientes credenciales temporales:</p>
          ${detailBox([
            { label: 'Correo / Usuario', value: String(data.email) },
            { label: 'Contraseña Temporal', value: String(data.password) },
          ])}
          <p style="margin-top:16px;">Te recomendamos cambiar tu contraseña una vez que ingreses al sistema desde tu perfil o panel.</p>
          ${cta(`${SITE}/login`, 'Iniciar Sesión Ahora')}`,
          'Tus credenciales de acceso al sistema'
        ),
      }

    default:
      return {
        subject: `Notificación — ${BRAND}`,
        html: layout(`<p>${data.motivo || 'Tienes una nueva notificación en el sistema.'}</p>`, 'Nueva notificación'),
      }
  }
}
