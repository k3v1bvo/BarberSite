'use client'

import { Badge } from './Badge'
import { Button } from './Button'
import { formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { X } from 'lucide-react'
import type { AgendaCita } from '@/lib/agenda/types'
import Link from 'next/link'

interface CitaDetailModalProps {
  cita: AgendaCita | null
  onClose: () => void
  showBarbero?: boolean
}

export function CitaDetailModal({ cita, onClose, showBarbero = true }: CitaDetailModalProps) {
  if (!cita) return null

  const estadoVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    pendiente: 'warning',
    confirmado: 'info',
    en_proceso: 'info',
    completado: 'success',
    cancelado: 'danger',
    no_presento: 'danger',
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">
              Detalle de cita
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              {format(parseISO(cita.fecha_hora), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Cliente</span>
            <span className="text-white font-bold text-right">{cita.cliente_nombre}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Servicio</span>
            <span className="text-white font-bold text-right">{cita.servicio_nombre}</span>
          </div>
          {showBarbero && (
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Barbero</span>
              <span className="text-amber-400 font-bold text-right">{cita.barbero_nombre}</span>
            </div>
          )}
          <div className="flex justify-between gap-4 items-center">
            <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Estado</span>
            <Badge variant={estadoVariant[cita.estado] || 'default'} className="uppercase text-xs">
              {cita.estado.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Precio</span>
            <span className="text-white font-black">{formatCurrency(cita.precio)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Duración</span>
            <span className="text-white font-bold">{cita.duracion_minutos} min</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link href="/recepcion" className="flex-1">
            <Button variant="primary" size="md" className="w-full font-black uppercase tracking-wider">
              Ir a recepción
            </Button>
          </Link>
          <Button variant="outline" size="md" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}
