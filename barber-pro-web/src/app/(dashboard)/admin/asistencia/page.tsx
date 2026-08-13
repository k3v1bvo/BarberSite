'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import {
  ArrowLeft, Clock, Download, Filter, AlertTriangle,
  Pencil, Users, RefreshCw, ChevronLeft, ChevronRight,
  CalendarDays, Calendar, Camera, MapPin, Eye,
} from 'lucide-react'
import {
  estadoBadgeVariant,
  estadoLabel,
  getBusinessDateString,
  getMondayOfWeek,
  addDays,
  type AsistenciaEstado,
} from '@/lib/asistencia/helpers'
import { AUTO_CLOSE_HOUR } from '@/lib/asistencia/constants'
import { useToast } from '@/components/ui/Toast'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { createClient } from '@/lib/supabase/client'

interface Registro {
  id: string
  fecha: string
  hora_entrada: string
  hora_salida: string | null
  horas_trabajadas: number | null
  cierre_automatico?: boolean
  editado_admin?: boolean
  notas?: string | null
  estado_calculado: AsistenciaEstado
  profiles?: { id: string; full_name: string | null; role: string; avatar_url?: string | null }
  selfie_url?: string | null
  lat?: number | null
  lng?: number | null
  en_almuerzo?: boolean
}

interface BarberoOpt { id: string; full_name: string }

// ── Helpers de fecha ──────────────────────────────────────────────────
function fmt(d: Date): string {
  return getBusinessDateString(d)
}

function fmtShort(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric' })
}

function getWeekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => getBusinessDateString(addDays(monday, i)))
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ────────────────────────────────────────────────────────────────────────
export default function AsistenciaAdminPage() {
  const supabase = createClient()
  const { success, error: toastError } = useToast()

  const [vista, setVista] = useState<'dia' | 'semana'>('semana')
  const [loading, setLoading] = useState(true)
  const [registros, setRegistros] = useState<Registro[]>([])
  const [resumen, setResumen] = useState({ total: 0, turnos_abiertos: 0, finalizados: 0 })
  const [selectedAsistenciaForModal, setSelectedAsistenciaForModal] = useState<Registro | null>(null)
  const [tick, setTick] = useState(0)

  // Vista día
  const [fecha, setFecha] = useState(() => getBusinessDateString())
  const [barberoId, setBarberoId] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [barberos, setBarberos] = useState<BarberoOpt[]>([])

  // Vista semana
  const [semanaInicio, setSemanaInicio] = useState<Date>(() => getMondayOfWeek(new Date()))
  const semanaFin = addDays(semanaInicio, 6)
  const semanaLabel = `${fmt(semanaInicio)} → ${fmt(semanaFin)}`
  const diasDeSemana = getWeekDays(semanaInicio)

  // Edición
  const [editando, setEditando] = useState<Registro | null>(null)
  const [formEdit, setFormEdit] = useState({ hora_entrada: '', hora_salida: '', notas: '' })

  // Permisos
  const [showPermiso, setShowPermiso] = useState(false)
  const [formPermiso, setFormPermiso] = useState(() => ({ barbero_id: '', fecha: getBusinessDateString(), notas: '', comprobante_url: '' }))
  const [savingPermiso, setSavingPermiso] = useState(false)

  // ─── Load barberos ──────────────────────────────────────────────────
  const loadBarberos = useCallback(async () => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('id, full_name').in('role', ['barbero', 'coordinador']).eq('is_active', true)
    setBarberos(data || [])
  }, [])

  // ─── Load vista día ─────────────────────────────────────────────────
  const loadDia = useCallback(async () => {
    setLoading(true)
    try {
      await fetch('/api/asistencias/auto-cerrar', { method: 'POST' })
      const params = new URLSearchParams({ fecha })
      if (barberoId) params.set('barbero_id', barberoId)
      if (estadoFiltro) params.set('estado', estadoFiltro)
      const res = await fetch(`/api/asistencias?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setRegistros(json.registros || [])
      setResumen(json.resumen || { total: 0, turnos_abiertos: 0, finalizados: 0 })
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [fecha, barberoId, estadoFiltro, toastError])

  // ─── Load vista semana ──────────────────────────────────────────────
  const loadSemana = useCallback(async () => {
    setLoading(true)
    try {
      // Cargar todos los días de la semana en paralelo
      const promises = diasDeSemana.map(d =>
        fetch(`/api/asistencias?fecha=${d}`).then(r => r.json()).then(j => j.registros || [])
      )
      const resultados = await Promise.all(promises)
      const todos: Registro[] = resultados.flat()
      setRegistros(todos)

      // Resumen total semana
      const abiertos = todos.filter(r => !r.hora_salida).length
      setResumen({ total: todos.length, turnos_abiertos: abiertos, finalizados: todos.length - abiertos })
    } catch (e) {
      toastError('Error al cargar semana')
    } finally {
      setLoading(false)
    }
  }, [semanaInicio, toastError]) // eslint-disable-line

  useEffect(() => { loadBarberos() }, [loadBarberos])
  useEffect(() => {
    if (vista === 'dia') loadDia()
    else loadSemana()
  }, [vista, loadDia, loadSemana])

  // Tick cada 30s para actualizar horas en tiempo real de turnos abiertos
  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // ─── Calcular grid semanal ──────────────────────────────────────────
  const empleadosPorId = new Map<string, { nombre: string; avatar?: string | null }>()
  registros.forEach(r => {
    if (r.profiles?.id) empleadosPorId.set(r.profiles.id, { nombre: r.profiles.full_name || 'Sin nombre', avatar: r.profiles.avatar_url })
  })
  // Orden para grid: barberos únicos
  const empleadosOrdenados = Array.from(empleadosPorId.entries())

  // Mapa: empleadoId → dia → Registro
  const gridMap = new Map<string, Map<string, Registro>>()
  registros.forEach(r => {
    const empId = r.profiles?.id || ''
    if (!gridMap.has(empId)) gridMap.set(empId, new Map())
    gridMap.get(empId)!.set(r.fecha, r)
  })

  // ─── Exportar CSV ───────────────────────────────────────────────────
  const exportarCSV = () => {
    const cabeceras = ['Empleado', 'Rol', 'Fecha', 'Estado', 'Entrada', 'Salida', 'Horas', 'Auto-cierre']
    const filas = registros.map(a => [
      a.profiles?.full_name || '',
      a.profiles?.role || '',
      a.fecha,
      estadoLabel(a.estado_calculado),
      new Date(a.hora_entrada).toLocaleTimeString('es-MX', { timeZone: 'America/La_Paz', hour12: true }),
      a.hora_salida ? new Date(a.hora_salida).toLocaleTimeString('es-MX', { timeZone: 'America/La_Paz', hour12: true }) : 'Abierto',
      a.horas_trabajadas ?? '',
      a.cierre_automatico ? 'Sí' : 'No',
    ])
    const csv = cabeceras.join(',') + '\n' + filas.map(e => e.join(',')).join('\n')
    const link = document.createElement('a')
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    link.download = `asistencia_${vista === 'semana' ? semanaLabel : fecha}.csv`
    link.click()
  }

  // ─── Edición ────────────────────────────────────────────────────────
  const isoToBoliviaInput = (iso: string | null): string => {
    if (!iso) return ''
    const d = new Date(iso)
    const boliviaTime = new Date(d.getTime() - 4 * 60 * 60 * 1000)
    const yyyy = boliviaTime.getUTCFullYear()
    const mm = String(boliviaTime.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(boliviaTime.getUTCDate()).padStart(2, '0')
    const hh = String(boliviaTime.getUTCHours()).padStart(2, '0')
    const m = String(boliviaTime.getUTCMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}T${hh}:${m}`
  }

  const abrirEdicion = (r: Registro) => {
    setSelectedAsistenciaForModal(r)
  }

  const horaFmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-MX', {
      timeZone: 'America/La_Paz',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })

  // Calcula horas transcurridas en vivo para turnos abiertos
  const horasEnVivo = (r: Registro): string => {
    void tick // fuerza re-render
    if (r.horas_trabajadas != null) return `${r.horas_trabajadas}h`
    if (!r.hora_entrada || r.hora_salida) return '—'
    const ms = Date.now() - new Date(r.hora_entrada).getTime()
    if (ms < 0) return '0.0h'
    const hrs = ms / 3_600_000
    return `${hrs.toFixed(1)}h`
  }

  const esEnVivo = (r: Registro): boolean => r.horas_trabajadas == null && !r.hora_salida && !!r.hora_entrada

  const celdaColor = (r: Registro | undefined) => {
    if (!r) return 'text-zinc-800'
    if (r.estado_calculado === 'permiso' as any || r.notas?.includes('PERMISO')) return 'text-purple-400'
    if (!r.hora_salida) return 'text-amber-400'
    if (r.estado_calculado === 'atrasado') return 'text-red-400'
    return 'text-green-400'
  }

  // ─── Guardar Permiso ──────────────────────────────────────────────────
  const guardarPermiso = async () => {
    if (!formPermiso.barbero_id || !formPermiso.fecha) return toastError('Falta empleado o fecha')
    setSavingPermiso(true)
    try {
      const res = await fetch('/api/asistencias/permiso', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formPermiso),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      success('Permiso registrado')
      setShowPermiso(false)
      setFormPermiso({ barbero_id: '', fecha: new Date().toISOString().split('T')[0], notas: '', comprobante_url: '' })
      vista === 'dia' ? loadDia() : loadSemana()
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSavingPermiso(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-8">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="p-4 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl transition-all btn-press">
            <ArrowLeft className="w-5 h-5 text-zinc-500 hover:text-amber-500" />
          </Link>
          <div>
            <h1 className="text-4xl font-black text-white uppercase leading-none">
              Control de <span className="text-amber-500">Asistencia</span>
            </h1>
            <p className="text-zinc-500 mt-2">Historial, correcciones y resumen semanal del equipo</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setShowPermiso(true)} className="font-black uppercase text-xs bg-purple-600 hover:bg-purple-500 text-white"><Calendar className="w-4 h-4 mr-2" />Permiso</Button>
          <Button variant="outline" size="md" onClick={vista === 'dia' ? loadDia : loadSemana}><RefreshCw className="w-4 h-4 mr-2" />Actualizar</Button>
          <Button variant="outline" size="lg" onClick={exportarCSV} className="font-black uppercase text-xs"><Download className="w-4 h-4 mr-2" />CSV</Button>
        </div>
      </div>

      {/* Info auto-cierre */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-5 flex gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
          <div className="text-sm text-zinc-300 leading-relaxed">
            <strong className="text-amber-400">Cierre automático:</strong> si un empleado no marca salida antes de las <strong>{AUTO_CLOSE_HOUR}:00</strong>, el sistema cierra el turno solo. Correcciones desde el botón editar.
          </div>
        </CardContent>
      </Card>

      {/* Toggle vista */}
      <div className="flex items-center gap-3">
        <p className="text-zinc-600 text-xs font-black uppercase tracking-widest">Vista:</p>
        <div className="flex bg-zinc-900 border border-white/5 rounded-2xl p-1 gap-1">
          {([['dia', 'Día', Calendar], ['semana', 'Semana', CalendarDays]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setVista(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${vista === key ? 'bg-amber-500 text-black' : 'text-zinc-500 hover:text-white'}`}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Alertas turno abierto */}
      {resumen.turnos_abiertos > 0 && (
        <Card className="border-red-500/30 bg-red-500/10 animate-pulse">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <div>
                <p className="font-black text-red-200 uppercase text-sm">Turnos sin cerrar</p>
                <p className="text-red-200/70 text-xs">{resumen.turnos_abiertos} empleado(s) aún en turno o sin salida registrada</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase text-zinc-500">Registros {vista === 'semana' ? '(semana)' : '(día)'}</p>
            <p className="text-3xl font-black text-white mt-1">{resumen.total}</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase text-green-400">Finalizados</p>
            <p className="text-3xl font-black text-green-400 mt-1">{resumen.finalizados}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase text-amber-400">En turno / abiertos</p>
            <p className="text-3xl font-black text-amber-400 mt-1">{resumen.turnos_abiertos}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── VISTA DÍA ── */}
      {vista === 'dia' && (
        <>
          {/* Filtros día */}
          <Card className="border-white/5">
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 block mb-2">Fecha</label>
                  <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                    className="h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 block mb-2">Empleado</label>
                  <select value={barberoId} onChange={e => setBarberoId(e.target.value)}
                    className="h-11 min-w-[180px] bg-zinc-950 border border-white/10 rounded-xl px-4 text-white font-bold">
                    <option value="">Todos</option>
                    {barberos.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 block mb-2">Estado</label>
                  <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}
                    className="h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white font-bold">
                    <option value="">Todos</option>
                    <option value="presente">Presente</option>
                    <option value="atrasado">Atrasado</option>
                    <option value="finalizado">Finalizado</option>
                  </select>
                </div>
                <Button variant="secondary" onClick={loadDia} className="h-11 font-black uppercase text-xs">
                  <Filter className="w-4 h-4 mr-2" />Filtrar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabla día */}
          <Card className="border-white/5 overflow-hidden">
            <CardContent className="p-0 overflow-x-auto w-full">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="bg-zinc-950/80">
                    <th className="py-4 px-6 text-[10px] font-black uppercase text-zinc-500">Empleado</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase text-zinc-500 text-center">Entrada</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase text-zinc-500 text-center">Salida</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase text-zinc-500 text-center">Horas</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase text-zinc-500 text-center">Estado</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase text-zinc-500 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr><td colSpan={6} className="py-20 text-center"><Clock className="w-10 h-10 mx-auto text-amber-500 animate-spin" /></td></tr>
                  ) : registros.map(r => (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer group/row" onClick={() => abrirEdicion(r)}>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-3">
                          {/* Miniatura Selfie con indicador GPS */}
                          <div
                            onClick={(e) => { e.stopPropagation(); setSelectedAsistenciaForModal(r) }}
                            className="relative group/avatar cursor-pointer shrink-0"
                            title="Haz clic para ver la Selfie y el Mapa GPS de marcación"
                          >
                            {r.selfie_url ? (
                              <img
                                src={r.selfie_url}
                                alt="Selfie"
                                className="w-11 h-11 rounded-2xl object-cover border-2 border-amber-500/40 hover:border-amber-400 shadow-md transition-all group-hover/avatar:scale-105"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-600 hover:border-amber-500/40">
                                <Camera className="w-5 h-5 text-zinc-500" />
                              </div>
                            )}
                            {r.lat != null && r.lng != null && (
                              <span className="absolute -top-1 -right-1 bg-emerald-500 text-black text-[9px] font-black p-0.5 rounded-full border border-black" title="GPS Verificado">
                                📍
                              </span>
                            )}
                          </div>

                          <div>
                            <p className="font-bold text-white text-sm">{r.profiles?.full_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-zinc-400 font-bold uppercase">{r.profiles?.role}</span>
                              {r.en_almuerzo && <span className="text-[9px] text-orange-400 font-bold bg-orange-500/15 px-1.5 py-0.5 rounded-md animate-pulse border border-orange-500/20">🍽️ Almorzando</span>}
                              {!r.en_almuerzo && r.notas?.includes('[ALMUERZO]') && <span className="text-[9px] text-orange-300/50 font-bold">✓ Almorzó</span>}
                              {(r.selfie_url || (r.lat != null && r.lng != null)) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedAsistenciaForModal(r) }}
                                  className="text-[10px] text-amber-400 hover:text-amber-300 font-extrabold flex items-center gap-1 underline ml-1"
                                >
                                  <Eye className="w-3 h-3" /> Ver Prueba
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6 text-center font-black text-white">{horaFmt(r.hora_entrada)}</td>
                      <td className="py-5 px-6 text-center">
                        {r.hora_salida ? <span className="font-black text-white">{horaFmt(r.hora_salida)}</span> : <span className="text-amber-500 font-bold text-xs uppercase">Abierto</span>}
                      </td>
                      <td className="py-5 px-6 text-center font-black">
                        <span className={esEnVivo(r) ? 'text-green-400 animate-pulse' : 'text-amber-500'}>
                          {horasEnVivo(r)}
                        </span>
                        {esEnVivo(r) && <p className="text-[9px] text-green-500/60 font-bold mt-0.5">EN VIVO</p>}
                      </td>
                      <td className="py-5 px-6 text-center">
                        <Badge variant={estadoBadgeVariant(r.estado_calculado)} className="uppercase text-[10px]">{estadoLabel(r.estado_calculado)}</Badge>
                        {r.cierre_automatico && <p className="text-[9px] text-amber-500 mt-1 font-bold">Auto</p>}
                      </td>
                      <td className="py-5 px-6 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {r.en_almuerzo && (
                            <Button
                              variant="outline"
                              size="sm"
                              title="Finalizar descanso de almuerzo"
                              onClick={async () => {
                                if (!confirm(`¿Finalizar pausa de almuerzo de ${r.profiles?.full_name}?`)) return
                                try {
                                  await supabase.from('asistencias').update({ en_almuerzo: false }).eq('id', r.id)
                                  await supabase.from('barbero_bloqueos').delete().eq('barbero_id', r.profiles?.id).eq('tipo', 'almuerzo')
                                  loadDia()
                                } catch (e) { console.error(e) }
                              }}
                              className="border-orange-500/30 text-orange-400 text-[10px] font-bold px-2 py-1"
                            >
                              ⏹️ Fin Almuerzo
                            </Button>
                          )}
                          <span className="text-[10px] text-zinc-600 group-hover/row:text-amber-400 font-bold uppercase transition-colors flex items-center gap-1">
                            <Pencil className="w-3 h-3" /> Editar
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && registros.length === 0 && (
                    <tr><td colSpan={6} className="py-16 text-center text-zinc-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      Sin registros para los filtros seleccionados
                    </td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── VISTA SEMANA ── */}
      {vista === 'semana' && (
        <>
          {/* Navegación de semana */}
          <Card className="border-white/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <button onClick={() => setSemanaInicio(s => addDays(s, -7))}
                  className="p-2 rounded-xl hover:bg-white/10 border border-white/5 text-zinc-400 hover:text-white transition-colors">
                  <ChevronLeft size={20} />
                </button>
                <div className="text-center">
                  <p className="text-white font-black text-sm uppercase tracking-widest">Semana</p>
                  <p className="text-amber-500 font-mono text-xs mt-0.5">{semanaLabel}</p>
                </div>
                <button onClick={() => setSemanaInicio(s => addDays(s, 7))}
                  className="p-2 rounded-xl hover:bg-white/10 border border-white/5 text-zinc-400 hover:text-white transition-colors">
                  <ChevronRight size={20} />
                </button>
                <button onClick={() => setSemanaInicio(getMondayOfWeek(new Date()))}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase hover:bg-amber-500/20 transition-colors">
                  Hoy
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Grid semanal (Desktop) */}
          <Card className="border-white/5 overflow-hidden hidden md:block">
            <CardContent className="p-0 overflow-x-auto w-full">
              {loading ? (
                <div className="flex justify-center py-16"><Clock className="w-10 h-10 text-amber-500 animate-spin" /></div>
              ) : (
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="bg-zinc-950/80">
                      <th className="py-4 px-4 text-[10px] font-black uppercase text-zinc-500 text-left min-w-[140px]">Empleado</th>
                      {diasDeSemana.map((dia, i) => (
                        <th key={dia} className={`py-4 px-2 text-[10px] font-black uppercase text-zinc-500 text-center ${dia === fmt(new Date()) ? 'text-amber-400' : ''}`}>
                          <div>{DIAS[i]}</div>
                          <div className="text-zinc-700 font-mono text-[9px] mt-0.5">{dia.slice(5)}</div>
                        </th>
                      ))}
                      <th className="py-4 px-4 text-[10px] font-black uppercase text-zinc-500 text-center">Total Hrs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {empleadosOrdenados.length === 0 ? (
                      <tr><td colSpan={9} className="py-16 text-center text-zinc-600">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        Sin registros esta semana
                      </td></tr>
                    ) : (
                      empleadosOrdenados.map(([empId, empData]) => {
                        const diasMap = gridMap.get(empId)
                        const totalHrs = diasDeSemana.reduce((sum, dia) => {
                          const r = diasMap?.get(dia)
                          if (!r) return sum
                          if (r.horas_trabajadas != null) return sum + r.horas_trabajadas
                          // Calcular en vivo
                          if (r.hora_entrada && !r.hora_salida) {
                            void tick
                            const ms = Date.now() - new Date(r.hora_entrada).getTime()
                            return sum + Math.max(0, ms / 3_600_000)
                          }
                          return sum
                        }, 0)
                        return (
                          <tr key={empId} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                {empData.avatar ? (
                                  <img src={empData.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-amber-500/30 shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold text-xs border border-amber-500/30 shrink-0">
                                    {empData.nombre.charAt(0)}
                                  </div>
                                )}
                                <p className="font-bold text-white text-sm">{empData.nombre}</p>
                              </div>
                            </td>
                            {diasDeSemana.map(dia => {
                              const r = diasMap?.get(dia)
                              return (
                                <td key={dia} className={`py-3 px-2 text-center ${r ? 'cursor-pointer hover:bg-amber-500/5 transition-colors' : ''}`} onClick={() => r && abrirEdicion(r)}>
                                  {r ? (
                                    <div className="space-y-1">
                                      <div className={`font-black text-xs ${celdaColor(r)} ${esEnVivo(r) ? 'animate-pulse' : ''}`}>
                                        {r.estado_calculado === 'permiso' as any || r.notas?.includes('PERMISO') 
                                          ? 'PERMISO' 
                                          : horasEnVivo(r)}
                                      </div>
                                      <div className="text-zinc-700 text-[9px]">
                                        {r.estado_calculado === 'permiso' as any || r.notas?.includes('PERMISO')
                                          ? 'Justificado'
                                          : (
                                            <>
                                              {horaFmt(r.hora_entrada)}
                                              {r.hora_salida ? ` → ${horaFmt(r.hora_salida)}` : ' →?'}
                                            </>
                                          )
                                        }
                                      </div>
                                      {r.estado_calculado === 'atrasado' && (
                                        <Badge variant="danger" className="text-[8px] py-0">tarde</Badge>
                                      )}
                                      {r.en_almuerzo && <span className="text-[8px] text-orange-400 animate-pulse">🍽️</span>}
                                      {!r.en_almuerzo && r.notas?.includes('[ALMUERZO]') && <span className="text-[8px] text-orange-300/40">✓🍽️</span>}

                                    </div>
                                  ) : (
                                    <span className="text-zinc-800 font-black text-lg">—</span>
                                  )}
                                </td>
                              )
                            })}
                            <td className="py-4 px-4 text-center">
                              <span className={`font-black text-sm ${totalHrs > 0 ? 'text-amber-400' : 'text-zinc-700'}`}>
                                {totalHrs > 0 ? `${totalHrs.toFixed(1)}h` : '—'}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  {/* Totales por día */}
                  <tfoot>
                    <tr className="border-t border-white/10 bg-zinc-950/50">
                      <td className="py-3 px-4 text-[10px] font-black uppercase text-zinc-600">Total día</td>
                      {diasDeSemana.map(dia => {
                        const total = registros
                          .filter(r => r.fecha === dia)
                          .reduce((sum, r) => sum + (r.horas_trabajadas ?? 0), 0)
                        return (
                          <td key={dia} className="py-3 px-2 text-center">
                            <span className="text-zinc-500 font-black text-xs">{total > 0 ? `${total.toFixed(1)}h` : '—'}</span>
                          </td>
                        )
                      })}
                      <td className="py-3 px-4 text-center">
                        <span className="text-amber-400 font-black text-xs">
                          {registros.reduce((s, r) => s + (r.horas_trabajadas ?? 0), 0).toFixed(1)}h
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Grid semanal (Mobile Cards) */}
          <div className="md:hidden space-y-4">
            {loading ? (
              <div className="flex justify-center py-16"><Clock className="w-10 h-10 text-amber-500 animate-spin" /></div>
            ) : empleadosOrdenados.length === 0 ? (
              <div className="py-16 text-center text-zinc-600 bg-zinc-900 rounded-2xl border border-white/5">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                Sin registros esta semana
              </div>
            ) : (
              empleadosOrdenados.map(([empId, empData]) => {
                const diasMap = gridMap.get(empId)
                const totalHrs = diasDeSemana.reduce((sum, dia) => {
                  const r = diasMap?.get(dia)
                  if (!r) return sum
                  if (r.horas_trabajadas != null) return sum + r.horas_trabajadas
                  if (r.hora_entrada && !r.hora_salida) {
                    void tick
                    const ms = Date.now() - new Date(r.hora_entrada).getTime()
                    return sum + Math.max(0, ms / 3_600_000)
                  }
                  return sum
                }, 0)

                return (
                  <Card key={empId} className="border-white/5 bg-zinc-900 overflow-hidden shadow-lg">
                    {/* Cabecera Card Empleado */}
                    <div className="p-4 bg-black/40 border-b border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {empData.avatar ? (
                          <img src={empData.avatar} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-amber-500/40 shrink-0 shadow-md" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold text-sm border border-amber-500/30 shrink-0">
                            {empData.nombre.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-black text-white text-sm">{empData.nombre}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Historial Semanal</p>
                        </div>
                      </div>
                      <div className="text-right bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                        <p className="text-[9px] text-amber-500/80 font-black uppercase tracking-widest mb-0.5">Total</p>
                        <p className="text-amber-400 font-black text-base leading-none">{totalHrs > 0 ? `${totalHrs.toFixed(1)}h` : '0h'}</p>
                      </div>
                    </div>
                    
                    {/* Días */}
                    <div className="divide-y divide-white/5">
                      {diasDeSemana.map((dia, i) => {
                        const r = diasMap?.get(dia)
                        const isHoy = dia === fmt(new Date())
                        return (
                          <div key={dia} className={`p-3 flex items-center justify-between ${isHoy ? 'bg-amber-500/[0.03]' : ''} ${r ? 'cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.05]' : ''} transition-colors`} onClick={() => r && abrirEdicion(r)}>
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] font-black uppercase w-8 text-center ${isHoy ? 'text-amber-400' : 'text-zinc-500'}`}>{DIAS[i]}</span>
                              <span className="text-zinc-600 font-mono text-[10px] font-bold">{dia.slice(5)}</span>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              {r ? (
                                <div className="text-right flex flex-col justify-center">
                                  <div className="flex items-center justify-end gap-2 mb-1">
                                    {r.estado_calculado === 'atrasado' && <Badge variant="danger" className="text-[8px] py-0 px-1 font-black leading-none">TARDE</Badge>}
                                    {r.en_almuerzo && <span className="text-[8px] text-orange-400 font-bold bg-orange-500/15 px-1 py-0.5 rounded animate-pulse">🍽️</span>}
                                    <div className={`font-black text-sm leading-none ${celdaColor(r)} ${esEnVivo(r) ? 'animate-pulse' : ''}`}>
                                      {r.estado_calculado === 'permiso' as any || r.notas?.includes('PERMISO') ? 'PERMISO' : horasEnVivo(r)}
                                    </div>
                                  </div>
                                  <div className="text-zinc-500 text-[10px] flex items-center gap-1.5 justify-end font-bold">
                                    {r.estado_calculado === 'permiso' as any || r.notas?.includes('PERMISO')
                                      ? 'Justificado'
                                      : (
                                        <>
                                          <span>{horaFmt(r.hora_entrada)}</span>
                                          <span className="text-zinc-700">→</span>
                                          <span>{r.hora_salida ? horaFmt(r.hora_salida) : '?'}</span>
                                        </>
                                      )
                                    }
                                    {!r.en_almuerzo && r.notas?.includes('[ALMUERZO]') && <span className="text-orange-300/50 ml-1">✓🍽️</span>}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-zinc-800 font-black text-sm mr-2">—</span>
                              )}
                              
                              {r && (
                                <span className="text-zinc-600 text-[10px] font-bold uppercase"><Pencil size={12} className="inline" /></span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )
              })
            )}
          </div>

          {/* Leyenda */}
          <div className="flex gap-4 flex-wrap text-[10px] font-black uppercase tracking-widest">
            <span className="flex items-center gap-1.5 text-green-400"><span className="w-2 h-2 bg-green-400 rounded-full inline-block" /> Completo</span>
            <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2 h-2 bg-amber-400 rounded-full inline-block" /> En turno / sin salida</span>
            <span className="flex items-center gap-1.5 text-red-400"><span className="w-2 h-2 bg-red-400 rounded-full inline-block" /> Atrasado</span>
            <span className="flex items-center gap-1.5 text-zinc-700"><span className="w-2 h-2 bg-zinc-700 rounded-full inline-block" /> Sin registro</span>
          </div>
        </>
      )}

      {/* Modal Registrar Permiso */}
      {showPermiso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <Card className="w-full max-w-md border-purple-500/20 shadow-2xl my-auto">
            <CardHeader><CardTitle className="text-purple-400 flex items-center gap-2"><Calendar className="w-5 h-5" /> Registrar Permiso</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Empleado</label>
                <select value={formPermiso.barbero_id} onChange={e => setFormPermiso({ ...formPermiso, barbero_id: e.target.value })}
                  className="w-full mt-1 h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-white font-bold">
                  <option value="">Seleccione...</option>
                  {barberos.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Fecha</label>
                <input type="date" value={formPermiso.fecha} onChange={e => setFormPermiso({ ...formPermiso, fecha: e.target.value })}
                  className="w-full mt-1 h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Motivo / Notas</label>
                <textarea value={formPermiso.notas} onChange={e => setFormPermiso({ ...formPermiso, notas: e.target.value })}
                  placeholder="Ej. Cita médica, Problema familiar..."
                  className="w-full mt-1 min-h-[80px] bg-zinc-950 border border-white/10 rounded-xl p-3 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Comprobante (Opcional)</label>
                <div className="bg-zinc-950 border border-white/10 rounded-xl p-2">
                  <ImageUpload 
                    onUploadSuccess={(url) => setFormPermiso({ ...formPermiso, comprobante_url: url })}
                    onUploadError={(err) => toastError(err)}
                  />
                  {formPermiso.comprobante_url && (
                    <p className="text-xs text-green-400 mt-2 font-bold text-center">✓ Imagen subida con éxito</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="primary" className="flex-1 font-black uppercase bg-purple-600 hover:bg-purple-500 text-white" onClick={guardarPermiso} disabled={savingPermiso}>
                  {savingPermiso ? 'Guardando...' : 'Guardar Permiso'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowPermiso(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Detalle / Prueba de Asistencia Fija Centrada */}
      {selectedAsistenciaForModal && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedAsistenciaForModal(null)}
        >
          <div 
            className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col bg-zinc-950 border border-amber-500/30 rounded-3xl shadow-2xl overflow-y-auto animate-in zoom-in-95 duration-200 my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header del Perfil con Foto Grande */}
            <div className="relative bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 p-6 text-center border-b border-white/10 shrink-0">
              <button 
                onClick={() => setSelectedAsistenciaForModal(null)} 
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
              >
                ✕
              </button>

              {/* FOTO GRANDE DEL BARBERO */}
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 mx-auto mb-4">
                {selectedAsistenciaForModal.selfie_url ? (
                  <img 
                    src={selectedAsistenciaForModal.selfie_url} 
                    alt="Foto Perfil / Marcación" 
                    className="w-full h-full rounded-3xl object-cover border-4 border-amber-500/50 shadow-2xl shadow-amber-500/20" 
                  />
                ) : selectedAsistenciaForModal.profiles?.avatar_url ? (
                  <img 
                    src={selectedAsistenciaForModal.profiles.avatar_url} 
                    alt={selectedAsistenciaForModal.profiles.full_name || 'Barbero'} 
                    className="w-full h-full rounded-3xl object-cover border-4 border-amber-500/50 shadow-2xl shadow-amber-500/20" 
                  />
                ) : (
                  <div className="w-full h-full rounded-3xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-4 border-amber-500/40 flex items-center justify-center shadow-2xl">
                    <span className="text-5xl font-black text-amber-400">
                      {selectedAsistenciaForModal.profiles?.full_name?.charAt(0) || '?'}
                    </span>
                  </div>
                )}
                {selectedAsistenciaForModal.lat != null && selectedAsistenciaForModal.lng != null && (
                  <span className="absolute -bottom-2 -right-2 bg-emerald-500 text-black text-xs font-black w-8 h-8 rounded-full border-2 border-zinc-950 flex items-center justify-center shadow-lg" title="GPS Verificado">
                    📍
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-tight">
                {selectedAsistenciaForModal.profiles?.full_name || 'Barbero'}
              </h2>
              <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mt-1">
                {selectedAsistenciaForModal.profiles?.role || 'barbero'}
              </p>

              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                <Badge variant={estadoBadgeVariant(selectedAsistenciaForModal.estado_calculado)} className="uppercase text-[10px] font-black px-3 py-1">
                  {estadoLabel(selectedAsistenciaForModal.estado_calculado)}
                </Badge>
                {selectedAsistenciaForModal.cierre_automatico && (
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-lg">
                    Auto-cierre 22:00
                  </span>
                )}
                {selectedAsistenciaForModal.en_almuerzo && (
                  <span className="text-[10px] text-orange-400 font-bold bg-orange-500/15 border border-orange-500/30 px-2.5 py-0.5 rounded-lg animate-pulse">
                    🍽️ Almuerzo activo
                  </span>
                )}
              </div>
            </div>

            {/* Cuerpo del Detalle */}
            <div className="p-6 space-y-5">
              {/* Tarjetas de Marcación */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900 rounded-2xl p-3 border border-white/5 text-center">
                  <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Entrada</p>
                  <p className="text-base font-black text-white mt-1">{horaFmt(selectedAsistenciaForModal.hora_entrada)}</p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{selectedAsistenciaForModal.fecha}</p>
                </div>
                <div className="bg-zinc-900 rounded-2xl p-3 border border-white/5 text-center">
                  <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Salida</p>
                  <p className={`text-base font-black mt-1 ${selectedAsistenciaForModal.hora_salida ? 'text-white' : 'text-amber-500'}`}>
                    {selectedAsistenciaForModal.hora_salida ? horaFmt(selectedAsistenciaForModal.hora_salida) : 'Abierto'}
                  </p>
                  {!selectedAsistenciaForModal.hora_salida && <p className="text-[9px] text-amber-500/60 font-bold mt-0.5">En turno</p>}
                </div>
                <div className="bg-zinc-900 rounded-2xl p-3 border border-white/5 text-center">
                  <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Horas</p>
                  <p className={`text-base font-black mt-1 ${esEnVivo(selectedAsistenciaForModal) ? 'text-green-400 animate-pulse' : 'text-amber-400'}`}>
                    {horasEnVivo(selectedAsistenciaForModal)}
                  </p>
                  {esEnVivo(selectedAsistenciaForModal) && <p className="text-[9px] text-green-500/60 font-bold mt-0.5">EN VIVO</p>}
                </div>
              </div>

              {/* Sección dinámica de Almuerzo */}
              {selectedAsistenciaForModal.en_almuerzo && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xl">🍽️</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-orange-400 uppercase tracking-wider">Pausa de Almuerzo Activa</p>
                    <p className="text-[10px] text-orange-300/80 mt-0.5">El barbero se encuentra almorzando actualmente.</p>
                  </div>
                </div>
              )}

              {!selectedAsistenciaForModal.en_almuerzo && selectedAsistenciaForModal.notas && selectedAsistenciaForModal.notas.includes('[ALMUERZO]') && (() => {
                const lineas = selectedAsistenciaForModal.notas!.split('\n').filter(l => l.includes('[ALMUERZO]'))
                return lineas.length > 0 ? (
                  <div className="space-y-2">
                    {lineas.map((linea, idx) => {
                      const horaMatch = linea.match(/a las (\d{1,2}:\d{2})/)
                      const gpsMatch = linea.match(/GPS:\s*([-\d.]+),\s*([-\d.]+)/)
                      const horaRetorno = horaMatch?.[1] || null
                      const gpsLat = gpsMatch?.[1] || null
                      const gpsLng = gpsMatch?.[2] || null
                      return (
                        <div key={idx} className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                              <span className="text-base">🍽️</span>
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-orange-400 uppercase tracking-wider">Almuerzo completado</p>
                              {horaRetorno && (
                                <p className="text-xs font-bold text-white mt-0.5">Retornó a las {horaRetorno}</p>
                              )}
                            </div>
                          </div>
                          {gpsLat && gpsLng && (
                            <a
                              href={`https://www.google.com/maps?q=${gpsLat},${gpsLng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-xl font-black text-[10px] uppercase transition shadow-md shrink-0"
                            >
                              📍 Ver GPS ↗
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : null
              })()}

              {/* Geolocalización GPS Embed si existen coordenadas */}
              {selectedAsistenciaForModal.lat != null && selectedAsistenciaForModal.lng != null && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-400" /> Marcación GPS Verificada
                  </p>
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30 bg-black h-48 shadow-xl">
                    <iframe
                      src={`https://maps.google.com/maps?q=${selectedAsistenciaForModal.lat},${selectedAsistenciaForModal.lng}&z=17&output=embed`}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      title="Ubicación GPS Marcada"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Cierre */}
            <div className="p-4 border-t border-white/10 bg-zinc-900/50 flex justify-end shrink-0">
              <Button 
                onClick={() => setSelectedAsistenciaForModal(null)} 
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs h-11 px-6 rounded-xl shadow-lg"
              >
                Cerrar Detalle
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
