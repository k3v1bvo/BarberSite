'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Wallet, Plus, X, User, Image as ImageIcon, ArrowUpCircle, ArrowDownCircle, Search, TrendingUp, TrendingDown, Scale, ShoppingCart, Receipt, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { ImageUpload } from '@/components/ui/ImageUpload'
import Link from 'next/link'

interface PlanCuenta {
  id: string
  codigo: string
  detalle: string
  tipo: string
  nivel?: number
  es_sancion?: boolean
}

interface Transaction {
  id: string
  fecha: string
  ci: string
  nombre: string
  cuenta_codigo: string
  cuenta_detalle: string
  glosa: string
  costo: number
  tipo_movimiento: string
  es_sancion: boolean
  metodo_pago: string | null
  comprobante_url: string | null
  usuario_registro: string
  libro: string
  subcategoria: string | null
  notas: string | null
  empleado_id: string | null
  cliente_id: string | null
  cita_id: string | null
  creado_en: string
}

export default function CajaChicaPage() {
  const supabase = createClient()
  const { success: toastSuccess, error: toastError } = useToast()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cuentas, setCuentas] = useState<PlanCuenta[]>([])
  const [barberos, setBarberos] = useState<{id: string, full_name: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [periodo, setPeriodo] = useState<'todos' | 'hoy' | 'semana' | 'mes' | 'custom'>('hoy')
  const [customDesde, setCustomDesde] = useState('')
  const [customHasta, setCustomHasta] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'INGRESO' | 'EGRESO'>('todos')
  const [sortKey, setSortKey] = useState<'fecha' | 'nombre' | 'cuenta_detalle' | 'costo' | 'metodo_pago'>('fecha')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Crear nueva categoría
  const [showNewCategoria, setShowNewCategoria] = useState(false)
  const [newCategoriaNombre, setNewCategoriaNombre] = useState('')
  const [newCategoriaCodigo, setNewCategoriaCodigo] = useState('')
  const [savingCategoria, setSavingCategoria] = useState(false)
  
  // Search categoria
  const [searchCategoria, setSearchCategoria] = useState('')
  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false)
  const categoriaRef = useRef<HTMLDivElement>(null)

  const hoy = new Date().toISOString().split('T')[0]

  // Calcular rango de fechas según periodo
  const getDateRange = (): { desde?: string, hasta?: string } => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    if (periodo === 'todos') return {} // sin filtro de fecha
    if (periodo === 'hoy') return { desde: todayStr, hasta: todayStr }
    if (periodo === 'semana') {
      const d = new Date(now)
      d.setDate(d.getDate() - d.getDay()) // domingo
      return { desde: d.toISOString().split('T')[0], hasta: todayStr }
    }
    if (periodo === 'mes') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1)
      return { desde: d.toISOString().split('T')[0], hasta: todayStr }
    }
    // custom
    return { desde: customDesde || todayStr, hasta: customHasta || todayStr }
  }

  const periodoLabel = periodo === 'todos' ? '(todos los registros)' : periodo === 'hoy' ? 'de hoy' : periodo === 'semana' ? 'de la semana' : periodo === 'mes' ? 'del mes' : `${customDesde} → ${customHasta}`

  const [form, setForm] = useState({
    direccion: '' as 'INGRESO' | 'EGRESO' | '',
    empleado_id: '',
    ci: '',
    nombre: '',
    cuenta_codigo: '',
    cuenta_detalle: '',
    glosa: '',
    costo: '',
    metodo_pago: 'efectivo',
    libro: 'CAJA_CHICA',
    notas: '',
    mixto_efectivo: '', mixto_qr: '', mixto_tarjeta: '',
    comprobante_url: '' as string | null,
  })

  // Derivar dirección del código contable
  const getDireccionFromCodigo = (codigo: string): 'INGRESO' | 'EGRESO' | '' => {
    const c = codigo.trim()
    if (c.startsWith('4') || c.toUpperCase().startsWith('ING')) return 'INGRESO'
    if (c.startsWith('5') || c.toUpperCase().startsWith('EGR')) return 'EGRESO'
    // Codes 1.x (activos) are typically movements where cash enters (ingresos operativos)
    // But we let the user see it as-is, default to empty
    return ''
  }

  const formDireccion = getDireccionFromCodigo(form.cuenta_codigo)

  // Click outside to close categoria dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoriaRef.current && !categoriaRef.current.contains(e.target as Node)) {
        setShowCategoriaDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', '500')
    if (search) params.set('search', search)
    const { desde, hasta } = getDateRange()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)

    const [txRes, ctasRes] = await Promise.all([
      fetch(`/api/transactions?${params.toString()}`),
      fetch('/api/plan-cuentas'),
    ])
    if (txRes.ok) setTransactions(await txRes.json())
    if (ctasRes.ok) setCuentas(await ctasRes.json())
    
    const { data: bList } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['barbero', 'coordinador'])
      .eq('is_active', true)
    if (bList) setBarberos(bList)
      
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, periodo, customDesde, customHasta])

  useEffect(() => {
    const delay = setTimeout(() => { loadData() }, 400)
    return () => clearTimeout(delay)
  }, [loadData])

  // Agrupar categorías jerárquicamente por código
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

  // Categorías filtradas por texto de búsqueda, ordenadas por código
  const categoriasFiltradas = cuentas
    .filter((c) => {
      if (!searchCategoria) return true
      return c.detalle.toLowerCase().includes(searchCategoria.toLowerCase()) ||
             c.codigo.toLowerCase().includes(searchCategoria.toLowerCase())
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))

  const selectCategoria = (cat: PlanCuenta) => {
    setForm({ ...form, cuenta_codigo: cat.codigo, cuenta_detalle: cat.detalle })
    setSearchCategoria(`${cat.codigo} — ${cat.detalle}`)
    setShowCategoriaDropdown(false)
  }

  // Generar el siguiente código en la jerarquía
  const generarSiguienteCodigo = (parentCodigo: string) => {
    // Buscar hijos directos del padre
    const hijos = cuentas
      .filter(c => c.codigo.startsWith(parentCodigo + '.') && c.codigo.split('.').length === parentCodigo.split('.').length + 1)
      .map(c => {
        const parts = c.codigo.split('.')
        return parseInt(parts[parts.length - 1]) || 0
      })
    const siguiente = hijos.length > 0 ? Math.max(...hijos) + 1 : 1
    return `${parentCodigo}.${siguiente}`
  }

  const crearNuevaCategoria = async () => {
    if (!newCategoriaNombre.trim()) return
    setSavingCategoria(true)
    try {
      let codigo = newCategoriaCodigo.trim()
      if (!codigo) {
        // Auto-generar código basado en la dirección seleccionada
        if (form.cuenta_codigo) {
          // Si hay una cuenta padre seleccionada, crear como hijo
          codigo = generarSiguienteCodigo(form.cuenta_codigo)
        } else if (form.direccion === 'INGRESO') {
          // Ingresos van bajo 4.x
          codigo = generarSiguienteCodigo('4')
        } else if (form.direccion === 'EGRESO') {
          // Egresos van bajo 5.x
          codigo = generarSiguienteCodigo('5')
        } else {
          codigo = generarSiguienteCodigo('5')
        }
      }

      const grupo = getGrupo(codigo)
      const tipo = grupo === 'INGRESO' ? 'INGRESO' : grupo === 'EGRESO' ? 'EGRESO' : grupo
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
      toastSuccess(`Categoría "${nueva.detalle}" creada con código ${nueva.codigo} ✅`)
    } catch (err: any) {
      toastError(err.message || 'Error al crear categoría')
    } finally {
      setSavingCategoria(false)
    }
  }

  const eliminarCategoria = async (catId: string, catNombre: string) => {
    if (!confirm(`¿Eliminar la categoría "${catNombre}"? Esta acción no se puede deshacer.`)) return
    try {
      const { error: err } = await supabase
        .from('plan_cuentas')
        .delete()
        .eq('id', catId)
      if (err) throw err
      setCuentas(prev => prev.filter(c => c.id !== catId))
      if (form.cuenta_codigo) {
        const cat = cuentas.find(c => c.id === catId)
        if (cat && cat.codigo === form.cuenta_codigo) {
          setForm({ ...form, cuenta_codigo: '', cuenta_detalle: '' })
          setSearchCategoria('')
        }
      }
      toastSuccess(`Categoría "${catNombre}" eliminada 🗑️`)
    } catch (err: any) {
      toastError(err.message || 'Error al eliminar')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.direccion) {
      toastError('Selecciona si es Ingreso o Egreso')
      return
    }
    if (!form.cuenta_codigo) {
      toastError('Selecciona una cuenta/categoría')
      return
    }
    const direccion = form.direccion
    setSaving(true)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        libro: form.libro,
        ci: form.ci,
        nombre: form.nombre,
        cuenta_codigo: form.cuenta_codigo,
        cuenta_detalle: form.cuenta_detalle || form.cuenta_codigo,
        glosa: form.glosa,
        costo: parseFloat(form.costo),
        tipo_movimiento: direccion,
        subcategoria: form.cuenta_detalle || null,
        metodo_pago: form.metodo_pago,
        comprobante_url: form.comprobante_url,
        notas: form.metodo_pago === 'mixto'
          ? `Efectivo: Bs ${form.mixto_efectivo || 0} | QR: Bs ${form.mixto_qr || 0} | Tarjeta: Bs ${form.mixto_tarjeta || 0}${form.notas ? ' | ' + form.notas : ''}`
          : form.notas || null,
        empleado_id: form.empleado_id || null,
      }),
    })
    if (res.ok) {
      toastSuccess('Movimiento registrado con éxito ✅')
      setShowForm(false)
      resetForm()
      loadData()
    } else {
      toastError('Error al registrar el movimiento')
    }
    setSaving(false)
  }

  const resetForm = () => {
    setForm({
      direccion: '', empleado_id: '', ci: '', nombre: '', cuenta_codigo: '', cuenta_detalle: '',
      glosa: '', costo: '', metodo_pago: 'efectivo', libro: 'CAJA_CHICA', notas: '',
      mixto_efectivo: '', mixto_qr: '', mixto_tarjeta: '', comprobante_url: null
    })
    setSearchCategoria('')
    setShowNewCategoria(false)
  }

  const handleBarberoChange = (id: string) => {
    const b = barberos.find((x) => x.id === id)
    setForm({ ...form, empleado_id: id, nombre: b?.full_name || form.nombre })
  }

  // Determinar si un movimiento es ingreso o egreso
  const esIngreso = (tx: Transaction) => {
    if (tx.tipo_movimiento === 'INGRESO') return true
    if (tx.tipo_movimiento === 'EGRESO') return false
    // Para registros legacy: inferir por cuenta_codigo o tipo_movimiento
    const codigo = (tx.cuenta_codigo || '').toUpperCase()
    if (codigo.startsWith('4') || codigo.startsWith('ING')) return true
    if (codigo.startsWith('5') || codigo.startsWith('EGR')) return false
    if (['VENTA', 'SERVICIO', 'PROPINA', 'PAGO_CLIENTE', 'APORTE_CAPITAL'].includes(tx.tipo_movimiento)) return true
    if (['GASTO', 'COMPRA', 'PAGO', 'SANCCION', 'ADELANTO', 'DEPOSITO_BANCO'].includes(tx.tipo_movimiento)) return false
    return true
  }

  // Sorting handler
  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'costo' ? 'desc' : 'asc')
    }
  }

  const SortIcon = ({ col }: { col: typeof sortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-zinc-700 ml-1 inline" />
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-400 ml-1 inline" /> : <ArrowDown className="w-3 h-3 text-amber-400 ml-1 inline" />
  }

  // Filtrar por tipo + texto + ordenar
  const txPorTipo = filtroTipo === 'todos' 
    ? transactions 
    : transactions.filter(tx => filtroTipo === 'INGRESO' ? esIngreso(tx) : !esIngreso(tx))

  const txBuscadas = txPorTipo.filter(tx => {
    if (!search) return true
    const q = search.toLowerCase()
    return (tx.nombre || '').toLowerCase().includes(q)
      || (tx.glosa || '').toLowerCase().includes(q)
      || (tx.cuenta_detalle || '').toLowerCase().includes(q)
      || (tx.cuenta_codigo || '').toLowerCase().includes(q)
  })

  const txFiltradas = [...txBuscadas].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'fecha') return dir * (a.fecha.localeCompare(b.fecha))
    if (sortKey === 'nombre') return dir * ((a.nombre || '').localeCompare(b.nombre || ''))
    if (sortKey === 'cuenta_detalle') return dir * ((a.cuenta_detalle || '').localeCompare(b.cuenta_detalle || ''))
    if (sortKey === 'costo') return dir * (Number(a.costo) - Number(b.costo))
    if (sortKey === 'metodo_pago') return dir * ((a.metodo_pago || '').localeCompare(b.metodo_pago || ''))
    return 0
  })

  // KPIs del periodo
  const totalIngresos = transactions.filter(esIngreso).reduce((s, t) => s + Number(t.costo), 0)
  const totalEgresos = transactions.filter(t => !esIngreso(t)).reduce((s, t) => s + Number(t.costo), 0)
  const saldoPeriodo = totalIngresos - totalEgresos
  const totalMovimientos = transactions.length

  // Desglose por categoría (top 5)
  const categoriaMap: Record<string, { monto: number, count: number, ingreso: boolean }> = {}
  transactions.forEach(tx => {
    const key = tx.cuenta_detalle || tx.tipo_movimiento || 'Sin categoría'
    if (!categoriaMap[key]) categoriaMap[key] = { monto: 0, count: 0, ingreso: esIngreso(tx) }
    categoriaMap[key].monto += Number(tx.costo)
    categoriaMap[key].count += 1
  })
  const topCategorias = Object.entries(categoriaMap)
    .sort((a, b) => b[1].monto - a[1].monto)
    .slice(0, 6)

  // Desglose por método de pago
  const pagoMap: Record<string, number> = {}
  transactions.forEach(tx => {
    const mp = tx.metodo_pago || 'efectivo'
    pagoMap[mp] = (pagoMap[mp] || 0) + Number(tx.costo)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            Caja <span className="text-amber-500">Chica</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Control de ingresos y egresos · {periodoLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/coordinador/caja">
            <Button variant="primary" className="gap-2 font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-xs">
              <Receipt className="w-4 h-4" />
              Caja / POS
            </Button>
          </Link>
          <Link href="/coordinador/ventas">
            <Button variant="outline" className="gap-2 font-bold uppercase tracking-wider text-xs border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10">
              <Receipt className="w-3.5 h-3.5" />
              Historial Ventas
            </Button>
          </Link>
          <Button variant="primary" onClick={() => { setForm({ ...form, direccion: 'EGRESO' }); setShowForm(true) }} className="gap-2 font-black uppercase tracking-wider bg-red-600 hover:bg-red-500 text-xs">
            <ShoppingCart className="w-4 h-4" />
            Registrar Gasto
          </Button>
          <Button variant="outline" onClick={() => setShowForm(true)} className="gap-2 font-black uppercase tracking-wider text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10">
            <Plus className="w-4 h-4" />
            Mov. Manual
          </Button>
        </div>
      </div>

      {/* Filtro de Periodo */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="flex gap-1 bg-zinc-950 border border-white/10 rounded-xl p-1 flex-wrap">
          {(['todos', 'hoy', 'semana', 'mes', 'custom'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                periodo === p ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-white'
              }`}
            >
              {p === 'todos' ? '📋 Todo' : p === 'hoy' ? '📅 Hoy' : p === 'semana' ? '📆 Semana' : p === 'mes' ? '🗓 Mes' : '📊 Rango'}
            </button>
          ))}
        </div>
        {periodo === 'custom' && (
          <div className="flex gap-2 items-center animate-in fade-in duration-200">
            <input type="date" value={customDesde} onChange={e => setCustomDesde(e.target.value)}
              className="h-9 bg-zinc-950 border border-white/10 rounded-lg px-3 text-xs text-white focus:border-amber-500/50 outline-none" />
            <span className="text-zinc-600 text-xs">→</span>
            <input type="date" value={customHasta} onChange={e => setCustomHasta(e.target.value)}
              className="h-9 bg-zinc-950 border border-white/10 rounded-lg px-3 text-xs text-white focus:border-amber-500/50 outline-none" />
          </div>
        )}
        <input
          type="text"
          placeholder="🔍 Buscar por nombre o glosa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-72 h-9 bg-zinc-950 border border-white/10 rounded-lg px-3 text-xs text-white focus:border-amber-500/50 outline-none"
        />
        <div className="flex gap-1 bg-zinc-950 border border-white/10 rounded-xl p-1">
          {(['todos', 'INGRESO', 'EGRESO'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                filtroTipo === t
                  ? t === 'INGRESO' ? 'bg-emerald-500/20 text-emerald-400'
                    : t === 'EGRESO' ? 'bg-red-500/20 text-red-400'
                    : 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              {t === 'todos' ? 'Todos' : t === 'INGRESO' ? '↑ Ing.' : '↓ Egr.'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/70">Ingresos</p>
              <p className="text-base font-black text-emerald-400">+{formatCurrency(totalIngresos)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-red-500/20 rounded-xl flex items-center justify-center shrink-0">
              <TrendingDown className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-red-500/70">Egresos</p>
              <p className="text-base font-black text-red-400">-{formatCurrency(totalEgresos)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-white/10 ${saldoPeriodo >= 0 ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
          <CardContent className="px-4 py-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${saldoPeriodo >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              <Scale className={`w-4 h-4 ${saldoPeriodo >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Saldo neto</p>
              <p className={`text-base font-black ${saldoPeriodo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {saldoPeriodo >= 0 ? '+' : ''}{formatCurrency(saldoPeriodo)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500/70">Movimientos</p>
              <p className="text-base font-black text-amber-400">{totalMovimientos}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desglose por categoría y método de pago */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Categorías */}
        <Card className="border-white/5 bg-zinc-900/50">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Desglose por Categoría</p>
            <div className="space-y-2">
              {topCategorias.length === 0 ? (
                <p className="text-zinc-600 text-xs text-center py-4">Sin movimientos en este periodo</p>
              ) : topCategorias.map(([cat, data]) => (
                <div key={cat} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${data.ingreso ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className="text-xs text-white truncate">{cat}</span>
                    <span className="text-[10px] text-zinc-600 shrink-0">×{data.count}</span>
                  </div>
                  <span className={`text-xs font-black shrink-0 ${data.ingreso ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.ingreso ? '+' : '-'}{formatCurrency(data.monto)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Métodos de Pago */}
        <Card className="border-white/5 bg-zinc-900/50">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Por Método de Pago</p>
            <div className="space-y-2">
              {Object.entries(pagoMap).length === 0 ? (
                <p className="text-zinc-600 text-xs text-center py-4">Sin movimientos</p>
              ) : Object.entries(pagoMap).sort((a,b) => b[1] - a[1]).map(([mp, monto]) => (
                <div key={mp} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{mp === 'efectivo' ? '💵' : mp === 'qr' ? '📱' : mp === 'tarjeta' ? '💳' : mp === 'mixto' ? '🔄' : '•'}</span>
                    <span className="text-xs text-white capitalize">{mp}</span>
                  </div>
                  <span className="text-xs font-black text-white">{formatCurrency(monto)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MODAL Formulario */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowForm(false)}>
          <div className="w-[95%] md:w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-amber-500/30 rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Nuevo Movimiento</h3>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* PASO 1: INGRESO o EGRESO */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-3 block">¿Entra o Sale dinero?</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => { setForm({ ...form, direccion: 'INGRESO', cuenta_codigo: '', cuenta_detalle: '' }); setSearchCategoria('') }}
                    className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                      form.direccion === 'INGRESO'
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                        : 'border-zinc-800 bg-black/50 hover:border-emerald-500/40'
                    }`}
                  >
                    <ArrowUpCircle className={`w-8 h-8 ${form.direccion === 'INGRESO' ? 'text-emerald-400' : 'text-zinc-600'}`} />
                    <span className={`font-black uppercase tracking-widest text-sm ${form.direccion === 'INGRESO' ? 'text-emerald-400' : 'text-zinc-500'}`}>Ingreso</span>
                    <span className="text-[10px] text-zinc-500">Ventas, Servicios, Aportes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForm({ ...form, direccion: 'EGRESO', cuenta_codigo: '', cuenta_detalle: '' }); setSearchCategoria('') }}
                    className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                      form.direccion === 'EGRESO'
                        ? 'border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                        : 'border-zinc-800 bg-black/50 hover:border-red-500/40'
                    }`}
                  >
                    <ArrowDownCircle className={`w-8 h-8 ${form.direccion === 'EGRESO' ? 'text-red-400' : 'text-zinc-600'}`} />
                    <span className={`font-black uppercase tracking-widest text-sm ${form.direccion === 'EGRESO' ? 'text-red-400' : 'text-zinc-500'}`}>Egreso</span>
                    <span className="text-[10px] text-zinc-500">Gastos, Compras, Pagos</span>
                  </button>
                </div>
              </div>

              {/* PASO 2: Categoría desde plan_cuentas */}
              {form.direccion && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                  <div ref={categoriaRef}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Categoría / Cuenta</label>
                      <button type="button" onClick={() => setShowNewCategoria(!showNewCategoria)}
                        className="text-[10px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors">
                        <Plus size={10} /> Nueva Categoría
                      </button>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <input
                        className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl pl-9 pr-8 text-sm text-white focus:border-amber-500/50 outline-none"
                        placeholder="Buscar por código o nombre de cuenta..."
                        value={searchCategoria}
                        onChange={e => {
                          setSearchCategoria(e.target.value)
                          setShowCategoriaDropdown(true)
                          if (!e.target.value) setForm({ ...form, cuenta_codigo: '', cuenta_detalle: '' })
                        }}
                        onFocus={() => setShowCategoriaDropdown(true)}
                        required
                      />
                      {searchCategoria && (
                        <button type="button" onClick={() => { setSearchCategoria(''); setForm({ ...form, cuenta_codigo: '', cuenta_detalle: '' }) }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                          <X size={14} />
                        </button>
                      )}
                      {showCategoriaDropdown && (
                        <div className="absolute z-20 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
                          {categoriasFiltradas.length > 0 ? (
                            categoriasFiltradas.map(cat => {
                              const nivel = getNivel(cat.codigo)
                              const grupo = getGrupo(cat.codigo)
                              const grupoColor = getGrupoColor(grupo)
                              const indent = Math.min((nivel - 1) * 16, 48)
                              return (
                                <div key={cat.id} className={`group flex items-center gap-2 pr-1 hover:bg-white/5 transition-colors ${
                                    form.cuenta_codigo === cat.codigo ? 'bg-amber-500/10 border-l-2 border-amber-500' : ''
                                  }`}
                                  style={{ paddingLeft: `${12 + indent}px` }}
                                >
                                  <button type="button" onClick={() => selectCategoria(cat)}
                                    className="flex-1 flex items-center gap-2 py-2 text-left min-w-0"
                                  >
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${grupoColor}`}>
                                      {grupo === 'INGRESO' ? '↑' : grupo === 'EGRESO' ? '↓' : '•'}
                                    </span>
                                    <span className="text-zinc-500 text-[11px] font-mono shrink-0 w-20">{cat.codigo}</span>
                                    <span className={`text-sm truncate ${nivel <= 2 ? 'font-black text-white' : 'font-medium text-zinc-300'}`}>{cat.detalle}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); eliminarCategoria(cat.id, cat.detalle) }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-all shrink-0"
                                    title={`Eliminar "${cat.detalle}"`}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              )
                            })
                          ) : (
                            <div className="px-4 py-3 text-zinc-500 text-sm">
                              Sin resultados.{' '}
                              <button type="button" onClick={() => { setShowNewCategoria(true); setNewCategoriaNombre(searchCategoria) }}
                                className="text-amber-500 font-bold hover:underline">
                                Crear &quot;{searchCategoria}&quot;
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Crear nueva categoría inline */}
                  {showNewCategoria && (
                    <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase text-amber-500 tracking-widest">Nueva Categoría de {form.direccion}</p>
                        <button type="button" onClick={() => setShowNewCategoria(false)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
                      </div>
                      <input placeholder="Nombre de la categoría *" value={newCategoriaNombre} onChange={e => setNewCategoriaNombre(e.target.value)}
                        className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white outline-none focus:border-amber-500/50" />
                      <input placeholder={`Código contable (ej: ${form.direccion === 'INGRESO' ? '4.1.1' : '5.1.1'})`} value={newCategoriaCodigo} onChange={e => setNewCategoriaCodigo(e.target.value)}
                        className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white font-mono outline-none focus:border-amber-500/50" />
                      <p className="text-[10px] text-zinc-500">💡 Usa código 4.x para ingresos, 5.x para egresos.</p>
                      <Button type="button" onClick={crearNuevaCategoria} disabled={savingCategoria || !newCategoriaNombre.trim()}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-black font-black h-10 text-xs uppercase tracking-widest">
                        <Plus size={14} className="mr-2" /> {savingCategoria ? 'Creando...' : 'Crear y Seleccionar'}
                      </Button>
                    </div>
                  )}

                  {/* Empleado */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Empleado / A quién</label>
                    <select
                      value={form.empleado_id} onChange={(e) => handleBarberoChange(e.target.value)}
                      className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none appearance-none"
                    >
                      <option value="">Sin empleado (externo)</option>
                      {barberos.map((b) => (
                        <option key={b.id} value={b.id}>{b.full_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* CI y Nombre */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">C.I.</label>
                      <input value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })}
                        className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Nombre</label>
                      <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none" required />
                    </div>
                  </div>

                  {/* Método de Pago */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1 block">Método de Pago</label>
                    <select value={form.metodo_pago} onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}
                      className="w-full h-11 bg-zinc-950 border border-amber-500/30 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none appearance-none font-bold">
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="qr">📱 QR / Transferencia</option>
                      <option value="tarjeta">💳 Tarjeta</option>
                      <option value="mixto">🔄 Mixto</option>
                    </select>
                  </div>

                  {/* Glosa y Monto */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Glosa / Descripción</label>
                      <input value={form.glosa} onChange={(e) => setForm({ ...form, glosa: e.target.value })}
                        className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none"
                        placeholder="Descripción del movimiento" required />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Monto (Bs)</label>
                      <input type="number" step="0.01" min="0" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })}
                        className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none" required />
                    </div>
                  </div>

                  {/* Desglose Mixto */}
                  {form.metodo_pago === 'mixto' && (
                    <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-3">🔄 Desglose Mixto</p>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">💵 Efectivo</label>
                          <input type="number" step="0.01" min="0" value={form.mixto_efectivo}
                            onChange={(e) => setForm({ ...form, mixto_efectivo: e.target.value })} placeholder="0.00"
                            className="w-full h-11 bg-zinc-950 border border-amber-500/30 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">📱 QR</label>
                          <input type="number" step="0.01" min="0" value={form.mixto_qr}
                            onChange={(e) => setForm({ ...form, mixto_qr: e.target.value })} placeholder="0.00"
                            className="w-full h-11 bg-zinc-950 border border-amber-500/30 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">💳 Tarjeta</label>
                          <input type="number" step="0.01" min="0" value={form.mixto_tarjeta}
                            onChange={(e) => setForm({ ...form, mixto_tarjeta: e.target.value })} placeholder="0.00"
                            className="w-full h-11 bg-zinc-950 border border-amber-500/30 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none" />
                        </div>
                      </div>
                      {form.costo && (parseFloat(form.mixto_efectivo || '0') + parseFloat(form.mixto_qr || '0') + parseFloat(form.mixto_tarjeta || '0')) !== parseFloat(form.costo) && (
                        <p className="text-red-400 text-xs mt-2 font-bold">
                          ⚠ La suma ({formatCurrency(parseFloat(form.mixto_efectivo || '0') + parseFloat(form.mixto_qr || '0') + parseFloat(form.mixto_tarjeta || '0'))}) no coincide con el monto total ({formatCurrency(parseFloat(form.costo))})
                        </p>
                      )}
                    </div>
                  )}

                  {/* Subir Comprobante */}
                  {(form.metodo_pago === 'qr' || form.metodo_pago === 'mixto') && (
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1 block">📸 Comprobante de Pago</label>
                      <div className="bg-zinc-950 border border-white/5 rounded-xl p-4">
                        <ImageUpload
                          defaultImage={form.comprobante_url || ''}
                          onUploadSuccess={(url) => setForm({ ...form, comprobante_url: url })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex justify-end gap-3 pt-6 border-t border-white/5 mt-6">
                    <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm() }}>Cancelar</Button>
                    <Button type="submit" variant="primary" disabled={saving}
                      className={`font-black uppercase tracking-wider ${form.direccion === 'INGRESO' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}>
                      {saving ? 'Guardando...' : form.direccion === 'INGRESO' ? '↑ Registrar Ingreso' : '↓ Registrar Egreso'}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Tabla de Movimientos */}
      <Card className="border-white/5 bg-zinc-900/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {txFiltradas.length} movimiento{txFiltradas.length !== 1 ? 's' : ''} {periodoLabel} · Click en columna para ordenar
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 w-[70px]">Tipo</th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 w-[85px] cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('fecha')}>Fecha <SortIcon col="fecha" /></th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500">Código</th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('cuenta_detalle')}>Categoría <SortIcon col="cuenta_detalle" /></th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('nombre')}>Nombre <SortIcon col="nombre" /></th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500">Detalle</th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 w-[80px] cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('metodo_pago')}>Pago <SortIcon col="metodo_pago" /></th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-right w-[100px] cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('costo')}>Monto <SortIcon col="costo" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {txFiltradas.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-zinc-600">
                    <div className="flex flex-col items-center gap-2">
                      <Wallet className="w-8 h-8 text-zinc-700" />
                      <p className="font-bold">Sin movimientos registrados</p>
                      <p className="text-xs text-zinc-700">Usa el botón &quot;Nuevo Movimiento&quot; para agregar uno</p>
                    </div>
                  </td></tr>
                ) : (
                  txFiltradas.map((tx) => {
                    const ingreso = esIngreso(tx)
                    const tipoLabel = tx.subcategoria || tx.tipo_movimiento || (ingreso ? 'INGRESO' : 'EGRESO')
                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                        {/* Tipo Ingreso/Egreso */}
                        <td className="px-3 py-2.5">
                          <Badge
                            variant={ingreso ? 'success' : 'danger'}
                            className="text-[8px] uppercase font-black flex items-center gap-0.5 w-fit whitespace-nowrap"
                          >
                            {ingreso ? <ArrowUpCircle className="w-2.5 h-2.5" /> : <ArrowDownCircle className="w-2.5 h-2.5" />}
                            {ingreso ? 'Ing.' : 'Egr.'}
                          </Badge>
                        </td>
                        {/* Fecha */}
                        <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap text-xs font-mono">{tx.fecha}</td>
                        {/* Código contable */}
                        <td className="px-3 py-2.5">
                          {tx.cuenta_codigo ? (
                            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">{tx.cuenta_codigo}</span>
                          ) : (
                            <span className="text-zinc-700 text-xs">—</span>
                          )}
                        </td>
                        {/* Categoría / Concepto */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            <span className="text-white text-xs font-semibold truncate max-w-[180px]">{tx.cuenta_detalle || tipoLabel}</span>
                            {tx.subcategoria && tx.subcategoria !== tx.cuenta_detalle && (
                              <span className="text-[10px] text-zinc-500">{tx.subcategoria}</span>
                            )}
                            {tx.libro && tx.libro !== 'CAJA_CHICA' && (
                              <span className="text-[9px] text-amber-500/60 font-bold uppercase">{tx.libro.replace('_', ' ')}</span>
                            )}
                          </div>
                        </td>
                        {/* Nombre / A quién */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            <span className="text-zinc-300 text-xs font-medium truncate max-w-[140px]">{tx.nombre || '—'}</span>
                            {tx.usuario_registro && tx.usuario_registro !== tx.nombre && (
                              <span className="text-[9px] text-zinc-600">por {tx.usuario_registro}</span>
                            )}
                          </div>
                        </td>
                        {/* Detalle / Glosa */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col max-w-[200px]">
                            {tx.glosa && <span className="text-zinc-400 text-xs truncate">{tx.es_sancion ? '⚠ ' : ''}{tx.glosa}</span>}
                            {tx.notas && <span className="text-[10px] text-zinc-600 truncate">{tx.notas}</span>}
                            {tx.comprobante_url && (
                              <a href={tx.comprobante_url} target="_blank" rel="noreferrer" className="text-[9px] text-amber-500 hover:text-amber-400 flex items-center gap-0.5 font-bold mt-0.5 w-fit">
                                <ImageIcon className="w-2.5 h-2.5" /> Comprobante
                              </a>
                            )}
                          </div>
                        </td>
                        {/* Método de pago */}
                        <td className="px-3 py-2.5">
                          <Badge
                            variant={tx.metodo_pago === 'qr' ? 'info' : tx.metodo_pago === 'mixto' ? 'warning' : tx.metodo_pago === 'tarjeta' ? 'info' : 'default'}
                            className="text-[9px] uppercase whitespace-nowrap"
                          >
                            {tx.metodo_pago === 'efectivo' ? '💵 Efect.' : tx.metodo_pago === 'qr' ? '📱 QR' : tx.metodo_pago === 'tarjeta' ? '💳 Tarj.' : tx.metodo_pago === 'mixto' ? '🔄 Mixto' : tx.metodo_pago || '—'}
                          </Badge>
                        </td>
                        {/* Monto */}
                        <td className="px-3 py-2.5 text-right">
                          <span className={`font-black text-sm ${ingreso ? 'text-emerald-400' : 'text-red-400'}`}>
                            {ingreso ? '+' : '-'}{formatCurrency(tx.costo)}
                          </span>
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
    </div>
  )
}
