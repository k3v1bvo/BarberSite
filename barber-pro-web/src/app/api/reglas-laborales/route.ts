import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// ─── GET: todos los datos para el panel de reglas laborales ───
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const [serviciosRes, barberosRes, planRes, configRes] = await Promise.all([
      supabase.from('servicios').select('id,nombre,precio,comision_activa,comision_tipo,comision_valor,comision_acumulable,comision_notas,is_active').order('nombre'),
      supabase.from('profiles').select('id,full_name,role,is_active').in('role', ['barbero', 'coordinador']).order('full_name'),
      supabase.from('plan_cuentas').select('*').order('codigo'),
      supabase.from('configuraciones').select('llave,valor,descripcion').in('llave', ['bonos_config']),
    ])

    return NextResponse.json({
      servicios: serviciosRes.data ?? [],
      barberos: barberosRes.data ?? [],
      plan_cuentas: planRes.data ?? [],
      configuraciones: configRes.data ?? [],
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ─── PATCH: actualizar una regla específica ───
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { accion, ...payload } = body

    // ── Actualizar comisión de un servicio ──
    if (accion === 'update_servicio_comision') {
      const { servicio_id, comision_activa, comision_tipo, comision_valor, comision_acumulable, comision_notas } = payload
      const { error } = await supabase.from('servicios').update({ comision_activa, comision_tipo, comision_valor, comision_acumulable, comision_notas }).eq('id', servicio_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }


    // ── Crear/editar cuenta en plan_cuentas (sanciones) ──
    if (accion === 'upsert_plan_cuenta') {
      const { id, codigo, detalle, tipo, nivel, es_sancion } = payload
      if (id) {
        const { error } = await supabase.from('plan_cuentas').update({ codigo, detalle, tipo, nivel, es_sancion }).eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        const { error } = await supabase.from('plan_cuentas').insert({ codigo, detalle, tipo, nivel: nivel ?? 1, es_sancion: es_sancion ?? false })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    // ── Eliminar cuenta contable (sanción) ──
    if (accion === 'delete_plan_cuenta') {
      const { id } = payload
      const { error } = await supabase.from('plan_cuentas').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── Guardar config de bonos (montos sugeridos y descripciones por tipo) ──
    if (accion === 'update_bonos_config') {
      const { valor } = payload
      const { error } = await supabase.from('configuraciones').upsert({ llave: 'bonos_config', valor, descripcion: 'Configuración de tipos y montos sugeridos de bonos' }, { onConflict: 'llave' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }



    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
