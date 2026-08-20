import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

// ── GET: Obtener todas las reseñas (Admin/Coordinador) o públicas ──────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { searchParams } = new URL(request.url)
    const soloPublicas = searchParams.get('publicas') === 'true'

    let query = supabase
      .from('reviews')
      .select(`
        *,
        cliente:profiles!reviews_cliente_id_fkey(full_name, email),
        barbero:profiles!reviews_barbero_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false })

    if (soloPublicas) {
      query = query.eq('is_public', true)
    }

    const { data, error } = await query
    if (error) {
      // Fallback si la relación de foreign key no tiene nombre exacto
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })
      if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 500 })
      return NextResponse.json(fallbackData ?? [])
    }

    return NextResponse.json(data ?? [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error interno' }, { status: 500 })
  }
}

// ── POST: Crear una reseña de un servicio (Cliente) ──────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión' }, { status: 401 })
    }

    const body = await request.json()
    const { cita_id, barbero_id, estrellas = 5, comentario = '' } = body

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        cliente_id: user.id,
        cita_id: cita_id || null,
        barbero_id: barbero_id || null,
        estrellas: Number(estrellas),
        comentario: (comentario || '').trim(),
        is_public: false, // Por defecto requiere moderación de Admin/Coordinador para aparecer en la home
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error interno' }, { status: 500 })
  }
}

// ── PATCH: Moderar reseña (Admin / Coordinador) -> hacer pública / ocultar ──
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos de moderación' }, { status: 403 })
    }

    const body = await request.json()
    const { id, is_public } = body
    if (!id) return NextResponse.json({ error: 'Falta ID de reseña' }, { status: 400 })

    const { data, error } = await supabase
      .from('reviews')
      .update({ is_public: !!is_public })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error interno' }, { status: 500 })
  }
}

// ── DELETE: Eliminar reseña (Admin / Coordinador) ─────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Falta ID' }, { status: 400 })

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error interno' }, { status: 500 })
  }
}
