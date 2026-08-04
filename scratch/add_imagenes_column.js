const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.vercel', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function addColumn() {
  console.log('--- AGREGANDO COLUMNA IMAGENES A TABLA PRODUCTOS ---');

  // Supabase Rest API check
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: 'ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagenes text[];'
  });

  if (error) {
    console.log('RPC error (esperado si no hay rpc exec_sql):', error.message);
  } else {
    console.log('Resultado RPC:', data);
  }
}

addColumn();
