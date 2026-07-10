import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'

export async function POST(request: Request) {
  try {
    const adminClient = createAdminSupabaseClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta (service role)' }, { status: 500 })
    }

    const body = await request.json()
    const { email, full_name, phone, ci, role, avatar_url } = body

    if (!email || !full_name) {
      return NextResponse.json({ error: 'Email y nombre son requeridos' }, { status: 400 })
    }

    // Crear el usuario directamente sin enviar email (usando createUser en vez de inviteUserByEmail)
    // Se asigna una contraseña genérica que el admin puede cambiar luego con el botón de la llave
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: 'barber123', // Contraseña genérica por defecto
      email_confirm: true,   // Esto evita que Supabase envíe correo de confirmación
      user_metadata: {
        full_name,
      },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 500 })
    }

    // Actualizar el perfil en la tabla profiles
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        role: role || 'barbero',
        phone: phone || null,
        ci: ci || null,
        avatar_url: avatar_url || null,
      })
      .eq('id', authData.user.id)

    if (profileError) {
      // Si falla la creación del perfil, podríamos borrar el usuario o simplemente retornar el error
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // Enviar correo de bienvenida al nuevo usuario (usa Nodemailer/Gmail)
    await dispatchNotification(adminClient, {
      event: 'bienvenida_nuevo_usuario',
      userEmail: email,
      payload: {
        nombre: full_name,
        email: email,
        password: 'barber123',
      },
    })

    return NextResponse.json({ success: true, user: authData.user })

  } catch (error: any) {
    console.error('Error al crear usuario:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const adminClient = createAdminSupabaseClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta (service role)' }, { status: 500 })
    }

    const { id, email } = await request.json()
    if (!id || !email) {
      return NextResponse.json({ error: 'ID y Email son requeridos para actualizar' }, { status: 400 })
    }

    const { error } = await adminClient.auth.admin.updateUserById(id, { email: email })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Actualizamos el email en la tabla perfiles para mantener consistencia
    await adminClient.from('profiles').update({ email: email }).eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error al actualizar correo:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
