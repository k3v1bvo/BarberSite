import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { getBoliviaDayOfWeek } from '@/lib/asistencia/helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const db = getNotificationDbClient(supabase)
    const { searchParams } = new URL(request.url)
    const solo_activas = searchParams.get('activas') !== 'false'

    // Auto-purga de duplicados en la base de datos
    const { data: allRaw } = await db.from('promociones').select('*').order('created_at', { ascending: false })
    if (allRaw && allRaw.length > 1) {
      const seenKeys = new Set<string>()
      const idsToDelete: string[] = []

      for (const p of allRaw) {
        const is2x1 = p.tipo === '2x1' || p.icono === '✂️' || p.nombre?.toLowerCase().includes('2x1') || p.nombre?.toLowerCase().includes('2×1')
        const isRef = p.tipo === 'referido' || p.icono === '🤝' || p.nombre?.toLowerCase().includes('referid')
        const isCump = p.tipo === 'cumpleanos' || p.icono === '🎂' || p.nombre?.toLowerCase().includes('cumplea')

        let categoryKey = ''
        if (is2x1) categoryKey = 'BASE_2X1'
        else if (isRef) categoryKey = 'BASE_REFERIDOS'
        else if (isCump) categoryKey = 'BASE_CUMPLEANOS'
        else categoryKey = `CUSTOM_${(p.nombre || '').toLowerCase().trim()}`

        if (seenKeys.has(categoryKey)) {
          idsToDelete.push(p.id)
        } else {
          seenKeys.add(categoryKey)
        }
      }

      if (idsToDelete.length > 0) {
        await db.from('promociones').delete().in('id', idsToDelete)
      }
    }

    let query = db
      .from('promociones')
      .select('*')
      .order('created_at', { ascending: false })

    if (solo_activas) query = query.eq('activa', true)

    const { data, error } = await query
    if (error) {
      console.error('Error in GET /api/promociones:', error)
      return NextResponse.json({ error: error.message, promociones: [] }, { status: 200 })
    }

    if (searchParams.get('hoy') === 'true') {
      const diaSemana = getBoliviaDayOfWeek()
      const hoy = (data ?? []).filter((p: any) => {
        if (!p.dias_semana || p.dias_semana.length === 0) return true
        return p.dias_semana.includes(diaSemana)
      })
      return NextResponse.json({ promociones: hoy })
    }

    return NextResponse.json({ promociones: data ?? [] })
  } catch (err: any) {
    console.error('Catch error in GET /api/promociones:', err)
    return NextResponse.json({ error: err?.message || 'Error interno', promociones: [] }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const db = getNotificationDbClient(supabase)
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos de administrador' }, { status: 403 })
    }

    const body = await request.json()
    const { nombre, descripcion, tipo, valor, dias_semana, servicio_id, nivel_requerido, activa, icono, color, fecha_inicio, fecha_fin } = body

    if (!nombre || !tipo) {
      return NextResponse.json({ error: 'Nombre y tipo son requeridos' }, { status: 400 })
    }

    const primaryServicioUuid = servicio_id ? String(servicio_id).split(',').filter(Boolean)[0] || null : null

    const { data, error } = await db
      .from('promociones')
      .insert({
        nombre,
        descripcion: descripcion || '',
        tipo,
        valor: valor ?? 0,
        dias_semana: dias_semana ?? [],
        servicio_id: primaryServicioUuid,
        nivel_requerido: nivel_requerido || null,
        activa: activa ?? true,
        icono: icono || '🎁',
        color: color || 'amber',
        fecha_inicio: fecha_inicio || null,
        fecha_fin: fecha_fin || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error interno al crear promoción' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const db = getNotificationDbClient(supabase)
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos de administrador' }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'ID de promoción requerido' }, { status: 400 })

    if ('servicio_id' in updates) {
      updates.servicio_id = updates.servicio_id ? String(updates.servicio_id).split(',').filter(Boolean)[0] || null : null
    }

    const { data, error } = await db.from('promociones').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error interno al actualizar promoción' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const db = getNotificationDbClient(supabase)
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos de administrador' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const { error } = await db.from('promociones').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error interno al eliminar promoción' }, { status: 500 })
  }
}
