import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function PUT(request: Request) {
  try {
    // 1. Verificar que el usuario está autenticado
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set() {},
          remove() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Leer los datos del body
    const body = await request.json()
    const { full_name, phone, ci, avatar_url, qr_code_url } = body

    // 3. Usar admin client para bypass RLS
    const adminClient = createAdminSupabaseClient()
    const db = adminClient || supabase

    // 4. Actualizar profiles
    const updatePayload: Record<string, any> = {}
    if (full_name !== undefined) updatePayload.full_name = full_name
    if (phone !== undefined) updatePayload.phone = phone
    if (ci !== undefined) updatePayload.ci = ci
    if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url
    if (qr_code_url !== undefined) updatePayload.qr_code_url = qr_code_url

    const { error: profileError } = await db
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id)

    if (profileError) {
      console.error('Error actualizando perfil:', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // 5. También sincronizar nombre, teléfono y CI en la tabla clientes (si existe)
    const clienteUpdate: Record<string, any> = {}
    if (full_name !== undefined) clienteUpdate.nombre = full_name
    if (phone !== undefined) clienteUpdate.telefono = phone
    if (ci !== undefined) clienteUpdate.ci = ci

    if (Object.keys(clienteUpdate).length > 0) {
      await db
        .from('clientes')
        .update(clienteUpdate)
        .eq('id', user.id)
        // Ignorar error si el usuario no tiene registro en clientes (ej: barbero sin registro de cliente)
    }

    return NextResponse.json({ success: true, message: 'Perfil actualizado correctamente' })
  } catch (error: any) {
    console.error('Error en API perfil/update:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
