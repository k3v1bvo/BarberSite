import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function toSentenceCase(str: string | null | undefined): string {
  if (!str) return ''
  const trimmed = str.trim()
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

export async function GET() {
  try {
    const admin = createAdminSupabaseClient()
    if (!admin) return NextResponse.json({ error: 'No admin client' }, { status: 500 })

    const { data: servicios, error } = await admin.from('servicios').select('*')
    if (error) throw error

    const updates = []
    if (servicios) {
      for (const s of servicios) {
        const cleanNombre = toSentenceCase(s.nombre)
        const cleanDesc = s.descripcion ? toSentenceCase(s.descripcion) : null

        const { error: updErr } = await admin.from('servicios').update({
          nombre: cleanNombre,
          descripcion: cleanDesc
        }).eq('id', s.id)

        if (!updErr) {
          updates.push({ id: s.id, antes: s.nombre, despues: cleanNombre })
        }
      }
    }

    return NextResponse.json({
      success: true,
      total: updates.length,
      actualizados: updates
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
