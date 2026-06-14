import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const adminClient = createAdminSupabaseClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta (service role)' }, { status: 500 })
    }

    const { cliente_antiguo_id, cliente_nuevo_id } = await request.json()

    if (!cliente_antiguo_id || !cliente_nuevo_id) {
      return NextResponse.json({ error: 'Ambos clientes son requeridos' }, { status: 400 })
    }

    if (cliente_antiguo_id === cliente_nuevo_id) {
      return NextResponse.json({ error: 'No puedes sincronizar el mismo cliente consigo mismo' }, { status: 400 })
    }

    // Obtener información de ambos clientes para sumar los totales
    const { data: antiguo } = await adminClient.from('clientes').select('total_visitas, total_gastado').eq('id', cliente_antiguo_id).single()
    const { data: nuevo } = await adminClient.from('clientes').select('total_visitas, total_gastado').eq('id', cliente_nuevo_id).single()

    if (!antiguo || !nuevo) {
      return NextResponse.json({ error: 'Uno de los clientes no existe' }, { status: 404 })
    }

    // Actualizar Citas
    await adminClient.from('citas').update({ cliente_id: cliente_nuevo_id }).eq('cliente_id', cliente_antiguo_id)

    // Actualizar Transactions (caja)
    await adminClient.from('transactions').update({ cliente_id: cliente_nuevo_id }).eq('cliente_id', cliente_antiguo_id)

    // Actualizar Pedidos
    await adminClient.from('pedidos').update({ cliente_id: cliente_nuevo_id }).eq('cliente_id', cliente_antiguo_id)

    // Actualizar Testimonios
    await adminClient.from('testimonios').update({ cliente_id: cliente_nuevo_id }).eq('cliente_id', cliente_antiguo_id)

    // Fusionar sumando visitas y gastos al nuevo cliente
    const nuevoTotalVisitas = (nuevo.total_visitas || 0) + (antiguo.total_visitas || 0)
    const nuevoTotalGastado = (nuevo.total_gastado || 0) + (antiguo.total_gastado || 0)

    const { error: updateError } = await adminClient.from('clientes')
      .update({ 
        total_visitas: nuevoTotalVisitas, 
        total_gastado: nuevoTotalGastado 
      })
      .eq('id', cliente_nuevo_id)

    if (updateError) {
      throw updateError
    }

    // Opcionalmente calcular nuevo nivel de lealtad, pero lo hará el trigger o la funcion dinámica.
    // Borrar cliente antiguo
    const { error: deleteError } = await adminClient.from('clientes').delete().eq('id', cliente_antiguo_id)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ success: true, message: 'Historial de cliente sincronizado y fusionado correctamente.' })

  } catch (error: any) {
    console.error('Error al sincronizar cliente:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
