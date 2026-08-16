'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import {
  Calendar, Clock, FileText, CheckCircle2, XCircle, AlertCircle,
  Eye, Download, RefreshCw, User, Check, X, Filter, ChevronRight
} from 'lucide-react'

interface PermisoAdminItem {
  id: string
  barbero_id: string
  fecha: string
  fecha_fin?: string | null
  hora_inicio?: string | null
  hora_fin?: string | null
  todo_el_dia: boolean
  tipo_permiso: string
  motivo: string
  comprobante_url?: string | null
  archivo_nombre?: string | null
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado'
  revisado_por?: string | null
  revisado_at?: string | null
  motivo_rechazo?: string | null
  created_at: string
  barbero?: {
    id: string
    full_name: string | null
    email: string | null
    phone?: string | null
    avatar_url?: string | null
    ci?: string | null
    role?: string
  }
}

export function AdminPermisosPanel() {
  const { success, error: toastError } = useToast()
  const [solicitudes, setSolicitudes] = useState<PermisoAdminItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendiente' | 'aprobado' | 'rechazado'>('pendiente')
  const [filtroBarbero, setFiltroBarbero] = useState('')
  const [search, setSearch] = useState('')

  // Modales
  const [selectedPdf, setSelectedPdf] = useState<{ url: string; name?: string; barbero?: string } | null>(null)
  const [rechazarModal, setRechazarModal] = useState<PermisoAdminItem | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const loadSolicitudes = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/permisos')
      if (!res.ok) throw new Error('Error al cargar permisos')
      const data = await res.json()
      setSolicitudes(data.solicitudes || [])
    } catch (e) {
      console.error('Error cargando permisos en admin:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSolicitudes()
  }, [loadSolicitudes])

  const handleAprobar = async (item: PermisoAdminItem) => {
    const confirmMsg = `¿Aprobar permiso para ${item.barbero?.full_name || 'el barbero'} para el día ${item.fecha}?\n\nEsto marcará su asistencia como "Permiso Justificado" y le enviará un correo automático de confirmación.`
    if (!confirm(confirmMsg)) return

    try {
      setProcessingId(item.id)
      const res = await fetch(`/api/permisos/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'aprobar' }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al aprobar')

      success('✅ Permiso aprobado y notificado al barbero.')
      loadSolicitudes()
    } catch (e: any) {
      toastError(e.message || 'No se pudo aprobar el permiso')
    } finally {
      setProcessingId(null)
    }
  }

  const handleConfirmRechazo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rechazarModal) return

    try {
      setProcessingId(rechazarModal.id)
      const res = await fetch(`/api/permisos/${rechazarModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'rechazar',
          motivo_rechazo: motivoRechazo.trim() || 'No autorizado por administración',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al rechazar')

      success('🚫 Permiso rechazado y notificado al barbero.')
      setRechazarModal(null)
      setMotivoRechazo('')
      loadSolicitudes()
    } catch (e: any) {
      toastError(e.message || 'No se pudo rechazar el permiso')
    } finally {
      setProcessingId(null)
    }
  }

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'medico': return '🩺 Salud / Reposo Médico'
      case 'personal': return '👨‍👩‍👧 Asunto Personal'
      case 'emergencia': return '🚨 Emergencia'
      case 'enfermedad_grave': return '🤒 Enfermedad Grave'
      case 'jornada_completa': return '💼 Jornada Completa'
      case 'horas': return '⏳ Por Horas'
      default: return '📋 Permiso General'
    }
  }

  // Filtrado
  const filtered = solicitudes.filter(item => {
    if (filtroEstado !== 'todos' && item.estado !== filtroEstado) return false
    if (filtroBarbero && item.barbero_id !== filtroBarbero) return false
    if (search) {
      const q = search.toLowerCase()
      const bName = item.barbero?.full_name?.toLowerCase() || ''
      const mot = item.motivo?.toLowerCase() || ''
      const fechaStr = item.fecha?.toLowerCase() || ''
      if (!bName.includes(q) && !mot.includes(q) && !fechaStr.includes(q)) return false
    }
    return true
  })

  // Lista única de barberos para el filtro
  const barberosOpts = Array.from(
    new Map(
      solicitudes
        .filter(s => s.barbero?.id)
        .map(s => [s.barbero!.id, s.barbero!.full_name || 'Barbero'])
    ).entries()
  )

  const pendientesCount = solicitudes.filter(s => s.estado === 'pendiente').length
  const aprobadosCount = solicitudes.filter(s => s.estado === 'aprobado').length
  const rechazadosCount = solicitudes.filter(s => s.estado === 'rechazado').length

  return (
    <Card className="bg-zinc-900 border-amber-500/20 shadow-2xl overflow-hidden">
      <CardHeader className="p-4 sm:p-6 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileText className="w-5 h-5" />
            </span>
            <CardTitle className="text-xl font-black uppercase tracking-tight text-white">
              Gestión de Permisos y Justificativos
            </CardTitle>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Revisa los PDFs adjuntos por el personal, aprueba o rechaza solicitudes y notifícales al instante.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSolicitudes}
            className="border-zinc-800 text-zinc-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-5">
        {/* Pestañas de Estado */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFiltroEstado('pendiente')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${
              filtroEstado === 'pendiente'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Pendientes de Revisión</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              filtroEstado === 'pendiente' ? 'bg-black text-amber-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              {pendientesCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado('aprobado')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${
              filtroEstado === 'aprobado'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Aprobados</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              filtroEstado === 'aprobado' ? 'bg-black text-emerald-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {aprobadosCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado('rechazado')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${
              filtroEstado === 'rechazado'
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <XCircle className="w-4 h-4" />
            <span>Rechazados</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              filtroEstado === 'rechazado' ? 'bg-black text-red-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {rechazadosCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado('todos')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              filtroEstado === 'todos'
                ? 'bg-zinc-700 text-white'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            Todos ({solicitudes.length})
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nombre de barbero, motivo o fecha..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-sm"
            />
          </div>

          {barberosOpts.length > 0 && (
            <select
              value={filtroBarbero}
              onChange={(e) => setFiltroBarbero(e.target.value)}
              className="h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-xs font-bold text-white outline-none focus:border-amber-500"
            >
              <option value="">Todos los barberos</option>
              {barberosOpts.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Lista de Solicitudes */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center bg-zinc-950/50 rounded-2xl border border-dashed border-zinc-800 space-y-2">
            <FileText className="w-10 h-10 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-zinc-400">
              No hay solicitudes {filtroEstado !== 'todos' ? `con estado "${filtroEstado}"` : ''}
            </p>
            <p className="text-xs text-zinc-500">
              Cuando un barbero suba un PDF solicitando permiso, aparecerá aquí inmediatamente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => {
              const esPdf = item.comprobante_url?.includes('.pdf') || item.comprobante_url?.startsWith('data:application/pdf')
              const isProcessing = processingId === item.id

              return (
                <div
                  key={item.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    item.estado === 'pendiente'
                      ? 'bg-zinc-950 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.05)]'
                      : item.estado === 'aprobado'
                      ? 'bg-zinc-950/70 border-emerald-500/20'
                      : 'bg-zinc-950/70 border-zinc-800'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                    {/* Info Barbero & Fecha */}
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center text-zinc-400 shrink-0">
                          {item.barbero?.avatar_url ? (
                            <img src={item.barbero.avatar_url} alt={item.barbero.full_name || ''} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-black text-white">
                              {item.barbero?.full_name || 'Barbero Desconocido'}
                            </h4>
                            {item.barbero?.ci && (
                              <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                                CI: {item.barbero.ci}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400">
                            Solicitado el {new Date(item.created_at).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      {/* Badges de Fecha y Tipo */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {item.fecha_fin && item.fecha_fin !== item.fecha
                            ? `${item.fecha} al ${item.fecha_fin}`
                            : item.fecha}
                        </span>

                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-zinc-300 bg-zinc-800 border border-zinc-700 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-zinc-400" />
                          {item.todo_el_dia ? 'Día Completo' : `${item.hora_inicio || '09:00'} - ${item.hora_fin || '20:00'}`}
                        </span>

                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-violet-300 bg-violet-500/10 border border-violet-500/20">
                          {getTipoLabel(item.tipo_permiso)}
                        </span>
                      </div>

                      {/* Motivo */}
                      <div className="p-3.5 bg-zinc-900/90 rounded-xl border border-zinc-800/80">
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block mb-1">
                          Motivo / Justificación:
                        </span>
                        <p className="text-sm text-zinc-200 font-medium whitespace-pre-wrap leading-relaxed">
                          {item.motivo}
                        </p>
                      </div>

                      {/* Historial de Revisión */}
                      {item.revisado_por && (
                        <div className="text-xs text-zinc-400 flex items-center gap-2">
                          <span>
                            {item.estado === 'aprobado' ? '✅ Aprobado por' : '❌ Rechazado por'}{' '}
                            <strong className="text-white">{item.revisado_por}</strong>
                          </span>
                          {item.motivo_rechazo && (
                            <span className="text-red-400 font-medium italic">
                              — "{item.motivo_rechazo}"
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Acciones y Vista de PDF */}
                    <div className="flex flex-col items-stretch sm:items-end gap-3 shrink-0 lg:w-64 pt-2 lg:pt-0">
                      {item.comprobante_url ? (
                        <button
                          type="button"
                          onClick={() => setSelectedPdf({
                            url: item.comprobante_url!,
                            name: item.archivo_nombre || 'Justificativo.pdf',
                            barbero: item.barbero?.full_name || 'Barbero'
                          })}
                          className="w-full py-2.5 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-wider border border-amber-500/30 transition flex items-center justify-center gap-2 shadow"
                        >
                          <FileText className="w-4 h-4" />
                          <span>{esPdf ? '📄 Ver PDF Adjunto' : '📷 Ver Comprobante'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-zinc-500 italic text-center w-full">
                          Sin archivo adjunto
                        </span>
                      )}

                      {/* Botones de Aprobación */}
                      {item.estado === 'pendiente' ? (
                        <div className="flex gap-2 w-full">
                          <Button
                            onClick={() => handleAprobar(item)}
                            disabled={isProcessing}
                            variant="success"
                            className="flex-1 py-4 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/10"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Aprobar
                          </Button>
                          <Button
                            onClick={() => {
                              setRechazarModal(item)
                              setMotivoRechazo('')
                            }}
                            disabled={isProcessing}
                            variant="danger"
                            className="flex-1 py-4 text-xs font-black uppercase tracking-wider"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Rechazar
                          </Button>
                        </div>
                      ) : (
                        <div className="w-full text-center">
                          {item.estado === 'aprobado' ? (
                            <span className="inline-block w-full py-2 px-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-black uppercase tracking-widest">
                              ✓ Aprobado
                            </span>
                          ) : (
                            <span className="inline-block w-full py-2 px-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-black uppercase tracking-widest">
                              ✕ Rechazado
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Modal Rechazar Permiso */}
      {rechazarModal && (
        <Modal
          isOpen={Boolean(rechazarModal)}
          onClose={() => setRechazarModal(null)}
          title="🚫 Rechazar Solicitud de Permiso"
          subtitle={`Indica el motivo por el cual no se autoriza el permiso a ${rechazarModal.barbero?.full_name || 'el barbero'}. Se le notificará por correo.`}
        >
          <form onSubmit={handleConfirmRechazo} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-zinc-400">Motivo del Rechazo</label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={3}
                placeholder="Ej. Cobertura insuficiente en el turno, por favor coordina otra fecha..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-red-500 outline-none resize-none"
                required
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRechazarModal(null)}
                className="flex-1 font-bold text-zinc-400"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="danger"
                className="flex-1 font-black uppercase tracking-wider py-5"
              >
                Confirmar Rechazo
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Visor de PDF */}
      {selectedPdf && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          onClick={() => setSelectedPdf(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[92vh] bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-white font-black text-sm uppercase">
                <FileText className="w-5 h-5 text-amber-500" />
                <span>{selectedPdf.barbero} — {selectedPdf.name || 'Documento Justificativo'}</span>
              </div>
              <div className="flex gap-2">
                <a
                  href={selectedPdf.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-black uppercase flex items-center gap-1 hover:bg-amber-400 transition shadow"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar Archivo
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedPdf(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:text-white transition"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="flex-1 p-2 bg-black overflow-auto min-h-[450px] flex items-center justify-center">
              {selectedPdf.url.includes('.pdf') || selectedPdf.url.startsWith('data:application/pdf') ? (
                <iframe
                  src={selectedPdf.url}
                  className="w-full h-[72vh] rounded-xl border-none"
                  title="Visor de PDF"
                />
              ) : (
                <img
                  src={selectedPdf.url}
                  alt="Comprobante"
                  className="max-h-[72vh] max-w-full object-contain rounded-xl"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
