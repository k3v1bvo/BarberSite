import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const adminClient = createAdminSupabaseClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta (service role)' }, { status: 500 })
    }

    const { new_user_id, ci, email, nombre } = await request.json()

    if (!new_user_id) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 })
    }

    const cleanCi = ci?.toString().trim()
    const cleanEmail = email?.toString().trim().toLowerCase()
    const cleanNombre = nombre?.toString().trim().toLowerCase()

    const matchingIds = new Set<string>()

    // 1. Buscar por CI si fue provisto
    if (cleanCi && cleanCi !== '0' && cleanCi !== '0000000') {
      const { data: byCi } = await adminClient
        .from('clientes')
        .select('id')
        .eq('ci', cleanCi)
        .neq('id', new_user_id)
      
      byCi?.forEach(c => matchingIds.add(c.id))
    }

    // 2. Buscar por Email si fue provisto
    if (cleanEmail) {
      const { data: byEmail } = await adminClient
        .from('clientes')
        .select('id')
        .ilike('email', cleanEmail)
        .neq('id', new_user_id)
      
      byEmail?.forEach(c => matchingIds.add(c.id))
    }

    // 3. Buscar por Nombre exacto si fue provisto
    if (cleanNombre && cleanNombre.length > 2) {
      const { data: byNombre } = await adminClient
        .from('clientes')
        .select('id')
        .ilike('nombre', cleanNombre)
        .neq('id', new_user_id)
      
      byNombre?.forEach(c => matchingIds.add(c.id))
    }

    const oldClientIds = Array.from(matchingIds)

    if (oldClientIds.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No se encontraron registros anteriores para sincronizar.', 
        synced: false, 
        count: 0 
      })
    }

    let totalVisitasSum = 0
    let totalGastadoSum = 0
    let ciFound = cleanCi || null
    let telefonoFound: string | null = null
    let cumpleanosFound: string | null = null

    for (const oldId of oldClientIds) {
      // Obtener datos del cliente antiguo
      const { data: oldClient } = await adminClient
        .from('clientes')
        .select('*')
        .eq('id', oldId)
        .single()

      if (oldClient) {
        totalVisitasSum += oldClient.total_visitas || 0
        totalGastadoSum += oldClient.total_gastado || 0
        if (!ciFound && oldClient.ci) ciFound = oldClient.ci
        if (!telefonoFound && oldClient.telefono) telefonoFound = oldClient.telefono
        if (!cumpleanosFound && oldClient.cumpleanos) cumpleanosFound = oldClient.cumpleanos
      }

      // Reasignar citas
      await adminClient.from('citas').update({ cliente_id: new_user_id }).eq('cliente_id', oldId)

      // Reasignar transacciones
      await adminClient.from('transactions').update({ cliente_id: new_user_id }).eq('cliente_id', oldId)

      // Reasignar pedidos
      await adminClient.from('pedidos').update({ cliente_id: new_user_id }).eq('cliente_id', oldId)

      // Reasignar testimonios
      await adminClient.from('testimonios').update({ cliente_id: new_user_id }).eq('cliente_id', oldId)

      // Reasignar referrals si los hay
      await adminClient.from('referrals').update({ cliente_recomendante_id: new_user_id }).eq('cliente_recomendante_id', oldId)
      await adminClient.from('referrals').update({ cliente_recomendado_id: new_user_id }).eq('cliente_recomendado_id', oldId)

      // Eliminar registro antiguo de cliente
      await adminClient.from('clientes').delete().eq('id', oldId)
    }

    // Obtener cliente actual para actualizar agregados
    const { data: currentNewClient } = await adminClient
      .from('clientes')
      .select('total_visitas, total_gastado, ci, telefono, cumpleanos')
      .eq('id', new_user_id)
      .single()

    const finalVisitas = (currentNewClient?.total_visitas || 0) + totalVisitasSum
    const finalGastado = (currentNewClient?.total_gastado || 0) + totalGastadoSum

    const updatePayload: any = {
      total_visitas: finalVisitas,
      total_gastado: finalGastado,
    }

    if (ciFound && (!currentNewClient?.ci || currentNewClient.ci === '')) {
      updatePayload.ci = ciFound
    }
    if (telefonoFound && (!currentNewClient?.telefono || currentNewClient.telefono === '')) {
      updatePayload.telefono = telefonoFound
    }
    if (cumpleanosFound && (!currentNewClient?.cumpleanos || currentNewClient.cumpleanos === '')) {
      updatePayload.cumpleanos = cumpleanosFound
    }

    await adminClient.from('clientes').update(updatePayload).eq('id', new_user_id)

    // Notificar al nuevo cliente
    await adminClient.from('notificaciones').insert({
      usuario_id: new_user_id,
      titulo: '🎉 ¡Historial Sincronizado Exitosamente!',
      mensaje: `¡Hola ${nombre || 'Cliente'}! Vinculamos automáticamente tus ${totalVisitasSum} visitas anteriores a tu nueva cuenta web.`,
      tipo: 'exito',
      categoria: 'sistema',
      link: '/cliente',
      leida: false,
    })

    // Notificar a Admin y Coordinadores
    const { data: staff } = await adminClient
      .from('profiles')
      .select('id, role')
      .in('role', ['admin', 'coordinador'])
      .eq('is_active', true)

    if (staff && staff.length > 0) {
      const notifs = staff.map(s => ({
        usuario_id: s.id,
        titulo: `🔗 Sincronización Automática: ${nombre || 'Cliente'}`,
        mensaje: `El cliente ${nombre || 'Nuevo'} (CI: ${cleanCi || 'N/A'}) se registró y se vincularon automáticamente ${oldClientIds.length} atenciones pasadas (${totalVisitasSum} visitas, Bs ${totalGastadoSum}).`,
        tipo: 'exito',
        categoria: 'sistema',
        link: s.role === 'admin' ? '/admin/sincronizar' : '/coordinador',
        leida: false,
      }))

      await adminClient.from('notificaciones').insert(notifs)
    }

    return NextResponse.json({
      success: true,
      message: `Historial sincronizado automáticamente (${oldClientIds.length} cuenta(s) fusionada(s)).`,
      synced: true,
      count: oldClientIds.length,
      visitas_agregadas: totalVisitasSum,
      gastado_agregado: totalGastadoSum
    })
  } catch (error: any) {
    console.error('Error en autosync-cliente:', error)
    return NextResponse.json({ error: error.message || 'Error interno en autosync' }, { status: 500 })
  }
}
