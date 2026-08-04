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

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const supabase = getSupabase(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const tabla = searchParams.get('tabla')
  const accion = searchParams.get('accion')
  const limit = parseInt(searchParams.get('limit') || '100')

  let query = supabase
    .from('audit_log')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(limit)

  if (tabla) query = query.eq('tabla_afectada', tabla)
  if (accion) query = query.eq('accion', accion)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
