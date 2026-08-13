import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/inducciones — Listar inducciones
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'barbero'
    const sp = request.nextUrl.searchParams
    const targetBarberoId = sp.get('barbero_id')

    let query = supabase
      .from('inducciones')
      .select(`
        *,
        servicios (id, nombre, duracion_minutos, precio),
        induccion_pasos (*),
        induccion_asignaciones (barbero_id),
        induccion_progreso (barbero_id, fecha_completado, estado)
      `)
      .order('orden', { ascending: true })
      .order('created_at', { ascending: false })

    if (role === 'barbero') {
      // Barberos solo ven lo que está publicado
      query = query.eq('is_published', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching inducciones:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let finalData = data || []

    // Si el usuario es barbero o se pide un barbero específico, filtrar las asignaciones
    if (role === 'barbero') {
      const myBarberoId = profile?.id || user.id
      finalData = finalData.filter((item: any) => {
        const asig = item.induccion_asignaciones || []
        // Si no hay ninguna asignación específica creada en el sistema, o si está asignado a este barbero
        return asig.length === 0 || asig.some((a: any) => a.barbero_id === myBarberoId)
      })
    } else if (targetBarberoId) {
      finalData = finalData.filter((item: any) => {
        const asig = item.induccion_asignaciones || []
        return asig.length === 0 || asig.some((a: any) => a.barbero_id === targetBarberoId)
      })
    }

    // Ordenar pasos dentro de cada inducción
    finalData.forEach((item: any) => {
      if (item.induccion_pasos && Array.isArray(item.induccion_pasos)) {
        item.induccion_pasos.sort((a: any, b: any) => (a.numero_paso || 0) - (b.numero_paso || 0))
      }
    })

    return NextResponse.json(finalData)
  } catch (err: any) {
    console.error('Error GET inducciones:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/inducciones — Crear nueva inducción con pasos
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Solo administradores o coordinadores pueden crear inducciones' }, { status: 403 })
    }

    const body = await request.json()
    const {
      titulo,
      descripcion,
      categoria,
      servicio_id,
      youtube_url,
      pdf_url,
      pdf_urls,
      herramientas_requeridas,
      duracion_minutos,
      is_published,
      nivel,
      dirigido_a,
      pasos,
      asignaciones_barberos // Array de barbero_ids a asignar
    } = body

    if (!titulo) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
    }

    // 1. Insertar Inducción
    const { data: nuevaInd, error: indError } = await supabase
      .from('inducciones')
      .insert({
        titulo: titulo.trim(),
        descripcion: descripcion ? descripcion.trim() : null,
        categoria: categoria || 'General',
        servicio_id: servicio_id || null,
        youtube_url: youtube_url ? youtube_url.trim() : null,
        pdf_url: pdf_url ? pdf_url.trim() : null,
        pdf_urls: Array.isArray(pdf_urls) ? pdf_urls : (pdf_url ? [pdf_url.trim()] : []),
        herramientas_requeridas: Array.isArray(herramientas_requeridas) ? herramientas_requeridas : [],
        duracion_minutos: Number(duracion_minutos) || 15,
        is_published: is_published !== false,
        nivel: nivel || 'basico',
        dirigido_a: Array.isArray(dirigido_a) ? dirigido_a : ['todos'],
        creado_por: user.id
      })
      .select()
      .single()

    if (indError || !nuevaInd) {
      return NextResponse.json({ error: indError?.message || 'Error al crear inducción' }, { status: 500 })
    }

    const induccionId = nuevaInd.id

    // 2. Insertar Pasos
    if (Array.isArray(pasos) && pasos.length > 0) {
      const pasosPayload = pasos.map((p: any, index: number) => ({
        induccion_id: induccionId,
        numero_paso: index + 1,
        titulo_paso: (p.titulo_paso || `Paso ${index + 1}`).trim(),
        descripcion: p.descripcion ? p.descripcion.trim() : null,
        timestamp_segundos: Number(p.timestamp_segundos) || 0
      }))

      await supabase.from('induccion_pasos').insert(pasosPayload)
    }

    // 3. Asignaciones iniciales si vienen especificadas
    if (Array.isArray(asignaciones_barberos) && asignaciones_barberos.length > 0) {
      const asigPayload = asignaciones_barberos.map((bId: string) => ({
        induccion_id: induccionId,
        barbero_id: bId,
        asignado_por: user.id
      }))

      await supabase.from('induccion_asignaciones').insert(asigPayload)
    }

    return NextResponse.json({ success: true, data: nuevaInd }, { status: 201 })
  } catch (err: any) {
    console.error('Error POST inducciones:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
