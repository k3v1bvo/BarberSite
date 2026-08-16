'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SolicitarPermisoModal } from './SolicitarPermisoModal'
import { useToast } from '@/components/ui/Toast'
import {
  Calendar, Clock, FileText, CheckCircle2, XCircle, AlertCircle,
  Plus, Eye, Download, Trash2, ExternalLink, RefreshCw
} from 'lucide-react'

interface PermisoItem {
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
}

interface BarberoPermisosWidgetProps {
  userId?: string | null
}

export function BarberoPermisosWidget({ userId }: BarberoPermisosWidgetProps) {
  const { success, error: toastError } = useToast()
  const [solicitudes, setSolicitudes] = useState<PermisoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedPdf, setSelectedPdf] = useState<{ url: string; name?: string } | null>(null)

  const loadSolicitudes = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/permisos')
      if (!res.ok) throw new Error('Error al cargar permisos')
      const data = await res.json()
      setSolicitudes(data.solicitudes || [])
    } catch (e) {
      console.error('Error cargando solicitudes de permiso:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSolicitudes()
  }, [loadSolicitudes])

  const handleCancel = async (permisoId: string) => {
    if (!confirm('¿Deseas cancelar esta solicitud de permiso pendiente?')) return
    try {
      const res = await fetch(`/api/permisos/${permisoId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al cancelar')
      success('Solicitud cancelada')
      loadSolicitudes()
    } catch (e: any) {
      toastError(e.message || 'No se pudo cancelar')
    }
  }

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'medico': return '🩺 Cita / Reposo Médico'
      case 'personal': return '👨‍👩‍👧 Asunto Personal'
      case 'emergencia': return '🚨 Emergencia'
      case 'enfermedad_grave': return '🤒 Enfermedad Grave'
      case 'jornada_completa': return '💼 Jornada Completa'
      case 'horas': return '⏳ Por Horas'
      default: return '📋 Permiso General'
    }
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'aprobado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Aprobado
          </span>
        )
      case 'rechazado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30">
            <XCircle className="w-3 h-3" /> Rechazado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertCircle className="w-3 h-3" /> En Revisión
          </span>
        )
    }
  }

  const pendientesCount = solicitudes.filter(s => s.estado === 'pendiente').length
  const aprobadosCount = solicitudes.filter(s => s.estado === 'aprobado').length

  return (
    <>
      <Card className="bg-zinc-900/70 border-white/5 shadow-xl relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6 pb-2 sm:pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                Solicitudes de Permiso
                {pendientesCount > 0 && (
                  <Badge className="bg-amber-500 text-black font-black text-[10px] px-2">
                    {pendientesCount} en revisión
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-zinc-400">
                Sube tu justificación en PDF para que el administrador la apruebe.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadSolicitudes}
              className="p-2 text-zinc-400 hover:text-white border-zinc-800"
              title="Recargar permisos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowModal(true)}
              className="font-black uppercase tracking-wider text-xs shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Solicitar Permiso
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-2">
          {solicitudes.length === 0 ? (
            <div className="p-6 text-center bg-zinc-950/40 rounded-2xl border border-dashed border-zinc-800 space-y-2">
              <FileText className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm font-semibold text-zinc-400">No tienes permisos solicitados</p>
              <p className="text-xs text-zinc-500">
                Si necesitas faltar o llegar en otro horario por razones de salud o personal, envía tu solicitud con tu PDF justificativo.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {solicitudes.map((item) => {
                const esPdf = item.comprobante_url?.includes('.pdf') || item.comprobante_url?.startsWith('data:application/pdf')
                return (
                  <div
                    key={item.id}
                    className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getEstadoBadge(item.estado)}
                        <span className="text-xs font-black uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          {getTipoLabel(item.tipo_permiso)}
                        </span>
                        <span className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-500" />
                          {item.fecha_fin && item.fecha_fin !== item.fecha
                            ? `${item.fecha} al ${item.fecha_fin}`
                            : item.fecha}
                        </span>
                        <span className="text-xs text-zinc-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          {item.todo_el_dia ? 'Jornada Completa' : `${item.hora_inicio || '09:00'} - ${item.hora_fin || '20:00'}`}
                        </span>
                      </div>

                      <p className="text-sm text-zinc-200 font-medium whitespace-pre-wrap">
                        {item.motivo}
                      </p>

                      {item.revisado_por && (
                        <p className="text-[11px] text-zinc-500">
                          Revisado por <strong className="text-zinc-400">{item.revisado_por}</strong>
                          {item.revisado_at ? ` el ${new Date(item.revisado_at).toLocaleDateString('es-BO')}` : ''}
                          {item.motivo_rechazo && (
                            <span className="text-red-400 block mt-0.5">
                              Motivo de rechazo: {item.motivo_rechazo}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Acciones y Documento */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.comprobante_url && (
                        <button
                          type="button"
                          onClick={() => setSelectedPdf({ url: item.comprobante_url!, name: item.archivo_nombre || 'Justificativo.pdf' })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-black uppercase tracking-wider border border-amber-500/30 transition shadow"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{esPdf ? 'Ver PDF' : 'Ver Comprobante'}</span>
                        </button>
                      )}

                      {item.estado === 'pendiente' && (
                        <button
                          type="button"
                          onClick={() => handleCancel(item.id)}
                          className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
                          title="Cancelar solicitud"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Solicitud */}
      <SolicitarPermisoModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={loadSolicitudes}
        barberoId={userId || undefined}
      />

      {/* Modal Visor de PDF */}
      {selectedPdf && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
          onClick={() => setSelectedPdf(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-black text-sm uppercase">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>{selectedPdf.name || 'Documento Justificativo'}</span>
              </div>
              <div className="flex gap-2">
                <a
                  href={selectedPdf.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-black uppercase flex items-center gap-1 hover:bg-amber-400 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedPdf(null)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:text-white"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="flex-1 p-2 bg-black overflow-auto min-h-[400px] flex items-center justify-center">
              {selectedPdf.url.includes('.pdf') || selectedPdf.url.startsWith('data:application/pdf') ? (
                <iframe
                  src={selectedPdf.url}
                  className="w-full h-[70vh] rounded-xl border-none"
                  title="Visor de PDF"
                />
              ) : (
                <img
                  src={selectedPdf.url}
                  alt="Comprobante"
                  className="max-h-[70vh] max-w-full object-contain rounded-xl"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
