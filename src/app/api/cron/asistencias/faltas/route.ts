import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getBusinessDateString, getBusinessNow } from '@/lib/asistencia/helpers'

/** 
 * Este endpoint está diseñado para ejecutarse al final del día (ej. 23:00).
 * Busca a todos los barberos que tenían turno hoy, y si no tienen registro 
 * en "asistencias" (ni entrada, ni permiso), les clava la falta injustificada.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Auth check for cron jobs if needed (optional if you secure via headers or Vercel Cron Secret)
    // For manual triggering by admin, we can check auth.
    // Si queremos que sea invocable por un cron externo sin auth, podemos omitir este check
    // o protegerlo con un secreto en el header.
    
    const hoy = getBusinessDateString()
    const now = getBusinessNow()
    const dayOfWeek = now.getUTCDay() // 0 = Domingo, 1 = Lunes... (getUTCDay porque getBusinessNow ya desplazó -4h)

    // 1. Obtener todos los horarios de HOY
    const { data: horarios, error: horError } = await supabase
      .from('barbero_horario_semanal')
      .select('barbero_id, hora_inicio, hora_fin, perfiles:profiles!barbero_id(full_name)')
      .eq('dia_semana', dayOfWeek)
      .eq('activo', true)

    if (horError) throw horError

    if (!horarios || horarios.length === 0) {
      return NextResponse.json({ mensaje: 'Nadie tenía turno hoy.' })
    }

    // 2. Obtener todas las asistencias de HOY
    const { data: asistenciasHoy, error: asisError } = await supabase
      .from('asistencias')
      .select('profile_id, estado')
      .eq('fecha', hoy)

    if (asisError) throw asisError
    
    const barberosConAsistencia = new Set(asistenciasHoy?.map(a => a.profile_id))

    // 3. Obtener el tipo de sanción para Falta desde plan_cuentas
    const { data: cuentasSancion } = await supabase.from('plan_cuentas').select('detalle').eq('es_sancion', true)
    let tipoSancionFalta = 'falta_injustificada'
    if (cuentasSancion && cuentasSancion.length > 0) {
      const match = cuentasSancion.find(c => c.detalle.toLowerCase().includes('falta') || c.detalle.toLowerCase().includes('ausen'))
      tipoSancionFalta = match ? match.detalle : cuentasSancion[0].detalle
    }

    // 4. Filtrar los que tenían turno pero NO marcaron
    const faltasGeneradas = []
    let contadorFaltas = 0

    for (const horario of horarios) {
      if (!barberosConAsistencia.has(horario.barbero_id)) {
        // No vino, ni pidió permiso (el permiso crea un registro)
        
        // Registrar asistencia como ausente
        await supabase.from('asistencias').insert({
          profile_id: horario.barbero_id,
          fecha: hoy,
          estado: 'ausente',
          notas: 'Falta injustificada generada automáticamente al final del día.',
          cierre_automatico: true,
        })

        // Insertar sanción
        await supabase.from('sanciones').insert({
          barbero_id: horario.barbero_id,
          tipo: tipoSancionFalta,
          descripcion: `Falta injustificada (Tenía turno ${horario.hora_inicio} - ${horario.hora_fin})`,
          monto: 30, // Monto fuerte por defecto para faltas
          estado: 'pendiente'
        })

        // El ignore error TS para perfiles
        // @ts-ignore
        const full_name = horario.perfiles?.full_name || 'Desconocido'
        
        contadorFaltas++
        faltasGeneradas.push(full_name)
      }
    }

    // Notificar al sistema
    if (contadorFaltas > 0) {
      const { getNotificationDbClient } = await import('@/lib/supabase/admin')
      const { dispatchNotification } = await import('@/lib/notifications/dispatch')
      const db = getNotificationDbClient(supabase)
      await dispatchNotification(db, {
        event: 'sistema',
        payload: {
          motivo: `Se generaron ${contadorFaltas} sanciones automáticas por Falta Injustificada.`,
          link: '/admin/comisiones',
        },
      })
    }

    return NextResponse.json({
      success: true,
      mensaje: contadorFaltas > 0 
        ? `Se aplicaron ${contadorFaltas} sanciones por falta injustificada.` 
        : 'Todos los programados para hoy registraron su asistencia (o permiso).',
      afectados: faltasGeneradas
    })
  } catch (err) {
    console.error('cron/faltas:', err)
    return NextResponse.json({ error: 'Error interno ejecutando cron de faltas' }, { status: 500 })
  }
}
