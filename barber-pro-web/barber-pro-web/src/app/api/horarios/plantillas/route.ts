import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('plantillas_horario')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ plantillas: data })
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('plantillas_horario')
    .insert([{
      nombre: body.nombre,
      tipo: body.tipo,
      hora_inicio: body.hora_inicio,
      hora_fin: body.hora_fin,
      descripcion: body.descripcion,
      is_active: body.is_active,
    }])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ plantilla: data })
}

export async function PUT(request: Request) {
  const supabase = await createServerSupabaseClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('plantillas_horario')
    .update({
      nombre: body.nombre,
      tipo: body.tipo,
      hora_inicio: body.hora_inicio,
      hora_fin: body.hora_fin,
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
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
  }

  const { error } = await supabase
    .from('plantillas_horario')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
