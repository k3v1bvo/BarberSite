'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
  parseISO
} from 'date-fns'
import { es } from 'date-fns/locale'

interface InlineCalendarPickerProps {
  selectedDate: string // Formato "YYYY-MM-DD"
  onSelectDate: (dateStr: string) => void
  minDate?: string // Formato "YYYY-MM-DD", por defecto hoy
  maxDate?: string // Formato "YYYY-MM-DD"
  disabledDates?: string[] // Array de "YYYY-MM-DD"
  className?: string
}

export function InlineCalendarPicker({
  selectedDate,
  onSelectDate,
  minDate,
  maxDate,
  disabledDates = [],
  className = ''
}: InlineCalendarPickerProps) {
  // Inicializar el mes visible según la fecha seleccionada o la fecha actual
  const initialDate = useMemo(() => {
    if (selectedDate) {
      try {
        const [y, m, d] = selectedDate.split('-').map(Number)
        return new Date(y, m - 1, d)
      } catch (_) {
        return new Date()
      }
    }
    return new Date()
  }, [selectedDate])

  const [currentMonth, setCurrentMonth] = useState<Date>(initialDate)

  const today = useMemo(() => startOfDay(new Date()), [])

  const minDateTime = useMemo(() => {
    if (!minDate) return today
    try {
      const [y, m, d] = minDate.split('-').map(Number)
      return startOfDay(new Date(y, m - 1, d))
    } catch (_) {
      return today
    }
  }, [minDate, today])

  const maxDateTime = useMemo(() => {
    if (!maxDate) return null
    try {
      const [y, m, d] = maxDate.split('-').map(Number)
      return startOfDay(new Date(y, m - 1, d))
    } catch (_) {
      return null
    }
  }, [maxDate])

  const selectedDateTime = useMemo(() => {
    if (!selectedDate) return null
    try {
      const [y, m, d] = selectedDate.split('-').map(Number)
      return startOfDay(new Date(y, m - 1, d))
    } catch (_) {
      return null
    }
  }, [selectedDate])

  // Calcular días de la cuadrícula (semanas que empiezan en Lunes = 1)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    return eachDayOfInterval({ start: startDate, end: endDate })
  }, [currentMonth])

  const handlePrevMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1))
  }

  // Días de la semana en español (L M M J V S D)
  const weekDayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

  return (
    <div className={`w-full max-w-sm mx-auto bg-zinc-950/80 border border-zinc-800/80 rounded-3xl p-5 shadow-2xl backdrop-blur-md ${className}`}>
      {/* Cabecera: Mes y Año + Flechas de navegación */}
      <div className="flex items-center justify-between mb-5 px-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-black text-white capitalize">
            {format(currentMonth, 'MMMM', { locale: es })}
          </span>
          <span className="text-sm font-bold text-zinc-500">
            {format(currentMonth, 'yyyy')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition active:scale-95"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition active:scale-95"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1 text-center mb-3">
        {weekDayLabels.map((dayLabel, idx) => (
          <span
            key={idx}
            className="text-xs font-black text-zinc-500 uppercase tracking-wider py-1"
          >
            {dayLabel}
          </span>
        ))}
      </div>

      {/* Cuadrícula de días */}
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {calendarDays.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = selectedDateTime ? isSameDay(day, selectedDateTime) : false
          const isToday = isSameDay(day, today)
          const isPast = isBefore(day, minDateTime)
          const isFutureBeyondMax = maxDateTime ? isBefore(maxDateTime, day) : false
          const dateKey = format(day, 'yyyy-MM-dd')
          const isExplicitDisabled = disabledDates.includes(dateKey)

          const isDisabled = !isCurrentMonth || isPast || isFutureBeyondMax || isExplicitDisabled

          return (
            <button
              key={idx}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) {
                  onSelectDate(dateKey)
                }
              }}
              className={`h-10 w-full rounded-2xl text-xs font-black flex items-center justify-center relative transition-all duration-200 ${
                isSelected
                  ? 'bg-amber-500 text-black shadow-[0_0_16px_rgba(245,158,11,0.4)] scale-105 z-10 ring-2 ring-amber-400'
                  : isDisabled
                    ? 'text-zinc-700 cursor-not-allowed opacity-30 pointer-events-none'
                    : isToday
                      ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white border border-transparent'
              }`}
            >
              <span>{format(day, 'd')}</span>
              {isToday && !isSelected && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-400"></span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
