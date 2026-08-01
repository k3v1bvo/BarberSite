import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendNotificationEmail } from '@/lib/notifications/email'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso solo para administradores' }, { status: 403 })
    }

    const { asunto, mensaje, link, audiencia, customEmail } = await request.json()

    if (!asunto || !mensaje) {
      return NextResponse.json({ error: 'Asunto y mensaje son requeridos' }, { status: 400 })
    }

    let targetEmails: { email: string; nombre: string }[] = []

    if (customEmail) {
      targetEmails = [{ email: customEmail.trim(), nombre: 'Cliente de Prueba' }]
    } else {
      let query = supabase.from('clientes').select('nombre, email, nivel_fidelidad, updated_at')

      if (audiencia === 'vip') {
        query = query.in('nivel_fidelidad', ['ORO', 'PLATA'])
      }

      const { data: clientesData } = await query

      if (clientesData) {
        targetEmails = clientesData
          .filter(c => c.email && c.email.includes('@'))
          .map(c => ({ email: c.email.trim(), nombre: c.nombre || 'Estimado Cliente' }))
      }
    }

    if (targetEmails.length === 0) {
      return NextResponse.json({ error: 'No se encontraron destinatarios válidos para esta audiencia.' }, { status: 400 })
    }

    let enviados = 0
    let errores = 0

    for (const target of targetEmails) {
      try {
        const res = await sendNotificationEmail(target.email, 'promocion_masiva', {
          nombre: target.nombre,
          asuntoCustom: asunto,
          mensajeCustom: mensaje,
          link: link || undefined
        })
        if (res.ok) enviados++
        else errores++
      } catch (e) {
        errores++
      }
    }

    return NextResponse.json({
      success: true,
      enviados,
      errores,
      total: targetEmails.length,
      message: `Enviados ${enviados} correos exitosamente (Errores: ${errores}).`
    })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
