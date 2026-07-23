import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const URL = 'https://yqzvhtkakmnphoudsadg.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxenZodGtha21ucGhvdWRzYWRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTcxODM3NCwiZXhwIjoyMDg3Mjk0Mzc0fQ.AoBdT2Pzx9At4hzDLA37RctHd5COAqFBMGCGzDm7apI'

function toSentenceCase(str: string | null | undefined): string {
  if (!str) return ''
  const trimmed = str.trim()
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

export async function GET() {
  try {
    const admin = createClient(URL, SERVICE_KEY)
    const { data: servicios, error } = await admin.from('servicios').select('*')
    if (error) throw error

    const list: any[] = []
    if (servicios) {
      for (const s of servicios) {
        const cleanNombre = toSentenceCase(s.nombre)
        const cleanDesc = s.descripcion ? toSentenceCase(s.descripcion) : null

        await admin.from('servicios').update({
          nombre: cleanNombre,
          descripcion: cleanDesc
        }).eq('id', s.id)

        list.push({ antes: s.nombre, despues: cleanNombre })
      }
    }

    return NextResponse.json({
      success: true,
      total_actualizados: list.length,
      ejemplos: list.slice(0, 10)
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
