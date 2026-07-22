const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.vercel', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function fixJhonny() {
  console.log('--- RESTAURANDO Y RECALCULANDO REGISTRO DE JHONNY ZAPATA ---');

  // 1. Buscar el perfil registrado de Jhonny por email o nombre
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .or('email.ilike.%jhonny.zm696%,full_name.ilike.%Jhonny%');

  console.log('Perfiles encontrados:', profiles);

  if (!profiles || profiles.length === 0) {
    console.log('No se encontro perfil en auth.');
    return;
  }

  const jhonnyProfile = profiles[0];
  const targetId = jhonnyProfile.id;

  // 2. Buscar todas las citas del ID o que tengan la nota de Jhonny
  const { data: citasById } = await supabase.from('citas').select('id, precio').eq('cliente_id', targetId);
  const { data: citasByNota } = await supabase.from('citas').select('id, precio').or('notas.ilike.%8759184%,notas.ilike.%Jhonny Zapata%');

  const allCitaIds = new Set();
  citasById?.forEach(c => allCitaIds.add(c.id));
  citasByNota?.forEach(c => allCitaIds.add(c.id));

  // Reasignar citasByNota al targetId por si alguna quedo suelta
  if (citasByNota && citasByNota.length > 0) {
    await supabase.from('citas').update({ cliente_id: targetId }).or('notas.ilike.%8759184%,notas.ilike.%Jhonny Zapata%');
  }

  // 3. Buscar todas las transacciones
  const { data: txsById } = await supabase.from('transactions').select('id, costo').eq('cliente_id', targetId);
  const { data: txsByNota } = await supabase.from('transactions').select('id, costo').or('glosa.ilike.%8759184%,glosa.ilike.%Jhonny Zapata%');

  if (txsByNota && txsByNota.length > 0) {
    await supabase.from('transactions').update({ cliente_id: targetId }).or('glosa.ilike.%8759184%,glosa.ilike.%Jhonny Zapata%');
  }

  // Recalcular visitas y total gastado
  const { data: finalCitas } = await supabase.from('citas').select('precio').eq('cliente_id', targetId);
  const { data: finalTxs } = await supabase.from('transactions').select('costo').eq('cliente_id', targetId).eq('libro', 'SERVICIOS');

  const totalVisitas = finalCitas?.length || 0;
  const totalGastado = finalTxs?.reduce((sum, t) => sum + (Number(t.costo) || 0), 0) || 0;

  console.log(`Visitas encontradas: ${totalVisitas}, Total Gastado: Bs. ${totalGastado}`);

  // 4. Crear/Actualizar la fila en la tabla 'clientes' para Jhonny Zapata
  const { data: updatedClient, error: upsertErr } = await supabase.from('clientes').upsert({
    id: targetId,
    nombre: jhonnyProfile.full_name || 'Johnny Zapata',
    email: jhonnyProfile.email || 'jhonny.zm696@gmail.com',
    telefono: jhonnyProfile.phone || '64879616',
    ci: '8759184',
    total_visitas: totalVisitas,
    total_gastado: totalGastado,
    nivel_fidelidad: 'bronce',
    created_at: jhonnyProfile.created_at || new Date().toISOString(),
  }).select('*').single();

  if (upsertErr) {
    console.error('Error al hacer upsert de cliente:', upsertErr);
  } else {
    console.log('¡CLIENTE JHONNY ZAPATA RESTAURADO Y SINCRONIZADO EXITOSAMENTE!', updatedClient);
  }

  // 5. Actualizar la tabla profiles con el CI
  await supabase.from('profiles').update({ ci: '8759184' }).eq('id', targetId);
}

fixJhonny();
