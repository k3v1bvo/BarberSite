import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { notificacion_id, cliente_id, email, accion, nuevo_email, nueva_password } = await req.json()

    if (!cliente_id || !accion) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    if (!admin) {
      return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
    }

    let resultadoAccion = ''

    if (accion === 'reset_link') {
      // 1. Generar enlace de reseteo o enviar contraseña
      const targetEmail = nuevo_email || email
      const { data, error } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: targetEmail,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://barber-site-livid.vercel.app'}/login`,
        },
      })

      if (error) throw error

      resultadoAccion = `Enlace de recuperación enviado con éxito a ${targetEmail}.`
    } else if (accion === 'cambiar_credenciales') {
      // 2. Cambiar correo o contraseña directamente por la administración
      const updateData: any = {}
      if (nuevo_email?.trim()) updateData.email = nuevo_email.trim()
      if (nueva_password?.trim()) updateData.password = nueva_password.trim()

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'Proporciona un nuevo correo o contraseña para actualizar.' }, { status: 400 })
      }

      // Actualizar en Supabase Auth
      const { error: authErr } = await admin.auth.admin.updateUserById(cliente_id, updateData)
      if (authErr) throw authErr

      // Actualizar en tabla clientes y profiles
      if (updateData.email) {
        await admin.from('clientes').update({ email: updateData.email }).eq('id', cliente_id)
        await admin.from('profiles').update({ email: updateData.email }).eq('id', cliente_id)
      }

      resultadoAccion = `Credenciales actualizadas correctamente para la cuenta.`
    }

    // Actualizar estado de la notificación a APROBADO
    if (notificacion_id) {
      const { data: notif } = await admin.from('notificaciones').select('datos_extra').eq('id', notificacion_id).single()
      const extra = notif?.datos_extra || {}

      await admin.from('notificaciones').update({
        leido: true,
        datos_extra: {
          ...extra,
          estado_solicitud: 'APROBADO',
          fecha_aprobacion: new Date().toISOString(),
          resultado: resultadoAccion,
        },
      }).eq('id', notificacion_id)
    }

    return NextResponse.json({
      success: true,
      mensaje: resultadoAccion,
    })
  } catch (err: any) {
    console.error('Error aprobando recuperación:', err)
    return NextResponse.json({ error: err.message || 'Error al procesar la aprobación.' }, { status: 500 })
  }
}
