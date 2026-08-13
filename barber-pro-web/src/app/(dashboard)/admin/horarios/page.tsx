'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import {
  ArrowLeft, Clock, Plus, Save, Trash2, User, Edit, Zap, Calendar, X, Copy, Check,
  CalendarDays, SlidersHorizontal, AlertTriangle, Moon, Sun, Sparkles, CheckCircle2, ShieldAlert
} from 'lucide-react'
import type { PlantillaHorario, TipoHorario } from '@/types'
import { getBusinessDateString } from '@/lib/asistencia/helpers'

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

interface FeriadoItem {
  id: string
  fecha: string
  nombre: string
  tipo: 'cerrado' | 'con_atencion'
  hora_inicio?: string
  hora_fin?: string
  descripcion?: string
}

interface DomingoItem {
  fecha: string
  barberos_habilitados: string[]
  notas?: string
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

// Genera los próximos N domingos a partir de hoy
function getProximosDomingos(cantidad = 8): { fecha: string; label: string }[] {
  const domingos: { fecha: string; label: string }[] = []
  const d = new Date()
  // Ajustar al próximo domingo si no es domingo hoy
  const day = d.getDay()
  const diffToSunday = day === 0 ? 0 : 7 - day
  d.setDate(d.getDate() + diffToSunday)

  for (let i = 0; i < cantidad; i++) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`
    const label = d.toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric', month: 'short' })
    domingos.push({ fecha: dateStr, label })
    d.setDate(d.getDate() + 7)
  }
  return domingos
}

export default function AdminHorariosPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  
  const [activeTab, setActiveTab] = useState<'semanal' | 'domingos' | 'feriados' | 'fecha_especifica'>('semanal')
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
  const [fechaEspecifica, setFechaEspecifica] = useState(() => getBusinessDateString())
  const [tipoExcepcion, setTipoExcepcion] = useState<'horario_especial' | 'dia_libre' | 'vacacion'>('horario_especial')
  const [excepcionInicio, setExcepcionInicio] = useState('10:00')
  const [excepcionFin, setExcepcionFin] = useState('16:00')
  const [motivoExcepcion, setMotivoExcepcion] = useState('')
  const [bloqueos, setBloqueos] = useState<BloqueoItem[]>([])
  const [savingExcepcion, setSavingExcepcion] = useState(false)

  // Domingos Rotativos
  const [proximosDomingos] = useState(() => getProximosDomingos(10))
  const [domingosRotativos, setDomingosRotativos] = useState<DomingoItem[]>([])
  const [savingDomingos, setSavingDomingos] = useState(false)

  // Feriados
  const [feriados, setFeriados] = useState<FeriadoItem[]>([])
  const [formFeriado, setFormFeriado] = useState<Omit<FeriadoItem, 'id'>>({
    fecha: getBusinessDateString(),
    nombre: '',
    tipo: 'cerrado',
    hora_inicio: '10:00',
    hora_fin: '16:00',
    descripcion: ''
  })
  const [savingFeriados, setSavingFeriados] = useState(false)

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
  }, [toastError])

  const loadFeriados = useCallback(async () => {
    try {
      const res = await fetch('/api/horarios/feriados')
      const json = await res.json()
      setFeriados(json.feriados || [])
    } catch {
      console.error('Error cargando feriados')
    }
  }, [])

  const loadDomingos = useCallback(async () => {
    try {
      const res = await fetch('/api/horarios/domingos')
      const json = await res.json()
      setDomingosRotativos(json.domingos || [])
    } catch {
      console.error('Error cargando domingos')
    }
  }, [])

  const searchParams = useSearchParams()
  const targetBarberoId = searchParams.get('barbero_id')

  useEffect(() => {
    loadPlantillas()
    loadFeriados()
    loadDomingos()
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['barbero', 'coordinador'])
        .eq('is_active', true)
        .order('full_name')
        .then(({ data }) => {
          if (data && data.length > 0) {
            const formatted = data.map(b => ({
              id: b.id,
              full_name: b.role === 'coordinador' ? `${b.full_name || 'Sin Nombre'} (Coordinador)` : (b.full_name || 'Sin Nombre')
            }))
            setBarberos(formatted)
            const initialId = (targetBarberoId && data.some(b => b.id === targetBarberoId)) ? targetBarberoId : formatted[0].id
            setBarberoId(initialId)
          }
        })
    })
  }, [loadPlantillas, loadFeriados, loadDomingos, targetBarberoId])

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

  // Domingos Rotativos: toggle de barbero en determinado domingo
  const toggleBarberoDomingo = (fechaDom: string, bId: string) => {
    setDomingosRotativos(prev => {
      const exist = prev.find(d => d.fecha === fechaDom)
      if (exist) {
        const estaHabilitado = exist.barberos_habilitados.includes(bId)
        const nuevaLista = estaHabilitado
          ? exist.barberos_habilitados.filter(id => id !== bId)
          : [...exist.barberos_habilitados, bId]
        return prev.map(d => (d.fecha === fechaDom ? { ...d, barberos_habilitados: nuevaLista } : d))
      } else {
        return [...prev, { fecha: fechaDom, barberos_habilitados: [bId] }]
      }
    })
  }

  const guardarDomingosRotativos = async () => {
    setSavingDomingos(true)
    try {
      const res = await fetch('/api/horarios/domingos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domingos: domingosRotativos }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success('¡Asignaciones de Domingos guardadas!')
    } catch (err: any) {
      toastError(err.message || 'Error al guardar domingos')
    } finally {
      setSavingDomingos(false)
    }
  }

  // Feriados: agregar feriado
  const agregarFeriado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formFeriado.nombre || !formFeriado.fecha) return toastError('Ingresa el nombre y fecha del feriado')
    
    const nuevoItem: FeriadoItem = {
      id: String(Date.now()),
      ...formFeriado
    }
    const nuevaLista = [...feriados.filter(f => f.fecha !== formFeriado.fecha), nuevoItem]
    setFeriados(nuevaLista)
    setSavingFeriados(true)
    try {
      const res = await fetch('/api/horarios/feriados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feriados: nuevaLista }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success('¡Feriado guardado correctamente!')
      setFormFeriado({
        fecha: getBusinessDateString(),
        nombre: '',
        tipo: 'cerrado',
        hora_inicio: '10:00',
        hora_fin: '16:00',
        descripcion: ''
      })
    } catch (err: any) {
      toastError(err.message || 'Error al guardar feriado')
    } finally {
      setSavingFeriados(false)
    }
  }

  const eliminarFeriado = async (id: string) => {
    if (!confirm('¿Eliminar este feriado registrado?')) return
    const nuevaLista = feriados.filter(f => f.id !== id)
    setFeriados(nuevaLista)
    try {
      await fetch('/api/horarios/feriados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feriados: nuevaLista }),
      })
      success('Feriado eliminado')
    } catch {
      toastError('Error al eliminar')
    }
  }

  // Guardar Excepción por Fecha Específica
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
            <p className="text-zinc-400 text-xs md:text-sm">Configura horarios semanales, domingos rotativos y feriados especiales</p>
          </div>
        </div>

        {/* SELECTOR DE BARBERO */}
        {activeTab !== 'feriados' && (
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
        )}
      </div>

      {/* PESTAÑAS NAVEGACIÓN */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-zinc-900 border border-white/10 rounded-2xl">
        <button
          onClick={() => setActiveTab('semanal')}
          className={`flex-1 py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all min-w-[140px] ${
            activeTab === 'semanal'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Planilla Semanal
        </button>

        <button
          onClick={() => setActiveTab('domingos')}
          className={`flex-1 py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all min-w-[140px] ${
            activeTab === 'domingos'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sun className="w-4 h-4" />
          Domingos Rotativos
        </button>

        <button
          onClick={() => setActiveTab('feriados')}
          className={`flex-1 py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all min-w-[140px] ${
            activeTab === 'feriados'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Feriados & Festivos
        </button>

        <button
          onClick={() => setActiveTab('fecha_especifica')}
          className={`flex-1 py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all min-w-[140px] ${
            activeTab === 'fecha_especifica'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Día Específico
        </button>
      </div>

      {/* VISTA 1: PLANILLA SEMANAL RECURRENTE */}
      {activeTab === 'semanal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
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

            {/* SECCIÓN HORAS POR DÍA */}
            <Card className="bg-zinc-950 border-white/10 shadow-xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-white text-base font-black uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Horas de Trabajo por Día
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {horarioSemanal.filter(d => d.activo).length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-zinc-800 rounded-2xl">
                    <Moon className="w-10 h-10 text-zinc-600 mx-auto mb-2 opacity-50" />
                    <p className="text-zinc-400 font-bold text-sm">Sin días hábiles seleccionados</p>
                    <p className="text-zinc-600 text-xs mt-1">Activa al menos un día arriba para configurar horas.</p>
                  </div>
                ) : (
                  horarioSemanal.filter(d => d.activo).map((d) => (
                    <div
                      key={d.dia_semana}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-zinc-900 border border-white/5 rounded-2xl hover:border-amber-500/20 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 font-black text-sm">
                          {d.nombre_corto}
                        </div>
                        <div>
                          <p className="font-black text-white text-sm">{d.nombre}</p>
                          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-0.5">Día Hábil</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="flex-1 sm:flex-initial">
                          <label className="text-[9px] font-black uppercase text-zinc-500 block mb-1">Entrada</label>
                          <input
                            type="time"
                            value={d.hora_inicio}
                            onChange={(e) => updateHoraDia(d.dia_semana, 'hora_inicio', e.target.value)}
                            className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold w-full outline-none focus:border-amber-500"
                          />
                        </div>
                        <span className="text-zinc-600 font-bold mt-4">→</span>
                        <div className="flex-1 sm:flex-initial">
                          <label className="text-[9px] font-black uppercase text-zinc-500 block mb-1">Salida</label>
                          <input
                            type="time"
                            value={d.hora_fin}
                            onChange={(e) => updateHoraDia(d.dia_semana, 'hora_fin', e.target.value)}
                            className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold w-full outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div className="pt-4 flex justify-end">
                  <Button
                    onClick={guardarHorarioSemanal}
                    disabled={savingHorario}
                    className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-sm h-12 px-8 rounded-xl shadow-lg shadow-amber-500/20"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingHorario ? 'Guardando...' : 'Guardar Planilla Semanal'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* LATERAL: ASIGNACIÓN EN LOTE Y PLANTILLAS RÁPIDAS */}
          <div className="space-y-6">
            <Card className="bg-zinc-950 border-white/10 shadow-xl">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-white text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Asignación en Lote
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <p className="text-xs text-zinc-400">Aplica el mismo horario de entrada y salida a todos los días marcados como activos.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">Entrada Lote</label>
                    <input
                      type="time"
                      value={batchInicio}
                      onChange={(e) => setBatchInicio(e.target.value)}
                      className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">Salida Lote</label>
                    <input
                      type="time"
                      value={batchFin}
                      onChange={(e) => setBatchFin(e.target.value)}
                      className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold w-full"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => aplicarATodosLosDias(batchInicio, batchFin)}
                  variant="outline"
                  className="w-full font-bold text-xs uppercase"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Aplicar a todos los días
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* VISTA 2: DOMINGOS ROTATIVOS */}
      {activeTab === 'domingos' && (
        <div className="space-y-6">
          <Card className="bg-zinc-950 border-amber-500/20 shadow-xl">
            <CardHeader className="pb-3 border-b border-white/5 flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <CardTitle className="text-amber-400 text-lg font-black uppercase tracking-wider flex items-center gap-2">
                  <Sun className="w-5 h-5" />
                  Asignación de Domingos Rotativos
                </CardTitle>
                <p className="text-xs text-zinc-400 mt-1">
                  Marca con un tike los domingos específicos en que trabajará cada barbero. Si un barbero no está tiqueado para determinado domingo, la web no permitirá reservas para él ese día.
                </p>
              </div>
              <Button
                onClick={guardarDomingosRotativos}
                disabled={savingDomingos}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs h-11 px-6 rounded-xl shrink-0"
              >
                <Save className="w-4 h-4 mr-2" />
                {savingDomingos ? 'Guardando...' : 'Guardar Domingos'}
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {proximosDomingos.map((dom) => {
                  const exist = domingosRotativos.find(d => d.fecha === dom.fecha)
                  const habilitadosCount = exist?.barberos_habilitados?.length || 0
                  return (
                    <div key={dom.fecha} className="bg-zinc-900 border border-white/10 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                          <Sun className="w-4 h-4 text-amber-500" />
                          <span className="font-black text-white text-sm uppercase">{dom.label}</span>
                        </div>
                        <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded-md">
                          {dom.fecha}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {barberos.map((b) => {
                          const isChecked = exist?.barberos_habilitados?.includes(b.id) || false
                          return (
                            <label
                              key={b.id}
                              className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-amber-500/10 border-amber-500/40 text-white'
                                  : 'bg-zinc-950 border-white/5 text-zinc-500 hover:border-white/10'
                              }`}
                            >
                              <span className="text-xs font-bold truncate pr-2">{b.full_name}</span>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleBarberoDomingo(dom.fecha, b.id)}
                                className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                              />
                            </label>
                          )
                        })}
                      </div>
                      <div className="pt-1 text-[10px] text-zinc-500 font-bold text-right">
                        {habilitadosCount} barbero(s) atiende(n)
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VISTA 3: FERIADOS Y DÍAS FESTIVOS */}
      {activeTab === 'feriados' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* REGISTRAR FERIADO */}
          <div className="lg:col-span-1">
            <Card className="bg-zinc-950 border-purple-500/20 shadow-xl">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-purple-400 text-base font-black uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Agregar Feriado
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <form onSubmit={agregarFeriado} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase">Nombre del Feriado</label>
                    <input
                      type="text"
                      placeholder="Ej: Día de la Independencia"
                      value={formFeriado.nombre}
                      onChange={e => setFormFeriado({ ...formFeriado, nombre: e.target.value })}
                      className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase">Fecha del Feriado</label>
                    <input
                      type="date"
                      value={formFeriado.fecha}
                      onChange={e => setFormFeriado({ ...formFeriado, fecha: e.target.value })}
                      className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase block mb-1">Tipo de Feriado</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormFeriado({ ...formFeriado, tipo: 'cerrado' })}
                        className={`p-3 rounded-xl border text-xs font-black uppercase flex flex-col items-center gap-1 transition ${
                          formFeriado.tipo === 'cerrado'
                            ? 'bg-red-500/20 border-red-500 text-red-400'
                            : 'bg-zinc-900 border-white/5 text-zinc-500'
                        }`}
                      >
                        <ShieldAlert className="w-4 h-4" />
                        🔴 Sin Atención (Cerrado)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormFeriado({ ...formFeriado, tipo: 'con_atencion' })}
                        className={`p-3 rounded-xl border text-xs font-black uppercase flex flex-col items-center gap-1 transition ${
                          formFeriado.tipo === 'con_atencion'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                            : 'bg-zinc-900 border-white/5 text-zinc-500'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        🟢 Horario Especial
                      </button>
                    </div>
                  </div>

                  {formFeriado.tipo === 'con_atencion' && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                      <div>
                        <label className="text-[10px] font-black uppercase text-emerald-400 block mb-1">Apertura</label>
                        <input
                          type="time"
                          value={formFeriado.hora_inicio}
                          onChange={e => setFormFeriado({ ...formFeriado, hora_inicio: e.target.value })}
                          className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold w-full"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-emerald-400 block mb-1">Cierre</label>
                        <input
                          type="time"
                          value={formFeriado.hora_fin}
                          onChange={e => setFormFeriado({ ...formFeriado, hora_fin: e.target.value })}
                          className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold w-full"
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={savingFeriados}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-xs h-12 rounded-xl"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Guardar Feriado
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* LISTA DE FERIADOS */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-zinc-950 border-white/10 shadow-xl">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-white text-base font-black uppercase tracking-wider flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-amber-500" />
                  Lista de Feriados Registrados
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {feriados.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                    <Sparkles className="w-10 h-10 text-zinc-600 mx-auto mb-2 opacity-40" />
                    <p className="text-zinc-400 font-bold text-sm">Sin feriados registrados</p>
                    <p className="text-zinc-600 text-xs mt-1">Agrega los feriados del año desde el formulario.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {feriados.map((f) => (
                      <div
                        key={f.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-zinc-900 border border-white/5 rounded-2xl hover:border-white/10 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                            f.tipo === 'cerrado' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          }`}>
                            <span className="text-xl">{f.tipo === 'cerrado' ? '🚫' : '⏰'}</span>
                          </div>
                          <div>
                            <p className="font-black text-white text-sm">{f.nombre}</p>
                            <p className="text-xs text-amber-400 font-mono font-bold mt-0.5">{f.fecha}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                          {f.tipo === 'cerrado' ? (
                            <Badge variant="danger" className="uppercase text-[10px] font-black">Cerrado (Sin Atención)</Badge>
                          ) : (
                            <Badge variant="success" className="uppercase text-[10px] font-black">
                              Especial: {f.hora_inicio} → {f.hora_fin}
                            </Badge>
                          )}
                          <button
                            onClick={() => eliminarFeriado(f.id)}
                            className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-xl transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* VISTA 4: DÍA ESPECÍFICO (EXCEPCIONES PUNTUALES) */}
      {activeTab === 'fecha_especifica' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-zinc-950 border-amber-500/20 shadow-xl">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-amber-400 text-base font-black uppercase tracking-wider flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" />
                  Crear Excepción Puntual
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <form onSubmit={guardarExcepcionFecha} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase">Fecha Específica</label>
                    <input
                      type="date"
                      value={fechaEspecifica}
                      onChange={e => setFechaEspecifica(e.target.value)}
                      className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase block mb-1">Tipo de Excepción</label>
                    <select
                      value={tipoExcepcion}
                      onChange={e => setTipoExcepcion(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-white font-bold text-sm outline-none"
                    >
                      <option value="horario_especial">Horario Especial en esta Fecha</option>
                      <option value="dia_libre">Día Libre Puntual (Sin Atención)</option>
                      <option value="vacacion">Vacación del Barbero</option>
                    </select>
                  </div>

                  {tipoExcepcion === 'horario_especial' && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                      <div>
                        <label className="text-[10px] font-black uppercase text-amber-400 block mb-1">Entrada</label>
                        <input
                          type="time"
                          value={excepcionInicio}
                          onChange={e => setExcepcionInicio(e.target.value)}
                          className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold w-full"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-amber-400 block mb-1">Salida</label>
                        <input
                          type="time"
                          value={excepcionFin}
                          onChange={e => setExcepcionFin(e.target.value)}
                          className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold w-full"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase">Motivo / Nota</label>
                    <input
                      type="text"
                      placeholder="Ej: Permiso médico, Horario especial..."
                      value={motivoExcepcion}
                      onChange={e => setMotivoExcepcion(e.target.value)}
                      className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-xl p-3 text-white text-sm outline-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={savingExcepcion}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs h-12 rounded-xl"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Excepción
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-zinc-950 border-white/10 shadow-xl">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-white text-base font-black uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Excepciones Registradas ({barberos.find(b => b.id === barberoId)?.full_name})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {bloqueos.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                    <Calendar className="w-10 h-10 text-zinc-600 mx-auto mb-2 opacity-40" />
                    <p className="text-zinc-400 font-bold text-sm">Sin excepciones registradas</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bloqueos.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-4 bg-zinc-900 border border-white/5 rounded-2xl"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={b.todo_el_dia ? 'danger' : 'warning'} className="uppercase text-[9px] font-black">
                              {b.tipo}
                            </Badge>
                            <span className="text-xs text-amber-400 font-mono font-bold">
                              {new Date(b.fecha_inicio).toLocaleDateString('es-BO')}
                            </span>
                          </div>
                          <p className="text-white text-sm font-bold mt-1">{b.motivo || 'Excepción de horario'}</p>
                        </div>
                        <button
                          onClick={() => eliminarBloqueo(b.id)}
                          className="p-2 text-zinc-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
