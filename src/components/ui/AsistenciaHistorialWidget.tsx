'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Clock, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { estadoBadgeVariant, estadoLabel, computeEstadoFromRecord, type AsistenciaEstado } from '@/lib/asistencia/helpers'

interface AsistenciaHistorial {
  id: string
  fecha: string
  hora_entrada: string
  hora_salida: string | null
  horas_trabajadas: number | null
  cierre_automatico?: boolean
  estado?: string
  en_almuerzo?: boolean
}

function getMondayOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0]
}

const DIAS_NOMBRE = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function AsistenciaHistorialWidget() {
  const [registros, setRegistros] = useState<AsistenciaHistorial[]>([])
  const [loading, setLoading] = useState(true)
  const [semanaInicio, setSemanaInicio] = useState<Date>(() => getMondayOfWeek(new Date()))

  const supabase = createClient()

  const loadHistorial = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const desde = fmt(semanaInicio)
      const hasta = fmt(addDays(semanaInicio, 6))

      const { data } = await supabase
        .from('asistencias')
        .select('id, fecha, hora_entrada, hora_salida, horas_trabajadas, cierre_automatico, estado, en_almuerzo')
        .eq('profile_id', user.id)
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: true })

      setRegistros(data || [])
    } catch (err) {
      console.error('Error cargando historial:', err)
    } finally {
      setLoading(false)
    }
  }, [semanaInicio, supabase])

  useEffect(() => {
    loadHistorial()
  }, [loadHistorial])

  const semanaFin = addDays(semanaInicio, 6)
  const totalHoras = registros.reduce((sum, r) => sum + (r.horas_trabajadas ?? 0), 0)
  const diasPuntuales = registros.filter(r => {
    const estado = computeEstadoFromRecord(r)
    return estado === 'presente' || estado === 'finalizado'
  }).length
  const diasAtraso = registros.filter(r => computeEstadoFromRecord(r) === 'atrasado' || r.estado === 'atrasado').length

  const esEstaSemana = fmt(getMondayOfWeek(new Date())) === fmt(semanaInicio)

  return (
    <Card className="bg-zinc-900 border-white/5">
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-amber-500" />
            <h3 className="font-black uppercase tracking-widest text-sm text-white">Mi Historial de Asistencia</h3>
          </div>
        </div>

        {/* Navegación semana */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setSemanaInicio(s => addDays(s, -7))}
            className="p-1.5 rounded-lg hover:bg-white/10 border border-white/5 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <p className="text-white font-bold text-xs">
              {semanaInicio.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })} — {semanaFin.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })}
            </p>
            {esEstaSemana && <p className="text-amber-500 text-[10px] font-black uppercase">Esta semana</p>}
          </div>
          <button
            onClick={() => setSemanaInicio(s => addDays(s, 7))}
            disabled={esEstaSemana}
            className="p-1.5 rounded-lg hover:bg-white/10 border border-white/5 text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-black/30 rounded-xl p-3 text-center">
            <p className="text-amber-500 font-black text-xl">{totalHoras.toFixed(1)}</p>
            <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Horas</p>
          </div>
          <div className="bg-black/30 rounded-xl p-3 text-center">
            <p className="text-green-400 font-black text-xl">{diasPuntuales}</p>
            <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Puntuales</p>
          </div>
          <div className="bg-black/30 rounded-xl p-3 text-center">
            <p className={`font-black text-xl ${diasAtraso > 0 ? 'text-yellow-400' : 'text-zinc-600'}`}>{diasAtraso}</p>
            <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Atrasos</p>
          </div>
        </div>

        {/* Detalle por día */}
        {loading ? (
          <div className="flex justify-center py-6">
            <Clock className="w-6 h-6 text-amber-500 animate-spin" />
          </div>
        ) : registros.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-4">Sin registros esta semana</p>
        ) : (
          <div className="space-y-1.5">
            {registros.map(r => {
              const estado: AsistenciaEstado = computeEstadoFromRecord(r)
              const d = new Date(r.fecha + 'T12:00:00')
              const diaNombre = DIAS_NOMBRE[d.getDay()]

              return (
                <div key={r.id} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-zinc-500 w-8">{diaNombre}</span>
                    <span className="text-xs text-zinc-400">
                      {new Date(r.hora_entrada).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      {r.hora_salida && (
                        <> — {new Date(r.hora_salida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.horas_trabajadas != null && (
                      <span className="text-amber-500 font-bold text-xs">{r.horas_trabajadas}h</span>
                    )}
                    <Badge variant={estadoBadgeVariant(estado)} className="text-[8px] uppercase px-1.5 py-0.5">
                      {estadoLabel(estado)}
                    </Badge>
                    {r.cierre_automatico && <span className="text-[8px] text-amber-500">⚡</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
