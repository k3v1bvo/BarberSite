import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getBusinessDateString } from '@/lib/asistencia/helpers'

/**
 * GET /api/turnos
 * Endpoint público/servidor para consultar el orden de turnos en apps externas (TV Android, tablets).
 * Devuelve la lista ya calculada, ordenada y rotada en JSON listo para consumir sin credenciales de Supabase.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const hoy = getBusinessDateString()

    // 1. Obtener offset de rotación
    const { data: configData } = await supabase
      .from('config_turnos')
      .select('rotation_offset, fecha')
      .eq('id', 'turno_offset')
      .maybeSingle()

    let rotationOffset = 0
    if (configData && configData.fecha === hoy) {
      rotationOffset = configData.rotation_offset || 0
    }

    // 2. Obtener asistencias de hoy con perfil
    const { data: asistencias, error } = await supabase
      .from('asistencias')
      .select(`
        id,
        hora_entrada,
        profile_id,
        profiles (
          full_name,
          avatar_url,
          role
        )
      `)
      .eq('fecha', hoy)
      .not('hora_entrada', 'is', null)
      .order('hora_entrada', { ascending: true })

    if (error || !asistencias) {
      return NextResponse.json({ turnos: [], total: 0, proximo: null })
    }

    // 3. Normalizar nombre para deduplicar
    const getNormalizedNameKey = (name: string): string => {
      if (!name) return ''
      const clean = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
      const parts = clean.split(/\s+/).filter(Boolean)
      return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0] || clean
    }

    // Deduplicar y filtrar solo rol barbero
    const seenProfileIds = new Set<string>()
    const seenNameKeys = new Set<string>()
    const asistenciasUnicas = asistencias.filter((item: any) => {
      const p = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      if (p?.role && p.role !== 'barbero') return false

      const nameKey = getNormalizedNameKey(p?.full_name || '')
      if (seenProfileIds.has(item.profile_id)) return false
      if (nameKey && seenNameKeys.has(nameKey)) return false

      seenProfileIds.add(item.profile_id)
      if (nameKey) seenNameKeys.add(nameKey)
      return true
    })

    // 4. Obtener citas completadas hoy
    const { data: citasHoy } = await supabase
      .from('citas')
      .select('barbero_id, updated_at')
      .gte('fecha_hora', `${hoy}T00:00:00`)
      .lte('fecha_hora', `${hoy}T23:59:59`)
      .eq('estado', 'completado')
      .order('updated_at', { ascending: false })

    const lastServedMap = new Map<string, string>()
    const totalCitasMap = new Map<string, number>()
    if (citasHoy) {
      for (const c of citasHoy) {
        if (!lastServedMap.has(c.barbero_id)) {
          lastServedMap.set(c.barbero_id, c.updated_at)
        }
        totalCitasMap.set(c.barbero_id, (totalCitasMap.get(c.barbero_id) || 0) + 1)
      }
    }

    // 5. Mapear items
    const mapeados = asistenciasUnicas.map((item: any) => {
      const p = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      return {
        id: item.id,
        profile_id: item.profile_id,
        full_name: p?.full_name || 'Barbero',
        avatar_url: p?.avatar_url || null,
        hora_entrada: item.hora_entrada,
        lastServedTime: lastServedMap.get(item.profile_id) || null,
        totalCitasHoy: totalCitasMap.get(item.profile_id) || 0,
        turnoPosicion: 0,
      }
    })

    // 6. Ordenar por llegada y última atención
    mapeados.sort((a, b) => {
      if (!a.lastServedTime && !b.lastServedTime) {
        return a.hora_entrada.localeCompare(b.hora_entrada)
      }
      if (!a.lastServedTime) return -1
      if (!b.lastServedTime) return 1
      return a.lastServedTime.localeCompare(b.lastServedTime)
    })

    // 7. Aplicar rotación cíclica
    const turnosOrdenados = [...mapeados]
    if (turnosOrdenados.length > 0 && rotationOffset > 0) {
      const shift = rotationOffset % turnosOrdenados.length
      const movidos = turnosOrdenados.splice(0, shift)
      turnosOrdenados.push(...movidos)
    }

    turnosOrdenados.forEach((m, idx) => {
      m.turnoPosicion = idx + 1
    })

    return NextResponse.json({
      turnos: turnosOrdenados,
      total: turnosOrdenados.length,
      proximo: turnosOrdenados[0] || null,
      rotationOffset,
      fecha: hoy
    })
  } catch (err: any) {
    console.error('Error GET /api/turnos:', err)
    return NextResponse.json({ error: 'Error al obtener turnos' }, { status: 500 })
  }
}

/**
 * POST /api/turnos
 * Rotar turno ("Pasar Turno") desde app externa o botón web.
 */
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const hoy = getBusinessDateString()

    const { data: configData } = await supabase
      .from('config_turnos')
      .select('rotation_offset, fecha')
      .eq('id', 'turno_offset')
      .maybeSingle()

    let currentOffset = 0
    if (configData && configData.fecha === hoy) {
      currentOffset = configData.rotation_offset || 0
    }

    const nextOffset = currentOffset + 1

    await supabase.from('config_turnos').upsert({
      id: 'turno_offset',
      fecha: hoy,
      rotation_offset: nextOffset,
      updated_at: new Date().toISOString()
    })

    return NextResponse.json({ success: true, nextOffset })
  } catch (err: any) {
    console.error('Error POST /api/turnos:', err)
    return NextResponse.json({ error: 'Error al rotar turno' }, { status: 500 })
  }
}
