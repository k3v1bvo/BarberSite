import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/notifications/email'
import { getBusinessDateString } from '@/lib/asistencia/helpers'
import { LUNCH_REMINDER_MINUTES } from '@/lib/asistencia/constants'

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const hoy = getBusinessDateString()

    // Verificar si aún está en almuerzo — si ya regresó, no enviar recordatorio
    const { data: asistencia } = await supabase
      .from('asistencias')
      .select('en_almuerzo')
      .eq('profile_id', user.id)
      .eq('fecha', hoy)
      .is('hora_salida', null)
      .maybeSingle()

    if (!asistencia?.en_almuerzo) {
      return NextResponse.json({ skipped: true, mensaje: 'Barbero ya regresó del almuerzo, no se envía recordatorio' })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const nombre = profile?.full_name || 'Barbero'
    const email = profile?.email

    // 1. Insertar notificación en el sistema
    try {
      await supabase.from('notificaciones').insert({
        user_id: user.id,
        titulo: `⏰ Quedan ${LUNCH_REMINDER_MINUTES} minutos de almuerzo`,
        mensaje: `¡Hola ${nombre}! Te quedan ${LUNCH_REMINDER_MINUTES} minutos de pausa. Prepárate para volver al salón y marca tu regreso. 💈`,
        tipo: 'asistencia',
        leido: false,
      })
    } catch (nErr) {
      console.error('Error insertando notificación de sistema recordatorio:', nErr)
    }

    // 2. Enviar correo electrónico si tiene email
    if (email) {
      try {
        const html = `
          <div style="background-color:#09090b; padding:28px; font-family:'Helvetica Neue', Arial, sans-serif; color:#ffffff; max-width:500px; margin:0 auto; border-radius:16px; border:1px solid rgba(245,158,11,0.3);">
            <div style="text-align:center; margin-bottom:20px;">
              <span style="font-size:40px;">⏰</span>
              <h2 style="color:#f59e0b; margin:10px 0 5px 0; font-size:20px; text-transform:uppercase; font-weight:900;">Recordatorio de Almuerzo</h2>
              <p style="color:#a1a1aa; font-size:12px; margin:0;">BarberSite — Gestión de Personal</p>
            </div>
            <div style="background-color:#18181b; padding:20px; border-radius:12px; border:1px solid rgba(255,255,255,0.05); margin-bottom:20px;">
              <p style="color:#ffffff; font-size:14px; margin:0 0 10px 0; font-weight:700;">¡Hola ${nombre}!</p>
              <p style="color:#d4d4d8; font-size:13px; line-height:1.6; margin:0;">
                Te quedan <strong>${LUNCH_REMINDER_MINUTES} minutos</strong> de tu descanso de almuerzo. Recuerda que debes marcar tu regreso manualmente desde la app cuando vuelvas a la barbería.
              </p>
            </div>
            <p style="color:#a1a1aa; font-size:12px; text-align:center; margin:0; line-height:1.5;">
              Si no marcas tu regreso a tiempo, el sistema seguirá contando tu descanso y se notificará a la administración. 💈✂️
            </p>
          </div>
        `
        await sendEmail({
          to: email,
          subject: `⏰ Recordatorio: Te quedan ${LUNCH_REMINDER_MINUTES} minutos de almuerzo`,
          html,
        })
      } catch (eErr) {
        console.error('Error enviando email de recordatorio almuerzo:', eErr)
      }
    }

    return NextResponse.json({ success: true, mensaje: `Recordatorio de ${LUNCH_REMINDER_MINUTES} min enviado por email y sistema` })
  } catch (error: any) {
    console.error('Error en API recordatorio almuerzo:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
