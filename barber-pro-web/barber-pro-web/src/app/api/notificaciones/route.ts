import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const soloNoLeidas = searchParams.get('unread') === '1'
  const categoria = searchParams.get('categoria')

  let query = supabase
    .from('notificaciones')
    .select('*', { count: 'exact' })
    .or(`user_id.eq.${user.id},rol_destino.eq.${profile?.role || ''}`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (soloNoLeidas) query = query.eq('leido', false)
  if (categoria) query = query.eq('categoria', categoria)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    notificaciones: data || [],
    total: count ?? 0,
    unread: (data || []).filter((n) => !n.leido).length,
  })
}
