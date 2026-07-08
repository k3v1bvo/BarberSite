'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import {
  ArrowLeft, Save, Plus, Trash2, Edit, X, ToggleLeft, ToggleRight,
  Coins, AlertTriangle, Gift, ChevronDown, ChevronUp, Check, DollarSign,
  CheckCircle2, XCircle, Calendar, Target, Clock,
} from 'lucide-react'

// ── Tipos ──────────────────────────────────────────────────────────────
interface Servicio { id: string; nombre: string; precio: number; comision_activa: boolean; comision_tipo: string; comision_valor: number; comision_acumulable: boolean; comision_notas: string | null; is_active: boolean }
interface Barbero { id: string; full_name: string; comision_porcentaje: number; role: string; is_active: boolean }
interface PlanCuenta { id: string; codigo: string; detalle: string; tipo: string; nivel: number; es_sancion: boolean }

interface BonoActivo {
  id: string; barbero_id: string; tipo: string; descripcion: string | null
  monto: number; periodo_tipo: string; mes: number; anio: number
  semana: number | null; fecha_inicio: string | null; fecha_fin: string | null
  pagado: boolean; pagado_at: string | null; creado_en: string
  barbero?: { id: string; full_name: string; role: string }
}

interface SancionActiva {
  id: string; barbero_id: string; tipo: string; descripcion: string | null
  monto: number; estado: string; creado_en: string
  barbero?: { id: string; full_name: string; role: string }
}

// ── Constantes ──────────────────────────────────────────────────────────
const BONO_TIPOS = [
  { key: 'puntualidad', emoji: '⏰', label: 'Puntualidad', metaLabel: 'Días puntual requeridos', metaKey: 'meta_dias' },
  { key: 'cantidad_servicios', emoji: '✂️', label: 'Cantidad de Servicios', metaLabel: 'Meta de servicios', metaKey: 'meta_cantidad' },
  { key: 'metas', emoji: '🎯', label: 'Metas de Venta (Bs)', metaLabel: 'Meta de ventas (Bs)', metaKey: 'meta_monto_bs' },
  { key: 'otro', emoji: '⭐', label: 'Otro', metaLabel: '', metaKey: '' },
]

const TIPOS_CUENTA = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'EGRESO']

const PERIODO_LABELS: Record<string, string> = {
  diario: '📅 Diario', semanal: '📆 Semanal', mensual: '🗓️ Mensual',
}

// ── Helper: semana ISO ────────────────────────────────────────────────
function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getMondayOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  date.setHours(0, 0, 0, 0)
  return date
}

