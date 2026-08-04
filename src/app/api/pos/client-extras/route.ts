import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('cliente_id')
    const clienteNombre = searchParams.get('nombre') || ''
    const clienteEmail = searchParams.get('email') || ''
    const clienteCi = searchParams.get('ci') || ''

    if (!clienteId && !clienteNombre) {
      return NextResponse.json({ error: 'Falta cliente_id o nombre' }, { status: 400 })
    }

    const hoyStr = new Date().toISOString().split('T')[0]

    // 1. Bonos de Referidos ganados por este cliente y aún no usados
    let referralBonuses: any[] = []
    if (clienteId) {
      const { data: refs } = await supabase
        .from('referrals')
        .select('id, monto_bono, bono_otorgado, bono_usado, creado_en, recomendado:clientes!cliente_recomendado_id(nombre)')
        .eq('cliente_recomendante_id', clienteId)
        .eq('bono_otorgado', true)
        .or('bono_usado.is.null,bono_usado.eq.false')

      referralBonuses = refs || []
    }

    // 2. ¿Tiene verificación de cumpleaños reciente (ej. los últimos 30 días)?
    let cumpleanosVerificado: any = null
    if (clienteId) {
      const hoy = new Date()
      const { data: verif } = await supabase
        .from('cumpleanos_verificados')
        .select('*, promo:promociones(id, nombre, tipo, valor)')
        .eq('cliente_id', clienteId)
        .order('fecha_verificacion', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (verif && verif.fecha_verificacion) {
        const verifDate = new Date(verif.fecha_verificacion)
        const diffInDays = Math.abs((hoy.getTime() - verifDate.getTime()) / (1000 * 3600 * 24))
        if (diffInDays <= 30) {
          cumpleanosVerificado = verif
        }
      }
    }

    // 3. ¿Es la pareja pendiente de un 2x1 registrado hoy?
    // Buscamos en las citas de hoy (o notas) si alguien registró a este cliente en acompañante_2x1
    let pareja2x1Pendiente: any = null
    const { data: citasHoy } = await supabase
      .from('citas')
      .select('id, cliente_id, fecha_hora, notas, descuento, clientes(nombre, telefono, email)')
      .gte('fecha_hora', `${hoyStr}T00:00:00`)
      .lte('fecha_hora', `${hoyStr}T23:59:59`)
      .ilike('notas', '%[PROMO 2x1]%')

    if (citasHoy && citasHoy.length > 0) {
      for (const c of citasHoy) {
        if (c.cliente_id === clienteId) continue

        const notasLower = (c.notas || '').toLowerCase()
        const matchNombre = clienteNombre && clienteNombre.trim().length >= 3 && notasLower.includes(clienteNombre.trim().toLowerCase())
        const matchEmail = clienteEmail && clienteEmail.trim().length >= 5 && notasLower.includes(clienteEmail.trim().toLowerCase())
        const matchCi = clienteCi && clienteCi.trim().length >= 4 && notasLower.includes(clienteCi.trim().toLowerCase())

        if (matchNombre || matchEmail || matchCi) {
          pareja2x1Pendiente = {
            cita_origen_id: c.id,
            principal_nombre: (c.clientes as any)?.nombre || 'Amigo/Pareja',
            notas: c.notas
          }
          break
        }
      }
    }

    return NextResponse.json({
      referralBonuses,
      cumpleanosVerificado,
      pareja2x1Pendiente
    })
  } catch (err: any) {
    console.error('Error en GET /api/pos/client-extras:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
