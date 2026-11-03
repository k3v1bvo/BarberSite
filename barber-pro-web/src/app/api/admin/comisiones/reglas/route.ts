import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServerAdminClient } from '@/lib/supabase/server'
import { calcularComisionBarbero } from '@/lib/comisiones/calcular'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const adminSupabase = await createServerAdminClient()

    // 1. Escala por horas desde configuracion
    let horas_8 = 40
    let horas_10 = 45
    let horas_11 = 50

    const { data: configList } = await adminSupabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['comision_horas_8', 'comision_horas_10', 'comision_horas_11'])

    configList?.forEach(c => {
      if (c.clave === 'comision_horas_8' && Number(c.valor)) horas_8 = Number(c.valor)
      if (c.clave === 'comision_horas_10' && Number(c.valor)) horas_10 = Number(c.valor)
      if (c.clave === 'comision_horas_11' && Number(c.valor)) horas_11 = Number(c.valor)
    })

    // 2. Servicios especiales (Corte de niño, Baño de luna, Tintes, Diseño)
    const { data: serviciosRaw } = await adminSupabase
      .from('servicios')
      .select('id, nombre, precio, comision_tipo, comision_valor')

    const nombresEspeciales = ['corte de niño', 'baño  de  luna', 'baño de luna', 'tintes', 'diseño', 'diseno']
    const servicios_especiales = (serviciosRaw || []).filter(s => {
      const n = (s.nombre || '').toLowerCase().trim()
      return nombresEspeciales.some(esp => n.includes(esp) || esp.includes(n))
    })

    // 3. Barberos activos y sus porcentajes
    const { data: barberos } = await adminSupabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, comision_porcentaje')
      .in('role', ['barbero', 'coordinador'])
      .eq('is_active', true)
      .order('full_name')

    return NextResponse.json({
      escala_horas: {
        horas_8,
        horas_10,
        horas_11,
      },
      servicios_especiales,
      barberos: barberos || [],
    })
  } catch (err: any) {
    console.error('Error GET /api/admin/comisiones/reglas:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const adminSupabase = await createServerAdminClient()
    const body = await req.json()
    const { escala_horas, servicios_especiales, barberos, recalcular_pendientes = true } = body

    // 1. Guardar escala por horas en configuracion
    if (escala_horas) {
      const updates = [
        { clave: 'comision_horas_8', valor: String(Number(escala_horas.horas_8) || 40), descripcion: 'Porcentaje de comisión para turno de 8 horas' },
        { clave: 'comision_horas_10', valor: String(Number(escala_horas.horas_10) || 45), descripcion: 'Porcentaje de comisión para turno de 10 horas' },
        { clave: 'comision_horas_11', valor: String(Number(escala_horas.horas_11) || 50), descripcion: 'Porcentaje de comisión para turno de 11+ horas' },
      ]

      for (const item of updates) {
        await adminSupabase
          .from('configuracion')
          .upsert(item, { onConflict: 'clave' })
      }
    }

    // 2. Guardar reglas de servicios especiales en servicios
    if (servicios_especiales && Array.isArray(servicios_especiales)) {
      for (const s of servicios_especiales) {
        if (!s.id) continue
        await adminSupabase
          .from('servicios')
          .update({
            comision_tipo: s.comision_tipo || 'porcentaje',
            comision_valor: Number(s.comision_valor) || 0,
            comision_activa: true,
          })
          .eq('id', s.id)
      }
    }

    // 3. Guardar porcentajes individuales de barberos en profiles
    if (barberos && Array.isArray(barberos)) {
      for (const b of barberos) {
        if (!b.id || typeof b.comision_porcentaje !== 'number') continue
        await adminSupabase
          .from('profiles')
          .update({
            comision_porcentaje: b.comision_porcentaje,
          })
          .eq('id', b.id)
      }
    }

    // 4. Recalcular citas pendientes si se solicita (en paralelo, ultra rápido)
    let citasRecalculadas = 0
    if (recalcular_pendientes) {
      const { data: citasPendientes } = await adminSupabase
        .from('citas')
        .select('id, barbero_id, servicio_id, precio, propinas, fecha_hora, notas, servicios(nombre, precio, comision_tipo, comision_valor)')
        .eq('estado', 'completado')
        .eq('comision_pagada', false)
        .order('fecha_hora', { ascending: false })
        .limit(150)

      if (citasPendientes && citasPendientes.length > 0) {
        // Pre-cargar perfiles para evitar miles de queries en bucle
        const { data: profilesList } = await adminSupabase
          .from('profiles')
          .select('id, comision_porcentaje')
        const profileMap = new Map((profilesList || []).map(p => [p.id, p.comision_porcentaje]))

        const updates = citasPendientes.map(async (c) => {
          if (!c.barbero_id || !c.servicio_id) return
          const serv = c.servicios as any
          const servNombre = (serv?.nombre || '').toLowerCase()

          // 1. Fijo estricto
          if (
            (serv?.comision_tipo === 'fija' && (serv?.comision_valor === 20 || serv?.comision_valor === 32)) ||
            servNombre.includes('niño') ||
            servNombre.includes('nino') ||
            servNombre.includes('baño de luna') ||
            servNombre.includes('bano de luna')
          ) {
            const fijaMonto = serv?.comision_valor === 32 ? 32 : 20
            return adminSupabase.from('citas').update({ comision_barbero: fijaMonto }).eq('id', c.id)
          }

          // 2. Porcentajes protegidos o del perfil del barbero
          let pctAplicar = profileMap.get(c.barbero_id) ?? 45
          if (servNombre.includes('tinte')) {
            pctAplicar = 35
          } else if (servNombre.includes('diseño') || servNombre.includes('diseno')) {
            pctAplicar = 50
          }

          const precioCobrado = Number(c.precio) || 0
          const precioCatalogo = Number(serv?.precio) || precioCobrado

          // Detectar monto de descuento
          let descMonto = 0
          if (c.notas) {
            const matchDesc = c.notas.match(/Desc\.\s*Especial:\s*-?Bs\s*(\d+(?:\.\d+)?)/i)
            if (matchDesc) descMonto = Number(matchDesc[1]) || 0
          }
          if (descMonto === 0 && precioCatalogo > precioCobrado) {
            descMonto = precioCatalogo - precioCobrado
          }

          // REGLA CLAVE:
          // Si la barbería asume el descuento, la comisión se calcula sobre el precio de catálogo completo (50 Bs).
          let base = (precioCatalogo * pctAplicar) / 100

          if (c.notas && descMonto > 0) {
            if (/asume:\s*barbero/i.test(c.notas)) {
              base = Math.max(0, base - descMonto)
            } else if (/asume:\s*compartido/i.test(c.notas) || /50\/50/i.test(c.notas)) {
              base = Math.max(0, base - (descMonto / 2))
            }
            // Si es 'Asume: Barbería' → base se mantiene al 100% sobre el precio de catálogo
          } else if (precioCobrado === 0 && precioCatalogo > 0 && !c.notas?.includes('asume:')) {
            if (!c.notas?.includes('Barbería') && !c.notas?.includes('barberia')) {
              base = 0
            }
          }

          const propinaBarbero = (Number(c.propinas) || 0) * 0.5
          const comisionFinal = Math.round((base + propinaBarbero) * 100) / 100

          return adminSupabase.from('citas').update({ comision_barbero: comisionFinal }).eq('id', c.id)
        })

        await Promise.all(updates)
        citasRecalculadas = citasPendientes.length
      }
    }

    return NextResponse.json({
      success: true,
      mensaje: 'Reglas de comisiones actualizadas exitosamente',
      citas_recalculadas: citasRecalculadas,
    })
  } catch (err: any) {
    console.error('Error POST /api/admin/comisiones/reglas:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}

