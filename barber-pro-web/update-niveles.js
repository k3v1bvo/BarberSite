const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function sincronizarNiveles() {
  console.log("Obteniendo metas de lealtad activas...")
  const { data: metas, error: metasError } = await supabase
    .from('lealtad_metas')
    .select('nombre, visitas_requeridas')
    .eq('is_active', true)
    .order('visitas_requeridas', { ascending: false })

  if (metasError) {
    console.error("Error al obtener metas:", metasError.message)
    return
  }
  
  if (!metas || metas.length === 0) {
    console.log("No hay metas activas en la base de datos. Se asignará BRONCE por defecto.")
  } else {
    console.log("Metas encontradas:")
    metas.forEach(m => console.log(` - ${m.nombre.toUpperCase()}: ${m.visitas_requeridas} visitas`))
  }

  function calcularNivel(visitas) {
    if (!metas || metas.length === 0) return 'BRONCE'
    const metaAlcanzada = metas.find(m => visitas >= m.visitas_requeridas)
    return metaAlcanzada ? metaAlcanzada.nombre.toUpperCase() : 'BRONCE'
  }

  console.log("\nObteniendo clientes...")
  const { data: clientes, error: fetchError } = await supabase
    .from('clientes')
    .select('id, nombre, total_visitas, nivel_fidelidad')

  if (fetchError) {
    console.error("Error al obtener clientes:", fetchError.message)
    return
  }

  console.log(`Se encontraron ${clientes.length} clientes. Sincronizando niveles dinámicamente...`)
  let actualizados = 0

  for (const c of clientes) {
    const visitas = c.total_visitas || 0
    const nivelCorrecto = calcularNivel(visitas)
    
    if (c.nivel_fidelidad !== nivelCorrecto) {
      console.log(`[${c.nombre}] Visitas: ${visitas}. Nivel actual: ${c.nivel_fidelidad || 'N/A'}. Cambiando a: ${nivelCorrecto}`)
      
      const { error: updateError } = await supabase
        .from('clientes')
        .update({ nivel_fidelidad: nivelCorrecto })
        .eq('id', c.id)

      if (updateError) {
        console.error(`Error al actualizar a ${c.nombre}:`, updateError.message)
      } else {
        actualizados++
      }
    }
  }

  console.log(`\n✅ Proceso finalizado. Se actualizaron ${actualizados} clientes con el nivel correcto.`)
}

sincronizarNiveles()
