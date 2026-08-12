'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Shield, Database, Filter, Eye, ChevronDown, ChevronUp } from 'lucide-react'

interface AuditEntry {
  id: string
  tabla_afectada: string
  registro_id: string | null
  accion: string
  usuario: string | null
  usuario_id: string | null
  fecha: string
  datos_anteriores: Record<string, unknown> | null
  datos_nuevos: Record<string, unknown> | null
}

export default function AuditoriaPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTabla, setFiltroTabla] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '150' })
    if (filtroTabla) params.set('tabla', filtroTabla)
    if (filtroAccion) params.set('accion', filtroAccion)

    const res = await fetch(`/api/audit-log?${params}`)
    if (res.ok) setEntries(await res.json())
    setLoading(false)
  }, [filtroTabla, filtroAccion])

  useEffect(() => { loadData() }, [loadData])

  const accionBadge = (accion: string) => {
    const map: Record<string, 'success' | 'warning' | 'danger'> = {
      INSERT: 'success',
      UPDATE: 'warning',
      DELETE: 'danger',
    }
    return map[accion] || 'default'
  }

  const accionLabel = (accion: string) => {
    const map: Record<string, string> = {
      INSERT: 'Creación',
      UPDATE: 'Edición',
      DELETE: 'Eliminación',
    }
    return map[accion] || accion
  }

  const tablaLabel = (tabla: string) => {
    const map: Record<string, string> = {
      transactions: 'Transacciones',
      daily_closures: 'Arqueos',
      egresos: 'Egresos',
      referrals: 'Referidos',
      bonos: 'Bonos',
      profiles: 'Usuarios',
      clientes: 'Clientes',
      citas: 'Citas',
      productos: 'Productos',
    }
    return map[tabla] || tabla
  }

  const tablas = [...new Set(entries.map(e => e.tabla_afectada))].sort()
  const totalInserts = entries.filter(e => e.accion === 'INSERT').length
  const totalUpdates = entries.filter(e => e.accion === 'UPDATE').length
  const totalDeletes = entries.filter(e => e.accion === 'DELETE').length

  const renderJsonDiff = (entry: AuditEntry) => {
    if (!entry.datos_anteriores && !entry.datos_nuevos) {
      return <p className="text-zinc-600 text-xs italic">Sin datos detallados</p>
    }

    const keys = new Set([
      ...Object.keys(entry.datos_anteriores || {}),
      ...Object.keys(entry.datos_nuevos || {}),
    ])

    // Filter out technical fields
    const skipKeys = ['id', 'creado_en', 'created_at']

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {entry.datos_anteriores && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">Datos Anteriores</p>
            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 space-y-1">
              {[...keys].filter(k => !skipKeys.includes(k)).map(key => {
                const val = entry.datos_anteriores?.[key]
                if (val === undefined || val === null) return null
                return (
                  <div key={key} className="flex gap-2 text-xs">
                    <span className="text-zinc-500 font-mono shrink-0">{key}:</span>
                    <span className="text-red-300 font-mono break-all">{JSON.stringify(val)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {entry.datos_nuevos && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-green-400 mb-2">Datos Nuevos</p>
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-3 space-y-1">
              {[...keys].filter(k => !skipKeys.includes(k)).map(key => {
                const val = entry.datos_nuevos?.[key]
                if (val === undefined || val === null) return null
                return (
                  <div key={key} className="flex gap-2 text-xs">
                    <span className="text-zinc-500 font-mono shrink-0">{key}:</span>
                    <span className="text-green-300 font-mono break-all">{JSON.stringify(val)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <AdminPageHeader
        title="Registro de"
        highlight="Auditoría"
        description="Historial completo de cambios en el sistema. Cada transacción, edición y eliminación queda registrada."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="px-5 py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Registros</p>
              <p className="text-2xl font-black text-white">{entries.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="px-5 py-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Creaciones</p>
              <p className="text-xl font-black text-green-400">{totalInserts}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="px-5 py-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Ediciones</p>
              <p className="text-xl font-black text-amber-400">{totalUpdates}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="px-5 py-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Eliminaciones</p>
              <p className="text-xl font-black text-red-400">{totalDeletes}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-zinc-500" />
        <select
          value={filtroTabla} onChange={(e) => setFiltroTabla(e.target.value)}
          className="h-10 bg-zinc-900 border border-white/10 rounded-xl px-4 text-xs text-zinc-300 appearance-none"
        >
          <option value="">Todas las tablas</option>
          {tablas.map(t => (
            <option key={t} value={t}>{tablaLabel(t)}</option>
          ))}
        </select>
        <select
          value={filtroAccion} onChange={(e) => setFiltroAccion(e.target.value)}
          className="h-10 bg-zinc-900 border border-white/10 rounded-xl px-4 text-xs text-zinc-300 appearance-none"
        >
          <option value="">Todas las acciones</option>
          <option value="INSERT">Creación</option>
          <option value="UPDATE">Edición</option>
          <option value="DELETE">Eliminación</option>
        </select>
        {(filtroTabla || filtroAccion) && (
          <button onClick={() => { setFiltroTabla(''); setFiltroAccion('') }}
            className="text-[10px] font-black uppercase tracking-widest text-amber-500 hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {entries.length === 0 ? (
          <Card className="border-white/5">
            <CardContent className="py-16 text-center">
              <Shield className="w-12 h-12 mx-auto text-zinc-800 opacity-30 mb-3" />
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Sin registros de auditoría</p>
              <p className="text-zinc-600 text-xs mt-1">Los cambios en transacciones se registrarán automáticamente</p>
            </CardContent>
          </Card>
        ) : (
          entries.map((entry, i) => (
            <Card key={entry.id}
              className="border-white/5 bg-zinc-900/50 hover:bg-zinc-900/80 transition-all animate-in fade-in slide-in-from-bottom-1 fill-mode-both"
              style={{ animationDelay: `${Math.min(i * 20, 400)}ms` }}
            >
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  className="w-full text-left p-4 flex items-center gap-4"
                >
                  <div className="shrink-0">
                    <Badge variant={accionBadge(entry.accion) as any} className="text-[10px] uppercase font-black w-20 justify-center">
                      {accionLabel(entry.accion)}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{tablaLabel(entry.tabla_afectada)}</span>
                      {entry.registro_id && (
                        <code className="text-[10px] text-zinc-600 bg-white/5 px-2 py-0.5 rounded font-mono">
                          {entry.registro_id.substring(0, 8)}
                        </code>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {entry.usuario || 'Sistema'} · {new Date(entry.fecha).toLocaleString('es-BO')}
                    </p>
                  </div>
                  <div className="shrink-0 text-zinc-600">
                    {expandedId === entry.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {expandedId === entry.id && (
                  <div className="px-4 pb-4 border-t border-white/5 pt-4 animate-in fade-in duration-200">
                    {renderJsonDiff(entry)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
