import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getBoliviaDateString, getBusinessNow } from '@/lib/asistencia/helpers'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('cliente_id')
    const clienteNombre = searchParams.get('nombre') || ''
    const clienteEmail = searchParams.get('email') || ''
    const clienteCi = searchParams.get('ci') || ''

    if (!clienteId && !clienteNombre) {
      return NextResponse.json({ error: 'Falta cliente_id o nombre' }, { status: 400 })
    }

    let resolvedClienteId = clienteId || ''
    let resolvedCliente: any = null

    if (!resolvedClienteId && (clienteCi || clienteNombre || clienteEmail)) {
      const orFilters: string[] = []
      if (clienteCi && clienteCi.trim()) orFilters.push(`ci.eq.${clienteCi.trim()}`)
      if (clienteEmail && clienteEmail.trim()) orFilters.push(`email.eq.${clienteEmail.trim()}`)
      if (clienteNombre && clienteNombre.trim().length >= 3) orFilters.push(`nombre.ilike.%${clienteNombre.trim()}%`)

      if (orFilters.length > 0) {
        const { data: found } = await supabase
          .from('clientes')
          .select('id, nombre, email, telefono, ci, nivel_fidelidad, total_visitas, total_gastado, codigo_tarjeta')
          .or(orFilters.join(','))
          .limit(1)
          .maybeSingle()
        if (found) {
          resolvedClienteId = found.id
          resolvedCliente = found
        }
      }
    }

    const hoyStr = getBoliviaDateString()

    // 1. Bonos de Referidos ganados por este cliente y aún no usados
    let referralBonuses: any[] = []
    if (resolvedClienteId) {
      const { data: refs } = await supabase
        .from('referrals')
        .select('id, monto_bono, bono_otorgado, bono_usado, creado_en, recomendado:clientes!cliente_recomendado_id(nombre)')
        .eq('cliente_recomendante_id', resolvedClienteId)
        .eq('bono_otorgado', true)
        .or('bono_usado.is.null,bono_usado.eq.false')

      referralBonuses = refs || []
    }

    // 2. ¿Tiene verificación de cumpleaños reciente (ej. los últimos 30 días)?
    let cumpleanosVerificado: any = null
    if (resolvedClienteId) {
      const hoy = getBusinessNow()
      const { data: verif } = await supabase
        .from('cumpleanos_verificados')
        .select('*, promo:promociones(id, nombre, tipo, valor)')
        .eq('cliente_id', resolvedClienteId)
        .order('fecha_verificacion', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (verif && verif.fecha_verificacion) {
        const verifDate = new Date(verif.fecha_verificacion)
        const diffInDays = Math.abs((hoy.getTime() - verifDate.getTime()) / (1000 * 3600 * 24))
        if (diffInDays <= 30) {
          cumpleanosVerificado = verif
        }
      }
    }

    // 3. ¿Es la pareja pendiente de un 2x1 registrado hoy?
    // Buscamos en las citas de hoy (o notas) si alguien registró a este cliente en acompañante_2x1
    let pareja2x1Pendiente: any = null
    const { data: citasHoy } = await supabase
      .from('citas')
      .select('id, cliente_id, fecha_hora, notas, descuento, clientes(nombre, telefono, email)')
      .gte('fecha_hora', `${hoyStr}T00:00:00`)
      .lte('fecha_hora', `${hoyStr}T23:59:59`)
      .ilike('notas', '%[PROMO 2x1]%')

    if (citasHoy && citasHoy.length > 0) {
      for (const c of citasHoy) {
        if (c.cliente_id === resolvedClienteId) continue

        const notasLower = (c.notas || '').toLowerCase()
        const matchNombre = clienteNombre && clienteNombre.trim().length >= 3 && notasLower.includes(clienteNombre.trim().toLowerCase())
        const matchEmail = clienteEmail && clienteEmail.trim().length >= 5 && notasLower.includes(clienteEmail.trim().toLowerCase())
        const matchCi = clienteCi && clienteCi.trim().length >= 4 && notasLower.includes(clienteCi.trim().toLowerCase())

        if (matchNombre || matchEmail || matchCi) {
          pareja2x1Pendiente = {
            cita_origen_id: c.id,
            principal_nombre: (c.clientes as any)?.nombre || 'Amigo/Pareja',
            notas: c.notas
          }
          break
        }
      }
    }

    // 4. Historial de Citas / Servicios Anteriores
    let historialCitas: any[] = []
    let barberoFrecuente = ''
    let ultimaVisitaFecha = ''
    if (resolvedClienteId) {
      const { data: citas } = await supabase
        .from('citas')
        .select(`
          id, fecha_hora, precio, estado, metodo_pago, notas, propinas, anticipo_monto,
          servicios (nombre, precio, duracion_minutos),
          profiles!citas_barbero_id_fkey (full_name)
        `)
        .eq('cliente_id', resolvedClienteId)
        .order('fecha_hora', { ascending: false })
        .limit(10)

      historialCitas = citas || []

      // Calcular barbero más frecuente y última visita
      const barberoCount: Record<string, number> = {}
      for (const c of historialCitas) {
        const barberoName = (c.profiles as any)?.full_name
        if (barberoName) {
          barberoCount[barberoName] = (barberoCount[barberoName] || 0) + 1
        }
        if (!ultimaVisitaFecha && c.estado === 'completado') {
          ultimaVisitaFecha = c.fecha_hora
        }
      }
      let maxCount = 0
      for (const [bName, count] of Object.entries(barberoCount)) {
        if (count > maxCount) {
          maxCount = count
          barberoFrecuente = bName
        }
      }
    }

    // 5. Historial de Compras de Productos
    let historialProductos: any[] = []
    if (resolvedClienteId) {
      const { data: prods } = await supabase
        .from('citas_productos')
        .select(`
          id, cantidad, precio_unitario, subtotal,
          productos (nombre, categoria),
          citas!inner (cliente_id, fecha_hora)
        `)
        .eq('citas.cliente_id', resolvedClienteId)
        .order('id', { ascending: false })
        .limit(10)

      historialProductos = prods || []
    }

    // 6. Transacciones de Caja Chica / Ventas históricas
    let transaccionesCaja: any[] = []
    const orFilters: string[] = []
    const nombreParaBuscar = clienteNombre || resolvedCliente?.nombre || ''
    const ciParaBuscar = clienteCi || resolvedCliente?.ci || ''
    if (nombreParaBuscar && nombreParaBuscar.trim().length >= 3) {
      orFilters.push(`nombre.ilike.%${nombreParaBuscar.trim()}%`)
      orFilters.push(`glosa.ilike.%${nombreParaBuscar.trim()}%`)
    }
    if (ciParaBuscar && ciParaBuscar.trim().length >= 4) {
      orFilters.push(`ci.ilike.%${ciParaBuscar.trim()}%`)
    }
    if (orFilters.length > 0) {
      const { data: txs } = await supabase
        .from('transactions')
        .select('id, fecha, creado_en, glosa, costo, metodo_pago, libro, tipo_movimiento, usuario_registro, nombre')
        .or(orFilters.join(','))
        .order('creado_en', { ascending: false })
        .limit(10)
      transaccionesCaja = txs || []
    }

    return NextResponse.json({
      cliente: resolvedCliente,
      referralBonuses,
      cumpleanosVerificado,
      pareja2x1Pendiente,
      historialCitas,
      historialProductos,
      transaccionesCaja,
      stats: {
        barberoFrecuente,
        ultimaVisitaFecha
      }
    })
  } catch (err: any) {
    console.error('Error en GET /api/pos/client-extras:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
