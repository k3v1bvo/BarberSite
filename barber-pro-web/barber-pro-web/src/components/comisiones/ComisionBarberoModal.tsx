'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { X, Save, DollarSign, Wrench, Calendar, ChevronDown, ChevronUp, Percent, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──
interface Categoria {
  id: string
  nombre: string
  descripcion: string | null
  requiere_herramientas: boolean
  is_active: boolean
  orden: number
}

interface ServicioBase {
  id: string
  nombre: string
  precio: number
  categoria: string | null
  is_active: boolean
}

interface HorarioItem {
  dia_semana: number
  categoria_id: string
  tiene_herramientas: boolean
}

interface ServicioComision {
  servicio_id: string
  categoria_id: string
  comision_tipo_con: string
  comision_valor_con: number
  comision_tipo_sin: string
  comision_valor_sin: number
}

interface Props {
  barberoId: string
  barberoNombre: string
  barberoImagen?: string
  onClose: () => void
  onSaved?: () => void
}

const DIAS = [
  { key: 0, label: 'Domingo', short: 'Dom' },
  { key: 1, label: 'Lunes', short: 'Lun' },
  { key: 2, label: 'Martes', short: 'Mar' },
  { key: 3, label: 'Miércoles', short: 'Mié' },
  { key: 4, label: 'Jueves', short: 'Jue' },
  { key: 5, label: 'Viernes', short: 'Vie' },
  { key: 6, label: 'Sábado', short: 'Sáb' },
]

