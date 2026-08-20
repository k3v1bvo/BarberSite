'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { useToast } from './Toast'
import { CalendarOff, Clock, Plus, Trash2, Save } from 'lucide-react'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface HorarioRow {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  activo: boolean
}

interface Bloqueo {
  id: string
  fecha_inicio: string
  fecha_fin: string
  tipo: string
  motivo: string | null
  todo_el_dia: boolean
}

interface BarberoHorarioPanelProps {
  barberoId: string
  canEdit?: boolean
}

export function BarberoHorarioPanel({ barberoId, canEdit = true }: BarberoHorarioPanelProps) {
  const { success, error: toastError } = useToast()
  const [horario, setHorario] = useState<HorarioRow[]>([])
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nuevoBloqueo, setNuevoBloqueo] = useState({
    fecha: '',
    tipo: 'dia_libre' as 'bloqueo' | 'vacacion' | 'dia_libre',
    motivo: '',
  })

  useEffect(() => {
    loadAll()
  }, [barberoId])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [hRes, bRes] = await Promise.all([
        fetch(`/api/barberos/${barberoId}/horario-laboral`),
        fetch(`/api/barberos/${barberoId}/bloqueos`),
      ])
      const hJson = await hRes.json()
      const bJson = await bRes.json()
      if (hJson.horario) setHorario(hJson.horario)
      if (bJson.bloqueos) setBloqueos(bJson.bloqueos)
    } finally {
      setLoading(false)
    }
  }

  const guardarHorario = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/barberos/${barberoId}/horario-laboral`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horario }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success('Horario semanal guardado')
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const agregarBloqueo = async () => {
    if (!nuevoBloqueo.fecha) return
    try {
      const inicio = `${nuevoBloqueo.fecha}T00:00:00`
      const fin = `${nuevoBloqueo.fecha}T23:59:59`
      const res = await fetch(`/api/barberos/${barberoId}/bloqueos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_inicio: inicio,
          fecha_fin: fin,
          tipo: nuevoBloqueo.tipo,
          motivo: nuevoBloqueo.motivo,
          todo_el_dia: true,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success('Día bloqueado registrado')
      setNuevoBloqueo({ fecha: '', tipo: 'dia_libre', motivo: '' })
      loadAll()
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Error')
    }
  }

  const eliminarBloqueo = async (id: string) => {
    try {
      await fetch(`/api/barberos/${barberoId}/bloqueos?bloqueo_id=${id}`, { method: 'DELETE' })
      loadAll()
    } catch {
      toastError('No se pudo eliminar')
    }
  }

  if (loading) {
    return (
      <Card className="border-white/5">
        <CardContent className="p-8 text-center text-zinc-500 text-sm">Cargando horarios...</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="border-white/5 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-amber-500" />
            Horario laboral semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {horario.map((row, idx) => (
            <div
              key={row.dia_semana}
              className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center p-3 rounded-xl bg-black/20 border border-white/5"
            >
              <label className="flex items-center gap-2 text-sm font-bold text-white">
                <input
                  type="checkbox"
                  checked={row.activo}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const copy = [...horario]
                    copy[idx] = { ...copy[idx], activo: e.target.checked }
                    setHorario(copy)
                  }}
                  className="rounded border-white/20"
                />
                {DIAS[row.dia_semana]}
              </label>
              <input
                type="time"
                disabled={!canEdit || !row.activo}
                value={row.hora_inicio?.slice(0, 5) || '09:00'}
                onChange={(e) => {
                  const copy = [...horario]
                  copy[idx] = { ...copy[idx], hora_inicio: e.target.value }
                  setHorario(copy)
                }}
                className="h-10 bg-zinc-950 border border-white/10 rounded-lg px-3 text-white text-sm"
              />
              <input
                type="time"
                disabled={!canEdit || !row.activo}
                value={row.hora_fin?.slice(0, 5) || '20:00'}
                onChange={(e) => {
                  const copy = [...horario]
                  copy[idx] = { ...copy[idx], hora_fin: e.target.value }
                  setHorario(copy)
                }}
                className="h-10 bg-zinc-950 border border-white/10 rounded-lg px-3 text-white text-sm"
              />
            </div>
          ))}
          {canEdit && (
            <Button variant="primary" onClick={guardarHorario} disabled={saving} className="w-full sm:w-auto font-black uppercase text-xs">
              <Save className="w-4 h-4 mr-2" />
              Guardar horario
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/5 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarOff className="w-5 h-5 text-red-400" />
            Días libres y vacaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && (
            <div className="flex flex-col sm:flex-row gap-3 items-end p-4 rounded-xl bg-black/20 border border-white/5">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">Fecha</label>
                <input
                  type="date"
                  value={nuevoBloqueo.fecha}
                  onChange={(e) => setNuevoBloqueo({ ...nuevoBloqueo, fecha: e.target.value })}
                  className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">Tipo</label>
                <select
                  value={nuevoBloqueo.tipo}
                  onChange={(e) =>
                    setNuevoBloqueo({
                      ...nuevoBloqueo,
                      tipo: e.target.value as 'bloqueo' | 'vacacion' | 'dia_libre',
                    })
                  }
                  className="h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white text-sm font-bold"
                >
                  <option value="dia_libre">Día libre</option>
                  <option value="vacacion">Vacación</option>
                  <option value="bloqueo">Bloqueo horario</option>
                </select>
              </div>
              <Input
                label="Motivo"
                value={nuevoBloqueo.motivo}
                onChange={(e) => setNuevoBloqueo({ ...nuevoBloqueo, motivo: e.target.value })}
                placeholder="Opcional"
              />
              <Button variant="outline" onClick={agregarBloqueo} className="font-black uppercase text-xs h-11">
                <Plus className="w-4 h-4 mr-1" />
                Agregar
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {bloqueos.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-6">No hay días bloqueados</p>
            ) : (
              bloqueos.map((b) => (
                <div
                  key={b.id}
                  className="flex justify-between items-center p-3 rounded-xl bg-zinc-950 border border-white/5"
                >
                  <div>
                    <p className="font-bold text-white text-sm capitalize">{b.tipo.replace('_', ' ')}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(b.fecha_inicio).toLocaleDateString('es-MX')}
                      {b.motivo ? ` · ${b.motivo}` : ''}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => eliminarBloqueo(b.id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
