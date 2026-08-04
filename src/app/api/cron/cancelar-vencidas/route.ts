import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Asegurarnos de que el cron job está autorizado (puedes configurar un CRON_SECRET en Vercel)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    
    // Obtenemos la fecha actual al inicio del día (medianoche)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    
    // Buscar citas que estén antes de "hoy" y en estado pendiente/confirmado
    const { data: citasVencidas, error: searchError } = await supabase
      .from('citas')
      .select('id, fecha_hora, estado')
      .lt('fecha_hora', hoy.toISOString())
      .in('estado', ['pendiente', 'confirmado'])

    if (searchError) throw searchError

    if (!citasVencidas || citasVencidas.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay citas vencidas para cancelar', count: 0 })
    }

    // Extraemos los IDs de las citas vencidas
    const idsToCancel = citasVencidas.map(cita => cita.id)

    // Actualizamos el estado a 'no_presento'
    const { error: updateError } = await supabase
      .from('citas')
      .update({ estado: 'no_presento' })
      .in('id', idsToCancel)

    if (updateError) throw updateError

    return NextResponse.json({ 
      success: true, 
      message: `Se cancelaron ${idsToCancel.length} citas vencidas correctamente.`,
      count: idsToCancel.length,
      canceled_ids: idsToCancel
    })

  } catch (error: any) {
    console.error('Error al cancelar citas vencidas:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