export default function ComisionBarberoModal({ barberoId, barberoNombre, barberoImagen, onClose, onSaved }: Props) {
  const { error: toastError, success: toastSuccess } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Data
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [todosServicios, setTodosServicios] = useState<ServicioBase[]>([])

  // Form state
  const [horario, setHorario] = useState<HorarioItem[]>([])
  const [serviciosComision, setServiciosComision] = useState<ServicioComision[]>([])

  // UI state
  const [expandedCategoria, setExpandedCategoria] = useState<string | null>(null)

  // ── Load data ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/comisiones-barbero?barbero_id=${barberoId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error cargando datos')

      setCategorias(json.categorias || [])
      setTodosServicios(json.todos_servicios || [])

      // Horario: si existe, usar; si no, dejar vacío
      if (json.horario?.length > 0) {
        setHorario(json.horario.map((h: any) => ({
          dia_semana: h.dia_semana,
          categoria_id: h.categoria_id,
          tiene_herramientas: h.tiene_herramientas,
        })))
      }

      // Servicios comisión
      if (json.servicios_comision?.length > 0) {
        setServiciosComision(json.servicios_comision.map((s: any) => ({
          servicio_id: s.servicio_id,
          categoria_id: s.categoria_id,
          comision_tipo_con: s.comision_tipo_con || 'porcentaje',
          comision_valor_con: s.comision_valor_con || 0,
          comision_tipo_sin: s.comision_tipo_sin || 'porcentaje',
          comision_valor_sin: s.comision_valor_sin || 0,
        })))
      }

      // Auto-expand first category
      if (json.categorias?.length > 0) {
        setExpandedCategoria(json.categorias[0].id)
      }
    } catch (e: any) {
      toastError(e.message)
    } finally {
      setLoading(false)
    }
  }, [barberoId])

  useEffect(() => { loadData() }, [loadData])

  // ── Horario helpers ──
  const getHorarioDia = (dia: number) => horario.find(h => h.dia_semana === dia)

  const setHorarioDia = (dia: number, categoriaId: string) => {
    const cat = categorias.find(c => c.id === categoriaId)
    setHorario(prev => {
      const rest = prev.filter(h => h.dia_semana !== dia)
      if (!categoriaId) return rest // clear
      return [...rest, {
        dia_semana: dia,
        categoria_id: categoriaId,
        tiene_herramientas: cat?.requiere_herramientas ? true : (getHorarioDia(dia)?.tiene_herramientas ?? false),
      }]
    })
  }

  const toggleHerramientas = (dia: number) => {
    setHorario(prev => prev.map(h => {
      if (h.dia_semana !== dia) return h
      const cat = categorias.find(c => c.id === h.categoria_id)
      if (cat?.requiere_herramientas) return h // can't toggle if category requires it
      return { ...h, tiene_herramientas: !h.tiene_herramientas }
    }))
  }

  // ── Servicios comisión helpers ──
  const getServicioComision = (servicioId: string, categoriaId: string) => {
    return serviciosComision.find(s => s.servicio_id === servicioId && s.categoria_id === categoriaId)
  }

  const setServicioComisionField = (servicioId: string, categoriaId: string, field: string, value: any) => {
    setServiciosComision(prev => {
      const idx = prev.findIndex(s => s.servicio_id === servicioId && s.categoria_id === categoriaId)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], [field]: value }
        return updated
      }
      // Create new entry
      return [...prev, {
        servicio_id: servicioId,
        categoria_id: categoriaId,
        comision_tipo_con: 'porcentaje',
        comision_valor_con: 0,
        comision_tipo_sin: 'porcentaje',
        comision_valor_sin: 0,
        [field]: value,
      }]
    })
  }

  const toggleServicioActivo = (servicioId: string, categoriaId: string) => {
    const existing = getServicioComision(servicioId, categoriaId)
    if (existing) {
      // Remove it
      setServiciosComision(prev => prev.filter(s => !(s.servicio_id === servicioId && s.categoria_id === categoriaId)))
    } else {
      // Add with defaults
      setServiciosComision(prev => [...prev, {
        servicio_id: servicioId,
        categoria_id: categoriaId,
        comision_tipo_con: 'porcentaje',
        comision_valor_con: 30,
        comision_tipo_sin: 'porcentaje',
        comision_valor_sin: 25,
      }])
    }
  }

  // ── Save ──
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/comisiones-barbero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barbero_id: barberoId,
          horario,
          servicios: serviciosComision,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al guardar')
      toastSuccess('Comisiones guardadas correctamente')
      onSaved?.()
    } catch (e: any) {
      toastError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const activarTodosLosServicios = (categoriaId: string) => {
    setServiciosComision(prev => {
      const rest = prev.filter(s => s.categoria_id !== categoriaId)
      const nuevos = todosServicios.map(serv => ({
        servicio_id: serv.id,
        categoria_id: categoriaId,
        comision_tipo_con: 'porcentaje',
        comision_valor_con: 30,
        comision_tipo_sin: 'porcentaje',
        comision_valor_sin: 25,
      }))
      return [...rest, ...nuevos]
    })
  }

  const desactivarTodosLosServicios = (categoriaId: string) => {
    setServiciosComision(prev => prev.filter(s => s.categoria_id !== categoriaId))
  }

  // ── Categorías que están asignadas en el horario ──
  const categoriasUsadas = [...new Set(horario.map(h => h.categoria_id))].filter(Boolean)

  // ── Contar servicios activos por categoría ──
  const countServiciosPorCategoria = (catId: string) => {
    return serviciosComision.filter(s => s.categoria_id === catId).length
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-2 backdrop-blur-md animate-in fade-in duration-300">
        <Card className="w-full max-w-4xl bg-zinc-950 border-white/10 rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center p-16">
            <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando comisiones...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-300">
      <Card className="w-full max-w-4xl border-white/10 shadow-2xl bg-zinc-950 max-h-[95vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl">
        {/* ── Header ── */}
        <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 p-4 sm:p-6 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            {barberoImagen && (
              <img
                src={barberoImagen}
                alt={barberoNombre}
                className="w-12 h-12 rounded-xl object-cover border-2 border-amber-500/40"
              />
            )}
            <div>
              <CardTitle className="text-lg sm:text-xl font-black uppercase text-white leading-none">
                💰 Comisiones de <span className="text-amber-500">{barberoNombre}</span>
              </CardTitle>
              <p className="text-zinc-400 text-[11px] mt-1 font-medium">
                Configura categoría de horario, herramientas y comisiones por servicio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-colors border border-white/10 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ═══ SECCIÓN 1: HORARIO SEMANAL ═══ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                Horario Semanal de Comisión
              </span>
            </div>
            <p className="text-[10px] text-zinc-500">
              Asigna una categoría de comisión y si trae herramientas para cada día de la semana.
              Esto NO afecta el horario real de trabajo, solo el cálculo de comisiones.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
              {DIAS.map(dia => {
                const hDia = getHorarioDia(dia.key)
                const cat = hDia ? categorias.find(c => c.id === hDia.categoria_id) : null
                const isReqTools = cat?.requiere_herramientas ?? false

                return (
                  <div
                    key={dia.key}
                    className={cn(
                      'rounded-xl border p-3 space-y-2 transition-all',
                      hDia
                        ? 'bg-zinc-900 border-amber-500/30'
                        : 'bg-zinc-950 border-white/5 opacity-60'
                    )}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300 block text-center">
                      {dia.short}
                    </span>

                    {/* Category selector */}
                    <select
                      value={hDia?.categoria_id || ''}
                      onChange={e => setHorarioDia(dia.key, e.target.value)}
                      className="w-full h-8 bg-zinc-950 border border-white/10 rounded-lg px-2 text-[10px] font-bold text-white focus:border-amber-500 outline-none appearance-none cursor-pointer"
                    >
                      <option value="">— No trabaja —</option>
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>

                    {/* Herramientas toggle */}
                    {hDia && (
                      <button
                        type="button"
                        onClick={() => toggleHerramientas(dia.key)}
                        disabled={isReqTools}
                        className={cn(
                          'w-full text-[9px] font-black uppercase tracking-wider py-1.5 rounded-lg border transition-all flex items-center justify-center gap-1',
                          hDia.tiene_herramientas || isReqTools
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-400 border-white/10 hover:bg-zinc-700',
                          isReqTools && 'cursor-not-allowed opacity-70'
                        )}
                      >
                        <Wrench size={10} />
                        {hDia.tiene_herramientas || isReqTools ? 'Con Herr.' : 'Sin Herr.'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ═══ SECCIÓN 2: COMISIONES POR SERVICIO ═══ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                Comisiones por Servicio según Categoría
              </span>
            </div>
            <p className="text-[10px] text-zinc-500">
              Configura los servicios que realiza este barbero y sus comisiones (Con y Sin Herramientas) en cada categoría.
            </p>

            {categorias.length === 0 ? (
              <div className="bg-zinc-900/40 border border-dashed border-white/10 rounded-2xl p-8 text-center">
                <Calendar className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-400 text-xs font-bold">No hay categorías registradas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {categorias.map(cat => {
                  const isUsadaEnHorario = categoriasUsadas.includes(cat.id)
                  const countActivos = countServiciosPorCategoria(cat.id)

                  return (
                    <div key={cat.id} className={cn(
                      'rounded-2xl border transition-all overflow-hidden',
                      isUsadaEnHorario ? 'border-amber-500/30 bg-zinc-900/80' : 'border-white/10 bg-zinc-900/40 opacity-90'
                    )}>
                      {/* Category header */}
                      <div className="flex flex-wrap items-center justify-between p-4 gap-3 bg-zinc-900/60 border-b border-white/5">
                        <button
                          type="button"
                          onClick={() => setExpandedCategoria(expandedCategoria === cat.id ? null : cat.id)}
                          className="flex items-center gap-3 text-left flex-1 hover:opacity-80 transition-opacity"
                        >
                          <span className="text-sm font-black text-white uppercase">{cat.nombre}</span>
                          {isUsadaEnHorario ? (
                            <span className="text-[9px] font-black bg-amber-500 text-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                              📅 Asignada al horario
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-white/10 px-2 py-0.5 rounded-full">
                              Configuración
                            </span>
                          )}
                          {cat.requiere_herramientas && (
                            <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Wrench size={9} /> Herramientas obligatorias
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800/80 px-2.5 py-0.5 rounded-full">
                            {countActivos} de {todosServicios.length} activos
                          </span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => activarTodosLosServicios(cat.id)}
                            className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition-all"
                            title="Habilitar todos los servicios con valores estándar"
                          >
                            ⚡ Activar Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => desactivarTodosLosServicios(cat.id)}
                            className="text-[9px] font-black uppercase tracking-wider text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-2.5 py-1 rounded-lg transition-all"
                            title="Desactivar todos los servicios en esta categoría"
                          >
                            Limpiar
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedCategoria(expandedCategoria === cat.id ? null : cat.id)}
                            className="p-1 text-zinc-400 hover:text-white"
                          >
                            {expandedCategoria === cat.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Services list */}
                      {expandedCategoria === cat.id && (
                        <div className="p-4 space-y-2">
                          {/* Table header */}
                          <div className="hidden sm:grid grid-cols-12 gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-1">
                            <div className="col-span-1">✓</div>
                            <div className="col-span-3">Servicio</div>
                            <div className="col-span-4 text-center">🔧 Con Herramientas</div>
                            <div className="col-span-4 text-center">Sin Herramientas</div>
                          </div>

                        {todosServicios.map(serv => {
                          const sc = getServicioComision(serv.id, cat.id)
                          const isActivo = !!sc

                          return (
                            <div
                              key={serv.id}
                              className={cn(
                                'rounded-xl border p-3 transition-all',
                                isActivo
                                  ? 'bg-zinc-800/60 border-amber-500/20'
                                  : 'bg-zinc-950/50 border-white/5 opacity-50'
                              )}
                            >
                              {/* Mobile layout */}
                              <div className="sm:hidden space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => toggleServicioActivo(serv.id, cat.id)}
                                      className={cn(
                                        'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                                        isActivo ? 'bg-amber-500 border-amber-500 text-black' : 'border-zinc-600 hover:border-zinc-400'
                                      )}
                                    >
                                      {isActivo && <span className="text-[10px] font-black">✓</span>}
                                    </button>
                                    <span className="text-xs font-bold text-white">{serv.nombre}</span>
                                  </div>
                                  <span className="text-[10px] font-bold text-zinc-400">Bs {serv.precio}</span>
                                </div>

                                {isActivo && (
                                  <div className="grid grid-cols-2 gap-3">
                                    {/* Con herramientas */}
                                    <div className="space-y-1.5 bg-emerald-500/5 rounded-lg p-2 border border-emerald-500/10">
                                      <span className="text-[9px] font-black uppercase text-emerald-400 flex items-center gap-1">
                                        <Wrench size={9} /> Con Herr.
                                      </span>
                                      <div className="flex gap-1">
                                        <select
                                          value={sc?.comision_tipo_con || 'porcentaje'}
                                          onChange={e => setServicioComisionField(serv.id, cat.id, 'comision_tipo_con', e.target.value)}
                                          className="w-12 h-7 bg-zinc-900 border border-white/10 rounded-md px-1 text-[9px] font-bold text-white outline-none appearance-none"
                                        >
                                          <option value="porcentaje">%</option>
                                          <option value="fija">Bs</option>
                                        </select>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={sc?.comision_valor_con || 0}
                                          onChange={e => setServicioComisionField(serv.id, cat.id, 'comision_valor_con', parseFloat(e.target.value) || 0)}
                                          className="flex-1 h-7 bg-zinc-900 border border-white/10 rounded-md px-2 text-[10px] font-bold text-white outline-none text-center"
                                        />
                                      </div>
                                    </div>
                                    {/* Sin herramientas */}
                                    <div className="space-y-1.5 bg-zinc-800/60 rounded-lg p-2 border border-white/5">
                                      <span className="text-[9px] font-black uppercase text-zinc-400">Sin Herr.</span>
                                      <div className="flex gap-1">
                                        <select
                                          value={sc?.comision_tipo_sin || 'porcentaje'}
                                          onChange={e => setServicioComisionField(serv.id, cat.id, 'comision_tipo_sin', e.target.value)}
                                          className="w-12 h-7 bg-zinc-900 border border-white/10 rounded-md px-1 text-[9px] font-bold text-white outline-none appearance-none"
                                        >
                                          <option value="porcentaje">%</option>
                                          <option value="fija">Bs</option>
                                        </select>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={sc?.comision_valor_sin || 0}
                                          onChange={e => setServicioComisionField(serv.id, cat.id, 'comision_valor_sin', parseFloat(e.target.value) || 0)}
                                          className="flex-1 h-7 bg-zinc-900 border border-white/10 rounded-md px-2 text-[10px] font-bold text-white outline-none text-center"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Desktop layout */}
                              <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                                {/* Checkbox */}
                                <div className="col-span-1 flex justify-center">
                                  <button
                                    onClick={() => toggleServicioActivo(serv.id, cat.id)}
                                    className={cn(
                                      'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                                      isActivo ? 'bg-amber-500 border-amber-500 text-black' : 'border-zinc-600 hover:border-zinc-400'
                                    )}
                                  >
                                    {isActivo && <span className="text-[10px] font-black">✓</span>}
                                  </button>
                                </div>
                                {/* Servicio name + price */}
                                <div className="col-span-3">
                                  <span className="text-xs font-bold text-white block truncate">{serv.nombre}</span>
                                  <span className="text-[10px] text-zinc-500">Bs {serv.precio}</span>
                                </div>
                                {/* Con herramientas */}
                                <div className="col-span-4">
                                  {isActivo ? (
                                    <div className="flex items-center gap-1.5 bg-emerald-500/5 rounded-lg p-1.5 border border-emerald-500/10">
                                      <Wrench size={10} className="text-emerald-400 shrink-0" />
                                      <select
                                        value={sc?.comision_tipo_con || 'porcentaje'}
                                        onChange={e => setServicioComisionField(serv.id, cat.id, 'comision_tipo_con', e.target.value)}
                                        className="w-14 h-7 bg-zinc-900 border border-white/10 rounded-md px-1 text-[10px] font-bold text-white outline-none appearance-none"
                                      >
                                        <option value="porcentaje">%</option>
                                        <option value="fija">Bs</option>
                                      </select>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={sc?.comision_valor_con || 0}
                                        onChange={e => setServicioComisionField(serv.id, cat.id, 'comision_valor_con', parseFloat(e.target.value) || 0)}
                                        className="flex-1 h-7 bg-zinc-900 border border-white/10 rounded-md px-2 text-[10px] font-bold text-white outline-none text-center"
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-zinc-600 italic">—</span>
                                  )}
                                </div>
                                {/* Sin herramientas */}
                                <div className="col-span-4">
                                  {isActivo ? (
                                    <div className="flex items-center gap-1.5 bg-zinc-800/60 rounded-lg p-1.5 border border-white/5">
                                      <select
                                        value={sc?.comision_tipo_sin || 'porcentaje'}
                                        onChange={e => setServicioComisionField(serv.id, cat.id, 'comision_tipo_sin', e.target.value)}
                                        className="w-14 h-7 bg-zinc-900 border border-white/10 rounded-md px-1 text-[10px] font-bold text-white outline-none appearance-none"
                                      >
                                        <option value="porcentaje">%</option>
                                        <option value="fija">Bs</option>
                                      </select>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={sc?.comision_valor_sin || 0}
                                        onChange={e => setServicioComisionField(serv.id, cat.id, 'comision_valor_sin', parseFloat(e.target.value) || 0)}
                                        className="flex-1 h-7 bg-zinc-900 border border-white/10 rounded-md px-2 text-[10px] font-bold text-white outline-none text-center"
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-zinc-600 italic">—</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="p-4 sm:p-6 bg-zinc-900/80 border-t border-white/5 flex gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11 border-white/10 text-zinc-400 hover:text-white uppercase font-black tracking-wider text-xs"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="flex-1 h-11 shadow-lg shadow-amber-500/20 uppercase font-black tracking-wider text-xs"
            disabled={saving}
            onClick={handleSave}
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Guardando...' : 'Guardar Comisiones'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
