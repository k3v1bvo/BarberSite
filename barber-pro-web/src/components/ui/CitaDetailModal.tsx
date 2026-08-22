'use client'

import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { Badge } from './Badge'
import { Button } from './Button'
import { formatCurrency } from '@/lib/utils'
import { X, Phone, User, Scissors, Clock, Download, Maximize2, AlertCircle, MessageCircle, ShoppingBag, Gift, Tag } from 'lucide-react'
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
  const [productos, setProductos] = useState<{ id: string; nombre: string; cantidad: number; precio_unitario: number; subtotal: number }[]>([])

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

  useEffect(() => {
    if (!cita?.id) {
      setProductos([])
      return
    }

    const fetchProductos = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('citas_productos')
        .select('id, cantidad, precio_unitario, subtotal, productos(nombre)')
        .eq('cita_id', cita.id)

      if (data && data.length > 0) {
        setProductos(data.map((item: any) => ({
          id: item.id,
          nombre: item.productos?.nombre || 'Producto',
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal || (item.cantidad * item.precio_unitario)
        })))
      } else {
        setProductos([])
      }
    }

    fetchProductos()
  }, [cita?.id])

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

  const matchStandard = cita.notas?.match(/\[Comprobante\]:\s*([^\s\n\r]+)/i)
  const matchBase64 = cita.notas?.match(/(data:image\/[a-zA-Z0-9+]+;base64,[^\s\n\r]+)/i)
  const matchAnyUrl = cita.notas?.match(/(https?:\/\/[^\s\n\r]+\.(?:jpg|jpeg|png|webp|gif|svg)|https?:\/\/(?:i\.)?ibb\.co\/[^\s\n\r]+|https?:\/\/res\.cloudinary\.com\/[^\s\n\r]+)/i)
  const effectiveComprobanteUrl = cita.comprobante_url || (matchStandard ? matchStandard[1].trim() : (matchBase64 ? matchBase64[1].trim() : (matchAnyUrl ? matchAnyUrl[1].trim() : undefined)))

  const downloadComprobante = async () => {
    if (!effectiveComprobanteUrl) return
    try {
      const res = await fetch(effectiveComprobanteUrl)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `Comprobante_${cita.id}.jpg`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(effectiveComprobanteUrl, '_blank')
    }
  }

  return createPortal(
    <>
      {/* Lightbox pantalla completa */}
      {lightboxOpen && effectiveComprobanteUrl && (
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
            src={effectiveComprobanteUrl}
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
            {/* Tarjeta Destacada del Cliente */}
            <div className="p-5 pb-3">
              <div className="p-4 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 rounded-2xl shadow-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-lg shrink-0 shadow-inner">
                      {cita.cliente_nombre?.charAt(0)?.toUpperCase() || 'C'}
                    </div>
                    <div>
                      <p className="text-base font-black text-white leading-tight">{cita.cliente_nombre}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {cita.cliente_ci ? (
                          <span className="text-[11px] font-mono font-bold bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md border border-white/5">
                            CI: {cita.cliente_ci}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-bold">Sin CI registrado</span>
                        )}
                        {cita.cliente_email && (
                          <span className="text-[11px] text-zinc-400 truncate max-w-[200px]">
                            ✉️ {cita.cliente_email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant={estadoVariant[cita.estado] || 'default'} className="uppercase text-[10px] font-black py-1 px-3 rounded-full shrink-0 shadow-md">
                    {cita.estado.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Contacto Directo Teléfono + WhatsApp */}
                {cita.cliente_telefono && (
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <a
                      href={`tel:${cita.cliente_telefono}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition border border-white/5"
                    >
                      <Phone className="w-3.5 h-3.5 text-amber-400" />
                      <span>{cita.cliente_telefono}</span>
                    </a>
                    <a
                      href={`https://wa.me/591${cita.cliente_telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `Hola ${cita.cliente_nombre}, te saludamos de BarberSite 💈. Respecto a tu cita agendada para el ${getBoliviaDateTimeStr(cita.fecha_hora)} con ${cita.barbero_nombre}:`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold transition border border-emerald-500/30 shadow-sm"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Detalles de la Cita y Servicio */}
            <div className="px-5 pb-3 space-y-2.5 text-sm">
              <div className="flex items-center gap-3 p-3.5 bg-zinc-900/80 rounded-xl border border-zinc-800">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 shrink-0">
                  <Scissors className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Servicio Seleccionado</p>
                  <p className="text-white font-black text-sm truncate">{cita.servicio_nombre}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-amber-400 font-black text-base">{formatCurrency(cita.precio)}</p>
                  <p className="text-zinc-500 text-[10px] flex items-center gap-0.5 justify-end"><Clock className="w-3 h-3" />{cita.duracion_minutos} min</p>
                </div>
              </div>

              {/* Si el servicio es gratis por beneficio */}
              {cita.precio === 0 && (
                <div className="p-3.5 bg-gradient-to-r from-amber-500/15 to-emerald-500/15 rounded-xl border border-amber-500/40 space-y-1 shadow-md">
                  <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-wider">
                    <Gift className="w-4 h-4 text-amber-400" />
                    <span>Beneficio Especial: Servicio 100% Gratuito</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Esta cita aplica un premio o promoción de fidelidad (Bs. 0,00). No requiere cobro en caja ni comprobante QR.
                  </p>
                </div>
              )}

              {(() => {
                const matchDesc = (cita.notas || '').match(/Desc:\s*-Bs\s*([0-9.]+)/i)
                const matchOrig = (cita.notas || '').match(/Original:\s*Bs\s*([0-9.]+)/i)
                const matchNeto = (cita.notas || '').match(/Neto(?:\s*cobrado)?:\s*Bs\s*([0-9.]+)/i)
                const descMonto = (cita as any).descuento ? Number((cita as any).descuento) : (matchDesc ? parseFloat(matchDesc[1]) : 0)
                const origMonto = matchOrig ? parseFloat(matchOrig[1]) : (descMonto > 0 ? (cita.precio + descMonto) : cita.precio)
                const netoMonto = matchNeto ? parseFloat(matchNeto[1]) : (descMonto > 0 ? (origMonto - descMonto) : cita.precio)
                if (descMonto <= 0) return null
                return (
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-amber-400 font-black flex items-center gap-1.5">
                        ⭐ Descuento Especial Aplicado
                      </span>
                      <span className="text-amber-400 font-mono font-black text-sm">-{formatCurrency(descMonto)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-white/10">
                      <span>Precio Regular: <span className="line-through text-zinc-500">{formatCurrency(origMonto)}</span></span>
                      <span className="text-white font-bold">Total Final: <span className="text-emerald-400 font-black">{formatCurrency(netoMonto)}</span></span>
                    </div>
                  </div>
                )
              })()}

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
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Barbero Asignado</p>
                    <p className="text-amber-400 font-black text-sm">{cita.barbero_nombre}</p>
                  </div>
                </div>
              )}

              {/* Desglose Financiero y Tipo de Reserva */}
              {cita.precio > 0 && (
                cita.anticipo_monto !== undefined && cita.anticipo_monto > 0 ? (
                  <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/20 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400 font-bold uppercase tracking-widest">
                        {cita.anticipo_monto >= cita.precio ? 'Pago Total por QR' : 'Anticipo por QR'}
                      </span>
                      <span className="text-amber-400 font-black">{formatCurrency(cita.anticipo_monto)}</span>
                    </div>
                    {cita.precio > cita.anticipo_monto && (
                      <div className="flex justify-between items-center text-xs pt-1.5 border-t border-white/5">
                        <span className="text-zinc-400 font-bold">Saldo restante a cobrar en local:</span>
                        <span className="text-white font-black text-sm">{formatCurrency(cita.precio - cita.anticipo_monto)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-between items-center px-3 py-2.5 bg-red-500/5 rounded-xl border border-red-500/20">
                    <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Tipo de Reserva</span>
                    <span className="text-red-400 font-black text-xs">Sin Adelanto · Paga 100% en Local ({formatCurrency(cita.precio)})</span>
                  </div>
                )
              )}

              {/* Productos Reservados */}
              {productos.length > 0 && (
                <div className="p-3 bg-violet-500/10 rounded-xl border border-violet-500/25 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-violet-400 font-black flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5" /> Productos Extra en Reserva
                    </span>
                    <span className="text-[10px] text-violet-300 font-bold bg-violet-500/20 px-2 py-0.5 rounded-full">{productos.length} item(s)</span>
                  </div>
                  <div className="space-y-1.5 pt-0.5">
                    {productos.map(p => (
                      <div key={p.id} className="flex justify-between items-center text-xs bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
                        <span className="text-zinc-200 font-medium">
                          <span className="font-black text-violet-400 mr-1.5">{p.cantidad}x</span>
                          {p.nombre}
                        </span>
                        <span className="font-black text-violet-300">{formatCurrency(p.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notas y Promociones */}
              {cita.notas && (() => {
                const rawNotas = cita.notas
                  .replace(/\[Comprobante\]:\s*([^\s\n\r]+)/gi, '')
                  .replace(/data:image\/[a-zA-Z]+;base64,[^\s\n\r]+/gi, '')
                  .trim()

                if (!rawNotas) return null

                const lines = rawNotas.split('\n').map(l => l.trim()).filter(Boolean)
                const tagLines = lines.filter(l => l.startsWith('[') && l.includes(']'))
                const userNotes = lines.filter(l => !(l.startsWith('[') && l.includes(']'))).join('\n')

                return (
                  <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/50 space-y-2">
                    {tagLines.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tagLines.map((t, idx) => {
                          const isPromo = t.toLowerCase().includes('promo') || t.toLowerCase().includes('descuento')
                          const isQR = t.toLowerCase().includes('qr') || t.toLowerCase().includes('adelanto')
                          return (
                            <span
                              key={idx}
                              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                                isPromo
                                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                  : isQR
                                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                                  : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                              }`}
                            >
                              {isPromo && <Gift className="w-3 h-3" />}
                              {t.replace(/^\[|\]$/g, '')}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    {userNotes && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Comentarios del Cliente</p>
                        <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">{userNotes}</p>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Comprobante inline */}
              {effectiveComprobanteUrl && (
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
                    src={effectiveComprobanteUrl}
                    alt="Comprobante de pago"
                    loading="eager"
                    className="w-full max-h-64 object-contain bg-zinc-950 cursor-pointer"
                    onClick={() => setLightboxOpen(true)}
                  />
                </div>
              )}

              {/* Advertencia si no hay comprobante pero hay anticipo QR pendiente */}
              {!effectiveComprobanteUrl && cita.anticipo_monto !== undefined && cita.anticipo_monto > 0 && cita.estado === 'pendiente_pago' && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-amber-400 uppercase tracking-wider">
                        Comprobante no adjunto
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                        El cliente reservó con anticipo de <span className="font-bold text-white">{formatCurrency(cita.anticipo_monto)}</span> pero no subió la captura de pago.
                      </p>
                    </div>
                  </div>
                  {cita.cliente_telefono && (
                    <a
                      href={`https://wa.me/591${cita.cliente_telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `Hola ${cita.cliente_nombre}, te saludamos de BarberSite 💈. Vemos tu reserva para hoy con ${cita.barbero_nombre}. Por favor, envíanos la captura de tu pago QR de Bs ${cita.anticipo_monto} para confirmar tu horario. ¡Muchas gracias!`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-emerald-600/20"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Pedir Comprobante por WhatsApp
                    </a>
                  )}
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
                        const res = await fetch(`/api/citas/${cita.id}/reprogramar`, { 
                          method: 'POST', 
                          headers: { 'Content-Type': 'application/json' }, 
                          body: JSON.stringify({ newDate, newTime, durationMinutes: cita.duracion_minutos || 30 }) 
                        })
                        const data = await res.json().catch(() => ({}))
                        if (!res.ok) throw new Error(data.error || 'No se pudo reprogramar')
                        success('Cita reprogramada con éxito')
                        onUpdate ? onUpdate() : window.location.reload()
                        onClose()
                      } catch (err: any) { 
                        error(err.message || 'No se pudo reprogramar') 
                      } finally { 
                        setReprogramming(false) 
                      }
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
                    <div className="grid grid-cols-3 gap-2">
                      {(userRole === 'admin' || userRole === 'coordinador') && (
                        <Button variant="outline" size="sm" className="h-11 font-black uppercase tracking-wider text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border-amber-500/30 text-xs"
                          onClick={() => { setNewDate(getBoliviaDateKey(cita.fecha_hora)); setNewTime(getBoliviaTimeStr(cita.fecha_hora)); setShowReprogramar(true) }}>
                          📅 Reprogramar
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-11 font-black uppercase tracking-wider text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 border-orange-500/30 text-xs" disabled={canceling}
                        onClick={async () => {
                          if (!confirm('¿Marcar que el cliente no se presentó a su cita? La hora quedará libre para otros clientes.')) return
                          setCanceling(true)
                          try {
                            const supabase = createClient()
                            const { error: err } = await supabase.from('citas').update({ estado: 'no_presento', updated_at: new Date().toISOString() }).eq('id', cita.id)
                            if (err) throw err
                            success('Marcado como No Asistió (Horario liberado)')
                            onUpdate ? onUpdate() : window.location.reload()
                            onClose()
                          } catch { error('Error al actualizar') } finally { setCanceling(false) }
                        }}>
                        {canceling ? '...' : '⚠️ No Asistió'}
                      </Button>
                      <Button variant="danger" size="sm" className="h-11 font-black uppercase tracking-wider text-xs bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20" disabled={canceling}
                        onClick={async () => {
                          if (!confirm('¿Deseas cancelar esta cita? El horario quedará liberado inmediatamente para otros clientes.')) return
                          setCanceling(true)
                          try {
                            const res = await fetch('/api/citas/cancelar', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ cita_id: cita.id, motivo: 'Cancelada desde panel de administración/agenda' })
                            })
                            if (!res.ok) {
                              const supabase = createClient()
                              await supabase.from('citas').update({ estado: 'cancelado', updated_at: new Date().toISOString() }).eq('id', cita.id)
                            }
                            success('Cita cancelada (Horario liberado)')
                            onUpdate ? onUpdate() : window.location.reload()
                            onClose()
                          } catch { error('Error al cancelar') } finally { setCanceling(false) }
                        }}>
                        {canceling ? '...' : '❌ Cancelar'}
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
                            const res = await fetch('/api/citas/cancelar', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ cita_id: cita.id, motivo: 'Pago QR no completado' })
                            })
                            if (!res.ok) {
                              const supabase = createClient()
                              await supabase.from('citas').update({ estado: 'cancelado', anticipo_monto: 0, updated_at: new Date().toISOString() }).eq('id', cita.id)
                            }
                            success('Cita cancelada (Horario liberado)')
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
