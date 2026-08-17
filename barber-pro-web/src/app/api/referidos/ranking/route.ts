import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get('periodo') || 'mes' // 'mes' | 'historico'

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // ── 1. Top Embajadores (Recomendaciones) ──
    let referralsQuery = supabase
      .from('referrals')
      .select('id, cliente_recomendante_id, monto_bono, bono_otorgado, created_at, recomendante:clientes!cliente_recomendante_id(id, nombre, email, telefono, nivel_fidelidad, total_visitas)')

    if (periodo === 'mes') {
      referralsQuery = referralsQuery.gte('created_at', startOfMonth)
    }

    const { data: rawReferrals } = await referralsQuery

    // Agrupar por recomendante
    const embajadoresMap: Record<string, {
      cliente_id: string
      nombre: string
      email: string
      telefono: string
      nivel_fidelidad: string
      total_amigos_invitados: number
      amigos_convertidos: number
      bonos_ganados: number
    }> = {}

    if (rawReferrals) {
      rawReferrals.forEach((r: any) => {
        const id = r.cliente_recomendante_id
        if (!id) return
        if (!embajadoresMap[id]) {
          embajadoresMap[id] = {
            cliente_id: id,
            nombre: r.recomendante?.nombre || 'Cliente',
            email: r.recomendante?.email || '',
            telefono: r.recomendante?.telefono || '',
            nivel_fidelidad: r.recomendante?.nivel_fidelidad || 'BRONCE',
            total_amigos_invitados: 0,
            amigos_convertidos: 0,
            bonos_ganados: 0,
          }
        }
        embajadoresMap[id].total_amigos_invitados += 1
        if (r.bono_otorgado) {
          embajadoresMap[id].amigos_convertidos += 1
          embajadoresMap[id].bonos_ganados += (Number(r.monto_bono) || 15)
        }
      })
    }

    const topEmbajadores = Object.values(embajadoresMap)
      .sort((a, b) => (b.amigos_convertidos - a.amigos_convertidos) || (b.total_amigos_invitados - a.total_amigos_invitados))
      .slice(0, 20)

    // ── 2. Top Clientes Frecuentes / VIP (Más servicios / cortes) ──
    let topClientesFrecuentes: any[] = []

    if (periodo === 'mes') {
      // Citas completadas este mes
      const { data: citasMes } = await supabase
        .from('citas')
        .select('cliente_id, precio, cliente:clientes(id, nombre, email, telefono, nivel_fidelidad)')
        .eq('estado', 'completado')
        .gte('fecha_hora', startOfMonth)

      const frecuentesMesMap: Record<string, any> = {}
      if (citasMes) {
        citasMes.forEach((c: any) => {
          const id = c.cliente_id
          if (!id) return
          if (!frecuentesMesMap[id]) {
            frecuentesMesMap[id] = {
              cliente_id: id,
              nombre: c.cliente?.nombre || 'Cliente',
              email: c.cliente?.email || '',
              telefono: c.cliente?.telefono || '',
              nivel_fidelidad: c.cliente?.nivel_fidelidad || 'BRONCE',
              total_visitas: 0,
              total_gastado: 0,
            }
          }
          frecuentesMesMap[id].total_visitas += 1
          frecuentesMesMap[id].total_gastado += Number(c.precio || 0)
        })
      }
      topClientesFrecuentes = Object.values(frecuentesMesMap)
        .sort((a: any, b: any) => b.total_visitas - a.total_visitas || b.total_gastado - a.total_gastado)
        .slice(0, 20)
    } else {
      // Histórico completo desde tabla clientes
      const { data: clientesHist } = await supabase
        .from('clientes')
        .select('id, nombre, email, telefono, nivel_fidelidad, total_visitas, total_gastado')
        .gt('total_visitas', 0)
        .order('total_visitas', { ascending: false })
        .order('total_gastado', { ascending: false })
        .limit(20)

      if (clientesHist) {
        topClientesFrecuentes = clientesHist.map(c => ({
          cliente_id: c.id,
          nombre: c.nombre || 'Cliente',
          email: c.email || '',
          telefono: c.telefono || '',
          nivel_fidelidad: c.nivel_fidelidad || 'BRONCE',
          total_visitas: c.total_visitas || 0,
          total_gastado: Number(c.total_gastado) || 0,
        }))
      }
    }

    return NextResponse.json({
      periodo,
      top_embajadores: topEmbajadores,
      top_frecuentes: topClientesFrecuentes,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
