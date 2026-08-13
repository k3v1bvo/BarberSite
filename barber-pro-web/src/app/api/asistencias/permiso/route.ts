import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationDbClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { barbero_id, fecha, comprobante_url, notas, tipo_permiso, duracion } = body

    if (!barbero_id || !fecha) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
    }

    const tipoLabel = 
      tipo_permiso === 'jornada_completa' ? 'Jornada Completa' :
      tipo_permiso === 'horas' ? `Permiso Parcial (${duracion || 3} horas)` :
      tipo_permiso === 'emergencia' ? 'Salida de Emergencia' :
      tipo_permiso === 'enfermedad_grave' ? `Enfermedad Grave (${duracion || 2} días)` :
      tipo_permiso === 'otro' ? `Otro Motivo (${duracion || ''})` : 'Permiso General'

    // Insertar asistencia con estado "permiso"
    const notaFinal = `PERMISO JUSTIFICADO [${tipoLabel}]: ${notas ?? ''} ${comprobante_url ? `[COMPROBANTE](${comprobante_url})` : ''}`

    const adminDb = getNotificationDbClient(supabase)

    const { data, error } = await adminDb
      .from('asistencias')
      .insert({
        profile_id: barbero_id,
        fecha: fecha,
        estado: 'permiso',
        notas: notaFinal.trim(),
        selfie_url: comprobante_url || null,
        editado_admin: true,
      })
      .select()
      .single()

    if (error) {
      // Si ya existe un registro para esa fecha, intentamos hacer update
      const { data: upData, error: upError } = await adminDb
        .from('asistencias')
        .update({
          estado: 'permiso',
          notas: notaFinal.trim(),
          selfie_url: comprobante_url || null,
          editado_admin: true,
        })
        .eq('profile_id', barbero_id)
        .eq('fecha', fecha)
        .select()
        .single()
        
      if (upError) {
        return NextResponse.json({ error: 'Error al registrar el permiso' }, { status: 500 })
      }
      
      // Eliminar sanciones si existían para esa fecha
      await adminDb.from('sanciones').delete().eq('barbero_id', barbero_id).eq('fecha', fecha)
      
      return NextResponse.json({ success: true, registro: upData })
    }

    // Eliminar sanciones si existían para esa fecha
    await adminDb.from('sanciones').delete().eq('barbero_id', barbero_id).eq('fecha', fecha)

    return NextResponse.json({ success: true, registro: data })
  } catch (err) {
    console.error('POST asistencias/permiso:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
