import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // 1. Perfil del usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', user.id)
      .single()

    // 2. Datos del cliente (tabla clientes) vinculado por email
    let { data: cliente } = await supabase
      .from('clientes')
      .select('id, nombre, cumpleanos, total_visitas, total_gastado, nivel_fidelidad, ultima_visita, ci, referral_code, codigo_tarjeta, numero_cliente')
      .eq('email', user.email)
      .maybeSingle()

    // Si no se encontró por email, intentar buscar por id = user.id
    if (!cliente) {
      const { data: cById } = await supabase
        .from('clientes')
        .select('id, nombre, cumpleanos, total_visitas, total_gastado, nivel_fidelidad, ultima_visita, ci, referral_code, codigo_tarjeta, numero_cliente')
        .eq('id', user.id)
        .maybeSingle()
      cliente = cById
    }

    // Auto-generar y guardar permanentemente referral_code y codigo_tarjeta en la BD si faltan
    if (cliente && (!cliente.referral_code || !cliente.codigo_tarjeta)) {
      const numPart = cliente.numero_cliente 
        ? cliente.numero_cliente.toString().padStart(4, '0').slice(-4) 
        : cliente.ci 
          ? cliente.ci.replace(/\D/g, '').slice(-4) 
          : cliente.id.replace(/-/g, '').slice(-4).toUpperCase()
      
      const generatedCode = cliente.referral_code || cliente.codigo_tarjeta || `REF-${numPart}`
      const updatesToDb: any = {}
      if (!cliente.referral_code) updatesToDb.referral_code = generatedCode
      if (!cliente.codigo_tarjeta) updatesToDb.codigo_tarjeta = generatedCode

      await supabase.from('clientes').update(updatesToDb).eq('id', cliente.id)
      cliente.referral_code = cliente.referral_code || generatedCode
      cliente.codigo_tarjeta = cliente.codigo_tarjeta || generatedCode
    }

    // 3. Calcular si HOY es su cumpleaños
    let esCumpleanos = false
    let diasParaCumple: number | null = null
    if (cliente?.cumpleanos) {
      const hoy = new Date()
      const cumple = new Date(cliente.cumpleanos)
      const cumpleEsteAnio = new Date(hoy.getFullYear(), cumple.getMonth(), cumple.getDate())
      esCumpleanos = cumpleEsteAnio.getMonth() === hoy.getMonth() && cumpleEsteAnio.getDate() === hoy.getDate()
      if (!esCumpleanos) {
        // Próximo cumpleaños
        if (cumpleEsteAnio < hoy) cumpleEsteAnio.setFullYear(hoy.getFullYear() + 1)
        diasParaCumple = Math.ceil((cumpleEsteAnio.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
      }
    }

    // 4. Verificación de cumpleaños (dentro de los últimos 30 días o este año)
    let cumpleVerificado = false
    if (cliente?.id) {
      const { data: verif } = await supabase
        .from('cumpleanos_verificados')
        .select('fecha_verificacion')
        .eq('cliente_id', cliente.id)
        .order('fecha_verificacion', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (verif?.fecha_verificacion) {
        const diffDays = Math.abs((new Date().getTime() - new Date(verif.fecha_verificacion).getTime()) / (1000 * 3600 * 24))
        if (diffDays <= 30) cumpleVerificado = true
      }
    }

    // 5. Metas de lealtad (próxima meta a alcanzar)
    const visitas = cliente?.total_visitas ?? 0
    const { data: metas } = await supabase
      .from('lealtad_metas')
      .select('*')
      .eq('is_active', true)
      .order('visitas_requeridas', { ascending: true })

    const proximaMeta = metas?.find(m => m.visitas_requeridas > visitas) ?? null
    const metasAlcanzadas = metas?.filter(m => m.visitas_requeridas <= visitas) ?? []

    // 6. Últimos canjes
    const { data: canjes } = await supabase
      .from('lealtad_canjes')
      .select('id, descripcion, canjeado_at, meta_id')
      .eq('cliente_id', cliente?.id ?? '')
      .order('canjeado_at', { ascending: false })
      .limit(5)

    // 7. Promociones activas HOY
    const diaSemana = new Date().getDay()
    const { data: todasPromos } = await supabase
      .from('promociones')
      .select('*')
      .eq('activa', true)

    const promosHoy = (todasPromos ?? []).filter((p: any) => {
      // Promo de cumpleaños: solo si es su cumpleaños y está verificado
      if (p.tipo === 'cumpleanos') return esCumpleanos && cumpleVerificado
      // Promo por nivel de lealtad
      if (p.tipo === 'nivel_lealtad') {
        const nivelCliente = cliente?.nivel_fidelidad ?? 'BRONCE'
        const niveles = ['BRONCE', 'PLATA', 'ORO']
        return !p.nivel_requerido || niveles.indexOf(nivelCliente) >= niveles.indexOf(p.nivel_requerido)
      }
      // Promo por día
      if (!p.dias_semana || p.dias_semana.length === 0) return true
      return p.dias_semana.includes(diaSemana)
    })

    // 8. Últimas citas
    const { data: ultimasCitas } = await supabase
      .from('citas')
      .select('id, fecha_hora, precio, estado, servicios(nombre)')
      .eq('cliente_id', user.id)
      .eq('estado', 'completado')
      .order('fecha_hora', { ascending: false })
      .limit(3)
    // 9. Referidos
    let misReferidos: any[] = []
    if (cliente?.id) {
      const { data: refs } = await supabase
        .from('referrals')
        .select(`
          id, monto_bono, bono_otorgado, bono_usado, creado_en,
          recomendado:clientes!cliente_recomendado_id(nombre)
        `)
        .eq('cliente_recomendante_id', cliente.id)
        .order('creado_en', { ascending: false })
      misReferidos = refs || []
    }

    return NextResponse.json({
      profile,
      cliente,
      esCumpleanos,
      cumpleVerificado,
      diasParaCumple,
      metas: metas ?? [],
      proximaMeta,
      metasAlcanzadas,
      canjes: canjes ?? [],
      promosHoy,
      promocionesActivas: todasPromos ?? [],
      ultimasCitas: ultimasCitas ?? [],
      misReferidos,
    })
  } catch (err) {
    console.error('Error cliente-card:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
