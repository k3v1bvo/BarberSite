import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(req.url)
    let clienteId = searchParams.get('cliente_id')

    if (!clienteId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        clienteId = user.id
      }
    }

    if (!clienteId) {
      return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })
    }

    // 1. Obtener datos del cliente
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nombre, email, telefono, ci, nivel_fidelidad, total_visitas, codigo_tarjeta')
      .eq('id', clienteId)
      .maybeSingle()

    // 2. Obtener lista de referidos
    let referralsList: any[] = []
    try {
      const { data: refs } = await supabase
        .from('referrals')
        .select('id, monto_bono, bono_otorgado, bono_usado, creado_en, created_at, recomendado:clientes!cliente_recomendado_id(id, nombre, email, total_visitas)')
        .eq('cliente_recomendante_id', clienteId)
        .order('created_at', { ascending: false })

      if (refs) referralsList = refs
    } catch (_) {}

    // 3. Calcular saldo y métricas
    const totalReferidos = referralsList.length
    const amigosAtendidos = referralsList.filter(r => r.bono_otorgado).length
    const saldoDisponible = referralsList
      .filter(r => r.bono_otorgado && !r.bono_usado)
      .reduce((sum, r) => sum + (Number(r.monto_bono) || 0), 0)
    const saldoHistoricoGanado = referralsList
      .filter(r => r.bono_otorgado)
      .reduce((sum, r) => sum + (Number(r.monto_bono) || 0), 0)

    // 4. Monto de bono configurado por defecto
    let montoBonoConfig = 10
    try {
      const { data: conf } = await supabase
        .from('configuraciones')
        .select('valor')
        .eq('llave', 'monto_bono_referido')
        .maybeSingle()
      if (conf?.valor) {
        const raw = conf.valor
        if (typeof raw === 'number') {
          montoBonoConfig = raw
        } else if (typeof raw === 'object' && raw !== null && (raw as any).monto !== undefined) {
          montoBonoConfig = Number((raw as any).monto) || 10
        } else {
          montoBonoConfig = Number(raw) || 10
        }
      }
    } catch (_) {}

    // Generar código de referido limpio
    const refCode = cliente?.ci || clienteId.slice(0, 8).toUpperCase()
    const referralLink = `https://barber-site-livid.vercel.app/reservar?ref=${clienteId}`

    return NextResponse.json({
      cliente_id: clienteId,
      cliente_nombre: cliente?.nombre || 'Cliente',
      referral_code: refCode,
      referral_link: referralLink,
      monto_bono_default: montoBonoConfig,
      saldo_disponible: saldoDisponible,
      saldo_historico_ganado: saldoHistoricoGanado,
      total_referidos: totalReferidos,
      amigos_atendidos: amigosAtendidos,
      historial: referralsList.map(r => ({
        id: r.id,
        amigo_nombre: r.recomendado?.nombre || 'Amigo',
        monto_bono: Number(r.monto_bono) || montoBonoConfig,
        bono_otorgado: !!r.bono_otorgado,
        bono_usado: !!r.bono_usado,
        fecha: r.created_at || r.creado_en || new Date().toISOString()
      }))
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
