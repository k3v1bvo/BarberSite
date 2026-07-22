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

    // Asignar CI 8759184 a Johnny Zapata en clientes y profiles
    const { data: p } = await admin.from('profiles').select('id, email').ilike('email', '%jhonny.zm696%').single()

    if (p) {
      await admin.from('clientes').update({ ci: '8759184' }).eq('id', p.id)
      await admin.from('profiles').update({ ci: '8759184' }).eq('id', p.id)
      return NextResponse.json({ success: true, message: 'CI 8759184 asignado exitosamente a Johnny Zapata', id: p.id })
    }

    return NextResponse.json({ error: 'No se encontró el perfil' }, { status: 404 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
