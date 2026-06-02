import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isValidImageUrl, isValidUUID } from '@/lib/validators'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Admin ve todos (incluidos inactivos), público solo activos
  let query = supabase.from('equipo_home').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false })

  if (!user) {
    query = query.eq('is_active', true)
  } else {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      query = query.eq('is_active', true)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const body = await req.json()
  const nombre = String(body.nombre || '').trim()
  const especialidad = String(body.especialidad || '').trim()
  const imagen_url = String(body.imagen_url || '').trim()

  if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  if (!especialidad) return NextResponse.json({ error: 'Especialidad requerida' }, { status: 400 })
  if (!imagen_url || !isValidImageUrl(imagen_url)) {
    return NextResponse.json({ error: 'URL de imagen inválida' }, { status: 400 })
  }

  const payload = {
    nombre: nombre.slice(0, 100),
    especialidad: especialidad.slice(0, 100),
    descripcion: String(body.descripcion || '').trim().slice(0, 500) || null,
    imagen_url,
    redes_sociales: body.redes_sociales || {},
    sort_order: Number.isInteger(Number(body.sort_order)) ? Number(body.sort_order) : 0,
    is_active: body.is_active !== false,
  }

  const { data, error } = await supabase.from('equipo_home').insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const body = await req.json()
  const id = String(body.id || '')
  if (!id || !isValidUUID(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.nombre !== undefined) updates.nombre = String(body.nombre).trim().slice(0, 100)
  if (body.especialidad !== undefined) updates.especialidad = String(body.especialidad).trim().slice(0, 100)
  if (body.descripcion !== undefined) updates.descripcion = String(body.descripcion || '').trim().slice(0, 500) || null
  if (body.imagen_url !== undefined) {
    if (!isValidImageUrl(String(body.imagen_url))) {
      return NextResponse.json({ error: 'URL de imagen inválida' }, { status: 400 })
    }
    updates.imagen_url = body.imagen_url
  }
  if (body.redes_sociales !== undefined) updates.redes_sociales = body.redes_sociales
  if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order) || 0
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active)

  const { data, error } = await supabase.from('equipo_home').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id || !isValidUUID(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const { error } = await supabase.from('equipo_home').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
