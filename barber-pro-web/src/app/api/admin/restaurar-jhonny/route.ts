import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const URL = 'https://yqzvhtkakmnphoudsadg.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxenZodGtha21ucGhvdWRzYWRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTcxODM3NCwiZXhwIjoyMDg3Mjk0Mzc0fQ.AoBdT2Pzx9At4hzDLA37RctHd5COAqFBMGCGzDm7apI'

export async function GET() {
  try {
    const admin = createClient(URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 1. Buscar el perfil registrado de Johnny Zapata por su email exacto o parcial
    const { data: p1 } = await admin.from('profiles').select('*').ilike('email', '%jhonny.zm696%')
    const { data: p2 } = await admin.from('profiles').select('*').ilike('full_name', '%Johnny%')

    const profiles = [...(p1 || []), ...(p2 || [])]

    if (profiles.length === 0) {
      return NextResponse.json({ error: 'No se encontró el perfil de Johnny Zapata en usuarios' }, { status: 404 })
    }

    const jhonnyProfile = profiles[0]
    const targetId = jhonnyProfile.id

    // 2. Buscar si ya existe la fila en clientes
    const { data: clienteExistente } = await admin
      .from('clientes')
      .select('*')
      .eq('id', targetId)
      .maybeSingle()

    // 3. Contar citas y transacciones acumuladas
    const { data: finalCitas } = await admin.from('citas').select('id').eq('cliente_id', targetId)
    const { data: finalTxs } = await admin.from('transactions').select('costo').eq('cliente_id', targetId)

    let totalVisitas = finalCitas?.length || clienteExistente?.total_visitas || 0
    let totalGastado = clienteExistente?.total_gastado || 0

    finalTxs?.forEach(t => {
      totalGastado += Number(t.costo) || 0
    })

    // 4. Crear/Restaurar la fila en la tabla 'clientes' para Johnny Zapata
    const { data: clienteRestaurado, error: clientErr } = await admin
      .from('clientes')
      .upsert({
        id: targetId,
        nombre: jhonnyProfile.full_name || 'Johnny Zapata',
        email: jhonnyProfile.email || 'jhonny.zm696@gmail.com',
        telefono: jhonnyProfile.phone || '64879616',
        ci: '8759184',
        total_visitas: totalVisitas,
        total_gastado: totalGastado,
        nivel_fidelidad: 'bronce',
        created_at: jhonnyProfile.created_at || new Date().toISOString(),
      })
      .select('*')
      .single()

    if (clientErr) throw clientErr

    // 5. Actualizar el CI en la tabla profiles
    await admin.from('profiles').update({ ci: '8759184' }).eq('id', targetId)

    return NextResponse.json({
      success: true,
      mensaje: `¡Cliente Johnny Zapata (${jhonnyProfile.email}) totalmente restaurado y visible en la lista de clientes!`,
      cliente: clienteRestaurado,
    })
  } catch (err: any) {
    console.error('Error restaurando Johnny Zapata:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
