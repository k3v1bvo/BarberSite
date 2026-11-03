'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { X, Save, Clock, Scissors, Users, Check, RefreshCw } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
  barberoIdInicial?: string
}

export default function ReglasComisionesModal({ isOpen, onClose, onSaved, barberoIdInicial }: Props) {
  const { error: toastError, success: toastSuccess } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recalcular, setRecalcular] = useState(true)

  const [escalaHoras, setEscalaHoras] = useState({
    horas_8: 40,
    horas_10: 45,
    horas_11: 50,
  })

  const [serviciosEspeciales, setServiciosEspeciales] = useState<any[]>([])
  const [barberos, setBarberos] = useState<any[]>([])

  useEffect(() => {
    if (!isOpen) return
    const cargarReglas = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/comisiones/reglas')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error cargando reglas')

        if (data.escala_horas) {
          setEscalaHoras({
            horas_8: Number(data.escala_horas.horas_8) || 40,
            horas_10: Number(data.escala_horas.horas_10) || 45,
            horas_11: Number(data.escala_horas.horas_11) || 50,
          })
        }

        setServiciosEspeciales(data.servicios_especiales || [])
        setBarberos(data.barberos || [])
      } catch (err: any) {
        toastError(err.message || 'Error al cargar reglas')
      } finally {
        setLoading(false)
      }
    }

    cargarReglas()
  }, [isOpen])

  if (!isOpen) return null

  const handleGuardar = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/comisiones/reglas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escala_horas: escalaHoras,
          servicios_especiales: serviciosEspeciales,
          barberos: barberos.map(b => ({ id: b.id, comision_porcentaje: Number(b.comision_porcentaje) || 0 })),
          recalcular_pendientes: recalcular,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')

      toastSuccess(data.mensaje || 'Reglas guardadas exitosamente')
      if (onSaved) onSaved()
      onClose()
    } catch (err: any) {
      toastError(err.message || 'Error al guardar reglas')
    } finally {
      setSaving(false)
    }
  }

  const actualizarServicio = (id: string, campo: string, valor: any) => {
    setServiciosEspeciales(prev =>
      prev.map(s => (s.id === id ? { ...s, [campo]: valor } : s))
    )
  }

  const actualizarBarberoPct = (id: string, nuevoPct: number) => {
    setBarberos(prev =>
      prev.map(b => (b.id === id ? { ...b, comision_porcentaje: nuevoPct } : b))
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-zinc-950/60">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">⚙️</span>
              Configuración de Porcentajes y Reglas de Comisión
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Control centralizado de pagos por horas de turno, servicios especiales y porcentajes de barberos.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
              <span>Cargando reglas y porcentajes...</span>
            </div>
          ) : (
            <>
              {/* 1. Escala por Horas de Turno */}
              <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-400 uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-amber-500" />
                  1. Escala según Horas de Turno (Servicios Generales)
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Los servicios normales aplican automáticamente este porcentaje de acuerdo con la jornada semanal programada para el barbero en ese día.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-300">
                      <span>🕒 Turno 8 Horas</span>
                      <span className="text-[10px] text-zinc-500 font-mono">(ej. 10:00 - 18:00)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={escalaHoras.horas_8}
                        onChange={e => setEscalaHoras({ ...escalaHoras, horas_8: Number(e.target.value) || 0 })}
                        className="h-11 bg-zinc-950 text-white font-bold text-base text-center"
                      />
                      <span className="font-bold text-zinc-400">%</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-300">
                      <span>🕒 Turno 10 Horas</span>
                      <span className="text-[10px] text-zinc-500 font-mono">(ej. 10:00 - 20:00)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={escalaHoras.horas_10}
                        onChange={e => setEscalaHoras({ ...escalaHoras, horas_10: Number(e.target.value) || 0 })}
                        className="h-11 bg-zinc-950 text-white font-bold text-base text-center"
                      />
                      <span className="font-bold text-zinc-400">%</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-300">
                      <span>🕒 Turno 11 Horas o más</span>
                      <span className="text-[10px] text-zinc-500 font-mono">(ej. 09:00 - 21:00)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={escalaHoras.horas_11}
                        onChange={e => setEscalaHoras({ ...escalaHoras, horas_11: Number(e.target.value) || 0 })}
                        className="h-11 bg-zinc-950 text-white font-bold text-base text-center"
                      />
                      <span className="font-bold text-zinc-400">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Servicios con Regla Especial */}
              <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-400 uppercase tracking-wider">
                  <Scissors className="w-4 h-4 text-amber-500" />
                  2. Servicios con Pago Especial Protegido
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Estos servicios respetan siempre su regla fija acordada, sin importar las horas del barbero en el día.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {serviciosEspeciales.map(s => {
                    const esFijo = s.comision_tipo === 'fija'
                    return (
                      <div key={s.id} className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white text-sm">{s.nombre}</span>
                          <span className="text-xs text-zinc-500">Precio: Bs {s.precio || 0}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <select
                            value={s.comision_tipo}
                            onChange={e => actualizarServicio(s.id, 'comision_tipo', e.target.value)}
                            className="h-10 bg-zinc-950 border border-white/10 rounded-xl px-3 text-xs text-white font-medium"
                          >
                            <option value="fija">Monto Fijo (Bs)</option>
                            <option value="porcentaje">Porcentaje (%)</option>
                          </select>

                          <div className="flex-1 flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              value={s.comision_valor}
                              onChange={e => actualizarServicio(s.id, 'comision_valor', Number(e.target.value) || 0)}
                              className="h-10 bg-zinc-950 text-white font-bold text-center"
                            />
                            <span className="text-xs font-bold text-zinc-400">{esFijo ? 'Bs' : '%'}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 3. Porcentaje Base por Especialista */}
              <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-400 uppercase tracking-wider">
                  <Users className="w-4 h-4 text-amber-500" />
                  3. Porcentajes de Barberos (Personal)
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Porcentaje asignado a cada barbero. Puedes cambiarlo aquí o directamente en la tabla principal con los botones rápidos.
                </p>

                <div className="divide-y divide-white/5">
                  {barberos.map(b => {
                    const pctActual = Number(b.comision_porcentaje) || 45
                    const esElSeleccionado = barberoIdInicial === b.id

                    return (
                      <div
                        key={b.id}
                        className={`py-3 flex flex-wrap items-center justify-between gap-4 px-2 rounded-xl transition-colors ${
                          esElSeleccionado ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-sm border border-amber-500/30">
                            {b.full_name?.charAt(0) || 'B'}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              {b.full_name}
                              {esElSeleccionado && (
                                <span className="text-[9px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-bold uppercase">
                                  Seleccionado
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-500 uppercase font-mono">{b.role}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Botones rápidos */}
                          <div className="flex items-center gap-1">
                            {[40, 45, 50].map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => actualizarBarberoPct(b.id, p)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${
                                  pctActual === p
                                    ? 'bg-amber-500 text-black border-amber-500'
                                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white hover:border-white/30'
                                }`}
                              >
                                {p}%
                              </button>
                            ))}
                          </div>

                          {/* Input manual */}
                          <div className="flex items-center gap-1 w-24">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={pctActual}
                              onChange={e => actualizarBarberoPct(b.id, Number(e.target.value) || 0)}
                              className="h-9 bg-zinc-900 text-white font-bold text-center text-sm"
                            />
                            <span className="text-xs font-bold text-zinc-400">%</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 bg-zinc-950/80 flex flex-wrap items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={recalcular}
              onChange={e => setRecalcular(e.target.checked)}
              className="w-4 h-4 rounded bg-zinc-900 border-white/20 text-amber-500 focus:ring-amber-500/20"
            />
            <span>Recalcular automáticamente todas las citas pendientes no pagadas</span>
          </label>

          <div className="flex items-center gap-3">
            <Button variant="outline" type="button" onClick={onClose} disabled={saving} className="h-11 px-5 text-xs">
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={handleGuardar}
              disabled={saving || loading}
              className="h-11 px-6 text-xs font-bold uppercase tracking-wider"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" /> Guardar y Aplicar Reglas
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

