'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import {
  ArrowLeft, Clock, Download, Filter, AlertTriangle,
  Pencil, Users, RefreshCw, ChevronLeft, ChevronRight,
  CalendarDays, Calendar,
} from 'lucide-react'
import { estadoBadgeVariant, estadoLabel, type AsistenciaEstado } from '@/lib/asistencia/helpers'
import { AUTO_CLOSE_HOUR } from '@/lib/asistencia/constants'
import { useToast } from '@/components/ui/Toast'
import { ImageUpload } from '@/components/ui/ImageUpload'

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
  profiles?: { id: string; full_name: string | null; role: string }
}

interface BarberoOpt { id: string; full_name: string }

// ── Helpers de fecha ──────────────────────────────────────────────────
function getMondayOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  date.setHours(0, 0, 0, 0)
  return date
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function fmtShort(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric' })
}

function getWeekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => fmt(addDays(monday, i)))
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ────────────────────────────────────────────────────────────────────────
export default function AsistenciaAdminPage() {
  const { success, error: toastError } = useToast()

  const [vista, setVista] = useState<'dia' | 'semana'>('semana')
  const [loading, setLoading] = useState(true)
  const [registros, setRegistros] = useState<Registro[]>([])
  const [resumen, setResumen] = useState({ total: 0, turnos_abiertos: 0, finalizados: 0 })

  // Vista día
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
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
  const [formPermiso, setFormPermiso] = useState({ barbero_id: '', fecha: new Date().toISOString().split('T')[0], notas: '', comprobante_url: '' })
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

  // ─── Calcular grid semanal ──────────────────────────────────────────
  const empleadosPorId = new Map<string, string>()
  registros.forEach(r => {
    if (r.profiles?.id) empleadosPorId.set(r.profiles.id, r.profiles.full_name || 'Sin nombre')
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
      new Date(a.hora_entrada).toLocaleTimeString('es-MX'),
      a.hora_salida ? new Date(a.hora_salida).toLocaleTimeString('es-MX') : 'Abierto',
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
  const abrirEdicion = (r: Registro) => {
    setEditando(r)
    setFormEdit({ hora_entrada: r.hora_entrada.slice(0, 16), hora_salida: r.hora_salida ? r.hora_salida.slice(0, 16) : '', notas: r.notas || '' })
  }

  const guardarEdicion = async () => {
    if (!editando) return
    try {
      const res = await fetch(`/api/asistencias/${editando.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hora_entrada: new Date(formEdit.hora_entrada).toISOString(), hora_salida: formEdit.hora_salida ? new Date(formEdit.hora_salida).toISOString() : null, notas: formEdit.notas }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      success('Registro actualizado')
      setEditando(null)
      vista === 'dia' ? loadDia() : loadSemana()
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  const horaFmt = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

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
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-950/80">
                    <th className="py-4 px-6 text-[10px] font-black uppercase text-zinc-500">Empleado</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase text-zinc-500 text-center">Entrada</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase text-zinc-500 text-center">Salida</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase text-zinc-500 text-center">Horas</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase text-zinc-500 text-center">Estado</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase text-zinc-500 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr><td colSpan={6} className="py-20 text-center"><Clock className="w-10 h-10 mx-auto text-amber-500 animate-spin" /></td></tr>
                  ) : registros.map(r => (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-5 px-6">
                        <p className="font-bold text-white">{r.profiles?.full_name}</p>
                        <p className="text-[10px] text-zinc-500 uppercase">{r.profiles?.role}</p>
                      </td>
                      <td className="py-5 px-6 text-center font-black text-white">{horaFmt(r.hora_entrada)}</td>
                      <td className="py-5 px-6 text-center">
                        {r.hora_salida ? <span className="font-black text-white">{horaFmt(r.hora_salida)}</span> : <span className="text-amber-500 font-bold text-xs uppercase">Abierto</span>}
                      </td>
                      <td className="py-5 px-6 text-center text-amber-500 font-black">{r.horas_trabajadas ?? '—'}</td>
                      <td className="py-5 px-6 text-center">
                        <Badge variant={estadoBadgeVariant(r.estado_calculado)} className="uppercase text-[10px]">{estadoLabel(r.estado_calculado)}</Badge>
                        {r.cierre_automatico && <p className="text-[9px] text-amber-500 mt-1 font-bold">Auto</p>}
                      </td>
                      <td className="py-5 px-6 text-center">
                        <Button variant="ghost" size="sm" onClick={() => abrirEdicion(r)}><Pencil className="w-4 h-4" /></Button>
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

          {/* Grid semanal */}
          <Card className="border-white/5 overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
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
                      empleadosOrdenados.map(([empId, nombre]) => {
                        const diasMap = gridMap.get(empId)
                        const totalHrs = diasDeSemana.reduce((sum, dia) => {
                          const r = diasMap?.get(dia)
                          return sum + (r?.horas_trabajadas ?? 0)
                        }, 0)
                        return (
                          <tr key={empId} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-4 px-4">
                              <p className="font-bold text-white text-sm">{nombre}</p>
                            </td>
                            {diasDeSemana.map(dia => {
                              const r = diasMap?.get(dia)
                              return (
                                <td key={dia} className="py-3 px-2 text-center">
                                  {r ? (
                                    <div className="space-y-1">
                                      <div className={`font-black text-xs ${celdaColor(r)}`}>
                                        {r.estado_calculado === 'permiso' as any || r.notas?.includes('PERMISO') 
                                          ? 'PERMISO' 
                                          : (r.horas_trabajadas != null ? `${r.horas_trabajadas}h` : '?')}
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
                                      <button onClick={() => abrirEdicion(r)} className="block mx-auto text-zinc-700 hover:text-amber-500 transition-colors">
                                        <Pencil size={9} />
                                      </button>
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

          {/* Leyenda */}
          <div className="flex gap-4 flex-wrap text-[10px] font-black uppercase tracking-widest">
            <span className="flex items-center gap-1.5 text-green-400"><span className="w-2 h-2 bg-green-400 rounded-full inline-block" /> Completo</span>
            <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2 h-2 bg-amber-400 rounded-full inline-block" /> En turno / sin salida</span>
            <span className="flex items-center gap-1.5 text-red-400"><span className="w-2 h-2 bg-red-400 rounded-full inline-block" /> Atrasado</span>
            <span className="flex items-center gap-1.5 text-zinc-700"><span className="w-2 h-2 bg-zinc-700 rounded-full inline-block" /> Sin registro</span>
          </div>
        </>
      )}

      {/* Modal edición */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md border-amber-500/20">
            <CardHeader><CardTitle>Editar asistencia — {editando.profiles?.full_name}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Entrada</label>
                <input type="datetime-local" value={formEdit.hora_entrada} onChange={e => setFormEdit({ ...formEdit, hora_entrada: e.target.value })}
                  className="w-full mt-1 h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Salida</label>
                <input type="datetime-local" value={formEdit.hora_salida} onChange={e => setFormEdit({ ...formEdit, hora_salida: e.target.value })}
                  className="w-full mt-1 h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Notas admin</label>
                <textarea value={formEdit.notas} onChange={e => setFormEdit({ ...formEdit, notas: e.target.value })}
                  className="w-full mt-1 min-h-[80px] bg-zinc-950 border border-white/10 rounded-xl p-3 text-white text-sm" />
              </div>
              <div className="flex gap-3">
                <Button variant="primary" className="flex-1 font-black uppercase" onClick={guardarEdicion}>Guardar</Button>
                <Button variant="outline" className="flex-1" onClick={() => setEditando(null)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Registrar Permiso */}
      {showPermiso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md border-purple-500/20">
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
    </div>
  )
}
