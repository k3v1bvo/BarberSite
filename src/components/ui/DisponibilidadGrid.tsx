'use client'

import React from 'react'
import {
  format,
  parseISO,
  startOfWeek,
  addDays,
  isSameDay,
  startOfDay,
  endOfDay
} from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import clsx from 'clsx'

interface Cita {
  id: string
  fecha_hora: string
  duracion_real_minutos?: number
  cliente_nombre: string
  servicio_nombre: string
  estado: string
  precio: number
}

interface Slot {
  hora: string
  disponible: boolean
  citaId?: string
}

interface DisponibilidadGridProps {
  slots: Slot[]
  citas: Cita[]
  startDate: Date
  endDate: Date
  onSlotClick?: (hora: string, disponible: boolean) => void
  barberoNombre?: string
}

export function DisponibilidadGrid({
  slots,
  citas,
  startDate,
  endDate,
  onSlotClick,
  barberoNombre
}: DisponibilidadGridProps) {

  // Generar matriz de horas × días
  const horas = Array.from({ length: 12 }, (_, i) => `${String(i + 9).padStart(2, '0')}:00`)
  const dias: Date[] = []
  let currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    dias.push(new Date(currentDate))
    currentDate = addDays(currentDate, 1)
  }

  const citasPorHorarioDia = new Map<string, Cita>()
  citas.forEach(cita => {
    const key = format(parseISO(cita.fecha_hora), 'yyyy-MM-dd HH:00')
    citasPorHorarioDia.set(key, cita)
  })

  const getSlotStatus = (dia: Date, hora: string): { disponible: boolean; cita?: Cita } => {
    const key = format(dia, 'yyyy-MM-dd') + ' ' + hora
    const cita = citasPorHorarioDia.get(key)
    return {
      disponible: !cita || cita.estado === 'cancelado',
      cita
    }
  }

  const getEstadoColor = (estado: string): string => {
    const colors = {
      pendiente: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/50',
      confirmado: 'bg-blue-500/20 text-blue-200 border-blue-500/50',
      en_proceso: 'bg-purple-500/20 text-purple-200 border-purple-500/50',
      completado: 'bg-green-500/20 text-green-200 border-green-500/50',
      cancelado: 'bg-gray-500/20 text-gray-200 border-gray-500/50'
    }
    return colors[estado as keyof typeof colors] || colors.pendiente
  }

  return (
    <Card className="border-white/5 bg-black/20">
      <CardHeader>
        <CardTitle>
          ⏰ Disponibilidad por Horario
          {barberoNombre && <span className="text-amber-500 ml-2">— {barberoNombre}</span>}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <div className="grid gap-0 border border-white/10 rounded-lg overflow-hidden min-w-full"
            style={{
              gridTemplateColumns: `80px repeat(${dias.length}, 1fr)`
            }}
          >
            {/* Header: Horas */}
            <div className="bg-zinc-800 border-r border-white/10 p-3 sticky left-0 z-10">
              <div className="text-xs font-bold text-zinc-400">Hora</div>
            </div>

            {/* Header: Días */}
            {dias.map((dia, idx) => (
              <div
                key={idx}
                className="bg-zinc-800 border-r border-white/10 p-3 text-center border-b border-white/10"
              >
                <div className="text-xs font-bold text-zinc-400">
                  {format(dia, 'EEE', { locale: es })}
                </div>
                <div className={clsx(
                  'text-sm font-bold',
                  isSameDay(dia, new Date()) ? 'text-amber-500' : 'text-white'
                )}>
                  {format(dia, 'd/MMM')}
                </div>
              </div>
            ))}

            {/* Slots */}
            {horas.map(hora => (
              <React.Fragment key={hora}>
                <div className="bg-zinc-900 border-r border-white/10 border-b border-white/5 p-3 sticky left-0 z-10">
                  <div className="text-xs font-bold text-zinc-500">{hora}</div>
                </div>

                {dias.map((dia, idx) => {
                  const { disponible, cita } = getSlotStatus(dia, hora)

                  if (cita && cita.estado !== 'cancelado') {
                    return (
                      <div
                        key={`${idx}-${hora}`}
                        className={clsx(
                          'border-r border-b border-white/5 p-2 min-h-24 flex items-center justify-center text-center cursor-pointer transition-all hover:shadow-lg border-2',
                          getEstadoColor(cita.estado)
                        )}
                        onClick={() => onSlotClick?.(hora, disponible)}
                      >
                        <div className="text-[10px]">
                          <div className="font-bold truncate">{cita.cliente_nombre}</div>
                          <div className="text-xs opacity-75">{cita.servicio_nombre}</div>
                          <div className="text-xs opacity-50 mt-1">
                            {cita.duracion_real_minutos || 30} min
                          </div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={`${idx}-${hora}`}
                      className={clsx(
                        'border-r border-b border-white/5 p-2 min-h-24 flex items-center justify-center transition-all cursor-pointer',
                        disponible
                          ? 'bg-green-500/5 hover:bg-green-500/10 border-green-500/30 hover:border-green-500/50'
                          : 'bg-red-500/5 border-red-500/30'
                      )}
                      onClick={() => onSlotClick?.(hora, disponible)}
                    >
                      <div className={clsx(
                        'text-xs font-bold',
                        disponible ? 'text-green-400' : 'text-red-400'
                      )}>
                        {disponible ? '✓ LIBRE' : '✗ OCUPADO'}
                      </div>
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Leyenda */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500/20 border border-green-500/50 rounded"></div>
            <span className="text-zinc-400">Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500/20 border border-yellow-500/50 rounded"></div>
            <span className="text-zinc-400">Pendiente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500/20 border border-blue-500/50 rounded"></div>
            <span className="text-zinc-400">Confirmado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500/20 border border-purple-500/50 rounded"></div>
            <span className="text-zinc-400">En Proceso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500/20 border border-green-500/50 rounded"></div>
            <span className="text-zinc-400">Completado</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
