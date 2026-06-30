import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const supabase = await createClient(cookies())
    
    // Verificar auth y rol
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const {
      cliente_recomendante_id,
      cliente_recomendante_nombre,
      nuevo_cliente_nombre,
      nuevo_cliente_telefono,
      nuevo_cliente_email,
      monto_bono
    } = await req.json()

    if (!cliente_recomendante_id || !nuevo_cliente_nombre) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // 1. Buscar si el amigo recomendado ya existe (por email o teléfono)
    let clienteRecomendadoId = null

    if (nuevo_cliente_email || nuevo_cliente_telefono) {
      const orQuery = []
      if (nuevo_cliente_email) orQuery.push(`email.eq.${nuevo_cliente_email}`)
      if (nuevo_cliente_telefono) orQuery.push(`telefono.eq.${nuevo_cliente_telefono}`)
      
      const { data: existingClient } = await supabase
        .from('clientes')
        .select('id')
        .or(orQuery.join(','))
        .limit(1)
        .maybeSingle()
        
      if (existingClient) {
        clienteRecomendadoId = existingClient.id
      }
    }

    // 2. Si no existe, crear el cliente
    if (!clienteRecomendadoId) {
      const { data: newClient, error: newClientError } = await supabase
        .from('clientes')
        .insert({
          nombre: nuevo_cliente_nombre,
          telefono: nuevo_cliente_telefono || null,
          email: nuevo_cliente_email || null,
          notas: `Registrado como referido de ${cliente_recomendante_nombre}`,
        })
        .select('id')
        .single()
        
      if (newClientError) throw newClientError
      clienteRecomendadoId = newClient.id
    }

    // 3. Crear el registro en la tabla referrals
    const { error: referralError } = await supabase
      .from('referrals')
      .insert({
        cliente_recomendante_id,
        cliente_recomendado_id: clienteRecomendadoId,
        monto_bono: monto_bono || 20,
        bono_otorgado: false
      })

    if (referralError) throw referralError

    // 4. Enviar notificación al nuevo amigo si tiene email
    if (nuevo_cliente_email) {
      await dispatchNotification(supabase, {
        event: 'invitacion_referido',
        payload: {
          clienteNombre: nuevo_cliente_nombre,
          acompananteNombre: cliente_recomendante_nombre, // Usamos acompananteNombre como el Recomendante en el template
          montoBono: monto_bono.toString()
        },
        userEmail: nuevo_cliente_email
      })
    }

    return NextResponse.json({ success: true })
    
  } catch (error: any) {
    console.error('Error en referrals route:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
