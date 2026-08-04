import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ resultados: [] })
    }

    const { data: { user } } = await supabase.auth.getUser()

    let query = supabase
      .from('clientes')
      .select('id, nombre, ci, telefono, email, referral_code, codigo_tarjeta')
      .or(`nombre.ilike.%${q}%,ci.ilike.%${q}%,telefono.ilike.%${q}%,referral_code.ilike.%${q}%,codigo_tarjeta.ilike.%${q}%`)
      .limit(8)

    if (user) {
      query = query.neq('id', user.id) // Excluirse a sí mismo
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ resultados: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
