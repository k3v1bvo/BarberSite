'use client'

import React from 'react'
import { X, Clock, Calendar, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react'
import { formatCurrency, toSentenceCase } from '@/lib/utils'
import { ServicioGalleryBanner } from './ServicioGalleryBanner'
import Link from 'next/link'

interface Servicio {
  id: string
  nombre: string
  precio: number
  duracion_minutos: number
  descripcion: string | null
  categoria?: string
  imagen_url?: string | null
  imagenes?: string[] | null
}

interface ServicioDetailModalProps {
  servicio: Servicio | null
  isOpen: boolean
  onClose: () => void
  onSelect?: (servicio: Servicio) => void
}

export function ServicioDetailModal({ servicio, isOpen, onClose, onSelect }: ServicioDetailModalProps) {
  if (!isOpen || !servicio) return null

  const allImgs = servicio.imagenes && servicio.imagenes.length > 0
    ? servicio.imagenes
    : (servicio.imagen_url ? [servicio.imagen_url] : [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-black/60 hover:bg-black text-zinc-400 hover:text-white rounded-full transition-all border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Gallery / Main Banner */}
        <div className="shrink-0">
          <ServicioGalleryBanner imagenes={allImgs} categoria={servicio.categoria || 'Cortes'} />
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-amber-500 font-bold uppercase tracking-wider">
                  {servicio.categoria || 'Servicio Exclusivo'}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {toSentenceCase(servicio.nombre)}
              </h2>
            </div>
            
            <div className="text-left sm:text-right shrink-0">
              <span className="text-3xl font-black text-amber-400 block">{formatCurrency(servicio.precio)}</span>
              <span className="text-xs font-bold text-zinc-400 inline-flex items-center gap-1 mt-1 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Duración estimada: {servicio.duracion_minutos} min
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-black uppercase text-zinc-500 tracking-wider mb-2">
              Detalles y Beneficios del Servicio
            </h4>
            <p className="text-zinc-300 text-sm md:text-base leading-relaxed bg-white/[0.02] p-4 rounded-2xl border border-white/5 whitespace-pre-line">
              {servicio.descripcion ? toSentenceCase(servicio.descripcion) : 'Servicio profesional realizado por barberos expertos utilizando productos de máxima calidad e higiene.'}
            </p>
          </div>

          {/* Highlights / Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="flex items-center gap-3 bg-zinc-900/80 p-3 rounded-xl border border-white/5">
              <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-white uppercase">Higiene 100% Garantizada</p>
                <p className="text-zinc-500">Herramientas esterilizadas</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-zinc-900/80 p-3 rounded-xl border border-white/5">
              <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-white uppercase">Productos de Alta Gama</p>
                <p className="text-zinc-500">Marcas profesionales</p>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3">
            {onSelect ? (
              <button
                onClick={() => {
                  onSelect(servicio)
                  onClose()
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black py-4 font-black uppercase text-sm tracking-wider rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" /> Seleccionar Servicio y Reservar
              </button>
            ) : (
              <Link
                href={`/reservar?servicio=${servicio.id}`}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black py-4 font-black uppercase text-sm tracking-wider rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 text-center"
              >
                <Calendar className="w-4 h-4" /> Reservar Este Servicio Ahora
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
