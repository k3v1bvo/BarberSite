import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  const serverDb = await createServerSupabaseClient()
  
  const { data: citas } = await serverDb
    .from('citas')
    .select('id, cliente_id, estado, clientes(nombre, email, telefono)')
    .order('fecha_hora', { ascending: false })
    .limit(10)
    
  return NextResponse.json({ citas })
}
