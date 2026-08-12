import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const URL = 'https://yqzvhtkakmnphoudsadg.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxenZodGtha21ucGhvdWRzYWRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTcxODM3NCwiZXhwIjoyMDg3Mjk0Mzc0fQ.AoBdT2Pzx9At4hzDLA37RctHd5COAqFBMGCGzDm7apI'

export async function GET() {
  try {
    const supabase = createClient(URL, SERVICE_KEY)

    // Crear la columna 'imagenes' en la tabla 'productos' si no existe
    const { error: sqlErr } = await supabase.rpc('exec_sql', {
      sql_query: 'ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagenes text[];'
    })

    // Si rpc no existe, probar vía rpc genérico o comprobar con rpc
    return NextResponse.json({
      success: true,
      sqlErr: sqlErr ? sqlErr.message : null
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
