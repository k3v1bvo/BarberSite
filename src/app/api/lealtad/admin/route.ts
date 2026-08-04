import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { calcularNivelFidelidad } from '@/lib/lealtad/calcular-nivel'

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: clientes, error: clientesError } = await supabase
    .from('clientes')
    .select('*')
    .order('total_visitas', { ascending: false })
    .limit(50000)
  
  const { data: canjes, error: canjesError } = await supabase
    .from('lealtad_canjes')
    .select('*, clientes(nombre)')
    .order('canjeado_at', { ascending: false })
    .limit(500)

  if (clientesError || canjesError) {
    return NextResponse.json({ error: clientesError?.message || canjesError?.message }, { status: 500 })
  }

  return NextResponse.json({ clientes, canjes })
}

export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient()
  const body = await req.json()
  const { accion, cliente_id } = body

  if (!cliente_id) return NextResponse.json({ error: 'Cliente ID requerido' }, { status: 400 })

  if (accion === 'ajustar_visitas') {
    const { visitas_delta, visitas_total } = body
    
    // Si se manda visitas_total, se fija a ese valor
    if (typeof visitas_total === 'number') {
      const nuevoNivel = await calcularNivelFidelidad(supabase, visitas_total)
      const { error } = await supabase.from('clientes').update({ total_visitas: visitas_total, nivel_fidelidad: nuevoNivel }).eq('id', cliente_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // Si se manda delta, se suma o resta
    if (typeof visitas_delta === 'number') {
      const { data: cData } = await supabase.from('clientes').select('total_visitas').eq('id', cliente_id).single()
      const nuevoTotal = Math.max(0, (cData?.total_visitas || 0) + visitas_delta)
      const nuevoNivel = await calcularNivelFidelidad(supabase, nuevoTotal)
      const { error } = await supabase.from('clientes').update({ total_visitas: nuevoTotal, nivel_fidelidad: nuevoNivel }).eq('id', cliente_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: 'Falta visitas_delta o visitas_total' }, { status: 400 })
  }

  if (accion === 'otorgar_recompensa') {
    const { descripcion } = body
    if (!descripcion) return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 })
    
    const { error } = await supabase.from('lealtad_canjes').insert([{
      cliente_id,
      descripcion,
      estado: 'completado'
    }])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
