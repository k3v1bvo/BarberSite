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
      const cleanEmail = customEmail.trim()
      let foundName = ''

      // 1. Buscar en profiles (Auth Users)
      const { data: pData } = await supabase
        .from('profiles')
        .select('full_name')
        .ilike('email', cleanEmail)
        .maybeSingle()

      if (pData?.full_name) {
        foundName = pData.full_name
      } else {
        // 2. Buscar en clientes
        const { data: cData } = await supabase
          .from('clientes')
          .select('nombre')
          .ilike('email', cleanEmail)
          .maybeSingle()

        if (cData?.nombre) foundName = cData.nombre
      }

      targetEmails = [{ email: cleanEmail, nombre: foundName || 'Estimado Cliente' }]
    } else {
      const [cRes, pRes] = await Promise.all([
        supabase.from('clientes').select('nombre, email, nivel_fidelidad'),
        supabase.from('profiles').select('full_name, email')
      ])

      const emailMap = new Map<string, string>()

      if (cRes.data) {
        cRes.data.forEach(c => {
          if (c.email && c.email.includes('@')) {
            const key = c.email.trim().toLowerCase()
            if (c.nombre && c.nombre !== 'Cliente') {
              emailMap.set(key, c.nombre.trim())
            }
          }
        })
      }

      if (pRes.data) {
        pRes.data.forEach(p => {
          if (p.email && p.email.includes('@')) {
            const key = p.email.trim().toLowerCase()
            if (p.full_name) {
              emailMap.set(key, p.full_name.trim())
            }
          }
        })
      }

      targetEmails = Array.from(emailMap.entries()).map(([email, nombre]) => ({
        email,
        nombre
      }))
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
