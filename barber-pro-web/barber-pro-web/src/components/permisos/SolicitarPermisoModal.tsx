'use client'

import React, { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FileUpload } from '@/components/ui/FileUpload'
import { useToast } from '@/components/ui/Toast'
import { getBusinessDateString } from '@/lib/asistencia/helpers'
import { Calendar, Clock, FileText, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react'

interface SolicitarPermisoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  barberoId?: string
}

export function SolicitarPermisoModal({
  isOpen,
  onClose,
  onSuccess,
  barberoId,
}: SolicitarPermisoModalProps) {
  const { success, error: toastError } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const [fecha, setFecha] = useState(() => getBusinessDateString())
  const [esRango, setEsRango] = useState(false)
  const [fechaFin, setFechaFin] = useState('')
  const [todoElDia, setTodoElDia] = useState(true)
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [horaFin, setHoraFin] = useState('14:00')
  const [tipoPermiso, setTipoPermiso] = useState('medico')
  const [motivo, setMotivo] = useState('')
  const [comprobanteUrl, setComprobanteUrl] = useState('')
  const [archivoNombre, setArchivoNombre] = useState('')

  const resetForm = () => {
    setFecha(getBusinessDateString())
    setEsRango(false)
    setFechaFin('')
    setTodoElDia(true)
    setHoraInicio('09:00')
    setHoraFin('14:00')
    setTipoPermiso('medico')
    setMotivo('')
    setComprobanteUrl('')
    setArchivoNombre('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fecha) {
      toastError('Selecciona la fecha del permiso')
      return
    }
    if (esRango && (!fechaFin || fechaFin < fecha)) {
      toastError('La fecha de fin debe ser posterior a la fecha de inicio')
      return
    }
    if (!todoElDia && horaInicio >= horaFin) {
      toastError('La hora de inicio debe ser anterior a la hora de fin')
      return
    }
    if (!motivo.trim()) {
      toastError('Ingresa el motivo o justificación del permiso')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/permisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barbero_id: barberoId,
          fecha,
          fecha_fin: esRango ? fechaFin : null,
          todo_el_dia: todoElDia,
          hora_inicio: todoElDia ? null : horaInicio,
          hora_fin: todoElDia ? null : horaFin,
          tipo_permiso: tipoPermiso,
          motivo: motivo.trim(),
          comprobante_url: comprobanteUrl || null,
          archivoNombre: archivoNombre || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar la solicitud')
      }

      success('📋 Solicitud de permiso enviada. Notificada al Administrador y Coordinador.')
      resetForm()
      onClose()
      onSuccess?.()
    } catch (err: any) {
      toastError(err.message || 'No se pudo enviar la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📋 Solicitar Permiso Laboral"
      subtitle="Sube tu justificación en PDF o imagen y especifica el día y horario para revisión de la administración."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Tipo de Permiso */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-zinc-400 tracking-wider">
            Tipo de Permiso / Motivo
          </label>
          <select
            value={tipoPermiso}
            onChange={(e) => setTipoPermiso(e.target.value)}
            className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm font-semibold text-white focus:border-amber-500 outline-none transition"
          >
            <option value="medico">🩺 Salud / Cita o Reposo Médico</option>
            <option value="personal">👨‍👩‍👧 Asunto Personal o Familiar</option>
            <option value="emergencia">🚨 Salida de Emergencia</option>
            <option value="enfermedad_grave">🤒 Enfermedad Grave (Días de Reposo)</option>
            <option value="jornada_completa">💼 Ausencia de Jornada Completa</option>
            <option value="horas">⏳ Permiso Parcial por Horas</option>
            <option value="otro">📦 Otro Motivo Especial</option>
          </select>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              {esRango ? 'Fecha Inicio' : 'Fecha del Permiso'}
            </label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="bg-zinc-950 border-zinc-800"
              required
            />
          </div>

          {esRango && (
            <div className="space-y-1.5 animate-in fade-in">
              <label className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" /> Fecha Fin
              </label>
              <Input
                type="date"
                min={fecha}
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="bg-zinc-950 border-zinc-800"
                required
              />
            </div>
          )}
        </div>

        {/* Toggle Rango de varios días */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="toggleRango"
            checked={esRango}
            onChange={(e) => {
              setEsRango(e.target.checked)
              if (!e.target.checked) setFechaFin('')
            }}
            className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500"
          />
          <label htmlFor="toggleRango" className="text-xs text-zinc-400 cursor-pointer select-none">
            ¿Es un permiso para múltiples días consecutivos?
          </label>
        </div>

        {/* Horario */}
        <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Cobertura Horaria
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTodoElDia(true)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  todoElDia
                    ? 'bg-amber-500 text-black shadow'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Día Completo
              </button>
              <button
                type="button"
                onClick={() => setTodoElDia(false)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  !todoElDia
                    ? 'bg-amber-500 text-black shadow'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Por Horas
              </button>
            </div>
          </div>

          {!todoElDia && (
            <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Hora Inicio</label>
                <Input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="bg-zinc-900 border-zinc-800"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Hora Fin</label>
                <Input
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                  className="bg-zinc-900 border-zinc-800"
                  required
                />
              </div>
            </div>
          )}
        </div>

        {/* Motivo */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-zinc-400 tracking-wider">
            Detalle / Explicación del Motivo <span className="text-amber-500">*</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Describe la razón de tu solicitud (ej: Cita odontológica programada en la clínica...)"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-amber-500 outline-none resize-none transition"
            required
          />
        </div>

        {/* Subida de Comprobante / PDF */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              Documento o Justificativo (PDF / Imagen)
            </span>
            <span className="text-[10px] text-amber-400 font-bold">RECOMENDADO</span>
          </label>
          <FileUpload
            label="Subir PDF o Foto del Justificativo"
            defaultUrl={comprobanteUrl}
            acceptPdf={true}
            onUploadSuccess={(url, name) => {
              setComprobanteUrl(url)
              if (name) setArchivoNombre(name)
            }}
            onUploadError={(err) => toastError(err)}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 pt-3 border-t border-zinc-800/80">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 font-bold text-zinc-400 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="flex-1 font-black uppercase tracking-wider py-5"
          >
            {submitting ? 'Enviando...' : '📤 Enviar Solicitud'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
