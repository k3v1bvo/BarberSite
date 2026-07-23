import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { sendNotificationEmail } from '@/lib/notifications/email'
import { formatCurrency } from '@/lib/utils'

import { calcularNivelFidelidad } from '@/lib/lealtad/calcular-nivel'

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

    // 0. Garantizar que el cliente existe en la tabla 'clientes' usando adminClient (para evitar fallos por RLS)
    const { data: existingTarget } = await adminClient
      .from('clientes')
      .select('id, ci, email, nombre')
      .eq('id', new_user_id)
      .maybeSingle()

    if (!existingTarget) {
      await adminClient.from('clientes').upsert({
        id: new_user_id,
        nombre: nombre || 'Cliente Registrado',
        email: cleanEmail || null,
        ci: cleanCi || null,
        total_visitas: 0,
        total_gastado: 0,
        created_at: new Date().toISOString(),
      })
    }

    const matchingIds = new Set<string>()

    // 1. Buscar por CI (coincidencia de carnet exacta y parcial)
    if (cleanCi && cleanCi.length >= 3 && cleanCi !== '0' && cleanCi !== '0000000') {
      const { data: byCiExact } = await adminClient
        .from('clientes')
        .select('id')
        .eq('ci', cleanCi)
        .neq('id', new_user_id)
      byCiExact?.forEach(c => matchingIds.add(c.id))

      const { data: byCiLike } = await adminClient
        .from('clientes')
        .select('id')
        .ilike('ci', `%${cleanCi}%`)
        .neq('id', new_user_id)
      byCiLike?.forEach(c => matchingIds.add(c.id))

      const digitsOnly = cleanCi.replace(/\D/g, '')
      if (digitsOnly && digitsOnly.length >= 4 && digitsOnly !== cleanCi) {
        const { data: byCiDigits } = await adminClient
          .from('clientes')
          .select('id')
          .ilike('ci', `%${digitsOnly}%`)
          .neq('id', new_user_id)
        byCiDigits?.forEach(c => matchingIds.add(c.id))
      }
    }

    // 2. Buscar por Email exacto o parcial si fue provisto
    if (cleanEmail && cleanEmail.includes('@')) {
      const { data: byEmail } = await adminClient
        .from('clientes')
        .select('id')
        .ilike('email', cleanEmail)
        .neq('id', new_user_id)
      byEmail?.forEach(c => matchingIds.add(c.id))
    }

    // 3. Buscar por Nombre inteligente (flexibilidad con segundo nombre, tildes y mayúsculas)
    if (cleanNombre && cleanNombre.length >= 3) {
      const { data: byNombreExact } = await adminClient
        .from('clientes')
        .select('id')
        .ilike('nombre', cleanNombre)
        .neq('id', new_user_id)
      byNombreExact?.forEach(c => matchingIds.add(c.id))

      // Normalizar tildes y dividir en palabras (ej: "Fabrice Sánchez" -> ["fabrice", "sanchez"])
      const normNombre = cleanNombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const nameWords = normNombre.split(/\s+/).filter(w => w.length >= 3)

      if (nameWords.length > 0) {
        const { data: allOtherClients } = await adminClient
          .from('clientes')
          .select('id, nombre')
          .neq('id', new_user_id)

        allOtherClients?.forEach(c => {
          if (!c.nombre) return
          const cNorm = c.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          // Si el nombre en la BD contiene al menos la primera y última palabra (ej: fabrice y sanchez en FABRICE MAURICIO SANCHEZ)
          const matchesFirst = nameWords[0] ? cNorm.includes(nameWords[0]) : false
          const matchesLast = nameWords.length > 1 ? cNorm.includes(nameWords[nameWords.length - 1]) : true
          
          if (matchesFirst && matchesLast) {
            matchingIds.add(c.id)
          }
        })
      }
    }

    const oldClientIds = Array.from(matchingIds)

    if (oldClientIds.length === 0) {
      // Notificar bienvenida sin historial previo
      await adminClient.from('notificaciones').insert({
        usuario_id: new_user_id,
        titulo: '🎉 ¡Bienvenido a Barber Site!',
        mensaje: `¡Hola ${nombre || 'Cliente'}! Tu cuenta ha sido registrada correctamente con tu CI (${cleanCi || 'Sin CI'}).`,
        tipo: 'success',
        categoria: 'sistema',
        link: '/cliente',
        leida: false,
      })

      const { data: staff } = await adminClient
        .from('profiles')
        .select('id, role')
        .in('role', ['admin', 'coordinador'])
        .eq('is_active', true)

      if (staff && staff.length > 0) {
        const notifs = staff.map(s => ({
          usuario_id: s.id,
          titulo: `👤 Nuevo Cliente Registrado: ${nombre || 'Cliente'}`,
          mensaje: `Se ha registrado el cliente ${nombre || 'Nuevo'} (CI: ${cleanCi || 'Sin CI'}, Email: ${cleanEmail || 'N/A'}). No se encontró historial previo de caja.`,
          tipo: 'info',
          categoria: 'sistema',
          link: s.role === 'admin' ? '/admin/clientes' : '/coordinador',
          leida: false,
        }))
        await adminClient.from('notificaciones').insert(notifs)
      }

      // Enviar correo de bienvenida directo al cliente
      if (cleanEmail) {
        try {
          await sendNotificationEmail(cleanEmail, 'registro_bienvenida_nuevo', {
            nombre: nombre || 'Cliente',
            ci: cleanCi || 'No especificado',
          })
        } catch (eErr) {
          console.error('Error enviando correo de bienvenida nuevo:', eErr)
        }
      }

      // Enviar correo de notificación al Administrador
      const masterAdminEmail = process.env.SMTP_USER || 'barbersiteadmin@gmail.com'
      try {
        await sendNotificationEmail(masterAdminEmail, 'alerta_sistema', {
          motivo: `👤 Nuevo Cliente Registrado: ${nombre || 'Cliente'} (CI: ${cleanCi || 'Sin CI'}, Email: ${cleanEmail || 'N/A'}). Se ha registrado exitosamente en la plataforma web.`,
          link: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://barber-site-livid.vercel.app'}/admin/clientes`
        })
      } catch (aErr) {
        console.error('Error enviando alerta de nuevo usuario al admin:', aErr)
      }

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
    const finalNivel = await calcularNivelFidelidad(adminClient, finalVisitas)

    const updatePayload: any = {
      total_visitas: finalVisitas,
      total_gastado: finalGastado,
      nivel_fidelidad: finalNivel,
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

    // Sincronizar también la tabla profiles para auth
    const profileUpdates: any = {}
    if (updatePayload.ci) profileUpdates.ci = updatePayload.ci
    if (updatePayload.telefono) profileUpdates.phone = updatePayload.telefono

    if (Object.keys(profileUpdates).length > 0) {
      await adminClient.from('profiles').update(profileUpdates).eq('id', new_user_id)
    }

    // Notificar al nuevo cliente en el sistema
    await adminClient.from('notificaciones').insert({
      usuario_id: new_user_id,
      titulo: '🎉 ¡Historial Sincronizado por CI Exitosamente!',
      mensaje: `¡Hola ${nombre || 'Cliente'}! Vinculamos automáticamente tus ${totalVisitasSum} visitas anteriores y beneficios de lealtad a tu perfil web (CI: ${cleanCi || 'N/A'}).`,
      tipo: 'success',
      categoria: 'sistema',
      link: '/cliente',
      leida: false,
    })

    // Enviar Correo de Bienvenida + Sincronización vía Nodemailer (Gmail App Password)
    if (cleanEmail) {
      try {
        await sendNotificationEmail(cleanEmail, 'registro_bienvenida_sync', {
          nombre: nombre || 'Cliente',
          ci: cleanCi || 'No especificado',
          visitas: totalVisitasSum.toString(),
          gastado: formatCurrency(totalGastadoSum),
        })
      } catch (eErr) {
        console.error('Error enviando correo de bienvenida sync:', eErr)
      }
    }

    // Notificar a Admin y Coordinadores
    const { data: staff } = await adminClient
      .from('profiles')
      .select('id, role')
      .in('role', ['admin', 'coordinador'])
      .eq('is_active', true)

    if (staff && staff.length > 0) {
      const notifs = staff.map(s => ({
        usuario_id: s.id,
        titulo: `🔗 Historial Sincronizado: ${nombre || 'Cliente'}`,
        mensaje: `El cliente ${nombre || 'Nuevo'} (CI: ${cleanCi || 'Sin CI'}) se registró y se vincularon automáticamente ${oldClientIds.length} historial(es) anterior(es) (${totalVisitasSum} visitas, Bs ${totalGastadoSum}).`,
        tipo: 'success',
        categoria: 'sistema',
        link: s.role === 'admin' ? '/admin/clientes' : '/coordinador',
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
