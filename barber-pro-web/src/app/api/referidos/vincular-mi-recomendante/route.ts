import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const adminSupabase = createAdminSupabaseClient() || supabase

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { recomendante_id } = await request.json()
    if (!recomendante_id) {
      return NextResponse.json({ error: 'Debes seleccionar un recomendante' }, { status: 400 })
    }

    if (recomendante_id === user.id) {
      return NextResponse.json({ error: 'No puedes autoreferirte a ti mismo' }, { status: 400 })
    }

    // 1. Obtener datos del cliente actual
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, total_visitas, referido_por')
      .eq('id', user.id)
      .maybeSingle()

    if (cliente && (cliente.total_visitas > 0 || cliente.referido_por)) {
      return NextResponse.json({
        error: 'La opción de vincular un recomendante solo está disponible 1 sola vez en tu primera visita.'
      }, { status: 400 })
    }

    // 2. Verificar que el recomendante existe
    const { data: recData } = await supabase
      .from('clientes')
      .select('id, nombre')
      .eq('id', recomendante_id)
      .maybeSingle()

    if (!recData) {
      return NextResponse.json({ error: 'El recomendante seleccionado no fue encontrado' }, { status: 404 })
    }

    // 3. Actualizar cliente y registrar referral pendiente
    await adminSupabase
      .from('clientes')
      .update({ referido_por: recomendante_id })
      .eq('id', user.id)

    // Obtener monto del bono configurado
    const { data: confMonto } = await adminSupabase
      .from('configuraciones')
      .select('valor')
      .eq('llave', 'monto_bono_referido')
      .maybeSingle()

    const montoReferido = Number(confMonto?.valor?.monto || confMonto?.valor) || 10

    await adminSupabase.from('referrals').insert({
      cliente_recomendante_id: recomendante_id,
      cliente_recomendado_id: user.id,
      monto_bono: montoReferido,
      bono_otorgado: false // Se activará cuando se realice y pague el primer servicio en Caja POS
    })

    return NextResponse.json({
      success: true,
      recomendanteNombre: recData.nombre,
      message: `¡Recomendante ${recData.nombre} vinculado con éxito! Cuando realices tu primer corte en la barbería, tu recomendante recibirá sus Bs. 10 de premio.`
    })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
