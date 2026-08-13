'use client'

import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { Badge } from './Badge'
import { Button } from './Button'
import { formatCurrency } from '@/lib/utils'
import { X, Phone, User, Scissors, Clock, Download, Maximize2 } from 'lucide-react'
import type { AgendaCita } from '@/lib/agenda/types'
import Link from 'next/link'
import { useToast } from './Toast'
import { createClient } from '@/lib/supabase/client'
import { getBoliviaDateTimeStr, getBoliviaDateKey, getBoliviaTimeStr } from '@/lib/agenda/date-utils'

interface CitaDetailModalProps {
  cita: AgendaCita | null
  onClose: () => void
  showBarbero?: boolean
  onUpdate?: () => void
}

export function CitaDetailModal({ cita, onClose, showBarbero = true, onUpdate }: CitaDetailModalProps) {
  const [verifying, setVerifying] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [showReprogramar, setShowReprogramar] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [reprogramming, setReprogramming] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [responding, setResponding] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

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
  if (!cita || !mounted) return null

  const estadoVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    pendiente: 'warning',
    pendiente_pago: 'warning',
    confirmado: 'info',
    en_proceso: 'info',
    completado: 'success',
    cancelado: 'danger',
    no_presento: 'danger',
    comprobante_rechazado: 'danger',
  }

  const downloadComprobante = async () => {
    if (!cita.comprobante_url) return
    try {
      const res = await fetch(cita.comprobante_url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `Comprobante_${cita.id}.jpg`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(cita.comprobante_url, '_blank')
    }
  }

  return createPortal(
    <>
      {/* Lightbox pantalla completa */}
      {lightboxOpen && cita.comprobante_url && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={cita.comprobante_url}
            alt="Comprobante"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}

      {/* Overlay modal */}
      <div
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-lg max-h-[95vh] sm:max-h-[92vh] flex flex-col bg-zinc-950 border border-white/10 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-zinc-900/80 shrink-0">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none">
                Detalle de <span className="text-amber-500">Cita</span>
              </h3>
              <p className="text-xs text-zinc-500 mt-1 font-medium">
                {getBoliviaDateTimeStr(cita.fecha_hora)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenido scrollable */}
          <div className="flex-1 overflow-y-auto">
            {/* Info rápida (chips) */}
            <div className="px-5 pt-4 pb-3 flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5">
                <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-white font-black text-xs truncate max-w-[140px]">{cita.cliente_nombre}</span>
              </div>
              {cita.cliente_telefono && (
                <a
                  href={`tel:${cita.cliente_telefono}`}
                  className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 hover:border-amber-500/50 transition"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-amber-400 font-bold text-xs">{cita.cliente_telefono}</span>
                </a>
              )}
              <Badge variant={estadoVariant[cita.estado] || 'default'} className="uppercase text-[10px] font-black py-1 px-3 rounded-full">
                {cita.estado.replace('_', ' ')}
              </Badge>
            </div>

            {/* Detalles */}
            <div className="px-5 pb-3 space-y-2.5 text-sm">
              <div className="flex items-center gap-3 p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/50">
                <Scissors className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Servicio</p>
                  <p className="text-white font-black truncate">{cita.servicio_nombre}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-amber-400 font-black text-base">{formatCurrency(cita.precio)}</p>
                  <p className="text-zinc-500 text-[10px] flex items-center gap-0.5 justify-end"><Clock className="w-3 h-3" />{cita.duracion_minutos} min</p>
                </div>
              </div>

              {showBarbero && (
                <div className="flex items-center gap-3 p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/50">
                  {cita.barbero_avatar_url ? (
                    <img src={cita.barbero_avatar_url} alt={cita.barbero_nombre} className="w-8 h-8 rounded-full object-cover border-2 border-amber-500/50 shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-black border-2 border-amber-500/30 shrink-0">
                      {cita.barbero_nombre?.charAt(0)?.toUpperCase() || 'B'}
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Barbero</p>
                    <p className="text-amber-400 font-black text-sm">{cita.barbero_nombre}</p>
                  </div>
                </div>
              )}

              {cita.anticipo_monto !== undefined && cita.anticipo_monto > 0 ? (
                <div className="flex justify-between items-center px-3 py-2.5 bg-amber-500/5 rounded-xl border border-amber-500/20">
                  <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
                    {cita.anticipo_monto >= cita.precio ? 'Pago Completo QR' : 'Anticipo QR'}
                  </span>
                  <span className="text-amber-400 font-black">{formatCurrency(cita.anticipo_monto)}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center px-3 py-2.5 bg-red-500/5 rounded-xl border border-red-500/20">
                  <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Tipo de Reserva</span>
                  <span className="text-red-400 font-black text-xs">Sin Adelanto · Paga en Local</span>
                </div>
              )}

              {cita.notas && (
                <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/50">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1.5">Notas</p>
                  <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">
                    {cita.notas.replace(/\[Comprobante\]:\s*([^\s\n\r]+)/i, '').replace(/data:image\/[a-zA-Z]+;base64,[^\s\n\r]+/i, '').trim() || 'Sin notas.'}
                  </p>
                </div>
              )}

              {/* Comprobante inline */}
              {cita.comprobante_url && (
                <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                  <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">📷 Comprobante</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={downloadComprobante}
                        className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition"
                      >
                        <Download className="w-3 h-3" /> Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition"
                      >
                        <Maximize2 className="w-3 h-3" /> Ver
                      </button>
                    </div>
                  </div>
                  <img
                    src={cita.comprobante_url}
                    alt="Comprobante de pago"
                    loading="eager"
                    className="w-full max-h-64 object-contain bg-zinc-950 cursor-pointer"
                    onClick={() => setLightboxOpen(true)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer con acciones */}
          <div className="px-5 py-4 border-t border-white/10 bg-zinc-900/50 shrink-0 space-y-2.5">

            {/* Solicitud de reprogramación pendiente */}
            {userRole === 'barbero' && cita.reprogramacion_estado === 'pendiente_aprobacion' && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl space-y-2">
                <p className="text-xs font-black uppercase text-amber-500 tracking-widest">Solicitud de Reprogramación</p>
                <p className="text-xs text-zinc-300">
                  El cliente solicita cambiar para:{' '}
                  <span className="font-black text-white">
                    {cita.fecha_hora_solicitada ? getBoliviaDateTimeStr(cita.fecha_hora_solicitada) : '—'}
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" className="flex-1" disabled={responding}
                    onClick={async () => {
                      setResponding(true)
                      try {
                        const res = await fetch('/api/citas/responder-reprogramacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ citaId: cita.id, respuesta: 'aceptar' }) })
                        if (!res.ok) throw new Error()
                        success('Reprogramación aceptada')
                        onUpdate ? onUpdate() : window.location.reload()
                        onClose()
                      } catch { error('No se pudo aceptar') } finally { setResponding(false) }
                    }}
                  >Aceptar</Button>
                  <Button variant="danger" size="sm" className="flex-1" disabled={responding}
                    onClick={async () => {
                      setResponding(true)
                      try {
                        const res = await fetch('/api/citas/responder-reprogramacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ citaId: cita.id, respuesta: 'rechazar' }) })
                        if (!res.ok) throw new Error()
                        success('Reprogramación rechazada')
                        onUpdate ? onUpdate() : window.location.reload()
                        onClose()
                      } catch { error('No se pudo rechazar') } finally { setResponding(false) }
                    }}
                  >Rechazar</Button>
                </div>
              </div>
            )}

            {/* Form reprogramar */}
            {showReprogramar ? (
              <div className="bg-zinc-950 p-4 rounded-xl border border-white/10 space-y-3">
                <p className="text-xs font-black uppercase text-amber-500 tracking-widest">Reprogramar Cita</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1 block">Fecha</label>
                    <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                      className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-amber-500/50 outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1 block">Hora</label>
                    <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                      className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-amber-500/50 outline-none" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 font-bold text-xs uppercase" onClick={() => setShowReprogramar(false)}>Cancelar</Button>
                  <Button variant="primary" size="sm" className="flex-1 font-black text-xs uppercase" disabled={reprogramming || !newDate || !newTime}
                    onClick={async () => {
                      setReprogramming(true)
                      try {
                        const res = await fetch(`/api/citas/${cita.id}/reprogramar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newDate, newTime, durationMinutes: cita.duracion_minutos }) })
                        if (!res.ok) throw new Error()
                        success('Cita reprogramada')
                        onUpdate ? onUpdate() : window.location.reload()
                        onClose()
                      } catch { error('No se pudo reprogramar') } finally { setReprogramming(false) }
                    }}>
                    {reprogramming ? 'Guardando...' : 'Confirmar'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {(cita.estado === 'pendiente' || cita.estado === 'confirmado' || cita.estado === 'en_proceso') && (
                  <>
                    <Link href={`/${userRole === 'admin' ? 'admin' : 'coordinador'}/caja?cita_id=${cita.id}`} className="block w-full">
                      <Button variant="primary" size="md" className="w-full h-12 font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 gap-2 shadow-lg shadow-emerald-500/20 text-sm">
                        💰 Cobrar en POS
                      </Button>
                    </Link>
                    <div className="flex gap-2">
                      {(userRole === 'admin' || userRole === 'coordinador') && (
                        <Button variant="outline" size="sm" className="flex-1 h-10 font-black uppercase tracking-wider text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 border-amber-500/20 text-xs"
                          onClick={() => { setNewDate(getBoliviaDateKey(cita.fecha_hora)); setNewTime(getBoliviaTimeStr(cita.fecha_hora)); setShowReprogramar(true) }}>
                          Reprogramar
                        </Button>
                      )}
                      <Button variant="danger" size="sm" className="flex-1 h-10 font-black uppercase tracking-wider text-xs" disabled={canceling}
                        onClick={async () => {
                          if (!confirm('¿Marcar que el cliente no se presentó?')) return
                          setCanceling(true)
                          try {
                            const supabase = createClient()
                            const { error: err } = await supabase.from('citas').update({ estado: 'no_presento', updated_at: new Date().toISOString() }).eq('id', cita.id)
                            if (err) throw err
                            success('Marcado como No Asistió')
                            onUpdate ? onUpdate() : window.location.reload()
                            onClose()
                          } catch { error('Error al actualizar') } finally { setCanceling(false) }
                        }}>
                        {canceling ? '...' : 'No Asistió'}
                      </Button>
                    </div>
                  </>
                )}

                {cita.estado === 'pendiente_pago' && (
                  <div className="space-y-2">
                    <Button variant="warning" size="md" className="w-full h-11 font-black uppercase tracking-wider text-xs" disabled={verifying}
                      onClick={async () => {
                        setVerifying(true)
                        try {
                          const res = await fetch('/api/citas/verificar-pago', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ citaId: cita.id }) })
                          if (!res.ok) throw new Error()
                          success('✅ Pago verificado')
                          onUpdate ? onUpdate() : window.location.reload()
                          onClose()
                        } catch { error('No se pudo verificar el pago') } finally { setVerifying(false) }
                      }}>
                      {verifying ? '...' : '✅ Verificar Pago'}
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="md" className="flex-1 h-11 font-black uppercase tracking-wider text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/30" disabled={rejecting}
                        onClick={async () => {
                          if (!confirm('¿Estás seguro? Esto marcará el comprobante como FALSO/NO VÁLIDO y cancelará la cita. Se notificará al admin, coordinador y barbero.')) return
                          setRejecting(true)
                          try {
                            const res = await fetch('/api/citas/rechazar-comprobante', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ citaId: cita.id }) })
                            if (!res.ok) throw new Error()
                            success('🚫 Comprobante rechazado')
                            onUpdate ? onUpdate() : window.location.reload()
                            onClose()
                          } catch { error('No se pudo rechazar el comprobante') } finally { setRejecting(false) }
                        }}>
                        {rejecting ? '...' : '🚫 Falso'}
                      </Button>
                      <Button variant="danger" size="md" className="flex-1 h-11 font-black uppercase tracking-wider text-xs" disabled={canceling}
                        onClick={async () => {
                          if (!confirm('¿Cancelar cita no pagada?')) return
                          setCanceling(true)
                          try {
                            const supabase = createClient()
                            const { error: err } = await supabase.from('citas').update({ estado: 'cancelado', anticipo_monto: 0, updated_at: new Date().toISOString() }).eq('id', cita.id)
                            if (err) throw err
                            success('Cita cancelada')
                            onUpdate ? onUpdate() : window.location.reload()
                            onClose()
                          } catch { error('Error al cancelar') } finally { setCanceling(false) }
                        }}>
                        {canceling ? '...' : '❌ Cancelar'}
                      </Button>
                    </div>
                  </div>
                )}

                <Button variant="outline" size="sm" className="w-full h-10 font-bold uppercase tracking-wider text-xs" onClick={onClose}>
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
