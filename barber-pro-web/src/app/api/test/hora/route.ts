import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/notifications/email'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  const ahora = new Date()
  const horaBolivia = ahora.toLocaleTimeString('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
  const fechaBolivia = ahora.toLocaleDateString('es-BO', {
    timeZone: 'America/La_Paz',
  })
  const isoUtc = ahora.toISOString()

  let emailResultado = 'No se solicitó envío de correo (agrega ?email=tu_correo@gmail.com)'

  if (email) {
    const res = await sendEmail({
      to: email,
      subject: `🧪 Prueba de Hora Oficial BarberSite — ${horaBolivia}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #09090b; color: #ffffff; border-radius: 16px; border: 1px solid #27272a; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #f59e0b; margin-top: 0; text-align: center;">⏱️ Prueba de Hora Oficial</h2>
          <p style="text-align: center; color: #a1a1aa; font-size: 14px;">Compara los datos emitidos por el servidor contra la hora actual de tu celular:</p>
          
          <div style="background-color: #18181b; padding: 18px; border-radius: 12px; border: 1px solid #3f3f46; margin: 20px 0;">
            <p style="margin: 8px 0; font-size: 18px;"><strong>🇧🇴 Hora Oficial Bolivia:</strong> <span style="color: #22c55e; font-weight: bold;">${horaBolivia}</span></p>
            <p style="margin: 8px 0; font-size: 15px;"><strong>📅 Fecha Bolivia:</strong> ${fechaBolivia}</p>
            <p style="margin: 8px 0; font-size: 12px; color: #a1a1aa;"><strong>🌐 Servidor ISO (UTC):</strong> ${isoUtc}</p>
          </div>

          <p style="font-size: 12px; color: #71717a; text-align: center;">Esta es una prueba de sincronización de zona horaria oficial (America/La_Paz, UTC-4).</p>
        </div>
      `,
    })

    emailResultado = res.ok
      ? `Correo enviado exitosamente a ${email}`
      : `Error al enviar correo: ${res.error}`
  }

  return NextResponse.json({
    hora_bolivia: horaBolivia,
    fecha_bolivia: fechaBolivia,
    servidor_utc: isoUtc,
    email_resultado: emailResultado,
  })
}
