'use client'

import React from 'react'
import {
  X, Sparkles, Scissors, Calendar, Users, Gift, Clock,
  CheckCircle2, Share2, ArrowRight, ShieldCheck, Zap
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'

export interface PromocionDetalle {
  id: string
  nombre: string
  icono?: string | null
  descripcion?: string | null
  tipo: string
  valor: number
  activa?: boolean
  dias_semana?: number[] | null
  servicio_id?: string | null
}

interface ModalDetallePromocionProps {
  promo: PromocionDetalle | null
  onClose: () => void
  onAplicarEnReserva?: (promoId: string) => void
  onIrAReservar?: () => void
  onIrAPerfil?: () => void
  clienteReferralCode?: string
}

export function ModalDetallePromocion({
  promo,
  onClose,
  onAplicarEnReserva,
  onIrAReservar,
  onIrAPerfil,
  clienteReferralCode,
}: ModalDetallePromocionProps) {
  const { success, error } = useToast()

  if (!promo) return null

  const is2x1 = promo.tipo === '2x1' || promo.nombre.toLowerCase().includes('2x1') || promo.nombre.toLowerCase().includes('2×1')
  const isCumple = promo.tipo === 'cumpleanos' || promo.tipo === 'servicio_gratis' || promo.nombre.toLowerCase().includes('cumpleañ')
  const isReferido = promo.tipo === 'referido' || promo.tipo === 'descuento_fijo' || promo.nombre.toLowerCase().includes('referid')

  const badgeText = isCumple
    ? '100% OFF • Regalo Especial'
    : is2x1
    ? '2×1 • Martes Especial'
    : isReferido
    ? `Bs. ${promo.valor || 10} OFF • Recomendación`
    : promo.tipo === 'descuento_porcentaje'
    ? `${promo.valor}% OFF`
    : `Bs. ${promo.valor} OFF`

  const handleCompartirWhatsApp = () => {
    let msg = ''
    if (is2x1) {
      msg = `✂️ ¡Hola! En Barber Pro tienen la promo *2×1 Todos los Martes* (pagamos 1 solo corte y entramos los 2). ¿Vamos este martes? Agenda aquí: ${window.location.origin}/reservar`
    } else if (isReferido) {
      msg = `🤝 ¡Hola! Te invito a cortarte en Barber Pro Studio. Usa mi código o enlace de referido para recibir un descuento especial en tu 1er corte: ${window.location.origin}/reservar${clienteReferralCode ? `?ref=${clienteReferralCode}` : ''}`
    } else if (isCumple) {
      msg = `🎂 ¡En Barber Pro te regalan un corte de cortesía en tu semana de cumpleaños! Puedes registrarte aquí: ${window.location.origin}/reservar`
    } else {
      msg = `🔥 ¡Mira esta promoción en Barber Pro: *${promo.nombre}*! Reserva tu turno aquí: ${window.location.origin}/reservar`
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-950 border border-amber-500/30 rounded-[2.5rem] shadow-[0_0_60px_rgba(245,158,11,0.2)] overflow-hidden my-auto max-h-[95vh] flex flex-col">
        
        {/* Header con Banner Temático */}
        <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 p-6 text-black flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-black/20 backdrop-blur-md border border-black/10 flex items-center justify-center text-3xl shadow-lg">
              {promo.icono || (isCumple ? '🎂' : is2x1 ? '✂️' : isReferido ? '🤝' : '🎁')}
            </div>
            <div>
              <Badge className="bg-black text-amber-400 font-black text-[10px] uppercase tracking-wider mb-1 px-2.5 py-0.5">
                {badgeText}
              </Badge>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black leading-tight">
                {promo.nombre}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 text-black flex items-center justify-center transition shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1">
          
          {/* Descripción Principal */}
          <div className="bg-zinc-900/90 border border-white/5 rounded-2xl p-4">
            <p className="text-zinc-200 text-sm font-medium leading-relaxed">
              {promo.descripcion || (
                isCumple
                  ? 'Celebramos tu día especial con un servicio de cortesía (100% de descuento). Válido durante la semana de tu cumpleaños presentando tu carnet.'
                  : is2x1
                  ? 'Ven acompañado los días martes y paguen únicamente por 1 servicio. Ambos reciben atención de primer nivel.'
                  : isReferido
                  ? 'Descuento directo de Bs. 10 por venir recomendado o invitar a tus amigos a la barbería.'
                  : 'Aprovecha este beneficio exclusivo en tu próxima visita a Barber Pro.'
              )}
            </p>
          </div>

          {/* Cómo Funciona Paso a Paso */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
              <Zap size={14} className="text-amber-500" /> ¿Cómo funciona?
            </h4>

            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3.5 bg-black/40 border border-zinc-800/80 rounded-2xl">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="text-xs font-black text-white">Selecciona tu Servicio</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {is2x1
                      ? 'Elige el corte o servicio individual y completa los datos de tu acompañante.'
                      : 'Elige tu corte, barba o servicio favorito en el catálogo.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-black/40 border border-zinc-800/80 rounded-2xl">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="text-xs font-black text-white">Validación de Beneficio</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {isCumple
                      ? 'Presenta tu Carnet de Identidad (CI) en recepción o sube tu foto desde tu perfil.'
                      : is2x1
                      ? 'Asiste junto con tu acompañante el día martes en tu horario agendado.'
                      : 'El descuento de Bs. 10 se aplica automáticamente a tu total.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-black/40 border border-zinc-800/80 rounded-2xl">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <p className="text-xs font-black text-emerald-400">¡Disfruta tu Descuento!</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {isCumple
                      ? 'Tu corte es 100% de cortesía ($0 Bs). ¡Feliz Cumpleaños!'
                      : 'El total se actualiza en tiempo real y pagas con el beneficio aplicado.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Información Adicional & Reglas */}
          <div className="p-3.5 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock size={14} className="text-amber-500" />
              <span>Días válidos:</span>
            </div>
            <span className="font-black text-white">
              {is2x1 ? 'Todos los Martes' : isCumple ? 'Semana de tu Cumpleaños' : 'Todos los Días'}
            </span>
          </div>

          {/* Botones de Acción */}
          <div className="space-y-2.5 pt-2">
            {/* Si estamos en la página de Reservar: Botón para Aplicar */}
            {onAplicarEnReserva && (
              <Button
                onClick={() => {
                  onAplicarEnReserva(promo.id)
                  onClose()
                  success(`¡${promo.nombre} aplicada a tu reserva! ✨`)
                }}
                className="w-full h-13 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider text-xs rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                <span>Aplicar esta Promoción a mi Reserva</span>
              </Button>
            )}

            {/* Si estamos en el portal del cliente: Botón para ir a reservar */}
            {onIrAReservar && (
              <Button
                onClick={() => {
                  onClose()
                  onIrAReservar()
                }}
                className="w-full h-13 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider text-xs rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Scissors size={16} />
                <span>Agendar Turno con esta Promo</span>
              </Button>
            )}

            {/* Si es cumpleaños y hay enlace a perfil */}
            {isCumple && onIrAPerfil && (
              <Button
                onClick={() => {
                  onClose()
                  onIrAPerfil()
                }}
                variant="outline"
                className="w-full h-12 bg-zinc-900 border-amber-500/30 hover:bg-amber-500/10 text-amber-400 font-bold text-xs rounded-2xl"
              >
                🎂 Subir Foto de Carnet para Validar
              </Button>
            )}

            {/* Compartir por WhatsApp */}
            <Button
              onClick={handleCompartirWhatsApp}
              variant="outline"
              className="w-full h-12 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-2xl flex items-center justify-center gap-2"
            >
              <Share2 size={15} />
              <span>Invitar a un Amigo por WhatsApp</span>
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-900/60 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-medium shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-amber-500" />
            <span>Promoción Oficial Barber Pro Studio</span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white font-bold">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
