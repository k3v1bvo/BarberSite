'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { Scissors, Clock, Calendar, Sun, Moon, Sparkles, CheckCircle2, ChevronRight, User, AlertCircle } from 'lucide-react'

export interface BarberoProfile {
  id: string
  full_name: string
  avatar_url?: string | null
  email?: string
  role?: string
}

export interface HorarioSemanalItem {
  barbero_id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  activo: boolean
  fraccionado?: boolean
  hora_inicio_2?: string | null
  hora_fin_2?: string | null
}

const DIAS_SEMANA = [
  { dia: 1, nombre: 'Lunes', corto: 'Lun' },
  { dia: 2, nombre: 'Martes', corto: 'Mar' },
  { dia: 3, nombre: 'Miércoles', corto: 'Mié' },
  { dia: 4, nombre: 'Jueves', corto: 'Jue' },
  { dia: 5, nombre: 'Viernes', corto: 'Vie' },
  { dia: 6, nombre: 'Sábado', corto: 'Sáb' },
  { dia: 0, nombre: 'Domingo', corto: 'Dom' },
]

export function getTurnoInfo(horaInicio?: string, horaFin?: string, activo?: boolean) {
  if (!activo || !horaInicio || !horaFin) {
    return {
      tipo: 'libre' as const,
      label: 'Día Libre',
      icon: '🏖️',
      badgeClass: 'text-zinc-400 bg-zinc-800/60 border-zinc-700/50',
    }
  }

  const [hIni] = horaInicio.split(':').map(Number)
  const [hFin] = horaFin.split(':').map(Number)
  const duracion = hFin - hIni

  // Turno Mañana: termina a las 15:30 o antes, o empieza temprano con duración corta
  if (hFin <= 15 || (hIni < 12 && duracion <= 6)) {
    return {
      tipo: 'manana' as const,
      label: 'Turno Mañana',
      icon: '☀️',
      badgeClass: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
    }
  }

  // Turno Tarde: empieza a las 13:00 o después
  if (hIni >= 13) {
    return {
      tipo: 'tarde' as const,
      label: 'Turno Tarde',
      icon: '🌙',
      badgeClass: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
    }
  }

  // Jornada Continua o Mixta
  return {
    tipo: 'continuo' as const,
    label: 'Jornada Completa',
    icon: '⏰',
    badgeClass: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  }
}