// ════════════════════════════════════════════════════════════════════════
export default function ReglasLaboralesPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()

  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'comisiones' | 'bonos' | 'sanciones' | 'asistencia'>('comisiones')

  // ─── Comisiones ───────────────────────────────────────────────────────
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // ─── Sanciones catálogo ───────────────────────────────────────────────
  const [planCuentas, setPlanCuentas] = useState<PlanCuenta[]>([])
  const [showCuentaModal, setShowCuentaModal] = useState(false)
  const [editingCuenta, setEditingCuenta] = useState<PlanCuenta | null>(null)
  const [cuentaForm, setCuentaForm] = useState({ codigo: '', detalle: '', tipo: 'EGRESO', nivel: 1, es_sancion: true })
  const [savingCuenta, setSavingCuenta] = useState(false)

  // ─── Sanciones activas ────────────────────────────────────────────────
  const [sancionesActivas, setSancionesActivas] = useState<SancionActiva[]>([])
  const [loadingSanc, setLoadingSanc] = useState(false)
  const [filtroSancBarbero, setFiltroSancBarbero] = useState('')
  const [showSancionModal, setShowSancionModal] = useState(false)
  const [sancionForm, setSancionForm] = useState({ barbero_id: '', tipo: 'llegada_tarde', descripcion: '', monto: 0 })
  const [savingSancion, setSavingSancion] = useState(false)
  const [sancionesBarberos, setSancionesBarberos] = useState<Barbero[]>([])

  // ─── Bonos config ─────────────────────────────────────────────────────
  const [bonosConfig, setBonosConfig] = useState<Record<string, { descripcion: string; monto_sugerido: number; meta_dias?: number; meta_cantidad?: number; meta_monto_bs?: number }>>({
    puntualidad: { descripcion: 'Bono por llegar puntual durante el periodo', monto_sugerido: 50, meta_dias: 5 },
    cantidad_servicios: { descripcion: 'Bono por superar meta de servicios', monto_sugerido: 100, meta_cantidad: 30 },
    metas: { descripcion: 'Bono por cumplir metas de venta', monto_sugerido: 150, meta_monto_bs: 5000 },
    otro: { descripcion: 'Bono especial discrecional', monto_sugerido: 75 },
  })
  const [savingBonos, setSavingBonos] = useState(false)

  // ─── Asistencia config ────────────────────────────────────────────────
  const [asistenciaConfig, setAsistenciaConfig] = useState({ tolerancia_minutos: 15 })
  const [savingAsistencia, setSavingAsistencia] = useState(false)

  // ─── Bonos activos ────────────────────────────────────────────────────
  const [bonosActivos, setBonosActivos] = useState<BonoActivo[]>([])
  const [loadingBonos, setLoadingBonos] = useState(false)
  const [filtroBonosBarbero, setFiltroBonosBarbero] = useState('')
  const [filtroBonosPagado, setFiltroBonosPagado] = useState<'false' | 'true' | ''>('false')
  const [showBonoModal, setShowBonoModal] = useState(false)
  const [bonoForm, setBonoForm] = useState({
    barbero_id: '', tipo: 'puntualidad', descripcion: '', monto: 0,
    periodo_tipo: 'semanal', fecha_inicio: '', fecha_fin: '', pagado: false,
  })
  const [savingBono, setSavingBono] = useState(false)
  const [editingBonoId, setEditingBonoId] = useState<string | null>(null)
  const [bonosBarberos, setBonosBarberos] = useState<Barbero[]>([])

  // ─── Load base data ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reglas-laborales')
      if (!res.ok) return
      const data = await res.json()
      setServicios(data.servicios ?? [])
      setBarberos(data.barberos ?? [])
      setPlanCuentas(data.plan_cuentas ?? [])
      const bonosCfg = data.configuraciones?.find((c: any) => c.llave === 'bonos_config')
      if (bonosCfg?.valor) setBonosConfig(bonosCfg.valor)
      
      const asisCfg = data.configuraciones?.find((c: any) => c.llave === 'asistencia_config')
      if (asisCfg?.valor) setAsistenciaConfig(asisCfg.valor)

    } finally {
      setLoading(false)
    }
  }, [])

  const loadBonosActivos = useCallback(async () => {
    setLoadingBonos(true)
    try {
      const params = new URLSearchParams({ anio: String(new Date().getFullYear()) })
      if (filtroBonosBarbero) params.set('barbero_id', filtroBonosBarbero)
      if (filtroBonosPagado !== '') params.set('pagado', filtroBonosPagado)
      const res = await fetch(`/api/bonos?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setBonosActivos(data.bonos ?? [])
      setBonosBarberos(data.barberos ?? [])
    } finally {
      setLoadingBonos(false)
    }
  }, [filtroBonosBarbero, filtroBonosPagado])

  const loadSancionesActivas = useCallback(async () => {
    setLoadingSanc(true)
    try {
      const params = new URLSearchParams()
      if (filtroSancBarbero) params.set('barbero_id', filtroSancBarbero)
      const res = await fetch(`/api/admin/sanciones?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setSancionesActivas(data.sanciones?.filter((s: any) => s.estado === 'pendiente') ?? [])
      
      const resBarberos = await fetch('/api/reglas-laborales')
      if (resBarberos.ok) {
        const bData = await resBarberos.json()
        setSancionesBarberos(bData.barberos ?? [])
      }
    } finally {
      setLoadingSanc(false)
    }
  }, [filtroSancBarbero])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === 'bonos') loadBonosActivos() }, [tab, loadBonosActivos])
  useEffect(() => { if (tab === 'sanciones') loadSancionesActivas() }, [tab, loadSancionesActivas])

  // ─── Comisiones handlers ──────────────────────────────────────────────
  const saveServicioComision = async (s: Servicio) => {
    setSavingId(s.id)
    const res = await fetch('/api/reglas-laborales', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'update_servicio_comision', servicio_id: s.id, comision_activa: s.comision_activa, comision_tipo: s.comision_tipo, comision_valor: s.comision_valor, comision_acumulable: s.comision_acumulable, comision_notas: s.comision_notas }),
    })
    if (res.ok) { success('Comisión actualizada') } else { toastError('Error al guardar') }
    setSavingId(null)
  }

  const updateServicio = (id: string, changes: Partial<Servicio>) =>
    setServicios(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s))


  // ─── Plan de cuentas handlers ─────────────────────────────────────────
  const openCuenta = (c?: PlanCuenta) => {
    setEditingCuenta(c ?? null)
    setCuentaForm(c ? { codigo: c.codigo, detalle: c.detalle, tipo: c.tipo, nivel: c.nivel, es_sancion: c.es_sancion } : { codigo: '', detalle: '', tipo: 'EGRESO', nivel: 1, es_sancion: true })
    setShowCuentaModal(true)
  }

  const saveCuenta = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingCuenta(true)
    const res = await fetch('/api/reglas-laborales', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'upsert_plan_cuenta', id: editingCuenta?.id, ...cuentaForm }) })
    if (res.ok) { success('Cuenta guardada'); setShowCuentaModal(false); load() }
    else { toastError((await res.json()).error || 'Error') }
    setSavingCuenta(false)
  }

  const deleteCuenta = async (id: string) => {
    if (!confirm('¿Eliminar esta cuenta? Solo si no tiene transacciones.')) return
    const res = await fetch('/api/reglas-laborales', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'delete_plan_cuenta', id }) })
    if (res.ok) { success('Cuenta eliminada'); load() }
    else { toastError('No se puede eliminar (tiene registros asociados)') }
  }

  // ─── Bonos config handler ─────────────────────────────────────────────
  const saveBonos = async () => {
    setSavingBonos(true)
    const res = await fetch('/api/reglas-laborales', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'update_bonos_config', valor: bonosConfig }) })
    if (res.ok) { success('Configuración de bonos guardada') } else { toastError('Error') }
    setSavingBonos(false)
  }

  // ─── Asistencia config handler ─────────────────────────────────────────
  const saveAsistencia = async () => {
    setSavingAsistencia(true)
    const res = await fetch('/api/reglas-laborales', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'update_asistencia_config', valor: asistenciaConfig }) })
    if (res.ok) { success('Configuración de asistencia guardada') } else { toastError('Error') }
    setSavingAsistencia(false)
  }

  // ─── Bono activo handlers ─────────────────────────────────────────────
  const openBonoModal = () => {
    const today = new Date()
    const monday = getMondayOfWeek(today)
    const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6)
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    setEditingBonoId(null)
    setBonoForm({ barbero_id: '', tipo: 'puntualidad', descripcion: '', monto: 0, periodo_tipo: 'semanal', fecha_inicio: fmt(monday), fecha_fin: fmt(sunday), pagado: false })
    setShowBonoModal(true)
  }

  const openEditBonoModal = (b: BonoActivo) => {
    setEditingBonoId(b.id)
    setBonoForm({
      barbero_id: b.barbero_id || '',
      tipo: b.tipo,
      descripcion: b.descripcion || '',
      monto: b.monto,
      periodo_tipo: b.periodo_tipo || 'mensual',
      fecha_inicio: b.fecha_inicio || '',
      fecha_fin: b.fecha_fin || '',
      pagado: b.pagado || false
    })
    setShowBonoModal(true)
  }

  const updateBonoFechas = (periodo_tipo: string) => {
    const today = new Date()
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    if (periodo_tipo === 'semanal') {
      const mon = getMondayOfWeek(today)
      const sun = new Date(mon); sun.setDate(sun.getDate() + 6)
      setBonoForm(f => ({ ...f, periodo_tipo, fecha_inicio: fmt(mon), fecha_fin: fmt(sun) }))
    } else if (periodo_tipo === 'mensual') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      setBonoForm(f => ({ ...f, periodo_tipo, fecha_inicio: fmt(first), fecha_fin: fmt(last) }))
    } else {
      setBonoForm(f => ({ ...f, periodo_tipo, fecha_inicio: fmt(today), fecha_fin: fmt(today) }))
    }
  }

  const submitBono = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingBono(true)
    try {
      const semana = bonoForm.periodo_tipo === 'semanal' && bonoForm.fecha_inicio ? getISOWeek(new Date(bonoForm.fecha_inicio)) : null
      const res = await fetch('/api/bonos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bonoForm, semana }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success(`Bono ${bonoForm.pagado ? 'creado y pagado' : 'creado'} correctamente`)
      setShowBonoModal(false); loadBonosActivos()
    } catch (err) { toastError(err instanceof Error ? err.message : 'Error') }
    setSavingBono(false)
  }

  const pagarBono = async (id: string) => {
    if (!confirm('¿Marcar este bono como pagado? Esto generará un egreso en el sistema contable.')) return
    const res = await fetch('/api/bonos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) { success('Bono pagado y egreso registrado ✅'); loadBonosActivos() }
    else { toastError((await res.json()).error || 'Error') }
  }

  const eliminarBono = async (id: string) => {
    if (!confirm('¿Eliminar este bono? Solo se pueden eliminar bonos no pagados.')) return
    const res = await fetch(`/api/bonos?id=${id}`, { method: 'DELETE' })
    if (res.ok) { success('Bono eliminado'); loadBonosActivos() }
    else { toastError((await res.json()).error || 'Error') }
  }

  // ─── Sanción activa handlers ──────────────────────────────────────────
  const openSancionModal = () => {
    setSancionForm({ barbero_id: '', tipo: 'llegada_tarde', descripcion: '', monto: 0 })
    setShowSancionModal(true)
  }

  const submitSancion = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingSancion(true)
    try {
      const res = await fetch('/api/admin/sanciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sancionForm),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success('Sanción registrada')
      setShowSancionModal(false); loadSancionesActivas()
    } catch (err) { toastError(err instanceof Error ? err.message : 'Error') }
    setSavingSancion(false)
  }

  const marcarSancionPagada = async (id: string) => {
    if (!confirm('¿Marcar esta sanción como perdonada o eliminada? Las sanciones reales se descuentan al pagar comisiones.')) return
    const res = await fetch(`/api/admin/sanciones?id=${id}`, { method: 'DELETE' })
    if (res.ok) { success('Sanción eliminada'); loadSancionesActivas() }
    else { toastError((await res.json()).error || 'Error') }
  }

  // ─── Derived ─────────────────────────────────────────────────────────
  const sanciones = planCuentas.filter(c => c.es_sancion)
  const cuentasNormales = planCuentas.filter(c => !c.es_sancion)

  // Totales por barbero (sanciones)
  const totalPorBarbero = sancionesActivas.reduce<Record<string, { nombre: string; total: number }>>((acc, s) => {
    const id = s.barbero?.id || 'unknown'
    if (!acc[id]) acc[id] = { nombre: s.barbero?.full_name || 'Desconocido', total: 0 }
    acc[id].total += Number(s.monto)
    return acc
  }, {})

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-3 hover:bg-white/5 border border-white/5 rounded-2xl text-zinc-500 hover:text-amber-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-4xl font-black text-white uppercase tracking-tight">
              Reglas <span className="text-amber-500">Laborales</span>
            </h1>
            <p className="text-zinc-500 mt-1">Comisiones, bonos activos y sanciones — todo integrado</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'comisiones', label: 'Comisiones', icon: Coins, color: 'text-amber-500' },
          { key: 'bonos', label: `Bonos (${bonosActivos.filter(b => !b.pagado).length} pendientes)`, icon: Gift, color: 'text-green-500' },
          { key: 'sanciones', label: `Sanciones (${sancionesActivas.length} pendientes)`, icon: AlertTriangle, color: 'text-red-500' },
          { key: 'asistencia', label: 'Asistencia', icon: Clock, color: 'text-blue-500' },
        ].map(({ key, label, icon: Icon, color }) => (
          <button key={key}
            onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border ${tab === key ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-zinc-500 hover:border-white/10 hover:text-zinc-300'}`}
          >
            <Icon size={14} className={tab === key ? color : ''} /> {label}
          </button>
        ))}
      </div>

      {/* ════════ COMISIONES ════════ */}
      {tab === 'comisiones' && (
        <div className="space-y-8">

          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4 border-l-4 border-amber-500 pl-3">Comisión por Servicio</h2>
            <div className="space-y-2">
              {servicios.map(s => (
                <div key={s.id} className="border border-white/5 bg-zinc-900 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition-colors" onClick={() => setExpandido(expandido === s.id ? null : s.id)}>
                        {expandido === s.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <div className="min-w-0">
                        <p className="font-black text-white uppercase truncate">{s.nombre}</p>
                        <p className="text-zinc-600 text-xs">{formatCurrency(s.precio)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={() => updateServicio(s.id, { comision_activa: !s.comision_activa })} className="transition-colors">
                        {s.comision_activa ? <ToggleRight size={24} className="text-green-500" /> : <ToggleLeft size={24} className="text-zinc-600" />}
                      </button>
                      {s.comision_activa && (
                        <div className="text-right">
                          <p className="text-amber-500 font-black text-lg">
                            {s.comision_tipo === 'porcentaje' ? `${s.comision_valor}%` : s.comision_tipo === 'fija' ? `Bs ${s.comision_valor}` : '—'}
                          </p>
                          <p className="text-zinc-600 text-[10px] uppercase">{s.comision_tipo}</p>
                        </div>
                      )}
                      {!s.comision_activa && <Badge variant="default" className="text-[9px] uppercase">Sin comisión</Badge>}
                      <Button size="sm" variant="outline" disabled={savingId === s.id} onClick={() => saveServicioComision(s)}>
                        {savingId === s.id ? '...' : <Check size={14} className="text-green-500" />}
                      </Button>
                    </div>
                  </div>
                  {expandido === s.id && (
                    <div className="border-t border-white/5 bg-zinc-950 p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Tipo</label>
                        <select className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-white text-sm"
                          value={s.comision_tipo} onChange={e => updateServicio(s.id, { comision_tipo: e.target.value })}>
                          <option value="ninguna">Ninguna</option>
                          <option value="porcentaje">Porcentaje %</option>
                          <option value="fija">Monto fijo Bs</option>
                        </select>
                      </div>
                      {s.comision_tipo !== 'ninguna' && (
                        <div>
                          <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">
                            {s.comision_tipo === 'porcentaje' ? 'Porcentaje (%)' : 'Monto (Bs)'}
                          </label>
                          <input type="number" min={0} step={0.5}
                            className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-amber-500 font-black text-sm outline-none focus:border-amber-500/50"
                            value={s.comision_valor} onChange={e => updateServicio(s.id, { comision_valor: parseFloat(e.target.value) || 0 })} />
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-2 text-sm text-zinc-400 pb-2">
                          <input type="checkbox" checked={s.comision_acumulable} onChange={e => updateServicio(s.id, { comision_acumulable: e.target.checked })} />
                          Acumulable
                        </label>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Notas</label>
                        <input type="text" className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-white text-sm outline-none focus:border-amber-500/50"
                          value={s.comision_notas ?? ''} onChange={e => updateServicio(s.id, { comision_notas: e.target.value })} placeholder="Observación..." />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>


        </div>
      )}

      {/* ════════ BONOS ════════ */}
      {tab === 'bonos' && (
        <div className="space-y-10">

          {/* ── Sección 1: Bonos Activos ── */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-green-400 border-l-4 border-green-500 pl-3">Bonos Activos por Barbero</h2>
                <p className="text-zinc-600 text-xs mt-1 ml-4">Al pagar un bono se registra automáticamente como egreso (cuenta 4.1.3)</p>
              </div>
              <Button variant="primary" onClick={openBonoModal}><Plus size={14} className="mr-2" /> Nuevo Bono</Button>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3">
              <select value={filtroBonosBarbero} onChange={e => setFiltroBonosBarbero(e.target.value)}
                className="h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-white text-sm">
                <option value="">Todos los barberos</option>
                {bonosBarberos.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
              </select>
              <select value={filtroBonosPagado} onChange={e => setFiltroBonosPagado(e.target.value as any)}
                className="h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-white text-sm">
                <option value="false">Pendientes</option>
                <option value="true">Pagados</option>
                <option value="">Todos</option>
              </select>
              <Button variant="outline" size="sm" onClick={loadBonosActivos}>Filtrar</Button>
            </div>

            {loadingBonos ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-zinc-700 border-t-green-500 rounded-full animate-spin" /></div>
            ) : bonosActivos.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-3xl">
                <Gift size={40} className="mx-auto text-zinc-800 mb-4" />
                <p className="text-zinc-600 font-black uppercase tracking-widest text-xs">No hay bonos para los filtros seleccionados</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="text-zinc-600 text-[10px] uppercase tracking-widest border-b border-white/5">
                      <th className="text-left py-3 px-4">Barbero</th>
                      <th className="text-left py-3 px-4">Tipo</th>
                      <th className="text-left py-3 px-4">Periodo</th>
                      <th className="text-left py-3 px-4">Descripción</th>
                      <th className="text-right py-3 px-4">Monto</th>
                      <th className="text-center py-3 px-4">Estado</th>
                      <th className="text-right py-3 px-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bonosActivos.map(b => {
                      const tipo = BONO_TIPOS.find(t => t.key === b.tipo)
                      const periodoStr = b.periodo_tipo === 'semanal' && b.semana
                        ? `Sem. ${b.semana}/${b.anio}`
                        : b.periodo_tipo === 'semanal' && b.fecha_inicio
                          ? `${b.fecha_inicio} → ${b.fecha_fin}`
                          : b.periodo_tipo === 'mensual'
                            ? `${b.mes}/${b.anio}`
                            : b.fecha_inicio || `${b.mes}/${b.anio}`
                      return (
                        <tr key={b.id} className="border-b border-white/5 hover:bg-white/[0.02] group">
                          <td className="py-3 px-4 font-bold text-white">{b.barbero?.full_name || '—'}</td>
                          <td className="py-3 px-4">
                            <span className="text-sm">{tipo?.emoji} </span>
                            <span className="text-zinc-300 text-xs">{tipo?.label || b.tipo}</span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="info" className="text-[9px] uppercase">{PERIODO_LABELS[b.periodo_tipo] || b.periodo_tipo}</Badge>
                            <p className="text-zinc-600 text-[10px] mt-0.5">{periodoStr}</p>
                          </td>
                          <td className="py-3 px-4 text-zinc-400 text-xs max-w-[180px] truncate">{b.descripcion || '—'}</td>
                          <td className="py-3 px-4 text-right font-black text-green-400 text-base">{formatCurrency(b.monto)}</td>
                          <td className="py-3 px-4 text-center">
                            {b.pagado
                              ? <Badge variant="success" className="text-[9px]"><CheckCircle2 size={10} className="inline mr-1" />Pagado</Badge>
                              : <Badge variant="warning" className="text-[9px]">Pendiente</Badge>
                            }
                          </td>
                          <td className="py-3 px-4 text-right flex justify-end gap-1">
                            {!b.pagado && (
                              <Button size="sm" variant="primary" className="text-[10px] h-7 px-3" onClick={() => pagarBono(b.id)}>
                                <DollarSign size={12} className="mr-1" />Pagar
                              </Button>
                            )}
                            {!b.pagado && (
                              <Button size="sm" variant="outline" onClick={() => openEditBonoModal(b)}>
                                <Edit size={12} className="text-zinc-400" />
                              </Button>
                            )}
                            {!b.pagado && (
                              <Button size="sm" variant="outline" onClick={() => eliminarBono(b.id)}>
                                <Trash2 size={12} className="text-red-500" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-white/5" />

          {/* ── Sección 2: Config de Tipos ── */}
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 border-l-4 border-amber-500 pl-3">Configuración de Tipos de Bono</h2>
              <p className="text-zinc-600 text-xs mt-1 ml-4">Define metas, descripciones y montos sugeridos para cada tipo</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BONO_TIPOS.map(tipo => {
                const cfg = bonosConfig[tipo.key] ?? { descripcion: '', monto_sugerido: 0 }
                return (
                  <Card key={tipo.key} className="bg-zinc-900 border-white/5 hover:border-green-500/20 transition-all">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{tipo.emoji}</span>
                        <div>
                          <p className="font-black text-white uppercase">{tipo.label}</p>
                          <p className="text-zinc-600 text-[10px] font-mono uppercase">{tipo.key}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Descripción sugerida</label>
                          <textarea value={cfg.descripcion}
                            onChange={e => setBonosConfig(prev => ({ ...prev, [tipo.key]: { ...prev[tipo.key], descripcion: e.target.value } }))}
                            className="w-full h-14 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-green-500/50 resize-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Monto sugerido (Bs)</label>
                            <div className="flex items-center gap-2 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2">
                              <span className="text-zinc-500 font-bold text-sm">Bs</span>
                              <input type="number" min={0} step={5} value={cfg.monto_sugerido}
                                onChange={e => setBonosConfig(prev => ({ ...prev, [tipo.key]: { ...prev[tipo.key], monto_sugerido: parseFloat(e.target.value) || 0 } }))}
                                className="flex-1 bg-transparent text-green-400 font-black text-base outline-none" />
                            </div>
                          </div>
                          {tipo.metaKey && (
                            <div>
                              <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block flex items-center gap-1">
                                <Target size={9} /> {tipo.metaLabel}
                              </label>
                              <div className="flex items-center gap-2 bg-zinc-950 border border-amber-500/20 rounded-xl px-3 py-2">
                                <input type="number" min={0}
                                  value={(cfg as any)[tipo.metaKey] ?? 0}
                                  onChange={e => setBonosConfig(prev => ({ ...prev, [tipo.key]: { ...prev[tipo.key], [tipo.metaKey]: parseFloat(e.target.value) || 0 } }))}
                                  className="flex-1 bg-transparent text-amber-400 font-black text-base outline-none" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Button variant="primary" className="w-full h-14 font-black uppercase tracking-widest" onClick={saveBonos} disabled={savingBonos}>
              <Save size={18} className="mr-2" /> {savingBonos ? 'Guardando...' : 'Guardar Configuración de Tipos'}
            </Button>
          </div>
        </div>
      )}

      {/* ════════ SANCIONES ════════ */}
      {tab === 'sanciones' && (
        <div className="space-y-10">

          {/* ── Sección 1: Sanciones Activas ── */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-red-400 border-l-4 border-red-500 pl-3">Sanciones Pendientes</h2>
                <p className="text-zinc-600 text-xs mt-1 ml-4">Se descuentan automáticamente al pagar comisiones del barbero</p>
              </div>
              <Button variant="primary" onClick={openSancionModal} className="border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300">
                <Plus size={14} className="mr-2" /> Nueva Sanción
              </Button>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3">
              <select value={filtroSancBarbero} onChange={e => setFiltroSancBarbero(e.target.value)}
                className="h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-white text-sm">
                <option value="">Todos los barberos</option>
                {sancionesBarberos.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
              </select>
              <Button variant="outline" size="sm" onClick={loadSancionesActivas}>Filtrar</Button>
            </div>

            {/* Resumen por barbero */}
            {Object.values(totalPorBarbero).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(totalPorBarbero).map(([id, { nombre, total }]) => (
                  <div key={id} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                    <p className="text-red-300 font-black text-xs uppercase truncate">{nombre}</p>
                    <p className="text-red-400 font-black text-2xl mt-1">{formatCurrency(total)}</p>
                    <p className="text-red-600 text-[10px] uppercase">debe</p>
                  </div>
                ))}
              </div>
            )}

            {loadingSanc ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" /></div>
            ) : sancionesActivas.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-3xl">
                <CheckCircle2 size={40} className="mx-auto text-green-800 mb-4" />
                <p className="text-zinc-600 font-black uppercase tracking-widest text-xs">¡Sin sanciones pendientes! 🎉</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="text-zinc-600 text-[10px] uppercase tracking-widest border-b border-white/5">
                      <th className="text-left py-3 px-4">Barbero</th>
                      <th className="text-left py-3 px-4">Tipo</th>
                      <th className="text-left py-3 px-4">Descripción</th>
                      <th className="text-left py-3 px-4">Fecha</th>
                      <th className="text-right py-3 px-4">Monto</th>
                      <th className="text-right py-3 px-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sancionesActivas.map(s => (
                      <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02] group">
                        <td className="py-3 px-4 font-bold text-white">{s.barbero?.full_name || '—'}</td>
                        <td className="py-3 px-4">
                          <p className="text-zinc-300 text-xs font-mono uppercase">{s.tipo.replace('_', ' ')}</p>
                        </td>
                        <td className="py-3 px-4 text-zinc-400 text-xs max-w-[200px] truncate">{s.descripcion || '—'}</td>
                        <td className="py-3 px-4 text-zinc-500 text-xs">{new Date(s.creado_en).toLocaleDateString('es-BO')}</td>
                        <td className="py-3 px-4 text-right font-black text-red-400 text-base">{formatCurrency(s.monto)}</td>
                        <td className="py-3 px-4 text-right">
                          <Button size="sm" variant="outline" className="text-[10px] h-7 px-3" onClick={() => marcarSancionPagada(s.id)}>
                            <XCircle size={12} className="mr-1 text-red-500" />Eliminar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-white/5" />

          {/* ── Sección 2: Catálogo de cuentas sanción ── */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 border-l-4 border-zinc-600 pl-3">Catálogo de Tipos de Sanción</h2>
                <p className="text-zinc-600 text-xs mt-1 ml-4">Cuentas del plan contable marcadas como sanción</p>
              </div>
              <Button variant="primary" onClick={() => openCuenta()}><Plus size={14} className="mr-2" /> Nueva Cuenta</Button>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="text-zinc-600 text-[10px] uppercase tracking-widest border-b border-white/5">
                    <th className="text-left py-3 px-4">Código</th>
                    <th className="text-left py-3 px-4">Nombre / Detalle</th>
                    <th className="text-left py-3 px-4">Tipo</th>
                    <th className="text-center py-3 px-4">Nivel</th>
                    <th className="text-right py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sanciones.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-12 text-zinc-700 font-black uppercase tracking-widest">No hay cuentas de sanción</td></tr>
                  )}
                  {sanciones.map(c => (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02] group">
                      <td className="py-3 px-4 font-mono text-amber-500 font-black">{c.codigo}</td>
                      <td className="py-3 px-4 font-bold text-white">{c.detalle}</td>
                      <td className="py-3 px-4"><Badge variant="danger" className="text-[9px] uppercase">{c.tipo}</Badge></td>
                      <td className="py-3 px-4 text-center text-zinc-400">{c.nivel}</td>
                      <td className="py-3 px-4 text-right flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openCuenta(c)}><Edit size={12} /></Button>
                        <Button size="sm" variant="outline" onClick={() => deleteCuenta(c.id)}><Trash2 size={12} className="text-red-500" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {cuentasNormales.length > 0 && (
              <>
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-600 border-l-4 border-zinc-700 pl-3 mt-6">Resto del Plan de Cuentas</h3>
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead>
                      <tr className="text-zinc-600 text-[10px] uppercase tracking-widest border-b border-white/5">
                        <th className="text-left py-3 px-4">Código</th>
                        <th className="text-left py-3 px-4">Detalle</th>
                        <th className="text-left py-3 px-4">Tipo</th>
                        <th className="text-right py-3 px-4">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuentasNormales.map(c => (
                        <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2 px-4 font-mono text-zinc-400 text-xs">{c.codigo}</td>
                          <td className="py-2 px-4 text-zinc-300 text-xs">{c.detalle}</td>
                          <td className="py-2 px-4"><Badge variant="default" className="text-[9px]">{c.tipo}</Badge></td>
                          <td className="py-2 px-4 text-right flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => openCuenta(c)}><Edit size={12} /></Button>
                            <Button size="sm" variant="outline" onClick={() => deleteCuenta(c.id)}><Trash2 size={12} className="text-red-500" /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════ MODAL: NUEVO/EDITAR BONO ════════ */}
      {showBonoModal && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-start justify-center p-4 pt-12 overflow-y-auto">
          <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl my-auto">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-black text-white uppercase">{editingBonoId ? 'Editar Bono' : 'Nuevo Bono'}</h3>
              <button onClick={() => setShowBonoModal(false)} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-500"><X size={16} /></button>
            </div>
            <form onSubmit={submitBono} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Barbero *</label>
                <select required value={bonoForm.barbero_id} onChange={e => setBonoForm({ ...bonoForm, barbero_id: e.target.value })}
                  className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-green-500/50">
                  <option value="">Seleccionar barbero</option>
                  {bonosBarberos.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Tipo *</label>
                  <select required value={bonoForm.tipo} onChange={e => setBonoForm({ ...bonoForm, tipo: e.target.value })}
                    className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm outline-none">
                    {BONO_TIPOS.map(t => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Periodo *</label>
                  <select required value={bonoForm.periodo_tipo} onChange={e => updateBonoFechas(e.target.value)}
                    className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm outline-none">
                    <option value="diario">📅 Diario</option>
                    <option value="semanal">📆 Semanal</option>
                    <option value="mensual">🗓️ Mensual</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Fecha inicio</label>
                  <input type="date" value={bonoForm.fecha_inicio} onChange={e => setBonoForm({ ...bonoForm, fecha_inicio: e.target.value })}
                    className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-green-500/50" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Fecha fin</label>
                  <input type="date" value={bonoForm.fecha_fin} onChange={e => setBonoForm({ ...bonoForm, fecha_fin: e.target.value })}
                    className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-green-500/50" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Monto (Bs) *</label>
                <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2">
                  <span className="text-zinc-500 font-bold">Bs</span>
                  <input required type="number" min={1} step={0.5} value={bonoForm.monto || ''}
                    onChange={e => setBonoForm({ ...bonoForm, monto: parseFloat(e.target.value) || 0 })}
                    className="flex-1 bg-transparent text-green-400 font-black text-lg outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Descripción / Motivo</label>
                <input type="text" value={bonoForm.descripcion}
                  onChange={e => setBonoForm({ ...bonoForm, descripcion: e.target.value })}
                  placeholder="Ej: Semana sin tardanzas"
                  className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-green-500/50" />
              </div>
              <label className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl cursor-pointer hover:bg-green-500/15 transition-colors">
                <input type="checkbox" checked={bonoForm.pagado} onChange={e => setBonoForm({ ...bonoForm, pagado: e.target.checked })} className="w-4 h-4" />
                <div>
                  <p className="text-green-400 font-black text-sm">Marcar como pagado ahora</p>
                  <p className="text-green-600 text-xs">Registrará automáticamente el egreso en el sistema contable</p>
                </div>
              </label>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowBonoModal(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" className="flex-1" disabled={savingBono}>
                  <Gift size={14} className="mr-2" />{savingBono ? 'Guardando...' : editingBonoId ? 'Guardar Cambios' : 'Crear Bono'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════ MODAL: NUEVA SANCIÓN ════════ */}
      {showSancionModal && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-start justify-center p-4 pt-12 overflow-y-auto">
          <div className="w-full max-w-lg bg-zinc-950 border border-red-500/20 rounded-3xl overflow-hidden shadow-2xl my-auto">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-black text-white uppercase">Registrar Sanción</h3>
              <button onClick={() => setShowSancionModal(false)} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-500"><X size={16} /></button>
            </div>
            <form onSubmit={submitSancion} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Barbero *</label>
                <select required value={sancionForm.barbero_id} onChange={e => setSancionForm({ ...sancionForm, barbero_id: e.target.value })}
                  className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-red-500/50">
                  <option value="">Seleccionar barbero</option>
                  {sancionesBarberos.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Tipo de Sanción *</label>
                <select required value={sancionForm.tipo}
                  onChange={e => setSancionForm({ ...sancionForm, tipo: e.target.value })}
                  className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-red-500/50">
                  <option value="llegada_tarde">Llegada Tarde</option>
                  <option value="falta">Falta Injustificada</option>
                  <option value="salida_temprano">Salida Temprano</option>
                  <option value="otro">Otro Motivo</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Descripción / Motivo *</label>
                <input required type="text" value={sancionForm.descripcion}
                  onChange={e => setSancionForm({ ...sancionForm, descripcion: e.target.value })}
                  placeholder="Ej: Tardanza el lunes 3 de junio"
                  className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-red-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Monto (Bs) *</label>
                  <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2">
                    <span className="text-zinc-500 font-bold">Bs</span>
                    <input required type="number" min={0.5} step={0.5} value={sancionForm.monto || ''}
                      onChange={e => setSancionForm({ ...sancionForm, monto: parseFloat(e.target.value) || 0 })}
                      className="flex-1 bg-transparent text-red-400 font-black text-lg outline-none" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowSancionModal(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-black" disabled={savingSancion}>
                  <AlertTriangle size={14} className="mr-2" />{savingSancion ? 'Registrando...' : 'Registrar Sanción'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════ MODAL: CUENTA CONTABLE ════════ */}
      {showCuentaModal && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-start justify-center p-4 pt-12 overflow-y-auto">
          <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-black text-white uppercase">{editingCuenta ? 'Editar Cuenta' : 'Nueva Cuenta Contable'}</h3>
              <button onClick={() => setShowCuentaModal(false)} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-500"><X size={16} /></button>
            </div>
            <form onSubmit={saveCuenta} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Código</label>
                  <input required value={cuentaForm.codigo} onChange={e => setCuentaForm({ ...cuentaForm, codigo: e.target.value })} placeholder="4.2.4.3" className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white font-mono outline-none focus:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Nivel</label>
                  <input type="number" min={1} max={5} value={cuentaForm.nivel} onChange={e => setCuentaForm({ ...cuentaForm, nivel: parseInt(e.target.value) || 1 })} className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white outline-none focus:border-amber-500/50" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Nombre / Detalle</label>
                <input required value={cuentaForm.detalle} onChange={e => setCuentaForm({ ...cuentaForm, detalle: e.target.value })} placeholder="Incumplimiento de horario" className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Tipo de cuenta</label>
                <select value={cuentaForm.tipo} onChange={e => setCuentaForm({ ...cuentaForm, tipo: e.target.value })} className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white outline-none">
                  {TIPOS_CUENTA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl cursor-pointer hover:bg-red-500/15 transition-colors">
                <input type="checkbox" checked={cuentaForm.es_sancion} onChange={e => setCuentaForm({ ...cuentaForm, es_sancion: e.target.checked })} className="w-4 h-4" />
                <div>
                  <p className="text-red-400 font-black text-sm">Marcar como Sanción</p>
                  <p className="text-red-600 text-xs">Aparece en el formulario de registro de sanciones</p>
                </div>
              </label>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCuentaModal(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" className="flex-1" disabled={savingCuenta}><Save size={14} className="mr-2" />{savingCuenta ? 'Guardando...' : 'Guardar'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ════════ ASISTENCIA ════════ */}
      {tab === 'asistencia' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 border-l-4 border-blue-500 pl-3">Tolerancia de Horario</h2>
            <p className="text-zinc-600 text-xs mt-1 ml-4">Configura los minutos de gracia antes de aplicar sanción por llegada tarde.</p>
          </div>
          
          <Card className="bg-zinc-900 border-white/5 hover:border-blue-500/20 transition-all max-w-lg">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <Clock className="text-blue-500 w-8 h-8" />
                <div>
                  <p className="font-black text-white uppercase">Minutos de Tolerancia</p>
                  <p className="text-zinc-500 text-xs">Ej. 15 minutos = Si entra a las 9:16 se sanciona.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input 
                  type="number" 
                  min={0} 
                  max={60} 
                  value={asistenciaConfig.tolerancia_minutos}
                  onChange={e => setAsistenciaConfig(p => ({ ...p, tolerancia_minutos: Number(e.target.value) || 0 }))}
                  className="w-24 h-14 bg-zinc-950 border border-white/10 rounded-xl px-4 text-center text-blue-400 font-black text-2xl outline-none focus:border-blue-500/50" 
                />
                <span className="text-zinc-400 font-bold">Minutos</span>
              </div>
              <Button variant="primary" className="w-full h-12 font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500" onClick={saveAsistencia} disabled={savingAsistencia}>
                <Save size={18} className="mr-2" /> {savingAsistencia ? 'Guardando...' : 'Guardar'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
