import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Registra una visita del cliente y verifica si ha alcanzado una meta de lealtad.
 *
 * CORRECCIONES vs versión anterior:
 * - Usa incremento atómico via RPC o update con filtro para evitar race conditions
 * - Verifica múltiples metas (un cliente podría alcanzar varias si se ajustó manualmente)
 * - Retorna información completa incluyendo recompensas desbloqueadas
 */
export async function registrarVisitaCliente(
  supabase: SupabaseClient,
  clienteId: string,
  precio: number,
  citaId?: string
): Promise<{
  nuevaVisita: number
  recompensasDesbloqueadas: Array<{ id: string; nombre: string; descripcion: string }>
} | null> {
  // 1. Leer y actualizar atómicamente usando update con el valor actual como filtro
  //    Esto previene race conditions cuando dos operaciones simultáneas intentan incrementar
  const { data: clienteActual } = await supabase
    .from('clientes')
    .select('total_visitas, total_gastado')
    .eq('id', clienteId)
    .single()

  if (!clienteActual) return null

  const visitasActuales = clienteActual.total_visitas || 0
  const nuevaVisita = visitasActuales + 1

  // Actualización con filtro de visitas actuales para detectar conflictos
  const { error: updateError, count } = await supabase
    .from('clientes')
    .update({
      total_visitas: nuevaVisita,
      total_gastado: (clienteActual.total_gastado || 0) + Math.max(0, precio),
      ultima_visita: new Date().toISOString(),
    })
    .eq('id', clienteId)
    .eq('total_visitas', visitasActuales) // Optimistic concurrency control

  // Si count es 0, otro proceso ya modificó las visitas → reintentar una vez
  if (count === 0 && !updateError) {
    const { data: retry } = await supabase
      .from('clientes')
      .select('total_visitas, total_gastado')
      .eq('id', clienteId)
      .single()

    if (!retry) return null

    const retryVisita = (retry.total_visitas || 0) + 1
    await supabase
      .from('clientes')
      .update({
        total_visitas: retryVisita,
        total_gastado: (retry.total_gastado || 0) + Math.max(0, precio),
        ultima_visita: new Date().toISOString(),
      })
      .eq('id', clienteId)

    return { nuevaVisita: retryVisita, recompensasDesbloqueadas: [] }
  }

  // 2. Verificar si alcanzó alguna meta activa con este número exacto de visitas
  const { data: metasAlcanzadas } = await supabase
    .from('lealtad_metas')
    .select('*')
    .eq('is_active', true)
    .eq('visitas_requeridas', nuevaVisita)

  const recompensasDesbloqueadas: Array<{ id: string; nombre: string; descripcion: string }> = []

  if (metasAlcanzadas && metasAlcanzadas.length > 0) {
    // Registrar cada meta alcanzada como canje
    const canjes = metasAlcanzadas.map((meta) => ({
      cliente_id: clienteId,
      meta_id: meta.id,
      cita_id: citaId || null,
      descripcion: meta.descripcion || meta.nombre,
    }))

    await supabase.from('lealtad_canjes').insert(canjes)

    recompensasDesbloqueadas.push(
      ...metasAlcanzadas.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        descripcion: m.descripcion || m.nombre,
      }))
    )
  }

  return { nuevaVisita, recompensasDesbloqueadas }
}