function toTitleCase(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

interface HorariosBarberosWidgetProps {
  className?: string
  onSelectBarbero?: (barberoId: string) => void
}

export function HorariosBarberosWidget({ className, onSelectBarbero }: HorariosBarberosWidgetProps) {
  const router = useRouter()
  const [barberos, setBarberos] = useState<BarberoProfile[]>([])
  const [horarios, setHorarios] = useState<HorarioSemanalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTurno, setFiltroTurno] = useState<'todos' | 'manana' | 'tarde' | 'hoy'>('todos')
  const [barberoExpandido, setBarberoExpandido] = useState<string | null>(null)

  // Obtener el día actual en hora de Bolivia (0=Dom..6=Sáb)
  const getDiaHoyBolivia = () => {
    try {
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' }))
      return now.getDay()
    } catch {
      return new Date().getDay()
    }
  }

  const diaHoy = getDiaHoyBolivia()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/barberos/horarios', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data.barberos) {
            setBarberos(data.barberos.filter((b: BarberoProfile) => b.role === 'barbero'))
          }
          if (data.horarios) {
            setHorarios(data.horarios)
          }
        }
      } catch (err) {
        console.error('Error al cargar horarios de barberos:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Filtrar barberos según el turno seleccionado
  const barberosFiltrados = barberos.filter(b => {
    const horarioHoy = horarios.find(h => h.barbero_id === b.id && h.dia_semana === diaHoy)
    const turnoHoy = getTurnoInfo(horarioHoy?.hora_inicio, horarioHoy?.hora_fin, horarioHoy?.activo)

    if (filtroTurno === 'hoy') {
      return horarioHoy?.activo === true
    }

    if (filtroTurno === 'manana') {
      // Tiene turno mañana hoy o en al menos 2 días de la semana
      const turnosSemana = horarios.filter(h => h.barbero_id === b.id && h.activo)
      const tieneManana = turnosSemana.some(h => getTurnoInfo(h.hora_inicio, h.hora_fin, true).tipo === 'manana')
      return (horarioHoy?.activo && turnoHoy.tipo === 'manana') || tieneManana
    }

    if (filtroTurno === 'tarde') {
      // Tiene turno tarde hoy o en al menos 2 días de la semana
      const turnosSemana = horarios.filter(h => h.barbero_id === b.id && h.activo)
      const tieneTarde = turnosSemana.some(h => getTurnoInfo(h.hora_inicio, h.hora_fin, true).tipo === 'tarde')
      return (horarioHoy?.activo && turnoHoy.tipo === 'tarde') || tieneTarde
    }

    return true
  })

  const handleReservarConBarbero = (barberoId: string) => {
    if (onSelectBarbero) {
      onSelectBarbero(barberoId)
    } else {
      router.push(`/reservar?barberoId=${barberoId}`)
    }
  }

  if (loading) {
    return (
      <div className={cn("p-6 bg-zinc-900/60 rounded-3xl border border-zinc-800 animate-pulse text-center", className)}>
        <Clock className="w-8 h-8 text-amber-500/40 mx-auto mb-2 animate-spin" />
        <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Cargando horarios de los barberos...</p>
      </div>
    )
  }

  if (barberos.length === 0) {
    return null
  }

  return (
    <Card className={cn("bg-zinc-900/90 border border-white/10 rounded-3xl overflow-hidden shadow-xl", className)}>
      <CardContent className="p-5 sm:p-7 space-y-6">
        {/* Header con título y descripción amigable */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Horarios de Nuestros Barberos</h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  En Vivo
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Conoce los días y turnos (mañana, tarde o continuo) de cada barbero para agendar tu cita a la hora que más te convenga.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/reservar')}
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500 hover:text-black font-black text-xs gap-1.5 rounded-xl shrink-0"
          >
            <Scissors size={14} /> Reservar Ahora
          </Button>
        </div>

        {/* Filtros rápidos de turno */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-black uppercase text-zinc-500 mr-1">Filtrar:</span>
          
          <button
            type="button"
            onClick={() => setFiltroTurno('todos')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
              filtroTurno === 'todos'
                ? "bg-amber-500 text-black border-amber-400 shadow-md font-black"
                : "bg-black/40 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
            )}
          >
            Todos ({barberos.length})
          </button>

          <button
            type="button"
            onClick={() => setFiltroTurno('hoy')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
              filtroTurno === 'hoy'
                ? "bg-emerald-500 text-black border-emerald-400 shadow-md font-black"
                : "bg-black/40 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Atendiendo Hoy
          </button>

          <button
            type="button"
            onClick={() => setFiltroTurno('manana')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
              filtroTurno === 'manana'
                ? "bg-amber-500/30 text-amber-200 border-amber-500 shadow-md font-black"
                : "bg-black/40 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
            )}
          >
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            Turno Mañana
          </button>

          <button
            type="button"
            onClick={() => setFiltroTurno('tarde')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
              filtroTurno === 'tarde'
                ? "bg-blue-500/30 text-blue-200 border-blue-500 shadow-md font-black"
                : "bg-black/40 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
            )}
          >
            <Moon className="w-3.5 h-3.5 text-blue-400" />
            Turno Tarde
          </button>
        </div>

        {/* Tarjetas de Barberos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {barberosFiltrados.map(barbero => {
            const horarioHoy = horarios.find(h => h.barbero_id === barbero.id && h.dia_semana === diaHoy)
            const turnoHoy = getTurnoInfo(horarioHoy?.hora_inicio, horarioHoy?.hora_fin, horarioHoy?.activo)
            const estaExpandido = barberoExpandido === barbero.id

            return (
              <div
                key={barbero.id}
                className={cn(
                  "p-4 sm:p-5 rounded-2xl border transition-all duration-300 bg-black/40 hover:bg-zinc-800/40 flex flex-col justify-between space-y-4",
                  horarioHoy?.activo
                    ? "border-zinc-800 hover:border-amber-500/40"
                    : "border-zinc-800/60 opacity-80"
                )}
              >
                {/* Info Barbero y Estado de Hoy */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-zinc-950 border-2 border-zinc-700 flex items-center justify-center shadow-md">
                        {barbero.avatar_url ? (
                          <img
                            src={barbero.avatar_url}
                            alt={barbero.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xl font-black text-amber-500">
                            {barbero.full_name.charAt(0)}
                          </span>
                        )}
                      </div>
                      {horarioHoy?.activo ? (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-zinc-950 rounded-full shadow-sm" title="Atiende hoy" />
                      ) : (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-zinc-600 border-2 border-zinc-950 rounded-full shadow-sm" title="Libre hoy" />
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm sm:text-base font-black text-white leading-tight">
                        {toTitleCase(barbero.full_name)}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border",
                          turnoHoy.badgeClass
                        )}>
                          <span>{turnoHoy.icon}</span>
                          <span>
                            {horarioHoy?.activo
                              ? `Hoy: ${horarioHoy.hora_inicio} - ${horarioHoy.hora_fin}`
                              : 'Hoy: Día Libre'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-md shrink-0">
                    {turnoHoy.label}
                  </span>
                </div>

                {/* Resumen Semanal de Días */}
                <div className="pt-2 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400">
                    <span className="uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-500" /> Horario Semanal:
                    </span>
                    <button
                      type="button"
                      onClick={() => setBarberoExpandido(estaExpandido ? null : barbero.id)}
                      className="text-amber-400 hover:text-amber-300 font-black uppercase tracking-wider hover:underline"
                    >
                      {estaExpandido ? 'Ocultar Detalle' : 'Ver Días'}
                    </button>
                  </div>

                  {/* Pills de los 7 días de la semana */}
                  <div className="grid grid-cols-7 gap-1">
                    {DIAS_SEMANA.map(d => {
                      const hDia = horarios.find(h => h.barbero_id === barbero.id && h.dia_semana === d.dia)
                      const tInfo = getTurnoInfo(hDia?.hora_inicio, hDia?.hora_fin, hDia?.activo)
                      const esDiaDeHoy = d.dia === diaHoy

                      return (
                        <div
                          key={d.dia}
                          className={cn(
                            "py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center text-center transition-all border",
                            esDiaDeHoy
                              ? "bg-amber-500/20 border-amber-500/80 ring-1 ring-amber-500/40"
                              : hDia?.activo
                                ? "bg-zinc-900 border-zinc-800"
                                : "bg-black/30 border-transparent opacity-40"
                          )}
                          title={`${d.nombre}: ${hDia?.activo ? `${hDia.hora_inicio} a ${hDia.hora_fin} (${tInfo.label})` : 'Día Libre'}`}
                        >
                          <span className={cn(
                            "text-[9px] font-black uppercase leading-none",
                            esDiaDeHoy ? "text-amber-400" : "text-zinc-400"
                          )}>
                            {d.corto}
                          </span>
                          <span className="text-[11px] mt-0.5">{tInfo.icon}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Vista expandida con tabla detallada de horas por día */}
                  {estaExpandido && (
                    <div className="mt-3 p-3 bg-zinc-950/80 rounded-xl border border-zinc-800 space-y-1.5 text-xs animate-in fade-in duration-200">
                      <p className="text-[10px] font-black uppercase text-amber-400 tracking-wider mb-2">
                        Detalle de Turnos por Día:
                      </p>
                      <div className="space-y-1">
                        {DIAS_SEMANA.map(d => {
                          const hDia = horarios.find(h => h.barbero_id === barbero.id && h.dia_semana === d.dia)
                          const tInfo = getTurnoInfo(hDia?.hora_inicio, hDia?.hora_fin, hDia?.activo)
                          const esHoy = d.dia === diaHoy

                          return (
                            <div
                              key={d.dia}
                              className={cn(
                                "flex items-center justify-between py-1 px-2 rounded-lg text-xs font-bold",
                                esHoy ? "bg-amber-500/10 text-amber-300 border border-amber-500/30" : "text-zinc-300"
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>{tInfo.icon}</span>
                                <span className={esHoy ? "font-black" : "font-medium"}>
                                  {d.nombre} {esHoy && '(Hoy)'}:
                                </span>
                              </div>
                              <span className={hDia?.activo ? "font-mono font-bold" : "text-zinc-500 italic"}>
                                {hDia?.activo ? `${hDia.hora_inicio} - ${hDia.hora_fin}` : 'Día Libre'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Botón de Reserva Directa */}
                <div className="pt-2">
                  <Button
                    onClick={() => handleReservarConBarbero(barbero.id)}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 active:scale-98 transition-all"
                  >
                    <Scissors size={14} />
                    <span>Reservar con {barbero.full_name.split(' ')[0]}</span>
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {barberosFiltrados.length === 0 && (
          <div className="p-8 text-center bg-black/40 border border-zinc-800 rounded-2xl space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-500/60 mx-auto" />
            <p className="text-white font-bold text-sm">No se encontraron barberos con el filtro seleccionado</p>
            <p className="text-xs text-zinc-400">Intenta seleccionando &quot;Todos&quot; para ver todo el equipo.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
