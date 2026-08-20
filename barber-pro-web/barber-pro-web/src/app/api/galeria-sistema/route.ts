import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Agrega TODAS las imágenes subidas al sistema, clasificadas por origen
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'coordinador'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const [portRes, equipoRes, prodRes, perfilesRes, cumpleRes, configRes, egresosRes, citasRes, todosPerfilesRes] = await Promise.all([
      supabase.from('portafolio').select('id,image_url,titulo,categoria,barbero_id,profiles!barbero_id(full_name),created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(100),
      supabase.from('equipo_home').select('id,imagen_url,nombre,especialidad,created_at').order('created_at', { ascending: false }),
      supabase.from('productos').select('id,nombre,image_url,categoria,created_at').not('image_url', 'is', null).limit(100),
      supabase.from('profiles').select('id,full_name,avatar_url,role').not('avatar_url', 'is', null).limit(50),
      supabase.from('cumpleanos_verificados').select('id,foto_documento_url,tipo_documento,clientes(nombre),created_at').not('foto_documento_url', 'is', null).order('created_at', { ascending: false }).limit(50),
      supabase.from('configuraciones').select('llave,valor,descripcion').in('llave', ['qr_pago', 'hero_bg_image']),
      supabase.from('egresos').select('id,comprobante_url,concepto,monto_bruto,fecha,creado_en').not('comprobante_url', 'is', null).order('creado_en', { ascending: false }).limit(100),
      supabase.from('citas').select('id,notas,precio,anticipo_monto,fecha_hora,barbero_id,clientes(nombre)').ilike('notas', '%http%').order('fecha_hora', { ascending: false }).limit(100),
      supabase.from('profiles').select('id,full_name'),
    ])

    const profilesMap = new Map<string, string>((todosPerfilesRes?.data || []).map((p: any) => [p.id, p.full_name]))

    // Normalizar cada fuente a formato { id, url, label, categoria, meta, fecha }
    const galeria: any[] = []

    // 1. QR y Hero bg desde configuraciones
    for (const cfg of configRes.data ?? []) {
      if (cfg.valor?.url) {
        galeria.push({
          id: `cfg-${cfg.llave}`,
          url: cfg.valor.url,
          label: cfg.llave === 'qr_pago' ? 'QR de Pagos' : 'Fondo de Inicio (Hero)',
          categoria: 'Sistema',
          icono: cfg.llave === 'qr_pago' ? '📱' : '🖼️',
          meta: cfg.descripcion,
          fecha: null,
        })
      }
    }

    // 2. Portfolio / galería de trabajos
    for (const p of portRes.data ?? []) {
      if (p.image_url) {
        galeria.push({
          id: `port-${p.id}`,
          url: p.image_url,
          label: p.titulo || p.categoria,
          categoria: 'Portafolio',
          icono: '✂️',
          meta: (p as any).profiles?.full_name ?? 'Barbero',
          fecha: p.created_at,
        })
      }
    }

    // 3. Equipo (carrusel de barberos en la web pública)
    for (const e of equipoRes.data ?? []) {
      if (e.imagen_url) {
        galeria.push({
          id: `equipo-${e.id}`,
          url: e.imagen_url,
          label: e.nombre,
          categoria: 'Equipo',
          icono: '👤',
          meta: e.especialidad,
          fecha: e.created_at,
        })
      }
    }

    // 4. Productos
    for (const p of prodRes.data ?? []) {
      const url = p.image_url
      if (url) {
        galeria.push({
          id: `prod-${p.id}`,
          url,
          label: p.nombre,
          categoria: 'Productos',
          icono: '📦',
          meta: p.categoria,
          fecha: p.created_at,
        })
      }
    }

    // 5. Avatares de perfiles
    for (const p of perfilesRes.data ?? []) {
      if (p.avatar_url) {
        galeria.push({
          id: `perfil-${p.id}`,
          url: p.avatar_url,
          label: p.full_name || 'Usuario',
          categoria: 'Avatares',
          icono: '🧑',
          meta: p.role,
          fecha: null,
        })
      }
    }

    // 6. Fotos de documentos de cumpleaños
    for (const c of cumpleRes.data ?? []) {
      if (c.foto_documento_url) {
        const urls = c.foto_documento_url.split(' | ').map((u: string) => u.trim()).filter(Boolean)
        urls.forEach((url: string, idx: number) => {
          galeria.push({
            id: `cumple-${c.id}-${idx}`,
            url,
            label: `${(c as any).clientes?.nombre ?? 'Cliente'}${urls.length > 1 ? (idx === 0 ? ' (Anverso)' : ' (Reverso)') : ''}`,
            categoria: 'Documentos Cumpleaños',
            icono: '🎂',
            meta: `${c.tipo_documento}${urls.length > 1 ? (idx === 0 ? ' - Anverso' : ' - Reverso') : ''}`,
            fecha: c.created_at,
          })
        })
      }
    }

    // 7. Comprobantes de Egresos
    for (const e of egresosRes.data ?? []) {
      if (e.comprobante_url) {
        galeria.push({
          id: `egr-${e.id}`,
          url: e.comprobante_url,
          label: e.concepto || 'Egreso',
          categoria: 'Comprobantes Financieros',
          icono: '💸',
          meta: `Egreso · Bs ${e.monto_bruto || 0}`,
          fecha: e.creado_en || e.fecha,
          monto: e.monto_bruto || 0,
          tipoMovimiento: 'Egreso de Caja',
          concepto: e.concepto || 'Egreso general',
        })
      }
    }

    // 8. Comprobantes de Citas / Servicios
    for (const c of citasRes.data ?? []) {
      const match = c.notas?.match(/(https?:\/\/[^\s]+)/)
      if (match && match[1]) {
        const clienteNombre = (c as any).clientes?.nombre || 'Cliente'
        const barberoNombre = profilesMap.get(c.barbero_id) || 'Barbero'
        const esPagoCompleto = c.notas?.includes('Pago Completo') || (c.anticipo_monto && c.anticipo_monto >= c.precio)
        const montoQR = c.anticipo_monto || c.precio || 0
        galeria.push({
          id: `cita-${c.id}`,
          url: match[1],
          label: `${clienteNombre}`,
          categoria: 'Comprobantes Servicios',
          icono: '🧾',
          meta: `Barbero: ${barberoNombre} · Cliente: ${clienteNombre} · ${esPagoCompleto ? 'Pago Completo QR' : 'Reserva/Adelanto QR'} (Bs ${montoQR})`,
          fecha: c.fecha_hora,
          clienteNombre,
          barberoNombre,
          monto: montoQR,
          tipoMovimiento: esPagoCompleto ? 'Pago Completo de Cita (100% QR)' : 'Anticipo / Reserva de Cita (QR)',
          concepto: esPagoCompleto ? 'Pago 100% por QR' : `Reserva / Adelanto de cita (Bs ${montoQR})`,
        })
      }
    }

    const categorias = [...new Set(galeria.map(g => g.categoria))]
    return NextResponse.json({ galeria, categorias, total: galeria.length })
  } catch (err) {
    console.error('Error galeria:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
