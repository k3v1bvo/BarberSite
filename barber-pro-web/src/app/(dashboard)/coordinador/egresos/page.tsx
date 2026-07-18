'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { ArrowDownCircle, Plus, X, FileText, Search, User, Building, Wallet, Landmark, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { useToast } from '@/components/ui/Toast'

interface PlanCuenta { id?: string; codigo: string; detalle: string; tipo: string }
interface Egreso {
  id: string; fecha: string; concepto: string; proveedor: string | null
  monto_bruto: number; tiene_factura: boolean; iva: number; it: number
  monto_neto: number; numero_factura: string | null; cuenta_codigo: string | null
  creado_en: string; metodo_pago?: string; monto_qr?: number; monto_efectivo?: number; comprobante_url?: string | null
}

interface Profile {
  id: string
  full_name: string
  role: string
  avatar_url: string | null
}

export default function EgresosPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [cuentas, setCuentas] = useState<PlanCuenta[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [periodo, setPeriodo] = useState<'todos' | 'hoy' | 'semana' | 'mes' | 'custom'>('hoy')
  const [customDesde, setCustomDesde] = useState('')
  const [customHasta, setCustomHasta] = useState('')
  const [search, setSearch] = useState('')
  const [filtroMetodo, setFiltroMetodo] = useState<'todos' | 'efectivo' | 'qr'>('todos')

  const [destinatarioTipo, setDestinatarioTipo] = useState<'proveedor' | 'barbero'>('proveedor')
  const [barberoId, setBarberoId] = useState('')

  const [form, setForm] = useState({
    concepto: '', proveedor: '', monto_bruto: '', cuenta_codigo: '',
    tiene_factura: false, numero_factura: '', notas: '', metodo_pago: 'efectivo',
    monto_efectivo: '', monto_qr: '', comprobante_url: ''
  })
  
  const [searchCategoria, setSearchCategoria] = useState('')
  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false)
  const [showNewCategoria, setShowNewCategoria] = useState(false)
  const [newCategoriaNombre, setNewCategoriaNombre] = useState('')
  const [newCategoriaCodigo, setNewCategoriaCodigo] = useState('')
  const [savingCategoria, setSavingCategoria] = useState(false)
  
  // QR Modal
  const [selectedEgresoQr, setSelectedEgresoQr] = useState<any | null>(null)
  const [qrModalUrl, setQrModalUrl] = useState('')
  const [savingQr, setSavingQr] = useState(false)

  const supabase = createClient()

  const getTodayBolivia = () => {
    const d = new Date()
    const boliviaTime = new Date(d.toLocaleString('en-US', { timeZone: 'America/La_Paz' }))
    return `${boliviaTime.getFullYear()}-${String(boliviaTime.getMonth() + 1).padStart(2, '0')}-${String(boliviaTime.getDate()).padStart(2, '0')}`
  }

  const formatLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const getDateRange = useCallback((): { desde?: string, hasta?: string } => {
    const now = new Date()
    const todayStr = getTodayBolivia()
    if (periodo === 'todos') return {}
    if (periodo === 'hoy') return { desde: todayStr, hasta: todayStr }
    if (periodo === 'semana') {
      const d = new Date(now)
      d.setDate(d.getDate() - d.getDay())
      return { desde: formatLocal(d), hasta: todayStr }
    }
    if (periodo === 'mes') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1)
      return { desde: formatLocal(d), hasta: todayStr }
    }
    return { desde: customDesde || todayStr, hasta: customHasta || todayStr }
  }, [periodo, customDesde, customHasta])

  const periodoLabel = periodo === 'todos' ? '(todos los egresos)' : periodo === 'hoy' ? 'de hoy' : periodo === 'semana' ? 'de la semana' : periodo === 'mes' ? 'del mes' : `${customDesde} → ${customHasta}`

  const loadData = useCallback(async () => {
    const { desde, hasta } = getDateRange()
    const params = new URLSearchParams()
    if (desde) params.append('desde', desde)
    if (hasta) params.append('hasta', hasta)
    params.append('limit', '500')

    const [eRes, ctasRes, profRes] = await Promise.all([
      fetch(`/api/egresos?${params.toString()}`),
      fetch('/api/plan-cuentas'),
      supabase.from('profiles').select('id, full_name, role, avatar_url').in('role', ['barbero', 'admin', 'coordinador']).eq('is_active', true).order('full_name')
    ])
    if (eRes.ok) setEgresos(await eRes.json())
    if (ctasRes.ok) {
      const all = await ctasRes.json()
      setCuentas(all.filter((c: PlanCuenta) => c.tipo === 'EGRESO'))
    }
    if (profRes.data) setProfiles(profRes.data)
    setLoading(false)
  }, [supabase, getDateRange])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveQrModal = async () => {
    if (!selectedEgresoQr) return
    setSavingQr(true)
    const res = await fetch('/api/egresos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedEgresoQr.id,
        comprobante_url: qrModalUrl || null,
      }),
    })
    if (res.ok) {
      toastSuccess('Comprobante guardado exitosamente ✅')
      setSelectedEgresoQr(null)
      setQrModalUrl('')
      loadData()
    } else {
      toastError('Error al guardar el comprobante')
    }
    setSavingQr(false)
  }

  const getNivel = (codigo: string) => codigo.split('.').length
  const getGrupo = (codigo: string): string => {
    const first = codigo.charAt(0)
    if (first === '4' || codigo.toUpperCase().startsWith('ING')) return 'INGRESO'
    if (first === '5' || codigo.toUpperCase().startsWith('EGR')) return 'EGRESO'
    if (first === '1') return 'ACTIVO'
    if (first === '2') return 'PASIVO'
    if (first === '3') return 'PATRIMONIO'
    return 'OTRO'
  }

  const getGrupoColor = (grupo: string) => {
    switch(grupo) {
      case 'INGRESO': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      case 'EGRESO': return 'text-red-400 bg-red-500/10 border-red-500/30'
      case 'ACTIVO': return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
      default: return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30'
    }
  }

  const categoriasFiltradas = cuentas
    .filter((c) => {
      if (!searchCategoria) return true
      return c.detalle.toLowerCase().includes(searchCategoria.toLowerCase()) ||
             c.codigo.toLowerCase().includes(searchCategoria.toLowerCase())
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))

  const selectCategoria = (cat: PlanCuenta) => {
    setForm({ ...form, cuenta_codigo: cat.codigo })
    setSearchCategoria(`${cat.codigo} — ${cat.detalle}`)
    setShowCategoriaDropdown(false)
  }

  const sugerirSiguienteEgreso = () => {
    const numericos = cuentas
      .filter(c => c.codigo.startsWith('5.'))
      .map(c => {
        const p = c.codigo.split('.')
        return parseInt(p[1]) || 0
      })
    const max = numericos.length > 0 ? Math.max(...numericos) : 0
    return `5.${max + 1}`
  }

  const sugerirSubcategoria = (parentCodigo: string) => {
    const hijos = cuentas.filter(c => c.codigo.startsWith(parentCodigo + '.'))
    let maxNum = 0
    hijos.forEach(h => {
      const remainder = h.codigo.slice(parentCodigo.length + 1)
      const num = parseInt(remainder.split('.')[0], 10)
      if (!isNaN(num) && num > maxNum) maxNum = num
    })
    return `${parentCodigo}.${maxNum + 1}`
  }

  const crearNuevaCategoria = async () => {
    if (!newCategoriaNombre.trim()) return
    setSavingCategoria(true)
    try {
      let codigo = newCategoriaCodigo.trim()
      if (!codigo) {
        codigo = sugerirSiguienteEgreso()
      }
      const tipo = 'EGRESO'
      const nivel = codigo.split('.').length

      const { data: nueva, error: err } = await supabase
        .from('plan_cuentas')
        .insert({ codigo, detalle: newCategoriaNombre.trim(), tipo, nivel, es_sancion: false })
        .select('*')
        .single()
      if (err) throw err
      setCuentas(prev => [...prev, nueva])
      selectCategoria(nueva)
      setShowNewCategoria(false)
      setNewCategoriaNombre('')
      setNewCategoriaCodigo('')
      toastSuccess('Categoría creada exitosamente ✅')
    } catch (err) {
      console.error(err)
      toastError('Error al crear categoría')
    } finally {
      setSavingCategoria(false)
    }
  }

  const handleBarberoSelect = (bId: string) => {
    setBarberoId(bId)
    const prof = profiles.find(p => p.id === bId)
    if (prof) {
      setForm(prev => ({
        ...prev,
        proveedor: prof.full_name,
        concepto: prev.concepto || `Anticipo/Préstamo — ${prof.full_name}`
      }))
    } else {
      setForm(prev => ({ ...prev, proveedor: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const provFinal = destinatarioTipo === 'barbero' 
      ? (profiles.find(p => p.id === barberoId)?.full_name || form.proveedor)
      : form.proveedor

    const res = await fetch('/api/egresos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concepto: form.concepto,
        proveedor: provFinal || null,
        monto_bruto: parseFloat(form.monto_bruto) || 0,
        cuenta_codigo: form.cuenta_codigo || null,
        tiene_factura: form.tiene_factura,
        numero_factura: form.numero_factura || null,
        notas: form.notas || null,
        metodo_pago: form.metodo_pago,
        monto_efectivo: form.metodo_pago === 'mixto' ? parseFloat(form.monto_efectivo) || 0 : (form.metodo_pago === 'efectivo' ? parseFloat(form.monto_bruto) || 0 : 0),
        monto_qr: form.metodo_pago === 'mixto' ? parseFloat(form.monto_qr) || 0 : (form.metodo_pago === 'qr' || form.metodo_pago === 'tarjeta' ? parseFloat(form.monto_bruto) || 0 : 0),
        comprobante_url: form.comprobante_url || null,
      }),
    })
    if (res.ok) {
      toastSuccess('Egreso registrado exitosamente ✅')
      setShowForm(false)
      setForm({ concepto: '', proveedor: '', monto_bruto: '', cuenta_codigo: '', tiene_factura: false, numero_factura: '', notas: '', metodo_pago: 'efectivo', monto_efectivo: '', monto_qr: '', comprobante_url: '' })
      setBarberoId('')
      setDestinatarioTipo('proveedor')
      setSearchCategoria('')
      loadData()
    } else {
      const err = await res.json().catch(() => ({}))
      toastError(`Error al guardar el egreso: ${err.error || res.statusText}`)
    }
    setSaving(false)
  }

  const getMontosEgreso = (e: Egreso) => {
    const mpLower = String(e.metodo_pago || 'efectivo').toLowerCase()
    const num = Number(e.monto_neto || 0)
    if (mpLower === 'efectivo') return { ef: num, qr: 0 }
    if (['qr', 'tarjeta', 'transferencia', 'banco'].includes(mpLower)) return { ef: 0, qr: num }
    if (mpLower === 'mixto') {
      return {
        ef: Number(e.monto_efectivo || 0),
        qr: Number(e.monto_qr || 0)
      }
    }
    return { ef: num, qr: 0 }
  }

  const egresosFiltrados = egresos.filter(e => {
    if (filtroMetodo !== 'todos') {
      const mpLower = String(e.metodo_pago || 'efectivo').toLowerCase()
      if (filtroMetodo === 'efectivo' && mpLower !== 'efectivo') return false
      if (filtroMetodo === 'qr' && !['qr', 'tarjeta', 'transferencia', 'banco'].includes(mpLower)) return false
    }
    if (!search) return true
    const q = search.toLowerCase()
    return (e.concepto || '').toLowerCase().includes(q)
      || (e.proveedor || '').toLowerCase().includes(q)
      || (e.cuenta_codigo || '').toLowerCase().includes(q)
  })

  let totalNeto = 0
  let totalEfectivo = 0
  let totalQr = 0
  let totalImpuestos = 0

  egresosFiltrados.forEach(e => {
    totalNeto += Number(e.monto_neto || 0)
    const { ef, qr } = getMontosEgreso(e)
    totalEfectivo += ef
    totalQr += qr
    totalImpuestos += Number(e.iva || 0) + Number(e.it || 0)
  })

  // Cálculo en vivo fiscal para la vista
  const montoBrutoNum = parseFloat(form.monto_bruto) || 0
  const ivaCalculado = form.tiene_factura ? montoBrutoNum * 0.13 : 0
  const itCalculado = form.tiene_factura ? montoBrutoNum * 0.03 : 0
  const montoNetoCalculado = montoBrutoNum - ivaCalculado - itCalculado

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-rose-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            Control de <span className="text-rose-500">Egresos</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Gastos con o sin factura, anticipos al personal y pagos a proveedores · {periodoLabel}</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="primary"
            onClick={() => setShowForm(!showForm)}
            className="gap-2 font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-500/20"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cerrar Formulario' : 'Nuevo Egreso'}
          </Button>
        </div>
      </div>

      {/* Filtro de Periodo y Búsqueda */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 bg-zinc-950 border border-white/10 rounded-xl p-1 flex-wrap">
            {(['todos', 'hoy', 'semana', 'mes', 'custom'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                  periodo === p ? 'bg-rose-500/20 text-rose-400' : 'text-zinc-500 hover:text-white'
                }`}
              >
                {p === 'todos' ? '📋 Todo' : p === 'hoy' ? '📅 Hoy' : p === 'semana' ? '📆 Semana' : p === 'mes' ? '🗓 Mes' : '📊 Rango'}
              </button>
            ))}
          </div>
          {periodo === 'custom' && (
            <div className="flex gap-2 items-center animate-in fade-in duration-200">
              <input type="date" value={customDesde} onChange={e => setCustomDesde(e.target.value)}
                className="h-9 bg-zinc-950 border border-white/10 rounded-lg px-3 text-xs text-white focus:border-rose-500/50 outline-none" />
              <span className="text-zinc-600 text-xs">→</span>
              <input type="date" value={customHasta} onChange={e => setCustomHasta(e.target.value)}
                className="h-9 bg-zinc-950 border border-white/10 rounded-lg px-3 text-xs text-white focus:border-rose-500/50 outline-none" />
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-stretch sm:items-center">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por concepto o proveedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 bg-zinc-950 border border-white/10 rounded-lg pl-9 pr-3 text-xs text-white focus:border-rose-500/50 outline-none"
            />
          </div>
          <div className="flex gap-1 bg-zinc-950 border border-white/10 rounded-xl p-1">
            {(['todos', 'efectivo', 'qr'] as const).map(m => (
              <button
                key={m}
                onClick={() => setFiltroMetodo(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                  filtroMetodo === m
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'text-zinc-500 hover:text-white'
                }`}
              >
                {m === 'todos' ? 'Todos' : m === 'efectivo' ? '💵 Efectivo' : '📱 QR/Banco'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4 KPIs Clave del Periodo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-rose-500/30 bg-rose-500/10">
          <CardContent className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center shrink-0">
              <ArrowDownCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-rose-400">Total Neto Egresos</p>
              <p className="text-lg font-black text-rose-400">{formatCurrency(totalNeto)}</p>
              <p className="text-[9px] text-rose-400/70 font-mono">{egresosFiltrados.length} registros en periodo</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Efectivo (Caja Chica)</p>
              <p className="text-lg font-black text-amber-400">{formatCurrency(totalEfectivo)}</p>
              <p className="text-[9px] text-amber-400/70 font-mono">Salida física de caja</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/30 bg-blue-500/10">
          <CardContent className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">QR / Transf. (Banco)</p>
              <p className="text-lg font-black text-blue-400">{formatCurrency(totalQr)}</p>
              <p className="text-[9px] text-blue-400/70 font-mono">Salida digital de banco</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/10">
          <CardContent className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Crédito Fiscal (IVA+IT)</p>
              <p className="text-lg font-black text-emerald-400">{formatCurrency(totalImpuestos)}</p>
              <p className="text-[9px] text-emerald-400/70 font-mono">Recuperable facturas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FORMULARIO PREMIUM MEJORADO PARA NUEVO EGRESO */}
      {showForm && (
        <Card className="border-rose-500/40 bg-zinc-900/95 shadow-2xl animate-in slide-in-from-top-3 duration-300 overflow-hidden">
          <div className="bg-gradient-to-r from-rose-500/10 via-transparent to-transparent px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/20 text-rose-400">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wide">
                  Registrar Salida / Gasto (Caja Chica o Banco)
                </h3>
                <p className="text-xs text-zinc-400">
                  Desglosa exactamente a quién se pagó, el método y si cuenta con crédito fiscal
                </p>
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Paso 1: Destinatario (Personal vs Proveedor) */}
              <div className="space-y-3 bg-zinc-950/80 p-4 rounded-xl border border-white/5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                  1. ¿A quién se realiza o destina este pago / egreso?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-white">
                    <input
                      type="radio"
                      name="dest_tipo"
                      checked={destinatarioTipo === 'proveedor'}
                      onChange={() => {
                        setDestinatarioTipo('proveedor')
                        setBarberoId('')
                        setForm(f => ({ ...f, proveedor: '' }))
                      }}
                      className="accent-rose-500 w-4 h-4"
                    />
                    <Building className="w-4 h-4 text-emerald-400" />
                    <span>Proveedor / Servicio Externo / Gasto Local</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-white">
                    <input
                      type="radio"
                      name="dest_tipo"
                      checked={destinatarioTipo === 'barbero'}
                      onChange={() => {
                        setDestinatarioTipo('barbero')
                        if (profiles.length > 0) handleBarberoSelect(profiles[0].id)
                      }}
                      className="accent-rose-500 w-4 h-4"
                    />
                    <User className="w-4 h-4 text-blue-400" />
                    <span>Barbero / Personal del Equipo</span>
                  </label>
                </div>

                {destinatarioTipo === 'barbero' ? (
                  <div className="space-y-4 pt-2">
                    {/* Tarjetas visuales del equipo */}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">
                        Selecciona el Barbero o Miembro del Equipo
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {profiles.map(p => {
                          const isSelected = barberoId === p.id
                          const initials = p.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleBarberoSelect(p.id)}
                              className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                                isSelected
                                  ? 'border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/10'
                                  : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600 hover:bg-zinc-900'
                              }`}
                            >
                              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-zinc-700 shrink-0">
                                {p.avatar_url ? (
                                  <img src={p.avatar_url} alt={p.full_name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                    <span className="text-sm font-black text-zinc-400">{initials}</span>
                                  </div>
                                )}
                              </div>
                              <div className="text-center min-w-0 w-full">
                                <p className={`text-xs font-black truncate ${isSelected ? 'text-rose-300' : 'text-white'}`}>{p.full_name.split(' ')[0]}</p>
                                <p className="text-[9px] uppercase tracking-widest text-zinc-500">{p.role}</p>
                              </div>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Concepto rápido cuando hay barbero seleccionado */}
                    {barberoId && (
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                          Concepto Rápido — {profiles.find(p => p.id === barberoId)?.full_name}
                        </label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              setForm(f => ({ ...f, concepto: `${e.target.value} — ${f.proveedor || ''}` }))
                            }
                          }}
                          className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-rose-500/50 outline-none"
                        >
                          <option value="">— Elegir tipo de egreso —</option>
                          <option value="Anticipo / Adelanto de Sueldo">💵 Adelanto / Préstamo de Sueldo</option>
                          <option value="Pago de Comisiones Pendientes">✂️ Pago de Comisiones del Periodo</option>
                          <option value="Bono / Premio o Incentivo">🏆 Bono o Premio por Desempeño</option>
                          <option value="Compra de Herramientas / Insumos para Barbero">🛠️ Herramientas / Insumos de Barbero</option>
                          <option value="Pago de Sueldo Fijo">📅 Sueldo Fijo del Periodo</option>
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                        Nombre del Proveedor / Beneficiario
                      </label>
                      <input
                        placeholder="Ej: Propietario Local / ELFEC / Insumos Barber"
                        value={form.proveedor}
                        onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                        className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-rose-500/50 outline-none"
                      />
                    </div>

                    <div className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Categoría / Cuenta Contable</label>
                        <button type="button" onClick={() => setShowNewCategoria(!showNewCategoria)}
                          className="text-[10px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors">
                          <Plus size={10} /> Nueva Categoría
                        </button>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <input
                          className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-8 text-sm text-white focus:border-rose-500/50 outline-none"
                          placeholder="Buscar por código o nombre de cuenta..."
                          value={searchCategoria}
                          onChange={e => {
                            setSearchCategoria(e.target.value)
                            setShowCategoriaDropdown(true)
                            if (!e.target.value) setForm({ ...form, cuenta_codigo: '' })
                          }}
                          onFocus={() => setShowCategoriaDropdown(true)}
                        />
                        {searchCategoria && (
                          <button type="button" onClick={() => { setSearchCategoria(''); setForm({ ...form, cuenta_codigo: '' }) }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                            <X size={14} />
                          </button>
                        )}
                        {showCategoriaDropdown && (
                          <div className="absolute z-20 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                            {categoriasFiltradas.length > 0 ? (
                              categoriasFiltradas.map(cat => {
                                const nivel = getNivel(cat.codigo)
                                const grupo = getGrupo(cat.codigo)
                                const grupoColor = getGrupoColor(grupo)
                                const indent = Math.min((nivel - 1) * 16, 48)
                                return (
                                  <div key={cat.id || cat.codigo} className={`group flex items-center gap-2 pr-1 hover:bg-white/5 transition-colors ${
                                      form.cuenta_codigo === cat.codigo ? 'bg-rose-500/10 border-l-2 border-rose-500' : ''
                                    }`}
                                    style={{ paddingLeft: `${12 + indent}px` }}
                                  >
                                    <button type="button" onClick={() => selectCategoria(cat)}
                                      className="flex-1 flex items-center gap-2 py-2 text-left min-w-0"
                                    >
                                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${grupoColor}`}>
                                        {grupo === 'EGRESO' ? '↓' : '•'}
                                      </span>
                                      <span className="text-zinc-500 text-[11px] font-mono shrink-0 w-16">{cat.codigo}</span>
                                      <span className="text-sm truncate text-zinc-200 font-medium">{cat.detalle}</span>
                                    </button>
                                  </div>
                                )
                              })
                            ) : (
                              <div className="px-4 py-3 text-zinc-500 text-sm">
                                Sin resultados.{' '}
                                <button type="button" onClick={() => { setShowNewCategoria(true); setNewCategoriaNombre(searchCategoria); setNewCategoriaCodigo(sugerirSiguienteEgreso()) }}
                                  className="text-amber-500 font-bold hover:underline">
                                  Crear "{searchCategoria}"
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Crear nueva categoría inline */}
              {showNewCategoria && (
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase text-amber-500 tracking-widest">Crear Nueva Categoría de Egreso</p>
                    <button type="button" onClick={() => setShowNewCategoria(false)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input placeholder="Nombre de la cuenta / categoría *" value={newCategoriaNombre} onChange={e => setNewCategoriaNombre(e.target.value)}
                      className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white outline-none focus:border-amber-500/50" />
                    <input placeholder="Código contable (ej: 5.1.1)" value={newCategoriaCodigo} onChange={e => setNewCategoriaCodigo(e.target.value)}
                      className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white font-mono outline-none focus:border-amber-500/50" />
                  </div>
                  <Button type="button" onClick={crearNuevaCategoria} disabled={savingCategoria || !newCategoriaNombre.trim()}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-black font-black h-10 text-xs uppercase tracking-widest">
                    <Plus size={14} className="mr-2" /> {savingCategoria ? 'Creando...' : 'Crear Categoría y Seleccionar'}
                  </Button>
                </div>
              )}

              {/* Paso 2: Concepto / Descripción y Monto Bruto */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                    2. Concepto / Detalle Específico del Egreso
                  </label>
                  <input
                    placeholder="Ej: Pago de factura de luz mes de julio / Adelanto quincenal en efectivo..."
                    value={form.concepto}
                    onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-rose-500/50 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                    Monto Bruto Total (Bs.)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={form.monto_bruto}
                      onChange={(e) => setForm({ ...form, monto_bruto: e.target.value })}
                      className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl pl-4 pr-10 text-base font-black text-white focus:border-rose-500/50 outline-none"
                      required
                    />
                    <span className="absolute right-3 top-3 text-xs font-bold text-zinc-500">Bs.</span>
                  </div>
                </div>
              </div>

              {/* Paso 3: Método de Pago (Caja Chica vs Banco) */}
              <div className="space-y-3 bg-zinc-950/80 p-4 rounded-xl border border-white/5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                  3. ¿De dónde sale el dinero? (Método de Pago)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, metodo_pago: 'efectivo' }))}
                    className={`flex items-center justify-center gap-2 h-12 rounded-xl border font-bold text-xs uppercase tracking-wide transition-all ${
                      form.metodo_pago === 'efectivo'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/10'
                        : 'bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Wallet className="w-4 h-4" /> Efectivo (Caja Chica)
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, metodo_pago: 'qr' }))}
                    className={`flex items-center justify-center gap-2 h-12 rounded-xl border font-bold text-xs uppercase tracking-wide transition-all ${
                      form.metodo_pago === 'qr'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10'
                        : 'bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Landmark className="w-4 h-4" /> QR / Transf. (Banco)
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, metodo_pago: 'mixto' }))}
                    className={`flex items-center justify-center gap-2 h-12 rounded-xl border font-bold text-xs uppercase tracking-wide transition-all ${
                      form.metodo_pago === 'mixto'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/10'
                        : 'bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    🔀 Pago Mixto
                  </button>
                </div>

                {form.metodo_pago === 'mixto' && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5 animate-in fade-in duration-200">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Monto en Efectivo (Bs.)</label>
                      <input
                        type="number" step="0.01" min="0" placeholder="0.00"
                        value={form.monto_efectivo}
                        onChange={(e) => setForm({ ...form, monto_efectivo: e.target.value })}
                        className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-amber-500/50 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Monto en QR / Banco (Bs.)</label>
                      <input
                        type="number" step="0.01" min="0" placeholder="0.00"
                        value={form.monto_qr}
                        onChange={(e) => setForm({ ...form, monto_qr: e.target.value })}
                        className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-amber-500/50 outline-none"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Paso 4: Factura y Crédito Fiscal */}
              <div className="space-y-3 bg-zinc-950/80 p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer text-sm font-bold text-white">
                    <input
                      type="checkbox"
                      checked={form.tiene_factura}
                      onChange={(e) => setForm({ ...form, tiene_factura: e.target.checked })}
                      className="accent-rose-500 w-5 h-5 rounded"
                    />
                    <FileText className="w-5 h-5 text-rose-400" />
                    <span>¿El proveedor emite Factura? (Con Crédito Fiscal IVA 13% e IT 3%)</span>
                  </label>
                </div>

                {form.tiene_factura && (
                  <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Número de Factura / NIT</label>
                        <input
                          placeholder="Ej: F-0012345"
                          value={form.numero_factura}
                          onChange={(e) => setForm({ ...form, numero_factura: e.target.value })}
                          className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-rose-500/50 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Notas / Glosa Tributaria</label>
                        <input
                          placeholder="Ej: Compra facturada a nombre de la empresa..."
                          value={form.notas}
                          onChange={(e) => setForm({ ...form, notas: e.target.value })}
                          className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-rose-500/50 outline-none"
                        />
                      </div>
                    </div>

                    {/* Desglose Fiscal Visual */}
                    {montoBrutoNum > 0 && (
                      <div className="grid grid-cols-3 gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                        <div>
                          <span className="text-[9px] font-black uppercase text-zinc-400 block">Crédito IVA (13%)</span>
                          <span className="text-xs font-black text-rose-300">-{formatCurrency(ivaCalculado)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black uppercase text-zinc-400 block">Crédito IT (3%)</span>
                          <span className="text-xs font-black text-rose-300">-{formatCurrency(itCalculado)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black uppercase text-zinc-400 block">Monto Neto a Gasto</span>
                          <span className="text-xs font-black text-emerald-300">{formatCurrency(montoNetoCalculado)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Paso 5: Comprobante / Foto (Opcional) */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">
                  4. Adjuntar Comprobante / Recibo / Factura (Opcional)
                </label>
                <ImageUpload
                  label="Subir foto del recibo, transferencia QR o factura en formato JPG/PNG"
                  defaultImage={form.comprobante_url || undefined}
                  onUploadSuccess={(url) => setForm({ ...form, comprobante_url: url })}
                  onUploadError={(err) => toastError(err)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving || !form.monto_bruto || parseFloat(form.monto_bruto) <= 0}
                  className="px-8 font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-500"
                >
                  {saving ? 'Registrando Egreso...' : 'Confirmar y Guardar Gasto'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TABLA PRINCIPAL DE EGRESOS */}
      <Card className="border-white/5 bg-zinc-900/50 overflow-hidden shadow-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left bg-zinc-950/40">
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Fecha</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Concepto / Categoría</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Proveedor / Destinatario</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Bruto</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Factura (IVA+IT)</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Neto a Gasto</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Método / Comprobante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {egresosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-zinc-600 font-medium">
                      No hay egresos o salidas de dinero para el filtro seleccionado
                    </td>
                  </tr>
                ) : (
                  egresosFiltrados.map((e) => {
                    const conFactura = e.tiene_factura
                    const iva = Number(e.iva || 0)
                    const it = Number(e.it || 0)
                    const impuestos = iva + it

                    return (
                      <tr key={e.id} className="hover:bg-white/[0.03] transition-colors group">
                        <td className="px-5 py-4 text-zinc-400 whitespace-nowrap text-xs font-medium">{e.fecha}</td>
                        <td className="px-5 py-4 text-white font-bold text-sm">
                          {e.concepto}
                          {e.cuenta_codigo && (
                            <span className="block text-[10px] font-mono text-zinc-500 mt-0.5">Ref: {e.cuenta_codigo}</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-zinc-300 font-medium text-xs">
                          {e.proveedor || '—'}
                        </td>
                        <td className="px-5 py-4 text-right font-black text-white whitespace-nowrap">
                          {formatCurrency(Number(e.monto_bruto))}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          {conFactura ? (
                            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                              -{formatCurrency(impuestos)} (F: {e.numero_factura || 'S/N'})
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-xs">Sin Factura</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-black text-rose-400 text-base whitespace-nowrap">
                          {formatCurrency(Number(e.monto_neto))}
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                              e.metodo_pago === 'qr'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : e.metodo_pago === 'mixto'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {e.metodo_pago ? e.metodo_pago.toUpperCase() : 'EFECTIVO'}
                            </span>

                            {e.comprobante_url ? (
                              <a
                                href={e.comprobante_url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-bold"
                                title="Ver comprobante adjunto"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <button
                                onClick={() => { setSelectedEgresoQr(e); setQrModalUrl('') }}
                                className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors text-xs"
                                title="Adjuntar comprobante posterior"
                              >
                                + Voucher
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal para adjuntar voucher a un egreso anterior */}
      {selectedEgresoQr && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white uppercase">Adjuntar Comprobante / Factura</h3>
              <button onClick={() => setSelectedEgresoQr(null)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-zinc-400">Egreso: <strong className="text-white">{selectedEgresoQr.concepto}</strong></p>
            <ImageUpload
              label="Subir voucher de transferencia QR o foto del recibo/factura"
              defaultImage={qrModalUrl || undefined}
              onUploadSuccess={(url) => setQrModalUrl(url)}
              onUploadError={(err) => toastError(err)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSelectedEgresoQr(null)}>Cancelar</Button>
              <Button variant="primary" onClick={handleSaveQrModal} disabled={savingQr || !qrModalUrl}>
                {savingQr ? 'Guardando...' : 'Guardar Comprobante'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
