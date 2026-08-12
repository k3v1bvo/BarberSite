import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check auth and permissions
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { nuevo_barbero_id, nombre_antiguo } = await request.json()

    if (!nuevo_barbero_id || !nombre_antiguo) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
    }

    const namePattern = nombre_antiguo.trim()
    const db = createAdminSupabaseClient() || supabase

    // Consultamos las citas que corresponden a este operario
    const { data: citasToUpdate, error: searchError } = await db
      .from('citas')
      .select('id')
      .is('barbero_id', null)
      .ilike('notas', `%${namePattern}%`)
      .range(0, 9999)

    if (searchError) {
      console.error('Error buscando citas:', searchError)
      throw searchError
    }

    if (!citasToUpdate || citasToUpdate.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: `No se encontraron citas pendientes para "${nombre_antiguo}".`,
        count: 0 
      })
    }

    const idsToUpdate = citasToUpdate.map(c => c.id)

    // Actualizamos masivamente en bloques de 500
    let updatedCount = 0
    const chunkSize = 500
    for (let i = 0; i < idsToUpdate.length; i += chunkSize) {
      const chunk = idsToUpdate.slice(i, i + chunkSize)
      const { error: updateError } = await db
        .from('citas')
        .update({ barbero_id: nuevo_barbero_id })
        .in('id', chunk)

      if (updateError) {
        console.error('Error actualizando citas chunk:', updateError)
        throw updateError
      }
      updatedCount += chunk.length
    }

    return NextResponse.json({ 
      success: true, 
      message: `¡Se sincronización exitosa! ${updatedCount} citas fueron vinculadas al barbero.`,
      count: updatedCount
    })

  } catch (error: any) {
    console.error('Error al sincronizar barbero:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
