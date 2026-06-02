'use client'

import React from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfDay,
  parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Badge } from './Badge'
import clsx from 'clsx'
import type { AgendaCita } from '@/lib/agenda/types'
import { getBarberColorClass } from '@/lib/agenda/barber-colors'
import type { AgendaView } from '@/lib/agenda/date-range'
import { formatCurrency } from '@/lib/utils'

export type CalendarCita = AgendaCita

interface CalendarViewProps {
  citas: CalendarCita[]
  view: AgendaView
  onViewChange: (view: AgendaView) => void
  selectedDate: Date
  onDateChange: (date: Date) => void
  onCitaClick?: (cita: CalendarCita) => void
  barberoNombre?: string
  mode?: 'general' | 'individual'
  onDaySelect?: (date: Date) => void
}

const getEstadoColor = (estado: string): string => {
  const colors = {
    pendiente: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200',
    confirmado: 'bg-blue-500/20 border-blue-500/50 text-blue-200',
    en_proceso: 'bg-purple-500/20 border-purple-500/50 text-purple-200',
    completado: 'bg-green-500/20 border-green-500/50 text-green-200',
    cancelado: 'bg-red-500/20 border-red-500/50 text-red-200',
    no_presento: 'bg-red-500/20 border-red-500/50 text-red-200',
  }
  return colors[estado as keyof typeof colors] || colors.pendiente
}

const getEstadoBadgeVariant = (estado: string) => {
  const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    pendiente: 'warning',
    confirmado: 'info',
    en_proceso: 'info',
    completado: 'success',
    cancelado: 'danger',
    no_presento: 'danger',
  }
  return variants[estado] || 'default'
}

function getCitaBlockClass(cita: CalendarCita, mode: 'general' | 'individual'): string {
  if (mode === 'general' && cita.barbero_id) {
    return clsx(
      'text-[10px] p-1 rounded border cursor-pointer transition-all hover:shadow-lg',
      getBarberColorClass(cita.barbero_id)
    )
  }
  return clsx(
    'text-[10px] p-1 rounded border cursor-pointer transition-all hover:shadow-lg',
    getEstadoColor(cita.estado)
  )
}

