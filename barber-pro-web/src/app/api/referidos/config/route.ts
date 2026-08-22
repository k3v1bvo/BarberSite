import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const adminSupabase = createAdminSupabaseClient() || supabase

    const { data: conf } = await adminSupabase
      .from('configuraciones')
      .select('valor')
      .eq('llave', 'monto_bono_referido')
      .maybeSingle()

    let monto = 10
    if (conf?.valor) {
      const raw = conf.valor
      if (typeof raw === 'number') {
        monto = raw
      } else if (typeof raw === 'object' && raw !== null && (raw as any).monto !== undefined) {
        monto = Number((raw as any).monto) || 10
      } else {
        monto = Number(raw) || 10
      }
    }

    return NextResponse.json({ monto })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al obtener configuración' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const adminSupabase = createAdminSupabaseClient() || supabase

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'coordinador')) {
      return NextResponse.json({ error: 'No tienes permisos para modificar esta configuración' }, { status: 403 })
    }

    const body = await request.json()
    const montoNum = parseFloat(body.monto)

    if (isNaN(montoNum) || montoNum < 0) {
      return NextResponse.json({ error: 'El monto debe ser un número válido mayor o igual a 0' }, { status: 400 })
    }

    const { error } = await adminSupabase
      .from('configuraciones')
      .upsert({
        llave: 'monto_bono_referido',
        valor: { monto: montoNum },
        descripcion: 'Monto de bono por referido en Bolivianos (Bs.)'
      }, { onConflict: 'llave' })

    if (error) throw error

    return NextResponse.json({ success: true, monto: montoNum })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al actualizar configuración' }, { status: 500 })
  }
}
