import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

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

    // Enviar invitación de usuario a través de auth.admin
    const { data: authData, error: authError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
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
