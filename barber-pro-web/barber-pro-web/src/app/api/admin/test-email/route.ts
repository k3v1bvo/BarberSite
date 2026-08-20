import { NextResponse } from 'next/server'
import { sendNotificationEmail } from '@/lib/notifications/email'

export async function POST(request: Request) {
  try {
    const { to, rol } = await request.json()

    if (!to) {
      return NextResponse.json({ error: 'El parámetro "to" (email destino) es requerido' }, { status: 400 })
    }

    const templateData = {
      nombre: `Usuario de Prueba (${rol || 'General'})`,
      email: to,
      password: 'PruebaPassword123!',
      motivo: `Correo de prueba enviado para verificar la integración SMTP con Gmail (${to}).`,
      link: 'https://barber-site-livid.vercel.app/login'
    }

    const result = await sendNotificationEmail(to, 'bienvenida_nuevo_usuario', templateData)

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `¡Correo de prueba enviado exitosamente a ${to}!`,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
