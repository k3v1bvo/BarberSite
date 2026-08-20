import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET - Listar todas las categorías
// POST - Crear nueva categoría
// PATCH - Editar categoría
// DELETE - Desactivar categoría

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('comision_categorias')
      .select('*')
      .order('orden', { ascending: true })

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json()
    const { nombre, descripcion, requiere_herramientas, orden } = body

    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const { data, error } = await supabase
      .from('comision_categorias')
      .insert({
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        requiere_herramientas: requiere_herramientas ?? false,
        orden: orden ?? 0,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json()
    const { id, nombre, descripcion, requiere_herramientas, orden, is_active } = body

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (nombre !== undefined) updates.nombre = nombre.trim()
    if (descripcion !== undefined) updates.descripcion = descripcion?.trim() || null
    if (requiere_herramientas !== undefined) updates.requiere_herramientas = requiere_herramientas
    if (orden !== undefined) updates.orden = orden
    if (is_active !== undefined) updates.is_active = is_active

    const { data, error } = await supabase
      .from('comision_categorias')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    // Soft delete: desactivar
    const { error } = await supabase
      .from('comision_categorias')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
