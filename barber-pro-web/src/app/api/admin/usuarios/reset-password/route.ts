import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const adminClient = createAdminSupabaseClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta (service role)' }, { status: 500 })
    }

    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email requerido para restablecer contraseña' }, { status: 400 })
    }

    const { error: resetErr } = await adminClient.auth.resetPasswordForEmail(email)

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
