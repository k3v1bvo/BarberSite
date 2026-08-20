import { SupabaseClient } from '@supabase/supabase-js'

export async function calcularNivelFidelidad(supabase: SupabaseClient, visitas: number): Promise<string> {
  // Obtenemos todas las metas activas, ordenadas de mayor a menor visitas requeridas
  const { data: metas } = await supabase
    .from('lealtad_metas')
    .select('nombre, visitas_requeridas')
    .eq('is_active', true)
    .order('visitas_requeridas', { ascending: false })

  if (!metas || metas.length === 0) return 'BRONCE'

  // Buscamos la meta más alta que el cliente haya alcanzado
  const metaAlcanzada = metas.find(m => visitas >= m.visitas_requeridas)
  
  if (metaAlcanzada) {
    // Retornamos el nombre de la meta (ej. 'BRONCE', 'PLATA', 'ORO', 'PLATINO', 'DIAMANTE')
    return metaAlcanzada.nombre.toUpperCase()
  }

  // Si no alcanza ninguna meta, por defecto es el nivel más bajo (o BRONCE)
  // Podemos sacar el nombre de la meta más baja, o simplemente decir 'BRONCE'
  return 'BRONCE'
}
