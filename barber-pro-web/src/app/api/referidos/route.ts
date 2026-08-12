import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function getSupabase(cookieStore: ReturnType<typeof cookies> extends Promise<infer T> ? T : never) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )
}

export async function GET() {
  const cookieStore = await cookies()
  const supabase = getSupabase(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('referrals')
    .select(`
      *,
      recomendante:clientes!cliente_recomendante_id(id, nombre, ci, telefono),
      recomendado:clientes!cliente_recomendado_id(id, nombre, ci, telefono)
    `)
    .order('creado_en', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = getSupabase(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { cliente_recomendante_id, cliente_recomendado_id, monto_bono } = body

  if (!cliente_recomendante_id || !cliente_recomendado_id) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('referrals')
    .insert({
      cliente_recomendante_id,
      cliente_recomendado_id,
      monto_bono: monto_bono || 0,
      bono_otorgado: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies()
  const supabase = getSupabase(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { id, bono_otorgado, monto_bono } = body

  if (!id) return NextResponse.json({ error: 'Falta ID' }, { status: 400 })

  const updateData: Record<string, unknown> = {}
  if (typeof bono_otorgado === 'boolean') updateData.bono_otorgado = bono_otorgado
  if (typeof monto_bono === 'number') updateData.monto_bono = monto_bono

  const { data, error } = await supabase
    .from('referrals')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
