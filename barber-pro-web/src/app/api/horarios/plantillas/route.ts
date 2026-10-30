import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServerAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const adminSupabase = await createServerAdminClient()
    const { data, error } = await adminSupabase
      .from('plantillas_horario')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plantillas: data || [] })
  } catch (err: any) {
    return NextResponse.json({ plantillas: [] })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const adminSupabase = await createServerAdminClient()

    const { data, error } = await adminSupabase
      .from('plantillas_horario')
      .insert([{
        nombre: body.nombre,
        tipo: body.tipo,
        hora_inicio: (body.hora_inicio || '09:00').slice(0, 5),
        hora_fin: (body.hora_fin || '20:00').slice(0, 5),
        descripcion: body.descripcion,
        is_active: body.is_active ?? true,
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plantilla: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const adminSupabase = await createServerAdminClient()

    const { data, error } = await adminSupabase
      .from('plantillas_horario')
      .update({
        nombre: body.nombre,
        tipo: body.tipo,
        hora_inicio: (body.hora_inicio || '09:00').slice(0, 5),
        hora_fin: (body.hora_fin || '20:00').slice(0, 5),
        descripcion: body.descripcion,
        is_active: body.is_active,
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plantilla: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const adminSupabase = await createServerAdminClient()
    const { error } = await adminSupabase
      .from('plantillas_horario')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}
