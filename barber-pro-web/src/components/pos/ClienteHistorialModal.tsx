'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Scissors, ShoppingBag, CreditCard, Star, Calendar, User, Clock, CheckCircle, AlertTriangle, Phone, Mail, IdCard, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDateTime } from '@/lib/utils'

interface ClienteHistorialModalProps {
  isOpen: boolean
  onClose: () => void
  cliente: {
    id: string
    nombre: string
    email?: string | null
    telefono?: string | null
    ci?: string | null
    nivel_fidelidad?: string
    total_visitas?: number
    total_gastado?: number
    codigo_tarjeta?: string | null
  } | null
  historialCitas: any[]
  historialProductos: any[]
  transaccionesCaja: any[]
  stats: {
    barberoFrecuente?: string
    ultimaVisitaFecha?: string
  }
  loading?: boolean
}

export function ClienteHistorialModal({
  isOpen,
  onClose,
  cliente,
  historialCitas = [],
  historialProductos = [],
  transaccionesCaja = [],
  stats = {},
  loading = false,
}: ClienteHistorialModalProps) {
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<'servicios' | 'productos' | 'caja'>('servicios')

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted || !cliente) return null

  const formatFechaCorta = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return iso
    }
  }

  const estadoBadge = (estado: string) => {
    switch (estado) {
      case 'completado':
        return <Badge variant="success" className="text-[10px] uppercase font-black">Completado</Badge>
      case 'en_proceso':
        return <Badge variant="info" className="text-[10px] uppercase font-black">En Proceso</Badge>
      case 'pendiente':
      case 'pendiente_pago':
        return <Badge variant="warning" className="text-[10px] uppercase font-black">Pendiente</Badge>
      case 'cancelado':
      case 'no_presento':
        return <Badge variant="danger" className="text-[10px] uppercase font-black">Cancelado</Badge>
      default:
        return <Badge variant="default" className="text-[10px] uppercase font-black">{estado}</Badge>
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* HEADER DEL CLIENTE */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 rounded-xl transition"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-black font-black text-2xl shadow-lg shadow-amber-500/20 shrink-0">
              {cliente.nombre ? cliente.nombre.charAt(0).toUpperCase() : <User className="w-7 h-7" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-black text-white truncate">{cliente.nombre}</h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  cliente.nivel_fidelidad === 'DIAMANTE' ? 'text-violet-400 bg-violet-400/10 border-violet-400/30' :
                  cliente.nivel_fidelidad === 'PLATINO' ? 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30' :
                  cliente.nivel_fidelidad === 'ORO' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' :
                  cliente.nivel_fidelidad === 'PLATA' ? 'text-zinc-300 bg-zinc-300/10 border-zinc-300/30' :
                  'text-amber-500 bg-amber-500/10 border-amber-500/30'
                }`}>
                  ★ {cliente.nivel_fidelidad || 'BRONCE'}
                </span>
                {cliente.codigo_tarjeta && (
                  <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-700">
                    Cód: {cliente.codigo_tarjeta}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-zinc-400">
                {cliente.ci && (
                  <span className="flex items-center gap-1">
                    <IdCard className="w-3.5 h-3.5 text-zinc-500" /> CI: {cliente.ci}
                  </span>
                )}
                {cliente.telefono && (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Phone className="w-3.5 h-3.5" /> {cliente.telefono}
                  </span>
                )}
                {cliente.email && (
                  <span className="flex items-center gap-1 text-zinc-300 truncate max-w-[200px]">
                    <Mail className="w-3.5 h-3.5 text-zinc-500" /> {cliente.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* TARJETAS RESUMEN RÁPIDO */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
            <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Total Visitas</p>
              <p className="text-sm font-black text-white">{cliente.total_visitas || 0} visitas</p>
            </div>
            <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Total Gastado</p>
              <p className="text-sm font-black text-amber-400">{formatCurrency(cliente.total_gastado || 0)}</p>
            </div>
            <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Barbero Habitual</p>
              <p className="text-sm font-bold text-white truncate">{stats.barberoFrecuente || 'Sin registro'}</p>
            </div>
            <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Última Visita</p>
              <p className="text-sm font-bold text-zinc-300 truncate">
                {stats.ultimaVisitaFecha ? formatFechaCorta(stats.ultimaVisitaFecha) : 'Primera vez'}
              </p>
            </div>
          </div>
        </div>

        {/* TABS DE HISTORIAL */}
        <div className="flex border-b border-zinc-800 bg-zinc-950 px-4 sm:px-6 pt-2">
          <button
            onClick={() => setTab('servicios')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition ${
              tab === 'servicios'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Scissors className="w-4 h-4" />
            Servicios Pasados ({historialCitas.length})
          </button>
          <button
            onClick={() => setTab('productos')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition ${
              tab === 'productos'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Productos ({historialProductos.length})
          </button>
          <button
            onClick={() => setTab('caja')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition ${
              tab === 'caja'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Caja Chica / Pagos ({transaccionesCaja.length})
          </button>
        </div>

        {/* CONTENIDO DE LAS PESTAÑAS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              <span className="inline-block w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-2"></span>
              <p>Cargando historial del cliente...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: SERVICIOS / CITAS */}
              {tab === 'servicios' && (
                historialCitas.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500">
                    <Scissors className="w-10 h-10 mx-auto text-zinc-700 mb-2" />
                    <p className="font-bold">No hay servicios registrados previamente</p>
                    <p className="text-xs text-zinc-600 mt-1">Este cliente no cuenta con citas finalizadas en el sistema.</p>
                  </div>
                ) : (
                  historialCitas.map((cita) => {
                    const servicioNombre = (cita.servicios as any)?.nombre || 'Servicio de Barbería'
                    const barberoNombre = (cita.profiles as any)?.full_name || 'Barbero'
                    return (
                      <div
                        key={cita.id}
                        className="p-4 bg-zinc-950/70 border border-zinc-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700 transition"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-500">
                            <Scissors className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-white text-sm">{servicioNombre}</p>
                              {estadoBadge(cita.estado)}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-400 mt-1">
                              <span className="flex items-center gap-1 font-medium">
                                <Calendar className="w-3 h-3 text-zinc-500" />
                                {formatDateTime(cita.fecha_hora)}
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-1 text-zinc-300 font-medium">
                                <User className="w-3 h-3 text-amber-500" /> {barberoNombre}
                              </span>
                              {cita.metodo_pago && (
                                <>
                                  <span>·</span>
                                  <span className="text-[11px] text-zinc-500 uppercase">{cita.metodo_pago}</span>
                                </>
                              )}
                            </div>
                            {cita.notas && (
                              <p className="text-xs text-amber-500/80 bg-amber-500/5 px-2.5 py-1 rounded-lg mt-2 border border-amber-500/15 max-w-lg">
                                📝 {cita.notas}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right sm:shrink-0 flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-800">
                          <p className="text-base font-black text-amber-400">{formatCurrency(cita.precio || 0)}</p>
                          {cita.propinas > 0 && (
                            <p className="text-[11px] text-emerald-400 font-bold">+ Propina {formatCurrency(cita.propinas)}</p>
                          )}
                        </div>
                      </div>
                    )
                  })
                )
              )}

              {/* TAB 2: PRODUCTOS COMPRADOS */}
              {tab === 'productos' && (
                historialProductos.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500">
                    <ShoppingBag className="w-10 h-10 mx-auto text-zinc-700 mb-2" />
                    <p className="font-bold">No hay compras de productos registradas</p>
                    <p className="text-xs text-zinc-600 mt-1">El cliente no ha adquirido productos en caja todavía.</p>
                  </div>
                ) : (
                  historialProductos.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-4 bg-zinc-950/70 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-3 hover:border-zinc-700 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 text-violet-400">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{(item.productos as any)?.nombre || 'Producto'}</p>
                          <p className="text-xs text-zinc-400">
                            Cantidad: <span className="font-bold text-white">{item.cantidad}</span> x {formatCurrency(item.precio_unitario)}
                            {item.productos?.categoria && ` · ${item.productos.categoria}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black text-white">{formatCurrency(item.subtotal || item.precio_unitario * item.cantidad)}</p>
                      </div>
                    </div>
                  ))
                )
              )}

              {/* TAB 3: CAJA CHICA Y TRANSACCIONES */}
              {tab === 'caja' && (
                transaccionesCaja.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500">
                    <CreditCard className="w-10 h-10 mx-auto text-zinc-700 mb-2" />
                    <p className="font-bold">No hay registros de caja asociados</p>
                    <p className="text-xs text-zinc-600 mt-1">No se encontraron movimientos contables para este cliente.</p>
                  </div>
                ) : (
                  transaccionesCaja.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 bg-zinc-950/70 border border-zinc-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700 transition"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-zinc-300">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-white text-sm">{tx.glosa || 'Movimiento en caja'}</p>
                            <Badge variant={
                              tx.tipo_movimiento === 'INGRESO' || tx.tipo_movimiento === 'VENTA' || tx.tipo_movimiento === 'SERVICIO' ? 'success' :
                              tx.tipo_movimiento === 'EGRESO' || tx.tipo_movimiento === 'SANCION' ? 'danger' : 'default'
                            } className="text-[9px] uppercase font-bold">
                              {tx.tipo_movimiento || tx.libro}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Fecha: {formatFechaCorta(tx.fecha || tx.creado_en)}
                            {tx.metodo_pago && ` · Método: ${tx.metodo_pago.toUpperCase()}`}
                            {tx.usuario_registro && ` · Por: ${tx.usuario_registro}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right sm:shrink-0">
                        <p className="text-base font-black text-amber-400">{formatCurrency(tx.costo || 0)}</p>
                      </div>
                    </div>
                  ))
                )
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-end">
          <Button variant="outline" onClick={onClose} className="font-bold text-xs uppercase tracking-wider">
            Cerrar Historial
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
