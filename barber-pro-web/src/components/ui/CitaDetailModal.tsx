'use client'

import { Badge } from './Badge'
import { Button } from './Button'
import { formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { X } from 'lucide-react'
import type { AgendaCita } from '@/lib/agenda/types'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useToast } from './Toast'
import { createClient } from '@/lib/supabase/client'

interface CitaDetailModalProps {
  cita: AgendaCita | null
  onClose: () => void
  showBarbero?: boolean
  onUpdate?: () => void
}

import { getBoliviaDateTimeStr, getBoliviaDateKey, getBoliviaTimeStr } from '@/lib/agenda/date-utils'

export function CitaDetailModal({ cita, onClose, showBarbero = true, onUpdate }: CitaDetailModalProps) {
  const [verifying, setVerifying] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [showImage, setShowImage] = useState(false)

  const [showReprogramar, setShowReprogramar] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [reprogramming, setReprogramming] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [responding, setResponding] = useState(false)

  useEffect(() => {
    const fetchRole = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (data) setUserRole(data.role)
      }
    }
    fetchRole()
  }, [])

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
      className="fixed inset-0 w-screen h-screen min-h-screen z-[100] bg-black/95 flex items-center justify-center p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[96vh] flex flex-col justify-between bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl my-auto overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera fija */}
        <div className="flex items-start justify-between gap-4 p-6 sm:p-8 border-b border-white/10 bg-zinc-900/50">
          <div>
            <h3 className="text-2xl font-black text-white uppercase leading-none">
              Detalle de <span className="text-amber-500">Cita</span>
            </h3>
            <p className="text-sm text-zinc-400 mt-2 font-medium">
              {getBoliviaDateTimeStr(cita.fecha_hora)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-3 hover:bg-white/5 rounded-2xl transition-colors border border-white/5 text-zinc-400 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col justify-between gap-6">

          <div className="space-y-3.5 text-base">
            <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
              <span className="text-zinc-500 font-black uppercase text-xs tracking-widest">Cliente</span>
              <span className="text-white font-black text-right">{cita.cliente_nombre}</span>
            </div>
            <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
              <span className="text-zinc-500 font-black uppercase text-xs tracking-widest">Servicio</span>
              <span className="text-white font-black text-right">{cita.servicio_nombre}</span>
            </div>
            {showBarbero && (
              <div className="flex justify-between items-center gap-4 py-1.5 border-b border-white/5">
                <span className="text-zinc-500 font-black uppercase text-xs tracking-widest">Barbero</span>
                <div className="flex items-center gap-2">
                  {cita.barbero_avatar_url ? (
                    <img
                      src={cita.barbero_avatar_url}
                      alt={cita.barbero_nombre}
                      className="w-6 h-6 rounded-full object-cover border border-amber-500/50"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-black border border-amber-500/50">
                      {cita.barbero_nombre?.charAt(0)?.toUpperCase() || 'B'}
                    </div>
                  )}
                  <span className="text-amber-400 font-black text-right">{cita.barbero_nombre}</span>
                </div>
              </div>
            )}
            {cita.cliente_telefono && (
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-zinc-500 font-black uppercase text-xs tracking-widest">Teléfono Cliente</span>
                <a href={`tel:${cita.cliente_telefono}`} className="text-amber-400 hover:underline font-bold text-right">
                  {cita.cliente_telefono}
                </a>
              </div>
            )}
            <div className="flex justify-between gap-4 items-center py-1.5 border-b border-white/5">
              <span className="text-zinc-500 font-black uppercase text-xs tracking-widest">Estado</span>
              <Badge variant={estadoVariant[cita.estado] || 'default'} className="uppercase text-xs font-black py-1 px-3">
                {cita.estado.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
              <span className="text-zinc-500 font-black uppercase text-xs tracking-widest">Precio</span>
              <span className="text-white font-black text-lg">{formatCurrency(cita.precio)}</span>
            </div>
            {cita.anticipo_monto !== undefined && cita.anticipo_monto > 0 ? (
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-zinc-500 font-black uppercase text-xs tracking-widest">
                  {cita.anticipo_monto >= cita.precio ? 'Pago Completo QR' : 'Anticipo QR Pagado'}
                </span>
                <span className="text-amber-400 font-black text-lg">{formatCurrency(cita.anticipo_monto)}</span>
              </div>
            ) : (
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-zinc-500 font-black uppercase text-xs tracking-widest">Tipo de Reserva</span>
                <span className="text-red-400 font-black text-xs">Sin Adelanto (Paga en Local)</span>
              </div>
            )}
            <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
              <span className="text-zinc-500 font-black uppercase text-xs tracking-widest">Duración</span>
              <span className="text-white font-bold">{cita.duracion_minutos} min</span>
            </div>
            {cita.notas && (
              <div className="py-2.5">
                <span className="text-zinc-500 font-black uppercase text-xs tracking-widest block mb-1">Notas / Detalles</span>
                <p className="text-zinc-300 text-sm bg-black/40 p-3 rounded-xl border border-white/5 whitespace-pre-wrap leading-relaxed">{cita.notas}</p>
              </div>
            )}
          </div>

          {cita.comprobante_url && (
            <div className="pt-2 border-t border-white/5">
              <Button
                onClick={() => setShowImage(true)}
                variant="outline"
                className="w-full h-11 uppercase tracking-widest font-black text-xs text-amber-500 border-amber-500/20 hover:bg-amber-500/10"
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

          <div className="mt-auto pt-6 space-y-4 border-t border-white/10">
            {userRole === 'barbero' && cita.reprogramacion_estado === 'pendiente_aprobacion' && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl space-y-3 mb-4">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-widest flex items-center gap-2">
                  Solicitud de Reprogramación
                </h4>
                <p className="text-xs text-zinc-300">
                  El cliente solicita cambiar la cita para el:<br />
                  <span className="font-black text-white">
                    {cita.fecha_hora_solicitada ? getBoliviaDateTimeStr(cita.fecha_hora_solicitada) : 'Fecha desconocida'}
                  </span>
                </p>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    disabled={responding}
                    onClick={async () => {
                      setResponding(true)
                      try {
                        const res = await fetch('/api/citas/responder-reprogramacion', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ citaId: cita.id, respuesta: 'aceptar' })
                        })
                        if (!res.ok) throw new Error('Error al aceptar')
                        success('Reprogramación aceptada')
                        if (onUpdate) onUpdate()
                        else window.location.reload()
                        onClose()
                      } catch (e) {
                        error('No se pudo aceptar la reprogramación')
                      } finally {
                        setResponding(false)
                      }
                    }}
                  >Aceptar</Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    disabled={responding}
                    onClick={async () => {
                      setResponding(true)
                      try {
                        const res = await fetch('/api/citas/responder-reprogramacion', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ citaId: cita.id, respuesta: 'rechazar' })
                        })
                        if (!res.ok) throw new Error('Error al rechazar')
                        success('Reprogramación rechazada')
                        if (onUpdate) onUpdate()
                        else window.location.reload()
                        onClose()
                      } catch (e) {
                        error('No se pudo rechazar la reprogramación')
                      } finally {
                        setResponding(false)
                      }
                    }}
                  >Rechazar</Button>
                </div>
              </div>
            )}

            {showReprogramar ? (
              <div className="bg-zinc-950 p-6 rounded-2xl border border-white/10 space-y-4">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-widest">Reprogramar Cita</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1 block">Nueva Fecha</label>
                    <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                      className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-amber-500/50 outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1 block">Nueva Hora</label>
                    <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                      className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-amber-500/50 outline-none" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" size="md" className="flex-1 h-11 font-bold text-xs uppercase" onClick={() => setShowReprogramar(false)}>Cancelar</Button>
                  <Button variant="primary" size="md" className="flex-1 h-11 font-black text-xs uppercase" disabled={reprogramming || !newDate || !newTime}
                    onClick={async () => {
                      setReprogramming(true)
                      try {
                        const res = await fetch(`/api/citas/${cita.id}/reprogramar`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ newDate, newTime, durationMinutes: cita.duracion_minutos })
                        })
                        if (!res.ok) throw new Error('Error al reprogramar')
                        success('Cita reprogramada con éxito')
                        if (onUpdate) onUpdate()
                        else window.location.reload()
                        onClose()
                      } catch (e) {
                        error('No se pudo reprogramar la cita')
                      } finally {
                        setReprogramming(false)
                      }
                    }}>
                    {reprogramming ? 'Guardando...' : 'Confirmar'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {(cita.estado === 'pendiente' || cita.estado === 'confirmado' || cita.estado === 'en_proceso') && (
                  <>
                    <Link href={`/${userRole === 'admin' ? 'admin' : 'coordinador'}/caja?cita_id=${cita.id}`} className="block w-full">
                      <Button
                        variant="primary"
                        size="md"
                        className="w-full h-12 font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 gap-2 shadow-lg shadow-emerald-500/20 text-sm"
                      >
                        💰 Cobrar en POS
                      </Button>
                    </Link>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {(userRole === 'admin' || userRole === 'coordinador') && (
                        <Button
                          variant="outline"
                          size="md"
                          className="flex-1 h-11 font-black uppercase tracking-wider text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 border-amber-500/20 text-xs"
                          onClick={() => {
                            setNewDate(getBoliviaDateKey(cita.fecha_hora))
                            setNewTime(getBoliviaTimeStr(cita.fecha_hora))
                            setShowReprogramar(true)
                          }}
                        >
                          Reprogramar
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="md"
                        className="flex-1 h-11 font-black uppercase tracking-wider text-xs"
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
                        {canceling ? '...' : 'No Asistió'}
                      </Button>
                    </div>
                  </>
                )}

                {cita.estado === 'pendiente_pago' ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      {cita.comprobante_url && (
                        <Button
                          onClick={() => window.open(cita.comprobante_url!, '_blank')}
                          variant="outline"
                          size="md"
                          className="flex-1 h-11 font-black uppercase tracking-wider text-amber-500 border-amber-500/20 hover:bg-amber-500/10 text-xs"
                        >
                          📷 Comprobante
                        </Button>
                      )}
                      <Button
                        variant="warning"
                        size="md"
                        className="flex-1 h-11 font-black uppercase tracking-wider text-xs"
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
                        {verifying ? '...' : '✅ Verificar Pago'}
                      </Button>
                    </div>
                    <Button
                      variant="danger"
                      size="md"
                      className="w-full h-11 font-black uppercase tracking-wider text-xs"
                      disabled={canceling}
                      onClick={async () => {
                        if (!confirm('¿Cancelar cita no pagada / no asistida? No generará ningún ingreso en caja.')) return;
                        setCanceling(true)
                        try {
                          const supabase = createClient()
                          const { error: err } = await supabase
                            .from('citas')
                            .update({ estado: 'cancelado', anticipo_monto: 0, updated_at: new Date().toISOString() })
                            .eq('id', cita.id)
                          if (err) throw err
                          success('Cita cancelada sin ingreso registrado')
                          if (onUpdate) onUpdate()
                          else window.location.reload()
                          onClose()
                        } catch (e) {
                          error('Error al cancelar cita')
                        } finally {
                          setCanceling(false)
                        }
                      }}
                    >
                      ❌ Cancelar Cita
                    </Button>
                  </div>
                ) : (
                  <Link href="/coordinador" className="w-full hidden">
                    <Button variant="primary" size="md" className="w-full font-black uppercase tracking-wider hidden">
                      Ir a coordinación
                    </Button>
                  </Link>
                )}

                <Button variant="outline" size="md" className="w-full h-11 font-bold uppercase tracking-wider text-xs" onClick={onClose}>
                  Cerrar Ventana
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
