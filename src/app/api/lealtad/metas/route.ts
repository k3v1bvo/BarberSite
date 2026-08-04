import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from('lealtad_metas').select('*').order('orden', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ metas: data })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const body = await req.json()
  if (body.servicio_id && typeof body.servicio_id === 'string' && body.servicio_id.includes(',')) {
    body.servicio_id = body.servicio_id.split(',').filter(Boolean)[0] || null
  }
  const { data, error } = await supabase.from('lealtad_metas').insert([body]).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meta: data })
}

export async function PUT(req: Request) {
  const supabase = await createServerSupabaseClient()
  const body = await req.json()
  const { id, ...updates } = body
  if (updates.servicio_id && typeof updates.servicio_id === 'string' && updates.servicio_id.includes(',')) {
    updates.servicio_id = updates.servicio_id.split(',').filter(Boolean)[0] || null
  }
  const { data, error } = await supabase.from('lealtad_metas').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meta: data })
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  const { error } = await supabase.from('lealtad_metas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
