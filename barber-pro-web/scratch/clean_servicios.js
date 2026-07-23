const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.vercel', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function formatSentence(str) {
  if (!str) return '';
  const trimmed = str.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

async function cleanServicios() {
  console.log('--- FORMATING SERVICIOS TO SENTENCE CASE ---');

  const { data: servicios, error } = await supabase.from('servicios').select('*');
  if (error) {
    console.error('Error fetching servicios:', error);
    return;
  }

  console.log(`Encontrados ${servicios ? servicios.length : 0} servicios.`);

  if (servicios) {
    for (const s of servicios) {
      const cleanNombre = formatSentence(s.nombre);
      const cleanDesc = s.descripcion ? formatSentence(s.descripcion) : null;

      console.log(`[${s.id}] '${s.nombre}' -> '${cleanNombre}'`);

      const { error: updErr } = await supabase.from('servicios').update({
        nombre: cleanNombre,
        descripcion: cleanDesc
      }).eq('id', s.id);

      if (updErr) console.error('Error updating:', updErr);
    }
  }
  console.log('¡PROCESO COMPLETADO EXITOSAMENTE!');
}

cleanServicios();
