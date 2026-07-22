import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const admin = createAdminSupabaseClient()
    if (!admin) return NextResponse.json({ error: 'No admin' }, { status: 500 })

    const { data: citasWithNotas, error: e1 } = await admin
      .from('citas')
      .select('id, barbero_id, notas')
      .not('notas', 'is', null)
      .limit(30)

    const { count: totalCitas, error: e2 } = await admin
      .from('citas')
      .select('*', { count: 'exact', head: true })

    const { count: citasHuerfanas, error: e3 } = await admin
      .from('citas')
      .select('*', { count: 'exact', head: true })
      .is('barbero_id', null)

    return NextResponse.json({ totalCitas, citasHuerfanas, sampleNotas: citasWithNotas, e1, e2, e3 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
