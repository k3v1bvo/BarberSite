import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const adminClient = createAdminSupabaseClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta (service role)' }, { status: 500 })
    }

    const { email, userId, newPassword } = await request.json()

    // 1. Si el admin envió una nueva contraseña directa para ese usuario
    if (userId && newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'La contraseña debe tener mínimo 6 caracteres' }, { status: 400 })
      }
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword
      })
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: 'Contraseña actualizada directamente' })
    }

    // 2. Si no, enviar enlace al correo
    if (!email) {
      return NextResponse.json({ error: 'Email o userId+newPassword requerido' }, { status: 400 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://barber-site-livid.vercel.app'
    const { error: resetErr } = await adminClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/actualizar-password`
    })

    if (resetErr) {
      console.error("Error al enviar reset:", resetErr)
      return NextResponse.json({ error: 'Error de Supabase: ' + resetErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: `Enlace enviado a ${email}` })
  } catch (error: any) {
    console.error('Error al restablecer password de usuario:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
