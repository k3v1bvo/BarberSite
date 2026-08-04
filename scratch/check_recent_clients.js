const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.vercel', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: clientes, error } = await supabase
    .from('clientes')
    .select('id, nombre, ci, email, total_visitas, total_gastado, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Ultimos 10 clientes registrados/creados:');
  console.log(JSON.stringify(clientes, null, 2));
}

check();
