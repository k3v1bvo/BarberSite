import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const barbero_id = searchParams.get('barbero_id')

  let query = supabase.from('sanciones').select('*, barbero:profiles!sanciones_barbero_id_fkey(full_name)').order('creado_en', { ascending: false })

  if (barbero_id) {
    query = query.eq('barbero_id', barbero_id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sanciones: data })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { barbero_id, tipo, descripcion, monto } = await req.json()

  if (!barbero_id || !tipo || !monto) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase.from('sanciones').insert({
    barbero_id,
    tipo,
    descripcion,
    monto,
    estado: 'pendiente'
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { id, estado, monto, descripcion } = await req.json()

  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const updates: any = {}
  if (estado) updates.estado = estado
  if (monto) updates.monto = monto
  if (descripcion) updates.descripcion = descripcion

  const { data, error } = await supabase.from('sanciones').update(updates).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const { error } = await supabase.from('sanciones').delete().eq('id', id).eq('estado', 'pendiente')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
