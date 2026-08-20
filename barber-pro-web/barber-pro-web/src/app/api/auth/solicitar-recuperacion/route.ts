import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { identificador, nota } = await req.json()

    if (!identificador) {
      return NextResponse.json(
        { error: 'Debes proporcionar tu CI o Correo electrónico.' },
        { status: 400 }
      )
    }

    const admin = createAdminSupabaseClient()
    if (!admin) {
      return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
    }

    const cleanId = identificador.trim()

    // 1. Buscar en la tabla de clientes o perfiles por CI o Email
    let targetUser: any = null

    // Buscar por CI exacto
    const { data: clientByCi } = await admin
      .from('clientes')
      .select('id, nombre, email, ci, telefono')
      .eq('ci', cleanId)
      .single()

    if (clientByCi) {
      targetUser = clientByCi
    } else {
      // Buscar por Email exacto
      const { data: clientByEmail } = await admin
        .from('clientes')
        .select('id, nombre, email, ci, telefono')
        .ilike('email', cleanId)
        .single()

      if (clientByEmail) {
        targetUser = clientByEmail
      } else {
        // Buscar en profiles
        const { data: profileByEmail } = await admin
          .from('profiles')
          .select('id, full_name, email, ci, phone')
          .ilike('email', cleanId)
          .single()

        if (profileByEmail) {
          targetUser = {
            id: profileByEmail.id,
            nombre: profileByEmail.full_name,
            email: profileByEmail.email,
            ci: profileByEmail.ci,
            telefono: profileByEmail.phone,
          }
        }
      }
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: 'No encontramos ninguna cuenta vinculada con esa Cédula de Identidad o Correo electrónico.' },
        { status: 404 }
      )
    }

    // 2. Crear notificación para Administradores y Coordinadores
    const mensajeAlerta = `El usuario ${targetUser.nombre || 'Sin Nombre'} (CI: ${targetUser.ci || '—'}, Email: ${targetUser.email || '—'}) solicitó ayuda para recuperar su contraseña o acceso a su cuenta.${nota ? ` Nota del cliente: "${nota}"` : ''}`

    // Insertar alerta en la tabla de notificaciones para admin/coordinador
    await admin.from('notificaciones').insert({
      titulo: `⚠️ Solicitud de Recuperación de Cuenta: ${targetUser.nombre || 'Cliente'}`,
      mensaje: mensajeAlerta,
      tipo: 'SISTEMA',
      datos_extra: {
        tipo_solicitud: 'RECUPERACION_CUENTA',
        cliente_id: targetUser.id,
        nombre: targetUser.nombre,
        ci: targetUser.ci,
        email: targetUser.email,
        telefono: targetUser.telefono,
        nota: nota || null,
        fecha_solicitud: new Date().toISOString(),
        estado_solicitud: 'PENDIENTE',
      },
    })

    return NextResponse.json({
      success: true,
      mensaje: 'Solicitud registrada correctamente.',
      cliente: {
        nombre: targetUser.nombre,
        email: targetUser.email,
      },
    })
  } catch (err: any) {
    console.error('Error en solicitar-recuperacion:', err)
    return NextResponse.json({ error: err.message || 'Error inesperado' }, { status: 500 })
  }
}
