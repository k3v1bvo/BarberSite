'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import {
  ArrowLeft,
  Clock,
  Download,
  Filter,
  AlertTriangle,
  Pencil,
  Users,
  RefreshCw,
} from 'lucide-react'
import { estadoBadgeVariant, estadoLabel, type AsistenciaEstado } from '@/lib/asistencia/helpers'
import { AUTO_CLOSE_HOUR } from '@/lib/asistencia/constants'
import { useToast } from '@/components/ui/Toast'

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

interface BarberoOpt {
  id: string
  full_name: string
}

export default function AsistenciaAdminPage() {
  const { success, error: toastError } = useToast()
  const [loading, setLoading] = useState(true)
  const [registros, setRegistros] = useState<Registro[]>([])
  const [resumen, setResumen] = useState({ total: 0, turnos_abiertos: 0, finalizados: 0 })
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [barberoId, setBarberoId] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [barberos, setBarberos] = useState<BarberoOpt[]>([])
  const [editando, setEditando] = useState<Registro | null>(null)
  const [formEdit, setFormEdit] = useState({ hora_entrada: '', hora_salida: '', notas: '' })

  const loadBarberos = useCallback(async () => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['barbero', 'recepcionista'])
      .eq('is_active', true)
    setBarberos(data || [])
  }, [])

  const loadAsistencias = useCallback(async () => {
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

  useEffect(() => {
    loadBarberos()
  }, [loadBarberos])

  useEffect(() => {
    loadAsistencias()
  }, [loadAsistencias])

  const exportarCSV = () => {
    const cabeceras = ['Empleado', 'Rol', 'Estado', 'Entrada', 'Salida', 'Horas', 'Auto-cierre']
    const filas = registros.map((a) => [
      a.profiles?.full_name || '',
      a.profiles?.role || '',
      estadoLabel(a.estado_calculado),
      new Date(a.hora_entrada).toLocaleTimeString('es-MX'),
      a.hora_salida ? new Date(a.hora_salida).toLocaleTimeString('es-MX') : 'Abierto',
      a.horas_trabajadas ?? '',
      a.cierre_automatico ? 'Sí' : 'No',
    ])
    const csv =
      cabeceras.join(',') + '\n' + filas.map((e) => e.join(',')).join('\n')
    const link = document.createElement('a')
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    link.download = `asistencia_${fecha}.csv`
    link.click()
  }

  const abrirEdicion = (r: Registro) => {
    setEditando(r)
    setFormEdit({
      hora_entrada: r.hora_entrada.slice(0, 16),
      hora_salida: r.hora_salida ? r.hora_salida.slice(0, 16) : '',
      notas: r.notas || '',
    })
  }

  const guardarEdicion = async () => {
    if (!editando) return
    try {
      const res = await fetch(`/api/asistencias/${editando.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hora_entrada: new Date(formEdit.hora_entrada).toISOString(),
          hora_salida: formEdit.hora_salida
            ? new Date(formEdit.hora_salida).toISOString()
            : null,
          notas: formEdit.notas,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      success('Registro actualizado')
      setEditando(null)
      loadAsistencias()
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-8">
        <div className="flex items-center gap-6">
          <Link
            href="/admin"
            className="p-4 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl transition-all btn-press"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-500 hover:text-amber-500" />
          </Link>
          <div>
            <h1 className="text-4xl font-black text-white uppercase leading-none">
              Control de <span className="text-amber-500">Asistencia</span>
            </h1>
            <p className="text-zinc-500 mt-2">Historial, correcciones y alertas de turnos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="md" onClick={loadAsistencias}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          <Button variant="outline" size="lg" onClick={exportarCSV} className="font-black uppercase text-xs">
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-5 flex gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
          <div className="text-sm text-zinc-300 leading-relaxed">
            <strong className="text-amber-400">Regla de cierre automático:</strong> si un empleado no marca
            salida antes de las <strong>{AUTO_CLOSE_HOUR}:00</strong>, el sistema cierra el turno solo. Después
            de esa hora, las correcciones deben hacerse desde este panel (botón editar).
          </div>
        </CardContent>
      </Card>

      {resumen.turnos_abiertos > 0 && (
        <Card className="border-red-500/30 bg-red-500/10 animate-pulse">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <div>
                <p className="font-black text-red-200 uppercase text-sm">Turnos sin cerrar</p>
                <p className="text-red-200/70 text-xs">
                  {resumen.turnos_abiertos} empleado(s) aún en turno o sin salida registrada
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-500/30 text-red-300"
              onClick={() => {
                setEstadoFiltro('')
                loadAsistencias()
              }}
            >
              Ver todos
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase text-zinc-500">Registros</p>
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

      <Card className="border-white/5">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 block mb-2">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 block mb-2">Empleado</label>
              <select
                value={barberoId}
                onChange={(e) => setBarberoId(e.target.value)}
                className="h-11 min-w-[180px] bg-zinc-950 border border-white/10 rounded-xl px-4 text-white font-bold"
              >
                <option value="">Todos</option>
                {barberos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 block mb-2">Estado</label>
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className="h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white font-bold"
              >
                <option value="">Todos</option>
                <option value="presente">Presente</option>
                <option value="atrasado">Atrasado</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>
            <Button variant="secondary" onClick={loadAsistencias} className="h-11 font-black uppercase text-xs">
              <Filter className="w-4 h-4 mr-2" />
              Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>

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
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Clock className="w-10 h-10 mx-auto text-amber-500 animate-spin" />
                  </td>
                </tr>
              ) : (
                registros.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-5 px-6">
                      <p className="font-bold text-white">{r.profiles?.full_name}</p>
                      <p className="text-[10px] text-zinc-500 uppercase">{r.profiles?.role}</p>
                    </td>
                    <td className="py-5 px-6 text-center font-black text-white">
                      {new Date(r.hora_entrada).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-5 px-6 text-center">
                      {r.hora_salida ? (
                        <span className="font-black text-white">
                          {new Date(r.hora_salida).toLocaleTimeString('es-MX', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      ) : (
                        <span className="text-amber-500 font-bold text-xs uppercase">Abierto</span>
                      )}
                    </td>
                    <td className="py-5 px-6 text-center text-amber-500 font-black">
                      {r.horas_trabajadas ?? '—'}
                    </td>
                    <td className="py-5 px-6 text-center">
                      <Badge variant={estadoBadgeVariant(r.estado_calculado)} className="uppercase text-[10px]">
                        {estadoLabel(r.estado_calculado)}
                      </Badge>
                      {r.cierre_automatico && (
                        <p className="text-[9px] text-amber-500 mt-1 font-bold">Auto 22:00</p>
                      )}
                    </td>
                    <td className="py-5 px-6 text-center">
                      <Button variant="ghost" size="sm" onClick={() => abrirEdicion(r)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
              {!loading && registros.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    Sin registros para los filtros seleccionados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md border-amber-500/20">
            <CardHeader>
              <CardTitle>Editar asistencia — {editando.profiles?.full_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Entrada</label>
                <input
                  type="datetime-local"
                  value={formEdit.hora_entrada}
                  onChange={(e) => setFormEdit({ ...formEdit, hora_entrada: e.target.value })}
                  className="w-full mt-1 h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Salida</label>
                <input
                  type="datetime-local"
                  value={formEdit.hora_salida}
                  onChange={(e) => setFormEdit({ ...formEdit, hora_salida: e.target.value })}
                  className="w-full mt-1 h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Notas admin</label>
                <textarea
                  value={formEdit.notas}
                  onChange={(e) => setFormEdit({ ...formEdit, notas: e.target.value })}
                  className="w-full mt-1 min-h-[80px] bg-zinc-950 border border-white/10 rounded-xl p-3 text-white text-sm"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="primary" className="flex-1 font-black uppercase" onClick={guardarEdicion}>
                  Guardar
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setEditando(null)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
