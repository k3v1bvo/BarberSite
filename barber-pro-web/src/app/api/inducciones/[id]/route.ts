import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// PUT /api/inducciones/[id] — Editar inducción existente
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

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
      pasos
    } = body

    // 1. Actualizar cabecera
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    if (titulo !== undefined) updateData.titulo = titulo.trim()
    if (descripcion !== undefined) updateData.descripcion = descripcion ? descripcion.trim() : null
    if (categoria !== undefined) updateData.categoria = categoria || 'General'
    if (servicio_id !== undefined) updateData.servicio_id = servicio_id || null
    if (youtube_url !== undefined) updateData.youtube_url = youtube_url ? youtube_url.trim() : null
    if (pdf_url !== undefined) updateData.pdf_url = pdf_url ? pdf_url.trim() : null
    if (pdf_urls !== undefined) updateData.pdf_urls = Array.isArray(pdf_urls) ? pdf_urls : []
    if (herramientas_requeridas !== undefined) updateData.herramientas_requeridas = Array.isArray(herramientas_requeridas) ? herramientas_requeridas : []
    if (duracion_minutos !== undefined) updateData.duracion_minutos = Number(duracion_minutos) || 15
    if (is_published !== undefined) updateData.is_published = !!is_published
    if (nivel !== undefined) updateData.nivel = nivel || 'basico'
    if (dirigido_a !== undefined) updateData.dirigido_a = Array.isArray(dirigido_a) ? dirigido_a : ['todos']

    const { data: updatedInd, error: indErr } = await supabase
      .from('inducciones')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (indErr) {
      return NextResponse.json({ error: indErr.message }, { status: 500 })
    }

    // 2. Reemplazar Pasos si se envían
    if (Array.isArray(pasos)) {
      // Eliminar pasos viejos
      await supabase.from('induccion_pasos').delete().eq('induccion_id', id)

      if (pasos.length > 0) {
        const pasosPayload = pasos.map((p: any, index: number) => ({
          induccion_id: id,
          numero_paso: index + 1,
          titulo_paso: (p.titulo_paso || `Paso ${index + 1}`).trim(),
          descripcion: p.descripcion ? p.descripcion.trim() : null,
          timestamp_segundos: Number(p.timestamp_segundos) || 0
        }))

        await supabase.from('induccion_pasos').insert(pasosPayload)
      }
    }

    return NextResponse.json({ success: true, data: updatedInd })
  } catch (err: any) {
    console.error('Error PUT inducciones:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE /api/inducciones/[id] — Eliminar inducción
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const { error } = await supabase.from('inducciones').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error DELETE inducciones:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