export function CalendarView({
  citas,
  view,
  onViewChange,
  selectedDate,
  onDateChange,
  onCitaClick,
  barberoNombre,
  mode = 'individual',
  onDaySelect,
}: CalendarViewProps) {
  const handlePrevious = () => {
    if (view === 'mes') {
      onDateChange(subMonths(selectedDate, 1))
    } else if (view === 'semana') {
      onDateChange(new Date(selectedDate.getTime() - 7 * 24 * 60 * 60 * 1000))
    } else {
      onDateChange(new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000))
    }
  }

  const handleNext = () => {
    if (view === 'mes') {
      onDateChange(addMonths(selectedDate, 1))
    } else if (view === 'semana') {
      onDateChange(new Date(selectedDate.getTime() + 7 * 24 * 60 * 60 * 1000))
    } else {
      onDateChange(new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000))
    }
  }

  const handleToday = () => {
    onDateChange(new Date())
  }

  const handleDayClick = (day: Date) => {
    onDateChange(day)
    onDaySelect?.(day)
    if (view !== 'dia') {
      onViewChange('dia')
    }
  }

  const renderCitaLabel = (cita: CalendarCita, compact = false) => (
    <>
      <div className="font-bold truncate">
        {format(parseISO(cita.fecha_hora), 'HH:mm')}
        {mode === 'general' && compact && (
          <span className="opacity-80"> · {cita.barbero_nombre.split(' ')[0]}</span>
        )}
      </div>
      <div className="truncate">{cita.cliente_nombre}</div>
      {!compact && mode === 'general' && (
        <div className="truncate opacity-80 text-[9px]">{cita.barbero_nombre}</div>
      )}
    </>
  )

  const renderMesView = () => {
    const monthStart = startOfMonth(selectedDate)
    const monthEnd = endOfMonth(monthStart)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    const weeks: Date[][] = []

    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }

    const citasPorDia = new Map<string, CalendarCita[]>()
    citas.forEach((cita) => {
      const fechaKey = format(parseISO(cita.fecha_hora), 'yyyy-MM-dd')
      if (!citasPorDia.has(fechaKey)) {
        citasPorDia.set(fechaKey, [])
      }
      citasPorDia.get(fechaKey)!.push(cita)
    })

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
            <div key={day} className="text-center font-bold text-zinc-500 text-sm py-2">
              {day}
            </div>
          ))}
        </div>

        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 gap-2">
            {week.map((day) => {
              const isCurrentMonth = isSameMonth(day, monthStart)
              const isToday = isSameDay(day, new Date())
              const dayKey = format(day, 'yyyy-MM-dd')
              const daysCitas = citasPorDia.get(dayKey) || []

              return (
                <div
                  key={dayKey}
                  className={clsx(
                    'min-h-32 p-2 border rounded-lg transition-all cursor-pointer',
                    isCurrentMonth
                      ? 'bg-zinc-900/50 border-white/10 hover:border-amber-500/30'
                      : 'bg-zinc-950 border-white/5 opacity-30',
                    isToday && 'ring-2 ring-amber-500'
                  )}
                  onClick={() => handleDayClick(day)}
                >
                  <div
                    className={clsx(
                      'text-sm font-bold mb-1',
                      isToday ? 'text-amber-500' : 'text-zinc-400'
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {daysCitas.slice(0, 2).map((cita) => (
                      <div
                        key={cita.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onCitaClick?.(cita)
                        }}
                        className={getCitaBlockClass(cita, mode)}
                      >
                        {renderCitaLabel(cita, true)}
                      </div>
                    ))}
                    {daysCitas.length > 2 && (
                      <div className="text-[10px] text-zinc-500 px-1">
                        +{daysCitas.length - 2} más
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  const renderSemanaView = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
    const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd })
    const hours = Array.from({ length: 12 }, (_, i) => i + 9)

    const citasPorDia = new Map<string, CalendarCita[]>()
    citas.forEach((cita) => {
      const fechaKey = format(parseISO(cita.fecha_hora), 'yyyy-MM-dd')
      if (!citasPorDia.has(fechaKey)) {
        citasPorDia.set(fechaKey, [])
      }
      citasPorDia.get(fechaKey)!.push(cita)
    })

    return (
      <div className="overflow-x-auto">
        <div
          className="grid gap-0 border border-white/10 rounded-lg overflow-hidden min-w-[700px]"
          style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}
        >
          <div className="bg-zinc-800 border-r border-white/10 p-2" />
          {daysOfWeek.map((day) => (
            <button
              type="button"
              key={format(day, 'yyyy-MM-dd')}
              onClick={() => handleDayClick(day)}
              className="bg-zinc-800 border-r border-white/10 p-2 text-center hover:bg-zinc-700 transition-colors"
            >
              <div className="text-xs font-bold text-zinc-400">
                {format(day, 'EEE', { locale: es })}
              </div>
              <div
                className={clsx(
                  'text-lg font-bold',
                  isSameDay(day, new Date()) ? 'text-amber-500' : 'text-white'
                )}
              >
                {format(day, 'd')}
              </div>
            </button>
          ))}

          {hours.map((hour) => (
            <React.Fragment key={hour}>
              <div className="bg-zinc-900 border-t border-white/5 p-2 text-xs text-zinc-500 border-r border-white/10">
                {String(hour).padStart(2, '0')}:00
              </div>
              {daysOfWeek.map((day) => {
                const dayKey = format(day, 'yyyy-MM-dd')
                const dayCitas = citasPorDia.get(dayKey) || []
                const dayCita = dayCitas.find((c) => {
                  const citaHour = parseInt(format(parseISO(c.fecha_hora), 'HH'), 10)
                  return citaHour === hour
                })

                return (
                  <div
                    key={`${dayKey}-${hour}`}
                    className="bg-zinc-900/50 border-t border-r border-white/5 p-2 min-h-20 hover:bg-zinc-800 transition-colors"
                  >
                    {dayCita && (
                      <div
                        onClick={() => onCitaClick?.(dayCita)}
                        className={getCitaBlockClass(dayCita, mode)}
                      >
                        <div className="font-bold">
                          {format(parseISO(dayCita.fecha_hora), 'HH:mm')}
                        </div>
                        <div className="truncate">{dayCita.cliente_nombre}</div>
                        {mode === 'general' && (
                          <div className="truncate text-[9px] opacity-80">
                            {dayCita.barbero_nombre}
                          </div>
                        )}
                        <div className="truncate">{dayCita.servicio_nombre}</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    )
  }

  const renderDiaView = () => {
    const dayStart = startOfDay(selectedDate)
    const dayCitas = citas
      .filter((c) => isSameDay(parseISO(c.fecha_hora), selectedDate))
      .sort(
        (a, b) =>
          parseISO(a.fecha_hora).getTime() - parseISO(b.fecha_hora).getTime()
      )

    const hours = Array.from({ length: 12 }, (_, i) => {
      const h = new Date(dayStart)
      h.setHours(9 + i, 0, 0, 0)
      return h
    })

    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white">
            {format(selectedDate, 'EEEE, dd MMMM yyyy', { locale: es })}
          </h3>
          <p className="text-zinc-500 text-sm mt-1">{dayCitas.length} cita(s)</p>
        </div>

        <div className="space-y-3">
          {hours.map((hour) => {
            const hourStr = format(hour, 'HH:mm')
            const citasHora = dayCitas.filter((c) =>
              format(parseISO(c.fecha_hora), 'HH:mm').startsWith(format(hour, 'HH'))
            )

            return (
              <div key={hourStr} className="border-l-4 border-amber-500/30 pl-4 py-2">
                <div className="text-sm font-bold text-zinc-400 mb-2">{hourStr}</div>
                {citasHora.length > 0 ? (
                  <div className="space-y-2">
                    {citasHora.map((cita) => (
                      <div
                        key={cita.id}
                        onClick={() => onCitaClick?.(cita)}
                        className={clsx(
                          'p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg',
                          mode === 'general' && cita.barbero_id
                            ? getBarberColorClass(cita.barbero_id)
                            : getEstadoColor(cita.estado)
                        )}
                      >
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <div>
                            <div className="font-bold text-lg">{cita.cliente_nombre}</div>
                            <div className="text-sm">{cita.servicio_nombre}</div>
                            {mode === 'general' && (
                              <div className="text-xs text-amber-400/90 mt-1 font-bold">
                                {cita.barbero_nombre}
                              </div>
                            )}
                          </div>
                          <Badge
                            variant={getEstadoBadgeVariant(cita.estado)}
                            className="uppercase text-xs shrink-0"
                          >
                            {cita.estado.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="text-xs text-zinc-400 mt-2">
                          {format(parseISO(cita.fecha_hora), 'HH:mm')} · {cita.duracion_minutos}{' '}
                          min · {formatCurrency(cita.precio)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500 bg-zinc-900/30 p-3 rounded">
                    Sin citas programadas
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const titlePrefix =
    mode === 'general' ? 'Agenda general' : barberoNombre ? `Agenda — ${barberoNombre}` : 'Agenda'

  return (
    <Card className="border-white/5 bg-black/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle>
              📅{' '}
              {view === 'mes'
                ? 'Calendario mensual'
                : view === 'semana'
                  ? 'Calendario semanal'
                  : 'Calendario diario'}
              <span className="block text-sm font-medium text-zinc-500 mt-1 normal-case tracking-normal">
                {titlePrefix}
              </span>
            </CardTitle>
          </div>
          <div className="flex gap-2">
            {(['dia', 'semana', 'mes'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onViewChange(v)}
                className={clsx(
                  'px-3 py-1 rounded text-xs font-bold uppercase transition-all',
                  view === v ? 'bg-amber-500 text-black' : 'bg-white/10 text-zinc-400 hover:bg-white/20'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevious}
            className="p-2 hover:bg-white/10 rounded transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">
              {view === 'mes' && format(selectedDate, 'MMMM yyyy', { locale: es })}
              {view === 'semana' &&
                `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'd MMM')} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: es })}`}
              {view === 'dia' && format(selectedDate, 'd MMMM yyyy', { locale: es })}
            </h2>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-xs font-bold uppercase rounded transition-colors"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-2 hover:bg-white/10 rounded transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {view === 'mes' && renderMesView()}
        {view === 'semana' && renderSemanaView()}
        {view === 'dia' && renderDiaView()}
      </CardContent>
    </Card>
  )
}
