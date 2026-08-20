const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.vercel', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkProductos() {
  console.log('--- PROBANDO UPDATE EN PRODUCTOS ---');

  // 1. Probar hacer select de imagenes
  const { data, error } = await supabase.from('productos').select('*').limit(1);
  if (error) {
    console.error('Error select productos:', error);
  } else {
    console.log('Columnas de productos primer registro:', Object.keys(data[0] || {}));
  }

  // 2. Probar hacer update sin imagenes vs con imagenes
  if (data && data.length > 0) {
    const prod = data[0];
    const { error: updateErr1 } = await supabase.from('productos').update({
      nombre: prod.nombre,
      imagenes: ['https://example.com/test.jpg']
    }).eq('id', prod.id);

    if (updateErr1) {
      console.error('ERROR AL INCLUIR "imagenes" EN UPDATE:', updateErr1);
    } else {
      console.log('Update con "imagenes" EXITOSO!');
    }
  }
}

checkProductos();
