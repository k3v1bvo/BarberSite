const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.vercel', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function findJhonny() {
  console.log('--- BUSCANDO A JHONNY ZAPATA EN TODA LA BASE DE DATOS ---');
  
  // 1. En clientes por CI, Nombre o Email
  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .or('nombre.ilike.%Jhonny%,nombre.ilike.%Zapata%,ci.ilike.%8759184%,email.ilike.%jhonny%');
  
  console.log('CLIENTES ENCONTRADOS:', JSON.stringify(clientes, null, 2));

  // 2. En profiles por CI, Nombre o Email
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .or('full_name.ilike.%Jhonny%,full_name.ilike.%Zapata%,ci.ilike.%8759184%,email.ilike.%jhonny%');

  console.log('PROFILES ENCONTRADOS:', JSON.stringify(profiles, null, 2));

  // 3. Buscar citas vinculadas a 8759184 o Jhonny Zapata
  const { data: citas } = await supabase
    .from('citas')
    .select('id, cliente_id, fecha_hora, notas, precio')
    .or('notas.ilike.%Jhonny%,notas.ilike.%8759184%')
    .limit(20);

  console.log('CITAS DE JHONNY ZAPATA:', JSON.stringify(citas, null, 2));

  // 4. Buscar transacciones vinculadas a Jhonny Zapata
  const { data: txs } = await supabase
    .from('transactions')
    .select('id, cliente_id, glosa, costo, creado_en')
    .or('glosa.ilike.%Jhonny%,glosa.ilike.%8759184%')
    .limit(20);

  console.log('TRANSACCIONES DE JHONNY ZAPATA:', JSON.stringify(txs, null, 2));
}

findJhonny();
