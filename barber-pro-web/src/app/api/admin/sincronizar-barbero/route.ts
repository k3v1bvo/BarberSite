import { createServerSupabaseClient } from '@/lib/supabase/server'
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

    // El patrón busca cualquier cita donde la nota contenga Op: NOMBRE_ANTIGUO
    const searchPattern = `%Op: ${nombre_antiguo.trim()}%`

    // Consultamos las citas que corresponden a este operario
    const { data: citasToUpdate, error: searchError } = await supabase
      .from('citas')
      .select('id')
      .is('barbero_id', null)
      .ilike('notas', searchPattern)
      .range(0, 9999)

    if (searchError) throw searchError

    if (!citasToUpdate || citasToUpdate.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: `No se encontraron citas pendientes para "${nombre_antiguo}".`,
        count: 0 
      })
    }

    const idsToUpdate = citasToUpdate.map(c => c.id)

    // Actualizamos masivamente
    const { error: updateError } = await supabase
      .from('citas')
      .update({ barbero_id: nuevo_barbero_id })
      .in('id', idsToUpdate)

    if (updateError) throw updateError

    return NextResponse.json({ 
      success: true, 
      message: `¡Se sincronizaron ${idsToUpdate.length} citas exitosamente!`,
      count: idsToUpdate.length
    })

  } catch (error: any) {
    console.error('Error al sincronizar barbero:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
