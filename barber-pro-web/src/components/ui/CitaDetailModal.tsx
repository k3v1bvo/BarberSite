'use client'

import { Badge } from './Badge'
import { Button } from './Button'
import { formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { X } from 'lucide-react'
import type { AgendaCita } from '@/lib/agenda/types'
import Link from 'next/link'
import { useState } from 'react'
import { useToast } from './Toast'
import { createClient } from '@/lib/supabase/client'

interface CitaDetailModalProps {
  cita: AgendaCita | null
  onClose: () => void
  showBarbero?: boolean
  onUpdate?: () => void
}

export function CitaDetailModal({ cita, onClose, showBarbero = true, onUpdate }: CitaDetailModalProps) {
  const [verifying, setVerifying] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [showImage, setShowImage] = useState(false)
  const { success, error } = useToast()
  if (!cita) return null

  const estadoVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    pendiente: 'warning',
    pendiente_pago: 'warning',
    confirmado: 'info',
    en_proceso: 'info',
    completado: 'success',
    cancelado: 'danger',
    no_presento: 'danger',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
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
          {cita.anticipo_monto !== undefined && cita.anticipo_monto > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Anticipo Pagado</span>
              <span className="text-amber-400 font-black">{formatCurrency(cita.anticipo_monto)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Duración</span>
            <span className="text-white font-bold">{cita.duracion_minutos} min</span>
          </div>
        </div>

        {cita.comprobante_url && (
          <div className="pt-2 border-t border-white/5">
            <Button
              onClick={() => setShowImage(true)}
              variant="outline"
              className="w-full h-10 uppercase tracking-widest font-black text-xs text-amber-500 border-amber-500/20 hover:bg-amber-500/10"
            >
              📷 Ver Comprobante
            </Button>
          </div>
        )}

        {showImage && cita.comprobante_url && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={(e) => { e.stopPropagation(); setShowImage(false); }}>
            <div className="relative max-w-full max-h-full">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowImage(false); }}
                className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white bg-black/50 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cita.comprobante_url} alt="Comprobante" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
            </div>
          </div>
        )}

        <div className="pt-2 space-y-2 border-t border-white/5">
          {(cita.estado === 'pendiente' || cita.estado === 'confirmado' || cita.estado === 'en_proceso') && (
            <Button
              variant="danger"
              size="md"
              className="w-full font-black uppercase tracking-wider"
              disabled={canceling}
              onClick={async () => {
                if (!confirm('¿Marcar que el cliente no se presentó a la cita?')) return;
                setCanceling(true)
                try {
                  const supabase = createClient()
                  const { error: err } = await supabase
                    .from('citas')
                    .update({ estado: 'no_presento', updated_at: new Date().toISOString() })
                    .eq('id', cita.id)
                  if (err) throw err
                  success('Cita marcada como No Asistió')
                  if (onUpdate) onUpdate()
                  else window.location.reload()
                  onClose()
                } catch (e) {
                  error('Error al actualizar la cita')
                } finally {
                  setCanceling(false)
                }
              }}
            >
              {canceling ? 'Actualizando...' : 'No Asistió'}
            </Button>
          )}

          {cita.estado === 'pendiente_pago' ? (
             <Button 
               variant="warning" 
               size="md" 
               className="flex-1 font-black uppercase tracking-wider"
               disabled={verifying}
               onClick={async () => {
                 setVerifying(true)
                 try {
                   const res = await fetch('/api/citas/verificar-pago', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ citaId: cita.id })
                   })
                   if (!res.ok) throw new Error('Error al verificar')
                   success('Pago verificado')
                   if (onUpdate) onUpdate()
                   else window.location.reload()
                   onClose()
                 } catch (e) {
                   error('No se pudo verificar el pago')
                 } finally {
                   setVerifying(false)
                 }
               }}
             >
               {verifying ? 'Verificando...' : '✅ Verificar Pago'}
             </Button>
          ) : (
            <Link href="/coordinador" className="flex-1">
              <Button variant="primary" size="md" className="w-full font-black uppercase tracking-wider hidden">
                Ir a coordinación
              </Button>
            </Link>
          )}
          <Button variant="outline" size="md" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}
