import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
} from 'date-fns'

export type AgendaView = 'mes' | 'semana' | 'dia'

export function getDateRangeForView(view: AgendaView, selectedDate: Date): {
  fechaInicio: string
  fechaFin: string
} {
  if (view === 'mes') {
    const start = startOfMonth(selectedDate)
    const end = endOfMonth(selectedDate)
    const calendarStart = startOfWeek(start, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(end, { weekStartsOn: 1 })
    return {
      fechaInicio: format(calendarStart, 'yyyy-MM-dd'),
      fechaFin: format(calendarEnd, 'yyyy-MM-dd'),
    }
  }

  if (view === 'semana') {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 })
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 })
    return {
      fechaInicio: format(start, 'yyyy-MM-dd'),
      fechaFin: format(end, 'yyyy-MM-dd'),
    }
  }

  const day = startOfDay(selectedDate)
  return {
    fechaInicio: format(day, 'yyyy-MM-dd'),
    fechaFin: format(endOfDay(selectedDate), 'yyyy-MM-dd'),
  }
}
