'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { ArrowLeft, Clock, Plus, Save, Trash2, User, Edit, Zap, Calendar, X, Copy, Check, CalendarDays, SlidersHorizontal, AlertTriangle, Moon } from 'lucide-react'
import type { PlantillaHorario, TipoHorario } from '@/types'

const TIPOS: { value: TipoHorario; label: string }[] = [
  { value: 'manana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'todo_dia', label: 'Todo el día' },
  { value: 'medio_turno', label: 'Medio turno' },
  { value: 'especial', label: 'Horario especial' },
  { value: 'personalizado', label: 'Personalizado' },
]

interface DiaConfig {
  dia_semana: number // 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 0=Dom
  nombre: string
  nombre_corto: string
  activo: boolean
  hora_inicio: string
  hora_fin: string
}

interface BloqueoItem {
  id: string
  barbero_id: string
  fecha_inicio: string
  fecha_fin: string
  tipo: string
  motivo: string | null
  todo_el_dia: boolean
}

const DIAS_CONFIG_INICIAL: DiaConfig[] = [
  { dia_semana: 1, nombre: 'Lunes', nombre_corto: 'Lun', activo: true, hora_inicio: '08:30', hora_fin: '20:30' },
  { dia_semana: 2, nombre: 'Martes', nombre_corto: 'Mar', activo: true, hora_inicio: '08:30', hora_fin: '20:30' },
  { dia_semana: 3, nombre: 'Miércoles', nombre_corto: 'Mié', activo: true, hora_inicio: '08:30', hora_fin: '20:30' },
  { dia_semana: 4, nombre: 'Jueves', nombre_corto: 'Jue', activo: true, hora_inicio: '08:30', hora_fin: '20:30' },
  { dia_semana: 5, nombre: 'Viernes', nombre_corto: 'Vie', activo: true, hora_inicio: '08:30', hora_fin: '20:30' },
  { dia_semana: 6, nombre: 'Sábado', nombre_corto: 'Sáb', activo: true, hora_inicio: '08:30', hora_fin: '20:30' },
  { dia_semana: 0, nombre: 'Domingo', nombre_corto: 'Dom', activo: false, hora_inicio: '09:00', hora_fin: '15:00' },
]

const emptyForm = {
  nombre: '',
  tipo: 'todo_dia' as TipoHorario,
  hora_inicio: '08:30',
  hora_fin: '20:30',
  descripcion: '',
  is_active: true,
}

export default function AdminHorariosPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  
  const [activeTab, setActiveTab] = useState<'semanal' | 'fecha_especifica'>('semanal')
  const [plantillas, setPlantillas] = useState<PlantillaHorario[]>([])
  const [barberos, setBarberos] = useState<{ id: string; full_name: string }[]>([])
  const [barberoId, setBarberoId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [savingHorario, setSavingHorario] = useState(false)

  // Configuración interactiva de la planilla semanal
  const [horarioSemanal, setHorarioSemanal] = useState<DiaConfig[]>(DIAS_CONFIG_INICIAL)

  // Rango general de lote
  const [batchInicio, setBatchInicio] = useState('08:30')
  const [batchFin, setBatchFin] = useState('20:30')

  // Modificación por Fecha Específica (Un solo día)
  const [fechaEspecifica, setFechaEspecifica] = useState(new Date().toISOString().split('T')[0])
  const [tipoExcepcion, setTipoExcepcion] = useState<'horario_especial' | 'dia_libre' | 'vacacion'>('horario_especial')
  const [excepcionInicio, setExcepcionInicio] = useState('10:00')
  const [excepcionFin, setExcepcionFin] = useState('16:00')
  const [motivoExcepcion, setMotivoExcepcion] = useState('')
  const [bloqueos, setBloqueos] = useState<BloqueoItem[]>([])
  const [savingExcepcion, setSavingExcepcion] = useState(false)

  // Modales y plantillas
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PlantillaHorario | null>(null)
  const [form, setForm] = useState(emptyForm)

  const loadPlantillas = useCallback(async () => {
    try {
      const res = await fetch('/api/horarios/plantillas')
      const json = await res.json()
      setPlantillas(json.plantillas ?? [])
    } catch {
      toastError('Error al cargar plantillas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPlantillas()
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'barbero')
        .eq('is_active', true)
        .order('full_name')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setBarberos(data)
            setBarberoId(data[0].id)
          }
        })
    })
  }, [loadPlantillas])

  // Cargar horario específico del barbero
  const loadHorarioBarbero = useCallback(async (bId: string) => {
    if (!bId) return
    try {
      const res = await fetch(`/api/barberos/${bId}/horario-laboral`)
      const json = await res.json()
      if (json.horario && Array.isArray(json.horario)) {
        setHorarioSemanal(prev =>
          prev.map(d => {
            const dbDay = json.horario.find((h: any) => Number(h.dia_semana) === d.dia_semana)
            if (dbDay) {
              return {
                ...d,
                activo: Boolean(dbDay.activo),
                hora_inicio: dbDay.hora_inicio?.slice(0, 5) || d.hora_inicio,
                hora_fin: dbDay.hora_fin?.slice(0, 5) || d.hora_fin,
              }
            }
            return d
          })
        )
      }
    } catch (e) {
      console.error('Error cargando horario barbero:', e)
    }
  }, [])

  // Cargar lista de excepciones / bloqueos por fecha para el barbero
  const loadBloqueosBarbero = useCallback(async (bId: string) => {
    if (!bId) return
    try {
      const res = await fetch(`/api/barberos/${bId}/bloqueos`)
      const json = await res.json()
      if (json.bloqueos) {
        setBloqueos(json.bloqueos)
      }
    } catch (e) {
      console.error('Error cargando excepciones/bloqueos:', e)
    }
  }, [])

  useEffect(() => {
    if (barberoId) {
      loadHorarioBarbero(barberoId)
      loadBloqueosBarbero(barberoId)
    }
  }, [barberoId, loadHorarioBarbero, loadBloqueosBarbero])

  // Toggle de día hábil
  const toggleDiaHabil = (diaSemana: number) => {
    setHorarioSemanal(prev =>
      prev.map(d => (d.dia_semana === diaSemana ? { ...d, activo: !d.activo } : d))
    )
  }

  // Modificar hora individual de un día de la semana
  const updateHoraDia = (diaSemana: number, campo: 'hora_inicio' | 'hora_fin', valor: string) => {
    setHorarioSemanal(prev =>
      prev.map(d => (d.dia_semana === diaSemana ? { ...d, [campo]: valor } : d))
    )
  }

  // Aplicar horario de un día a TODOS los días activos
  const aplicarATodosLosDias = (horaInicio: string, horaFin: string) => {
    setHorarioSemanal(prev =>
      prev.map(d => (d.activo ? { ...d, hora_inicio: horaInicio, hora_fin: horaFin } : d))
    )
    success(`Horario ${horaInicio} a ${horaFin} aplicado a todos los días activos.`)
  }

  // Aplicar plantilla rápida
  const aplicarPlantilla = (p: PlantillaHorario) => {
    const inicio = p.hora_inicio?.slice(0, 5) || '08:30'
    const fin = p.hora_fin?.slice(0, 5) || '20:30'
    setBatchInicio(inicio)
    setBatchFin(fin)
    aplicarATodosLosDias(inicio, fin)
  }

  // Guardar horario semanal recurrente
  const guardarHorarioSemanal = async () => {
    if (!barberoId) {
      toastError('Selecciona un barbero')
      return
    }
    setSavingHorario(true)
    try {
      const res = await fetch(`/api/barberos/${barberoId}/horario-laboral`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horario: horarioSemanal }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success('¡Horario semanal guardado correctamente!')
    } catch (err: any) {
      toastError(err.message || 'Error al guardar el horario')
    } finally {
      setSavingHorario(false)
    }
  }

  // Guardar Excepción por Fecha Específica (Un Solo Día)
  const guardarExcepcionFecha = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!barberoId || !fechaEspecifica) {
      toastError('Selecciona una fecha y un barbero')
      return
    }

    setSavingExcepcion(true)
    try {
      let payload: any = {
        barbero_id: barberoId,
        motivo: motivoExcepcion || (tipoExcepcion === 'dia_libre' ? 'Día libre puntual' : 'Horario especial'),
        tipo: tipoExcepcion === 'vacacion' ? 'vacacion' : (tipoExcepcion === 'dia_libre' ? 'dia_libre' : 'bloqueo'),
      }

      if (tipoExcepcion === 'dia_libre' || tipoExcepcion === 'vacacion') {
        payload.fecha_inicio = `${fechaEspecifica}T00:00:00-04:00`
        payload.fecha_fin = `${fechaEspecifica}T23:59:59-04:00`
        payload.todo_el_dia = true
      } else {
        // Horario especial para esa fecha puntual
        payload.fecha_inicio = `${fechaEspecifica}T${excepcionInicio}:00-04:00`
        payload.fecha_fin = `${fechaEspecifica}T${excepcionFin}:00-04:00`
        payload.todo_el_dia = false
      }

      const res = await fetch(`/api/barberos/${barberoId}/bloqueos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error((await res.json()).error)
      
      success(`¡Excepción guardada para la fecha ${fechaEspecifica}!`)
      setMotivoExcepcion('')
      loadBloqueosBarbero(barberoId)
    } catch (err: any) {
      toastError(err.message || 'Error al guardar excepción')
    } finally {
      setSavingExcepcion(false)
    }
  }

  // Eliminar excepción / bloqueo puntual
  const eliminarBloqueo = async (bloqueoId: string) => {
    if (!confirm('¿Eliminar esta excepción de horario para este día?')) return
    try {
      const res = await fetch(`/api/barberos/${barberoId}/bloqueos?bloqueo_id=${bloqueoId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success('Excepción eliminada')
      loadBloqueosBarbero(barberoId)
    } catch (err: any) {
      toastError(err.message || 'Error al eliminar')
    }
  }

  // Plantillas CRUD
  const savePlantilla = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/horarios/plantillas', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { id: editing.id, ...form } : form),
    })
    if (!res.ok) {
      toastError((await res.json()).error)
      return
    }
    success(editing ? 'Plantilla actualizada' : 'Plantilla creada')
    setShowModal(false)
    setEditing(null)
    setForm(emptyForm)
    loadPlantillas()
  }

  const deletePlantilla = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return
    const res = await fetch(`/api/horarios/plantillas?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toastError((await res.json()).error)
      return
    }
    success('Plantilla eliminada')
    loadPlantillas()
  }

  const openEdit = (p: PlantillaHorario) => {
    setEditing(p)
    setForm({
      nombre: p.nombre,
      tipo: p.tipo,
      hora_inicio: p.hora_inicio?.slice(0, 5) || '08:30',
      hora_fin: p.hora_fin?.slice(0, 5) || '20:30',
      descripcion: p.descripcion || '',
      is_active: p.is_active,
    })
    setShowModal(true)
  }

  if (loading) {
    return (
      <div className="flex justify-center h-96 items-center">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-28 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-6 gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin')} className="p-3 hover:bg-white/5 border border-white/10 bg-zinc-950 rounded-2xl transition">
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="warning" className="text-[9px] uppercase font-black px-2 py-0.5">Gestor de Horarios</Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight mt-1">
              Horas de <span className="text-amber-500">Trabajo</span>
            </h1>
            <p className="text-zinc-400 text-xs md:text-sm">Configura la planilla semanal o modifica un día específico en particular</p>
          </div>
        </div>

        {/* SELECTOR DE BARBERO */}
        <div className="w-full md:w-auto flex items-center gap-3 bg-zinc-900 border border-amber-500/30 p-2 rounded-2xl shadow-lg">
          <User className="w-5 h-5 text-amber-500 ml-2 shrink-0" />
          <select
            className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer pr-4 py-1"
            value={barberoId}
            onChange={(e) => setBarberoId(e.target.value)}
          >
            {barberos.map((b) => (
              <option key={b.id} value={b.id} className="bg-zinc-950 text-white">
                {b.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* PESTAÑAS NAVEGACIÓN: PLANILLA SEMANAL VS MODIFICACIÓN POR DÍA ESPECÍFICO */}
      <div className="flex gap-2 p-1.5 bg-zinc-900 border border-white/10 rounded-2xl">
        <button
          onClick={() => setActiveTab('semanal')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            activeTab === 'semanal'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Planilla Semanal Recurrente
        </button>

        <button
          onClick={() => setActiveTab('fecha_especifica')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            activeTab === 'fecha_especifica'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Modificar un Día Específico (Fecha Puntual)
        </button>
      </div>

      {/* VISTA 1: PLANILLA SEMANAL RECURRENTE */}
      {activeTab === 'semanal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* PANEL PRINCIPAL: EDITOR DE HORAS DE TRABAJO */}
          <div className="lg:col-span-2 space-y-6">
            {/* SECCIÓN 1: DÍAS HÁBILES (BOTONES CIRCULARES DE SELECCIÓN DE DÍAS) */}
            <Card className="bg-zinc-950 border-white/10 shadow-xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-white text-base font-black uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  Días hábiles
                </CardTitle>
                <p className="text-xs text-zinc-400">Marca los días de la semana en que este barbero atiende en el local.</p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  {horarioSemanal.map((d) => (
                    <button
                      key={d.dia_semana}
                      type="button"
                      onClick={() => toggleDiaHabil(d.dia_semana)}
                      className="flex flex-col items-center gap-2 group focus:outline-none"
                    >
                      <div
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-2 transition-all duration-200 shadow-md ${
                          d.activo
                            ? 'bg-zinc-900 border-white text-white shadow-amber-500/10'
                            : 'bg-black/40 border-zinc-800 text-zinc-600 hover:border-zinc-700'
                        }`}
                      >
                        {d.activo ? (
                          <div className="w-7 h-7 rounded-full bg-black border border-white/20 flex items-center justify-center text-white">
                            <Check className="w-4 h-4 text-white stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-zinc-700 flex items-center justify-center opacity-40">
                            <Check className="w-3.5 h-3.5 text-zinc-500" />
                          </div>
                        )}
                      </div>
                      <span className={`text-xs font-bold transition-colors ${d.activo ? 'text-white' : 'text-zinc-500'}`}>
                        {d.nombre_corto}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* SECCIÓN 2: HORAS DE TRABAJO Y ASIGNACIÓN EN LOTE */}
            <Card className="bg-zinc-950 border-white/10 shadow-xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white text-base font-black uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Horas de trabajo
                  </CardTitle>
                  <p className="text-xs text-zinc-400">Establece el rango de entrada y salida para cada día hábil.</p>
                </div>

                <button
                  type="button"
                  onClick={() => aplicarATodosLosDias(batchInicio, batchFin)}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 underline underline-offset-4 transition"
                >
                  Aplicar a todos los días
                </button>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* RANGO GLOBAL RAPIDO */}
                <div className="p-4 bg-zinc-900/80 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-white uppercase">Asignar Rango a Todos</p>
                      <p className="text-[11px] text-zinc-400">Copia este horario a todos los días marcados arriba</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={batchInicio}
                      onChange={(e) => setBatchInicio(e.target.value)}
                      className="h-10 bg-zinc-950 border border-white/10 rounded-xl px-3 text-xs font-bold text-white outline-none focus:border-amber-500"
                    />
                    <span className="text-xs text-zinc-500 font-bold">a</span>
                    <input
                      type="time"
                      value={batchFin}
                      onChange={(e) => setBatchFin(e.target.value)}
                      className="h-10 bg-zinc-950 border border-white/10 rounded-xl px-3 text-xs font-bold text-white outline-none focus:border-amber-500"
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => aplicarATodosLosDias(batchInicio, batchFin)}
                      className="font-bold text-xs"
                    >
                      Aplicar
                    </Button>
                  </div>
                </div>

                {/* LISTA DETALLADA POR DÍA */}
                <div className="space-y-4">
                  {horarioSemanal.map((d, index) => {
                    if (!d.activo) return null

                    return (
                      <div
                        key={d.dia_semana}
                        className="p-4 bg-zinc-900/60 border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-white/20 transition"
                      >
                        <div className="flex items-center justify-between sm:justify-start gap-4">
                          <span className="font-bold text-sm text-white min-w-[90px]">{d.nombre}</span>
                          {index === 0 && (
                            <button
                              type="button"
                              onClick={() => aplicarATodosLosDias(d.hora_inicio, d.hora_fin)}
                              className="text-[11px] text-zinc-400 hover:text-amber-400 underline underline-offset-2 transition"
                            >
                              Aplicar a todos los días
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 bg-zinc-950/80 p-2 rounded-xl border border-white/5">
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={d.hora_inicio}
                              onChange={(e) => updateHoraDia(d.dia_semana, 'hora_inicio', e.target.value)}
                              className="bg-transparent text-white font-bold text-sm outline-none px-2 py-1 cursor-pointer focus:text-amber-400"
                            />
                            <span className="text-xs text-zinc-500 font-bold">a</span>
                            <input
                              type="time"
                              value={d.hora_fin}
                              onChange={(e) => updateHoraDia(d.dia_semana, 'hora_fin', e.target.value)}
                              className="bg-transparent text-white font-bold text-sm outline-none px-2 py-1 cursor-pointer focus:text-amber-400"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => aplicarATodosLosDias(d.hora_inicio, d.hora_fin)}
                            className="p-1.5 text-zinc-500 hover:text-amber-400 hover:bg-white/5 rounded-lg transition"
                            title="Copiar este horario a los demás días"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {horarioSemanal.filter(d => d.activo).length === 0 && (
                    <div className="text-center py-12 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl">
                      <p className="text-zinc-500 font-bold text-xs">No hay días hábiles seleccionados.</p>
                      <p className="text-zinc-600 text-[11px] mt-1">Haz clic en los círculos de días de arriba para activar horas de trabajo.</p>
                    </div>
                  )}
                </div>

                {/* BOTÓN GUARDAR HORARIO */}
                <div className="pt-4 border-t border-white/5 flex justify-end">
                  <Button
                    variant="primary"
                    onClick={guardarHorarioSemanal}
                    disabled={savingHorario}
                    className="w-full sm:w-auto font-black uppercase text-xs tracking-wider px-8 py-6 bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingHorario ? 'Guardando...' : 'Guardar Horas de Trabajo'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* PANEL LATERAL: PLANTILLAS REUTILIZABLES */}
          <div className="space-y-6">
            <Card className="bg-zinc-950 border-white/10 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-white/5">
                <CardTitle className="text-white text-base font-black uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Plantillas Rápidas
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(null)
                    setForm(emptyForm)
                    setShowModal(true)
                  }}
                  className="text-xs font-bold text-amber-400 border-amber-500/30"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Nueva
                </Button>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                <p className="text-xs text-zinc-400">Haz clic en cualquier plantilla para aplicarla de inmediato a los días activos del barbero.</p>

                {plantillas.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 bg-zinc-900/80 border border-white/5 rounded-2xl hover:border-amber-500/40 transition flex items-center justify-between gap-3 group"
                  >
                    <div className="flex-1 min-w-0">
                      <Badge variant="warning" className="text-[9px] uppercase font-black mb-1">
                        {TIPOS.find((t) => t.value === p.tipo)?.label || p.tipo}
                      </Badge>
                      <h3 className="font-bold text-white text-sm truncate uppercase">{p.nombre}</h3>
                      <p className="text-xs text-amber-400 font-mono font-bold mt-0.5">
                        {p.hora_inicio?.slice(0, 5)} — {p.hora_fin?.slice(0, 5)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => aplicarPlantilla(p)}
                        className="text-xs font-bold bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500 hover:text-black transition"
                      >
                        Aplicar
                      </Button>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-2 text-zinc-400 hover:text-white rounded-lg transition"
                        title="Editar plantilla"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deletePlantilla(p.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 rounded-lg transition"
                        title="Eliminar plantilla"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {plantillas.length === 0 && (
                  <p className="text-center py-6 text-xs text-zinc-500 font-bold">No hay plantillas guardadas.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* VISTA 2: MODIFICAR UN DÍA ESPECÍFICO (EXCEPCIONES Y BLOQUEOS POR FECHA PUNTUAL) */}
      {activeTab === 'fecha_especifica' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FORMULARIO DE CREACIÓN DE EXCEPCIÓN PUNTUAL */}
          <Card className="lg:col-span-2 bg-zinc-950 border-white/10 shadow-xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-white text-base font-black uppercase tracking-wider flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-amber-500" />
                Modificar Horario de un Día Específico
              </CardTitle>
              <p className="text-xs text-zinc-400">
                Selecciona una fecha puntual para cambiar el horario o marcar día libre sin modificar la planilla semanal recurrente.
              </p>
            </CardHeader>

            <form onSubmit={guardarExcepcionFecha}>
              <CardContent className="p-6 space-y-6">
                {/* FECHA PUNTUAL */}
                <div>
                  <label className="text-xs font-black uppercase text-zinc-400 mb-2 block">
                    1. Selecciona la Fecha Específica
                  </label>
                  <input
                    type="date"
                    required
                    value={fechaEspecifica}
                    onChange={(e) => setFechaEspecifica(e.target.value)}
                    className="w-full p-3.5 bg-zinc-900 border border-white/10 rounded-xl text-white font-bold outline-none focus:border-amber-500"
                  />
                </div>

                {/* TIPO DE MODIFICACIÓN */}
                <div>
                  <label className="text-xs font-black uppercase text-zinc-400 mb-2 block">
                    2. ¿Qué deseas hacer en esta fecha?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setTipoExcepcion('horario_especial')}
                      className={`p-4 rounded-xl border text-left flex flex-col gap-1 transition ${
                        tipoExcepcion === 'horario_especial'
                          ? 'bg-amber-500/10 border-amber-500 text-white'
                          : 'bg-zinc-900 border-white/5 text-zinc-400 hover:border-white/20'
                      }`}
                    >
                      <Clock className="w-5 h-5 text-amber-400" />
                      <span className="font-bold text-xs uppercase">Horario Especial</span>
                      <span className="text-[10px] text-zinc-500">Cambiar horas de entrada/salida</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTipoExcepcion('dia_libre')}
                      className={`p-4 rounded-xl border text-left flex flex-col gap-1 transition ${
                        tipoExcepcion === 'dia_libre'
                          ? 'bg-purple-500/10 border-purple-500 text-white'
                          : 'bg-zinc-900 border-white/5 text-zinc-400 hover:border-white/20'
                      }`}
                    >
                      <Moon className="w-5 h-5 text-purple-400" />
                      <span className="font-bold text-xs uppercase">Día Libre Puntual</span>
                      <span className="text-[10px] text-zinc-500">No atenderá en esta fecha</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTipoExcepcion('vacacion')}
                      className={`p-4 rounded-xl border text-left flex flex-col gap-1 transition ${
                        tipoExcepcion === 'vacacion'
                          ? 'bg-red-500/10 border-red-500 text-white'
                          : 'bg-zinc-900 border-white/5 text-zinc-400 hover:border-white/20'
                      }`}
                    >
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <span className="font-bold text-xs uppercase">Ausencia / Vacación</span>
                      <span className="text-[10px] text-zinc-500">Bloqueo por motivo especial</span>
                    </button>
                  </div>
                </div>

                {/* HORAS SI ES HORARIO ESPECIAL */}
                {tipoExcepcion === 'horario_especial' && (
                  <div className="p-4 bg-zinc-900 border border-white/5 rounded-2xl space-y-3">
                    <label className="text-xs font-black uppercase text-amber-400 block">
                      Definir Horas de Atención para el {fechaEspecifica}
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[11px] text-zinc-400 block mb-1">Hora de entrada</span>
                        <input
                          type="time"
                          value={excepcionInicio}
                          onChange={(e) => setExcepcionInicio(e.target.value)}
                          className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-white font-bold outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-400 block mb-1">Hora de salida</span>
                        <input
                          type="time"
                          value={excepcionFin}
                          onChange={(e) => setExcepcionFin(e.target.value)}
                          className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-white font-bold outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* MOTIVO */}
                <Input
                  label="Motivo o Nota (Opcional)"
                  placeholder="Ej: Permiso médico, atención por evento especial, etc."
                  value={motivoExcepcion}
                  onChange={(e) => setMotivoExcepcion(e.target.value)}
                />

                <div className="pt-4 border-t border-white/5 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={savingExcepcion}
                    className="w-full sm:w-auto font-black uppercase text-xs tracking-wider px-8 py-6 bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/20"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingExcepcion ? 'Guardando...' : 'Aplicar Excepción a este Día'}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>

          {/* LISTA DE EXCEPCIONES Y DÍAS MODIFICADOS */}
          <Card className="bg-zinc-950 border-white/10 shadow-xl">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-white text-base font-black uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                Días Modificados / Excepciones
              </CardTitle>
              <p className="text-xs text-zinc-400">Ajustes específicos por fecha registrados para este barbero.</p>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {bloqueos.map((b) => {
                const fechaStr = b.fecha_inicio?.split('T')[0]
                const horaIniStr = b.fecha_inicio?.split('T')[1]?.slice(0, 5)
                const horaFinStr = b.fecha_fin?.split('T')[1]?.slice(0, 5)

                return (
                  <div key={b.id} className="p-4 bg-zinc-900 border border-white/5 rounded-2xl space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-amber-400">{fechaStr}</span>
                      <Badge
                        variant={b.todo_el_dia ? 'default' : 'warning'}
                        className="text-[9px] uppercase font-black"
                      >
                        {b.todo_el_dia ? 'Día Libre' : 'Horario Especial'}
                      </Badge>
                    </div>

                    {!b.todo_el_dia && (
                      <p className="text-xs text-white font-bold">
                        🕒 {horaIniStr} a {horaFinStr}
                      </p>
                    )}

                    {b.motivo && <p className="text-xs text-zinc-400 italic">"{b.motivo}"</p>}

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => eliminarBloqueo(b.id)}
                        className="text-[11px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar Ajuste
                      </button>
                    </div>
                  </div>
                )
              })}

              {bloqueos.length === 0 && (
                <div className="text-center py-8 text-zinc-500 font-bold text-xs">
                  No hay días modificados por fecha para este barbero.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL CREAR / EDITAR PLANTILLA */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-start justify-center z-[100] p-4 pt-12 overflow-y-auto">
          <Card className="w-full max-w-md bg-zinc-950 border-white/10 my-auto">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5">
              <CardTitle className="text-white uppercase font-black text-base">
                {editing ? 'Editar plantilla' : 'Nueva plantilla de horario'}
              </CardTitle>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <form onSubmit={savePlantilla}>
              <CardContent className="space-y-4 p-6">
                <Input
                  label="Nombre de la plantilla"
                  required
                  placeholder="Ej: Jornada Completa, Turno Mañana"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Tipo de Turno</label>
                  <select
                    className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm"
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoHorario })}
                  >
                    {TIPOS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Hora de Inicio"
                    type="time"
                    value={form.hora_inicio}
                    onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                  />
                  <Input
                    label="Hora de Fin"
                    type="time"
                    value={form.hora_fin}
                    onChange={(e) => setForm({ ...form, hora_fin: e.target.value })}
                  />
                </div>
                <Input
                  label="Descripción (opcional)"
                  placeholder="Ej: Aplica de Lunes a Sábado..."
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                />
              </CardContent>
              <div className="p-6 border-t border-white/5 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowModal(false)
                    setEditing(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  <Save className="w-4 h-4 mr-2" /> Guardar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
