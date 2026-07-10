import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'

export async function POST(request: Request) {
  try {
    const adminClient = createAdminSupabaseClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Admin client error' }, { status: 500 })
    }

    const { email, full_name, password } = await request.json()

    if (!email || !full_name) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    await dispatchNotification(adminClient, {
      event: 'bienvenida_nuevo_usuario',
      userEmail: email,
      payload: {
        nombre: full_name,
        email: email,
        password: password || 'La contraseña que elegiste al registrarte',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
