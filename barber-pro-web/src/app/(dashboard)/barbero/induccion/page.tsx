'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { YouTubePlayer } from '@/components/induccion/YouTubePlayer'
import { InduccionCard } from '@/components/induccion/InduccionCard'
import { formatSecondsToTimestamp } from '@/lib/youtube'
import { toastSuccess, toastError } from '@/lib/toast'
import {
  GraduationCap, Play, CheckCircle2, Clock, Wrench, Layers,
  ChevronLeft, Sparkles, Check, BookmarkCheck, ArrowRight
} from 'lucide-react'

export default function BarberoInduccionPage() {
  const supabase = createClient()
  const [inducciones, setInducciones] = useState<any[]>([])
  const [progreso, setProgreso] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Selected Inducción for learning room
  const [selectedInduccion, setSelectedInduccion] = useState<any | null>(null)
  const [currentTimestampSeconds, setCurrentTimestampSeconds] = useState<number>(0)
  const [togglingComplete, setTogglingComplete] = useState(false)

  // Fetch assigned inducciones and my progress
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [indRes, progRes] = await Promise.all([
        fetch('/api/inducciones'),
        fetch('/api/inducciones/progreso')
      ])

      if (indRes.ok) setInducciones(await indRes.json())
      if (progRes.ok) setProgreso(await progRes.json())
    } catch (err: any) {
      toastError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Check if an inducción is completed by me
  const isInduccionCompletada = (indId: string) => {
    return progreso.some((p: any) => p.induccion_id === indId && p.estado === 'completado')
  }

  // Toggle Complete / Visto status
  const handleToggleComplete = async (indId: string) => {
    setTogglingComplete(true)
    const currentlyDone = isInduccionCompletada(indId)
    try {
      const res = await fetch('/api/inducciones/progreso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          induccion_id: indId,
          completado: !currentlyDone
        })
      })

      if (!res.ok) throw new Error('Error al actualizar progreso')

      if (!currentlyDone) {
        toastSuccess('🎉 ¡Excelente! Inducción marcada como completada y registrada.')
      } else {
        toastSuccess('Estado de la inducción actualizado.')
      }
      loadData()
    } catch (err: any) {
      toastError(err.message)
    } finally {
      setTogglingComplete(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  const completadasCount = inducciones.filter(i => isInduccionCompletada(i.id)).length
  const porcentajeTotal = inducciones.length > 0 ? Math.round((completadasCount / inducciones.length) * 100) : 0

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24 lg:pb-12">
      {/* Top Header */}
      {!selectedInduccion ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white uppercase flex items-center gap-3">
                <span className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <GraduationCap className="w-8 h-8" />
                </span>
                <span>Academia & <span className="text-amber-500">Capacitación</span></span>
              </h1>
              <p className="text-zinc-400 font-medium mt-1.5 text-sm">
                Módulos y metodologías de servicio asignadas especialmente para tu desarrollo técnico
              </p>
            </div>

            {/* Progress Summary Card */}
            <div className="bg-zinc-900 border border-white/10 p-4 rounded-2xl flex items-center gap-4 shadow-xl">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-base">
                {porcentajeTotal}%
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tu Avance General</p>
                <p className="text-sm font-black text-white">{completadasCount} de {inducciones.length} Capacitaciones Vistas</p>
              </div>
            </div>
          </div>

          {/* Courses Gallery */}
          {inducciones.length === 0 ? (
            <div className="bg-zinc-900/50 border border-dashed border-white/10 rounded-3xl p-12 text-center">
              <GraduationCap className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 font-bold">No tienes capacitaciones asignadas por ahora</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                Tu coordinador o administrador te asignará las inducciones correspondientes muy pronto.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {inducciones.map((ind) => (
                <InduccionCard
                  key={ind.id}
                  induccion={ind}
                  isCompletado={isInduccionCompletada(ind.id)}
                  onClick={() => {
                    setSelectedInduccion(ind)
                    setCurrentTimestampSeconds(0)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* INTERACTIVE LEARNING ROOM VIEW */
        <div className="space-y-6">
          {/* Back button */}
          <button
            onClick={() => setSelectedInduccion(null)}
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition bg-zinc-900 px-3.5 py-2 rounded-xl border border-white/10"
          >
            <ChevronLeft className="w-4 h-4" /> Volver a mis capacitaciones
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Player & Video Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* YouTube Interactive Player */}
              <YouTubePlayer
                url={selectedInduccion.youtube_url}
                title={selectedInduccion.titulo}
                currentSeconds={currentTimestampSeconds}
              />

              {/* Title & Actions Bar */}
              <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    {selectedInduccion.servicios?.nombre && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-md mb-2 inline-block">
                        ✂️ {selectedInduccion.servicios.nombre}
                      </span>
                    )}
                    <h2 className="text-xl font-black text-white">{selectedInduccion.titulo}</h2>
                  </div>

                  {/* Mark Completed Button */}
                  <Button
                    onClick={() => handleToggleComplete(selectedInduccion.id)}
                    disabled={togglingComplete}
                    className={`font-black shrink-0 transition ${
                      isInduccionCompletada(selectedInduccion.id)
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                        : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                    }`}
                  >
                    {isInduccionCompletada(selectedInduccion.id) ? (
                      <>
                        <Check className="w-5 h-5 mr-1.5 stroke-[3]" /> Inducción Completada
                      </>
                    ) : (
                      <>
                        <BookmarkCheck className="w-5 h-5 mr-1.5" /> Marcar como Visto
                      </>
                    )}
                  </Button>
                </div>

                {selectedInduccion.descripcion && (
                  <p className="text-xs text-zinc-300 leading-relaxed font-normal pt-2 border-t border-white/5">
                    {selectedInduccion.descripcion}
                  </p>
                )}

                {/* Tools Required */}
                {selectedInduccion.herramientas_requeridas && selectedInduccion.herramientas_requeridas.length > 0 && (
                  <div className="pt-3 border-t border-white/5 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5" /> Herramientas e Insumos Necesarios
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedInduccion.herramientas_requeridas.map((tool: string, idx: number) => (
                        <span key={idx} className="text-xs bg-zinc-950 border border-white/10 text-zinc-300 font-bold px-2.5 py-1 rounded-lg">
                          • {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Step-by-Step Interactive Checklist */}
            <div className="space-y-4">
              <Card className="border-white/10 bg-zinc-900">
                <CardContent className="p-5 space-y-4">
                  <div className="border-b border-white/10 pb-3">
                    <h3 className="font-black text-white uppercase text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-500" /> Pasos de la Metodología
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Haz clic en un paso para saltar al minuto del video correspondiente.
                    </p>
                  </div>

                  {/* Steps List */}
                  {(!selectedInduccion.induccion_pasos || selectedInduccion.induccion_pasos.length === 0) ? (
                    <p className="text-xs text-zinc-500 py-6 text-center italic">
                      No hay pasos detallados configurados para este video.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedInduccion.induccion_pasos.map((paso: any, idx: number) => {
                        const isCurrentActive = currentTimestampSeconds === (paso.timestamp_segundos || 0)
                        return (
                          <div
                            key={paso.id || idx}
                            onClick={() => setCurrentTimestampSeconds(paso.timestamp_segundos || 0)}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                              isCurrentActive
                                ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-lg'
                                : 'bg-zinc-950/80 border-white/5 hover:border-amber-500/30 text-zinc-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-amber-400">
                                Paso #{paso.numero_paso || idx + 1}: {paso.titulo_paso}
                              </span>
                              <span className="text-[10px] font-mono font-bold bg-black/60 text-zinc-300 border border-white/10 px-2 py-0.5 rounded-md shrink-0">
                                ⏱️ {formatSecondsToTimestamp(paso.timestamp_segundos || 0)}
                              </span>
                            </div>

                            {paso.descripcion && (
                              <p className="text-xs text-zinc-400 mt-1.5 font-normal leading-snug">
                                {paso.descripcion}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
