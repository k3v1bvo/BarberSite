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

    // 1. Garantizar que cliente_antiguo existe en la tabla clientes
    let { data: antiguo } = await adminClient
      .from('clientes')
      .select('*')
      .eq('id', cliente_antiguo_id)
      .maybeSingle()

    if (!antiguo) {
      // Buscar en profiles
      const { data: profAntiguo } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', cliente_antiguo_id)
        .maybeSingle()

      if (profAntiguo) {
        const { data: newAntiguo } = await adminClient.from('clientes').upsert({
          id: profAntiguo.id,
          nombre: profAntiguo.full_name || 'Cliente Antiguo',
          email: profAntiguo.email || null,
          telefono: profAntiguo.phone || null,
          ci: profAntiguo.ci || null,
          total_visitas: 0,
          total_gastado: 0,
        }).select('*').single()
        
        antiguo = newAntiguo
      }
    }

    // 2. Garantizar que cliente_nuevo existe en la tabla clientes
    let { data: nuevo } = await adminClient
      .from('clientes')
      .select('*')
      .eq('id', cliente_nuevo_id)
      .maybeSingle()

    if (!nuevo) {
      // Buscar en profiles
      const { data: profNuevo } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', cliente_nuevo_id)
        .maybeSingle()

      if (profNuevo) {
        const { data: newNuevo } = await adminClient.from('clientes').upsert({
          id: profNuevo.id,
          nombre: profNuevo.full_name || 'Cliente Nuevo',
          email: profNuevo.email || null,
          telefono: profNuevo.phone || null,
          ci: profNuevo.ci || null,
          total_visitas: 0,
          total_gastado: 0,
        }).select('*').single()

        nuevo = newNuevo
      }
    }

    if (!antiguo || !nuevo) {
      return NextResponse.json(
        { error: 'No se pudo ubicar uno de los clientes seleccionados. Verifica que ambos perfiles existan en el sistema.' },
        { status: 400 }
      )
    }

    // 3. Reasignar todas las tablas asociadas
    await adminClient.from('citas').update({ cliente_id: cliente_nuevo_id }).eq('cliente_id', cliente_antiguo_id)
    await adminClient.from('transactions').update({ cliente_id: cliente_nuevo_id }).eq('cliente_id', cliente_antiguo_id)
    await adminClient.from('pedidos').update({ cliente_id: cliente_nuevo_id }).eq('cliente_id', cliente_antiguo_id)
    await adminClient.from('testimonios').update({ cliente_id: cliente_nuevo_id }).eq('cliente_id', cliente_antiguo_id)
    await adminClient.from('referrals').update({ cliente_recomendante_id: cliente_nuevo_id }).eq('cliente_recomendante_id', cliente_antiguo_id)
    await adminClient.from('referrals').update({ cliente_recomendado_id: cliente_nuevo_id }).eq('cliente_recomendado_id', cliente_antiguo_id)

    // 4. Sumar los totales acumulados y complementar datos faltantes
    const nuevoTotalVisitas = (nuevo.total_visitas || 0) + (antiguo.total_visitas || 0)
    const nuevoTotalGastado = (nuevo.total_gastado || 0) + (antiguo.total_gastado || 0)

    const finalCi = nuevo.ci?.trim() || antiguo.ci?.trim() || null
    const finalTelefono = nuevo.telefono?.trim() || antiguo.telefono?.trim() || null
    const finalCumpleanos = nuevo.cumpleanos || antiguo.cumpleanos || null
    const finalEmail = nuevo.email?.trim() || antiguo.email?.trim() || null
    const finalCodigoTarjeta = nuevo.codigo_tarjeta || antiguo.codigo_tarjeta || null

    const updatePayload: any = {
      total_visitas: nuevoTotalVisitas,
      total_gastado: nuevoTotalGastado,
      ci: finalCi,
      telefono: finalTelefono,
      cumpleanos: finalCumpleanos,
      email: finalEmail,
      codigo_tarjeta: finalCodigoTarjeta,
    }

    await adminClient.from('clientes').update(updatePayload).eq('id', cliente_nuevo_id)

    // Sincronizar también la tabla profiles para que el CI y teléfono estén disponibles en auth
    const profileUpdates: any = {}
    if (finalCi) profileUpdates.ci = finalCi
    if (finalTelefono) profileUpdates.phone = finalTelefono

    if (Object.keys(profileUpdates).length > 0) {
      await adminClient.from('profiles').update(profileUpdates).eq('id', cliente_nuevo_id)
    }

    // 5. Borrar el registro antiguo
    await adminClient.from('clientes').delete().eq('id', cliente_antiguo_id)

    // 6. Crear notificación en el sistema para el cliente
    await adminClient.from('notificaciones').insert({
      usuario_id: cliente_nuevo_id,
      titulo: '✨ ¡Historial Sincronizado Con Éxito!',
      mensaje: `¡Hola ${nuevo.nombre || 'Cliente'}! Tu perfil ha sido vinculado exitosamente con tu historial previo en la barbería. Ahora cuentas con ${nuevoTotalVisitas} visitas acumuladas y tus beneficios de lealtad activos.`,
      tipo: 'success',
      categoria: 'sistema',
      link: '/cliente',
      leida: false,
    })

    return NextResponse.json({
      success: true,
      message: `¡Éxito! Se fusionaron los historiales de "${antiguo.nombre || 'Cliente'}" hacia "${nuevo.nombre || 'Cliente'}". Se sumaron +${antiguo.total_visitas || 0} visitas y +Bs. ${antiguo.total_gastado || 0}.`,
    })
  } catch (error: any) {
    console.error('Error en sincronizar-cliente:', error)
    return NextResponse.json({ error: error.message || 'Error interno al fusionar clientes' }, { status: 500 })
  }
}
