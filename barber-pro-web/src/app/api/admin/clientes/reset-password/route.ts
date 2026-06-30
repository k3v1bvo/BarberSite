import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { cliente_id } = await request.json()

    if (!cliente_id) {
      return NextResponse.json({ error: 'Cliente ID es requerido' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta (falta SERVICE_ROLE_KEY)' }, { status: 500 })
    }

    // Usamos el Service Role para saltar el RLS y poder llamar a auth.admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Obtenemos todos los datos posibles del cliente
    const { data: cliente, error: clientErr } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single()

    if (clientErr || !cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado en la base de datos' }, { status: 404 })
    }

    // Buscamos cuál es el ID de autenticación vinculado (puede llamarse auth_id o profile_id)
    const userIdToReset = cliente.auth_id || cliente.profile_id
    let emailToReset = cliente.correo || cliente.email

    // Si tenemos un userId, vamos a traer su email oficial de Supabase Auth
    if (userIdToReset) {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userIdToReset)
      if (!userErr && userData?.user?.email) {
        emailToReset = userData.user.email
      }
    }

    if (!emailToReset) {
      return NextResponse.json({ error: 'El cliente no tiene un correo electrónico ni una cuenta vinculada para restablecer la contraseña.' }, { status: 400 })
    }

    // Disparamos el correo de restablecimiento
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://barber-site-livid.vercel.app'
    const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(emailToReset, {
      redirectTo: `${siteUrl}/actualizar-password`
    })

    if (resetErr) {
      console.error("Error al enviar reset:", resetErr)
      return NextResponse.json({ error: 'Error de Supabase: ' + resetErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Enlace enviado correctamente a ${emailToReset}` })
  } catch (error: any) {
    console.error('Error interno reseteando password:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
