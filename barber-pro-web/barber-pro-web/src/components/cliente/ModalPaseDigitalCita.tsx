'use client'

import React, { useState } from 'react'
import {
  X, Calendar, Clock, Scissors, User, MapPin, QrCode,
  Download, Share2, MessageSquare, CheckCircle, AlertCircle,
  ExternalLink, Sparkles, Printer, ArrowRight, ShieldCheck
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, cn, toTitleCase } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'

export interface CitaPaseDigital {
  id: string
  fecha_hora: string
  precio: number
  estado: string
  notas?: string | null
  anticipo_pagado?: number | null
  tipo_reserva?: string | null
  servicio_id?: string
  barbero_id?: string
  servicios?: {
    nombre: string
    duracion_minutos?: number
    precio?: number
    categoria?: string
  } | null
  profiles?: {
    full_name: string
    phone?: string | null
    avatar_url?: string | null
  } | null
}

interface ModalPaseDigitalCitaProps {
  cita: CitaPaseDigital | null
  clienteNombre: string
  clienteCi?: string | null
  onClose: () => void
  onReprogramar?: (citaId: string) => void
  onCancelar?: (citaId: string) => void
}

export function ModalPaseDigitalCita({
  cita,
  clienteNombre,
  clienteCi,
  onClose,
  onReprogramar,
  onCancelar,
}: ModalPaseDigitalCitaProps) {
  const { success, error } = useToast()
  const [downloading, setDownloading] = useState(false)

  if (!cita) return null

  const fechaObj = new Date(cita.fecha_hora)
  const esFechaValida = !isNaN(fechaObj.getTime())
  
  const fechaFormateada = esFechaValida
    ? fechaObj.toLocaleDateString('es-BO', {
        timeZone: 'America/La_Paz',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Fecha no disponible'

  const horaFormateada = esFechaValida
    ? fechaObj.toLocaleTimeString('es-BO', {
        timeZone: 'America/La_Paz',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : 'Hora no disponible'

  // Datos para el QR Code
  const qrPayload = JSON.stringify({
    reserva_id: cita.id,
    cliente: clienteNombre,
    ci: clienteCi || 'N/A',
    fecha_hora: cita.fecha_hora,
    servicio: cita.servicios?.nombre || 'Servicio',
    tipo: 'CHECKIN_BARBER_PRO'
  })

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrPayload)}&bgcolor=ffffff&color=000000&margin=10`

  // Generar link de Google Calendar
  const getGoogleCalendarUrl = () => {
    if (!esFechaValida) return '#'
    const startIso = fechaObj.toISOString().replace(/-|:|\.\d\d\d/g, '')
    const endObj = new Date(fechaObj.getTime() + (cita.servicios?.duracion_minutos || 45) * 60000)
    const endIso = endObj.toISOString().replace(/-|:|\.\d\d\d/g, '')
    
    const title = encodeURIComponent(`Corte en Barber Pro - ${cita.servicios?.nombre || 'Servicio'}`)
    const details = encodeURIComponent(`Cita con ${cita.profiles?.full_name || 'Barbero'}. Pase VIP ID: ${cita.id.slice(0, 8)}`)
    const location = encodeURIComponent('Barber Pro Studio')
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`
  }

  // Generar mensaje de WhatsApp
  const getWhatsappUrl = () => {
    const telefono = cita.profiles?.phone ? cita.profiles.phone.replace(/\D/g, '') : ''
    const msg = encodeURIComponent(
      `Hola! Soy ${clienteNombre}, tengo mi cita agendada en Barber Pro para el servicio de *${cita.servicios?.nombre || 'Corte'}* el día *${fechaFormateada}* a las *${horaFormateada}*. (Pase VIP: #${cita.id.slice(0, 8)})`
    )
    if (telefono) {
      return `https://wa.me/${telefono.startsWith('591') ? telefono : `591${telefono}`}?text=${msg}`
    }
    return `https://wa.me/?text=${msg}`
  }

  const handleDescargarQR = async () => {
    setDownloading(true)
    try {
      const response = await fetch(qrCodeUrl)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `Pase_VIP_BarberPro_${cita.id.slice(0, 8)}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
      success('Pase Digital con QR descargado con éxito')
    } catch {
      window.open(qrCodeUrl, '_blank')
    } finally {
      setDownloading(false)
    }
  }

  const handleCompartir = async () => {
    const shareText = `🎟️ Mi Pase VIP Barber Pro:\nCorte: ${cita.servicios?.nombre}\nFecha: ${fechaFormateada} a las ${horaFormateada}\nEspecialista: ${cita.profiles?.full_name || 'Barber Pro'}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Pase Digital Barber Pro',
          text: shareText,
          url: window.location.href,
        })
      } catch {
        // Share dismiss
      }
    } else {
      navigator.clipboard.writeText(shareText)
      success('Detalles de tu cita copiados al portapapeles 📋')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-950 border border-amber-500/30 rounded-[2.5rem] shadow-[0_0_50px_rgba(245,158,11,0.15)] overflow-hidden my-auto max-h-[95vh] flex flex-col">
        
        {/* Header Decorativo */}
        <div className="relative bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 p-5 sm:p-6 text-black flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black/20 backdrop-blur-md flex items-center justify-center font-black">
              <Scissors size={20} className="text-black" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-black/70 leading-none">BARBER PRO VIP</p>
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-black mt-0.5">Pase & Check-in Digital</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 text-black flex items-center justify-center transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido Scrollable */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1">
          
          {/* Tarjeta Tipo Ticket / Boarding Pass */}
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-3xl p-6 overflow-hidden shadow-2xl">
            {/* Perforación lateral decorativa */}
            <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-950 border-r border-zinc-800" />
            <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-950 border-l border-zinc-800" />
            
            {/* Estado y N° de Pase */}
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-4">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-0.5">Ticket ID</span>
                <span className="font-mono text-xs font-bold text-amber-400">#{cita.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <Badge
                variant={
                  cita.estado === 'confirmado' ? 'success' :
                  cita.estado === 'completado' ? 'success' :
                  cita.estado === 'en_proceso' ? 'warning' :
                  cita.estado === 'cancelado' ? 'danger' : 'warning'
                }
                className="text-[10px] uppercase font-black px-3 py-1"
              >
                {cita.estado}
              </Badge>
            </div>

            {/* Servicio Principal */}
            <div className="py-4 border-b border-white/5">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Servicio Solicitado</span>
              <h3 className="text-xl font-black text-white leading-tight flex items-center gap-2">
                <span>✂️</span>
                <span>{cita.servicios?.nombre || 'Corte / Arreglo'}</span>
              </h3>
              {cita.servicios?.duracion_minutos && (
                <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 font-medium">
                  <Clock size={13} className="text-amber-500" />
                  Duración estimada: <strong className="text-white">{cita.servicios.duracion_minutos} minutos</strong>
                </p>
              )}
            </div>

            {/* Fecha, Hora y Barbero */}
            <div className="grid grid-cols-2 gap-4 py-4 border-b border-white/5">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Fecha & Hora</span>
                <p className="text-sm font-black text-white capitalize">{fechaFormateada}</p>
                <p className="text-amber-400 font-black text-base mt-0.5">{horaFormateada} hrs</p>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Especialista</span>
                <p className="text-sm font-black text-white flex items-center gap-1.5">
                  <User size={14} className="text-amber-500 shrink-0" />
                  <span>{cita.profiles?.full_name ? toTitleCase(cita.profiles.full_name) : 'Cualquier Barbero'}</span>
                </p>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Barber Pro Artist</span>
              </div>
            </div>

            {/* Titular y QR de Check-in */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-5">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Titular de la Cita</span>
                <p className="text-base font-black text-white">{clienteNombre}</p>
                {clienteCi && (
                  <p className="text-xs font-mono text-emerald-400 font-bold mt-0.5">CI: {clienteCi}</p>
                )}
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                  <ShieldCheck size={13} />
                  <span>Pase Válido para Recepción</span>
                </div>
              </div>

              {/* QR Code de Checkin */}
              <div className="flex flex-col items-center shrink-0">
                <div className="p-2.5 bg-white rounded-2xl shadow-xl shadow-black/60 border border-white/20">
                  <img
                    src={qrCodeUrl}
                    alt="QR Check-in"
                    className="w-28 h-28 object-contain rounded-lg"
                  />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-1.5">
                  Muestra este QR al llegar
                </span>
              </div>
            </div>

            {/* Desglose de Montos */}
            <div className="mt-5 pt-4 border-t border-dashed border-zinc-700/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Monto del Servicio</span>
                {cita.anticipo_pagado !== undefined && cita.anticipo_pagado !== null && cita.anticipo_pagado > 0 && (
                  <span className="text-[10px] text-emerald-400 font-bold">
                    Anticipo: {formatCurrency(cita.anticipo_pagado)} pagado
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-amber-400">{formatCurrency(cita.precio)}</span>
              </div>
            </div>
          </div>

          {/* Acciones Rápidas VIP */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" /> Acciones Rápidas
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Descargar Pase */}
              <Button
                onClick={handleDescargarQR}
                disabled={downloading}
                variant="outline"
                className="w-full h-12 bg-zinc-900 border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/10 text-white font-bold text-xs flex items-center justify-center gap-2 rounded-2xl"
              >
                <Download size={16} className="text-amber-400" />
                <span>{downloading ? 'Descargando...' : 'Guardar Pase con QR'}</span>
              </Button>

              {/* Agregar a Google Calendar */}
              <a
                href={getGoogleCalendarUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-12 bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/10 text-white font-bold text-xs flex items-center justify-center gap-2 rounded-2xl transition"
              >
                <Calendar size={16} className="text-amber-400" />
                <span>Agendar en Google Calendar</span>
              </a>

              {/* WhatsApp con el Barbero */}
              <a
                href={getWhatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-12 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 rounded-2xl transition"
              >
                <MessageSquare size={16} className="text-emerald-400" />
                <span>Contactar por WhatsApp</span>
              </a>

              {/* Compartir Cita */}
              <Button
                onClick={handleCompartir}
                variant="outline"
                className="w-full h-12 bg-zinc-900 border-zinc-800 hover:border-white/20 text-zinc-300 font-bold text-xs flex items-center justify-center gap-2 rounded-2xl"
              >
                <Share2 size={16} className="text-zinc-400" />
                <span>Compartir / Copiar Pase</span>
              </Button>
            </div>
          </div>

          {/* Opciones de Modificación (Reprogramar / Cancelar) */}
          {(cita.estado === 'pendiente' || cita.estado === 'confirmado') && (
            <div className="pt-2 border-t border-white/5 flex gap-2">
              {onReprogramar && (
                <Button
                  onClick={() => {
                    onClose()
                    onReprogramar(cita.id)
                  }}
                  variant="outline"
                  className="flex-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-bold text-xs h-11 rounded-xl"
                >
                  🔄 Reprogramar Fecha/Hora
                </Button>
              )}
              {onCancelar && (
                <Button
                  onClick={() => {
                    onClose()
                    onCancelar(cita.id)
                  }}
                  variant="ghost"
                  className="flex-1 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold text-xs h-11 rounded-xl"
                >
                  ✕ Cancelar Cita
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-900/60 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-medium shrink-0">
          <div className="flex items-center gap-1.5">
            <MapPin size={13} className="text-amber-500" />
            <span>Barber Pro Studio • Presenta 5 min antes</span>
          </div>
          <button
            onClick={() => window.print()}
            className="text-zinc-400 hover:text-white flex items-center gap-1 font-bold"
          >
            <Printer size={12} />
            <span>Imprimir</span>
          </button>
        </div>
      </div>
    </div>
  )
}
