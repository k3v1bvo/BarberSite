'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, getTodayBolivia, exportToCSV } from '@/lib/utils'
import { Receipt, Plus, X, Store, Filter, ArrowUpDown, ArrowUp, ArrowDown, Search, Wallet, ShoppingBag, Image as ImageIcon, User, Sparkles, CheckCircle2, DollarSign, QrCode, CreditCard, Scissors, Package, Layers, AlertCircle, Printer, Download, Edit3 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { ModalEditarTransaccion } from '@/components/pos/ModalEditarTransaccion'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/client'

interface PlanCuenta { codigo: string; detalle: string; tipo: string }
interface Transaction {
  id: string; fecha: string; ci: string; nombre: string
  cuenta_codigo: string; cuenta_detalle: string; glosa: string
  costo: number; tipo_movimiento: string; metodo_pago: string | null
  creado_en: string; notas: string | null; comprobante_url?: string | null
  monto_efectivo?: number; monto_qr?: number
}
interface Servicio { id: string; nombre: string; precio: number }
interface Producto { id: string; nombre: string; precio_venta: number }
interface Profile { id: string; full_name: string; role: string }

type SortKey = 'fecha' | 'nombre' | 'cuenta_detalle' | 'costo' | 'metodo_pago'
type SortDir = 'asc' | 'desc'
type TipoVenta = 'servicio' | 'producto' | 'otro'

export default function VentasPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cuentas, setCuentas] = useState<PlanCuenta[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null)
  const [filtroLibro, setFiltroLibro] = useState<'HOY' | 'ESTE_AÑO' | 'VENTAS' | 'SERVICIOS' | 'USO_TIENDA' | 'TODOS'>('HOY')
  const [buscandoCi, setBuscandoCi] = useState(false)
  const [cumpleanosMsg, setCumpleanosMsg] = useState<string | null>(null)
  const [clienteEncontrado, setClienteEncontrado] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('fecha')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const hoy = getTodayBolivia()

  // Estados interactivos para el nuevo formulario de venta
  const [tipoVenta, setTipoVenta] = useState<TipoVenta>('servicio')
  const [itemSearchText, setItemSearchText] = useState('')

  const [form, setForm] = useState({
    ci: '', nombre: '', email: '', cuenta_codigo: '', glosa: '', costo: '',
    barbero_id: '',
    metodo_pago: 'efectivo', notas: '',
    mixto_efectivo: '', mixto_qr: '', mixto_tarjeta: '',
    comprobante_url: '',
  })

  // Timeout para debounce
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

  const handleCiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ci = e.target.value
    setForm(prev => ({ ...prev, ci }))
    
    if (searchTimeout) clearTimeout(searchTimeout)
    setCumpleanosMsg(null)
    setClienteEncontrado(false)
    
    if (ci.length >= 4) {
      setSearchTimeout(setTimeout(async () => {
        setBuscandoCi(true)
        try {
          const supabase = createClient()
          const { data: cliente } = await supabase
            .from('clientes')
            .select('nombre, email, cumpleanos')
            .eq('ci', ci)
            .single()

          if (cliente) {
            setClienteEncontrado(true)
            setForm(prev => ({ ...prev, nombre: cliente.nombre, email: cliente.email || '' }))
            
            // Check birthday
            if (cliente.cumpleanos) {
              const cumple = new Date(cliente.cumpleanos)
              const today = new Date()
              if (cumple.getMonth() === today.getMonth() && cumple.getDate() === today.getDate()) {
                setCumpleanosMsg(`¡Hoy es el cumpleaños de ${cliente.nombre}! 🎉 Puedes ofrecerle una cortesía o producto sorpresa.`)
              }
            }
          }
        } catch (error) {
          // Ignore errors
        } finally {
          setBuscandoCi(false)
        }
      }, 600))
    }
  }

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [txRes, ctasRes, { data: sData }, { data: pData }, { data: profData }] = await Promise.all([
      filtroLibro === 'HOY'
        ? fetch(`/api/transactions?fecha=${getTodayBolivia()}&limit=200`).then(r => r.ok ? r.json() : [])
        : filtroLibro === 'ESTE_AÑO'
        ? fetch(`/api/transactions?desde=${new Date().getFullYear()}-01-01&limit=2000`).then(r => r.ok ? r.json() : [])
        : filtroLibro === 'TODOS'
        ? Promise.all([
            fetch(`/api/transactions?libro=VENTAS&limit=200`),
            fetch(`/api/transactions?libro=SERVICIOS&limit=200`),
            fetch(`/api/transactions?libro=USO_TIENDA&limit=200`),
          ]).then(async ([r1, r2, r3]) => {
            const d1 = r1.ok ? await r1.json() : []
            const d2 = r2.ok ? await r2.json() : []
            const d3 = r3.ok ? await r3.json() : []
            return [...d1, ...d2, ...d3].sort((a: any, b: any) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()).slice(0, 300)
          })
        : fetch(`/api/transactions?libro=${filtroLibro}&limit=200`).then(r => r.ok ? r.json() : []),
      fetch('/api/plan-cuentas'),
      supabase.from('servicios').select('id, nombre, precio').eq('is_active', true).order('nombre'),
      supabase.from('productos').select('id, nombre, precio_venta').eq('is_active', true).order('nombre'),
      supabase.from('profiles').select('id, full_name, role').in('role', ['barbero', 'admin', 'coordinador']).eq('is_active', true).order('full_name')
    ])
    if (Array.isArray(txRes)) setTransactions(txRes)
    else if (txRes.ok) setTransactions(await txRes.json())
    else setTransactions(txRes)
    if (ctasRes.ok) setCuentas(await ctasRes.json())
    if (sData) setServicios(sData)
    if (pData) setProductos(pData)
    if (profData) setProfiles(profData)
    setLoading(false)
  }, [filtroLibro])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.cuenta_codigo) {
      toastError('Por favor selecciona un Servicio, Producto o Cuenta')
      return
    }

    if (form.metodo_pago === 'mixto') {
      const sumaMixta = parseFloat(form.mixto_efectivo || '0') + parseFloat(form.mixto_qr || '0') + parseFloat(form.mixto_tarjeta || '0')
      if (Math.abs(sumaMixta - parseFloat(form.costo || '0')) > 0.05) {
        toastError('La suma del pago mixto no coincide con el total de la venta')
        return
      }
    }

    setSaving(true)

    let realCuentaCodigo = form.cuenta_codigo
    let realCuentaDetalle = form.cuenta_codigo
    let productoId = null

    if (form.cuenta_codigo.startsWith('srv-')) {
      realCuentaCodigo = '4.1.1'
      const srv = servicios.find(s => s.id === form.cuenta_codigo.replace('srv-', ''))
      realCuentaDetalle = srv ? srv.nombre : 'Servicio'
    } else if (form.cuenta_codigo.startsWith('prd-')) {
      realCuentaCodigo = '4.1.2'
      const prd = productos.find(p => p.id === form.cuenta_codigo.replace('prd-', ''))
      realCuentaDetalle = prd ? prd.nombre : 'Producto'
      productoId = prd ? prd.id : null
    } else {
      const cuenta = cuentas.find((c) => c.codigo === form.cuenta_codigo)
      realCuentaDetalle = cuenta?.detalle || form.cuenta_codigo
    }

    if (form.ci && form.ci !== '0' && form.ci !== '0000000' && form.nombre) {
      try {
        const supabase = createClient()
        const { data: existente } = await supabase.from('clientes').select('id').eq('ci', form.ci).single()
        if (!existente) {
          await supabase.from('clientes').insert({
            ci: form.ci,
            nombre: form.nombre,
            email: form.email || null
          })
        }
      } catch {
        // Ignorar si el cliente ya existe o falló la creación
      }
    }

    const isEgreso = realCuentaCodigo.startsWith('5') || realCuentaCodigo.startsWith('6') || (form.glosa && (form.glosa.toLowerCase().includes('devolucion') || form.glosa.toLowerCase().includes('cambio')))
    const tipoMovFinal = isEgreso ? 'EGRESO' : 'INGRESO'
    const libroFinal = isEgreso ? (form.metodo_pago === 'qr' || form.metodo_pago === 'tarjeta' ? 'BANCO' : 'CAJA_CHICA') : 'VENTAS'

    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        libro: libroFinal,
        ci: form.ci && form.ci !== '0000000' ? form.ci : '',
        nombre: form.nombre || (isEgreso ? 'Egreso / Devolución' : 'Cliente General'),
        cuenta_codigo: realCuentaCodigo,
        cuenta_detalle: realCuentaDetalle,
        producto_id: productoId,
        glosa: form.glosa,
        costo: parseFloat(form.costo),
        tipo_movimiento: tipoMovFinal,
        subcategoria: isEgreso ? 'GASTO_GENERAL' : (form.cuenta_codigo.startsWith('srv-') ? 'SERVICIO' : form.cuenta_codigo.startsWith('prd-') ? 'PRODUCTO' : 'VENTA'),
        empleado_id: form.barbero_id || null,
        metodo_pago: form.metodo_pago,
        monto_efectivo: form.metodo_pago === 'efectivo' ? parseFloat(form.costo) : form.metodo_pago === 'mixto' ? parseFloat(form.mixto_efectivo || '0') : 0,
        monto_qr: form.metodo_pago === 'qr' ? parseFloat(form.costo) : form.metodo_pago === 'mixto' ? parseFloat(form.mixto_qr || '0') : 0,
        monto_tarjeta: form.metodo_pago === 'tarjeta' ? parseFloat(form.costo) : form.metodo_pago === 'mixto' ? parseFloat(form.mixto_tarjeta || '0') : 0,
        comprobante_url: form.comprobante_url || null,
        notas: form.metodo_pago === 'mixto'
          ? `Efectivo: Bs ${form.mixto_efectivo || 0} | QR: Bs ${form.mixto_qr || 0} | Tarjeta: Bs ${form.mixto_tarjeta || 0}${form.notas ? ' | ' + form.notas : ''}`
          : form.notas || null,
      }),
    })
    if (res.ok) {
      toastSuccess('Venta registrada con éxito ✅')
      setShowForm(false)
      setForm({ ci: '', nombre: '', email: '', cuenta_codigo: '', glosa: '', costo: '', barbero_id: '', metodo_pago: 'efectivo', notas: '', mixto_efectivo: '', mixto_qr: '', mixto_tarjeta: '', comprobante_url: '' })
      loadData()
    } else {
      toastError('Error al registrar la venta')
    }
    setSaving(false)
  }

  // Sorting
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'costo' ? 'desc' : 'asc')
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-zinc-700 ml-1 inline" />
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-400 ml-1 inline" /> : <ArrowDown className="w-3 h-3 text-amber-400 ml-1 inline" />
  }

  // Filter and sort
  const filtered = transactions.filter(tx => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return (tx.nombre || '').toLowerCase().includes(q)
      || (tx.ci || '').toLowerCase().includes(q)
      || (tx.glosa || '').toLowerCase().includes(q)
      || (tx.cuenta_detalle || '').toLowerCase().includes(q)
  })

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'fecha') return dir * (a.fecha.localeCompare(b.fecha))
    if (sortKey === 'nombre') return dir * ((a.nombre || '').localeCompare(b.nombre || ''))
    if (sortKey === 'cuenta_detalle') return dir * ((a.cuenta_detalle || '').localeCompare(b.cuenta_detalle || ''))
    if (sortKey === 'costo') return dir * (Number(a.costo) - Number(b.costo))
    if (sortKey === 'metodo_pago') return dir * ((a.metodo_pago || '').localeCompare(b.metodo_pago || ''))
    return 0
  })

  const totalHoy = transactions.filter((t) => t.fecha === hoy && t.tipo_movimiento !== 'USO_TIENDA').reduce((s, t) => {
    const monto = Number(t.costo)
    return s + (t.tipo_movimiento === 'EGRESO' ? -monto : monto)
  }, 0)
  const totalTiendaHoy = transactions.filter((t) => t.fecha === hoy && t.tipo_movimiento === 'USO_TIENDA').reduce((s, t) => s + Number(t.costo), 0)
  const totalGeneral = transactions.reduce((s, t) => {
    const monto = Number(t.costo)
    return s + (t.tipo_movimiento === 'EGRESO' ? -monto : monto)
  }, 0)
  const ventasCuentas = cuentas.filter((c) => c.codigo.startsWith('4.1'))

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-green-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            Ventas / <span className="text-green-500">Servicios</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Pagos de clientes por cortes, barba y productos · {sorted.length} registros</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/coordinador/caja">
            <Button variant="primary" className="text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 gap-1">
              <ShoppingBag className="w-3.5 h-3.5" /> Caja POS
            </Button>
          </Link>
          <Link href="/coordinador/caja-chica">
            <Button variant="outline" className="text-xs font-black uppercase tracking-wider border-amber-500/30 text-amber-500 hover:bg-amber-500/10 gap-1">
              <Wallet className="w-3.5 h-3.5" /> Caja Chica
            </Button>
          </Link>
          <Button variant="primary" onClick={() => setShowForm(!showForm)} className="gap-2 font-black uppercase tracking-wider bg-green-600 hover:bg-green-500 text-xs">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cerrar' : 'Nueva Venta'}
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2 font-bold uppercase tracking-wider text-xs border-white/20 text-white hover:bg-white/10 print:hidden">
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </Button>
          <Button 
            variant="outline" 
            onClick={() => exportToCSV(transactions, `ventas_${getTodayBolivia()}`)} 
            className="gap-2 font-bold uppercase tracking-wider text-xs border-blue-500/20 text-blue-400 hover:bg-blue-500/10 print:hidden"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-green-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-green-500/70">Ventas hoy</p>
              <p className="text-base font-black text-green-400">{formatCurrency(totalHoy)}</p>
            </div>
          </CardContent>
        </Card>
        {totalTiendaHoy > 0 && (
          <Card className="border-violet-500/20 bg-violet-500/5">
            <CardContent className="px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-violet-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Store className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-violet-500/70">Uso tienda hoy</p>
                <p className="text-base font-black text-violet-400">{formatCurrency(totalTiendaHoy)}</p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="border-white/10 bg-zinc-900/50">
          <CardContent className="px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Total periodo</p>
              <p className="text-base font-black text-white">{formatCurrency(totalGeneral)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          {(['HOY', 'ESTE_AÑO', 'TODOS', 'SERVICIOS', 'VENTAS', 'USO_TIENDA'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltroLibro(f as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                filtroLibro === f
                  ? f === 'HOY'
                    ? 'bg-emerald-500 text-black'
                    : f === 'USO_TIENDA'
                    ? 'bg-violet-600 text-white'
                    : f === 'SERVICIOS'
                    ? 'bg-green-500 text-black'
                    : 'bg-amber-500 text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {f === 'HOY' ? '📅 Hoy' : f === 'ESTE_AÑO' ? '📅 Este Año' : f === 'TODOS' ? 'Todas' : f === 'SERVICIOS' ? 'Servicios' : f === 'VENTAS' ? 'Ventas' : '⚡ Uso Tienda'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            placeholder="Buscar por nombre, CI o glosa..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full h-9 bg-zinc-950 border border-white/10 rounded-lg pl-9 pr-3 text-xs text-white focus:border-green-500/50 outline-none"
          />
        </div>
      </div>

      {showForm && (
        <Card className="border-green-500/40 bg-zinc-900/90 shadow-2xl animate-in slide-in-from-top-2 duration-300 overflow-hidden">
          {/* Header del Formulario */}
          <div className="bg-gradient-to-r from-green-600/20 via-zinc-900 to-zinc-900 px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">Registrar Nueva Venta / Servicio</h3>
                <p className="text-xs text-zinc-400">Selecciona el ítem con un clic, asigna el barbero y elige el método de pago</p>
              </div>
            </div>

            {/* Pestañas de Categoría Rápida */}
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => { setTipoVenta('servicio'); setItemSearchText(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${tipoVenta === 'servicio' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-zinc-400 hover:text-white'}`}
              >
                <Scissors className="w-3.5 h-3.5" /> Servicios
              </button>
              <button
                type="button"
                onClick={() => { setTipoVenta('producto'); setItemSearchText(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${tipoVenta === 'producto' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-zinc-400 hover:text-white'}`}
              >
                <Package className="w-3.5 h-3.5" /> Productos
              </button>
              <button
                type="button"
                onClick={() => { setTipoVenta('otro'); setItemSearchText(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${tipoVenta === 'otro' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-zinc-400 hover:text-white'}`}
              >
                <Layers className="w-3.5 h-3.5" /> Otras Cuentas
              </button>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* 🎂 BANNER DE CUMPLEAÑOS 🎂 */}
            {cumpleanosMsg && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 animate-in fade-in zoom-in shadow-lg">
                <span className="text-3xl mt-0.5">🎂</span>
                <div>
                  <h3 className="font-black text-amber-400 uppercase tracking-widest text-xs">¡Alerta de Cumpleaños!</h3>
                  <p className="text-amber-100 text-xs mt-1 leading-relaxed font-medium">{cumpleanosMsg}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* SECCIÓN 1: SELECCIÓN RÁPIDA DE SERVICIO O PRODUCTO */}
              <div className="space-y-3 bg-zinc-950/60 p-4 rounded-2xl border border-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-black uppercase tracking-wider text-green-400 flex items-center gap-1.5">
                    <span>1.</span> {tipoVenta === 'servicio' ? '✂️ Elige el Servicio Atendido' : tipoVenta === 'producto' ? '📦 Elige el Producto Vendido' : '⚡ Elige la Cuenta de Ingreso'}
                  </label>
                  {tipoVenta !== 'otro' && (
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <input
                        type="text"
                        placeholder={tipoVenta === 'servicio' ? "Buscar servicio..." : "Buscar producto..."}
                        value={itemSearchText}
                        onChange={(e) => setItemSearchText(e.target.value)}
                        className="w-full h-8 bg-zinc-900 border border-white/10 rounded-lg pl-8 pr-3 text-xs text-white focus:border-green-500 outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Grid interactivo de tarjetas */}
                {tipoVenta === 'servicio' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto pr-1">
                    {servicios
                      .filter(s => !itemSearchText || s.nombre.toLowerCase().includes(itemSearchText.toLowerCase()))
                      .map(s => {
                        const isSelected = form.cuenta_codigo === `srv-${s.id}`
                        return (
                          <div
                            key={s.id}
                            onClick={() => setForm({ ...form, cuenta_codigo: `srv-${s.id}`, costo: s.precio.toString(), glosa: `Servicio: ${s.nombre}` })}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition select-none relative flex flex-col justify-between min-h-[72px] ${
                              isSelected
                                ? 'bg-green-500/15 border-green-500 shadow-lg shadow-green-500/10 ring-1 ring-green-500'
                                : 'bg-zinc-900/80 border-white/10 hover:border-white/30 hover:bg-zinc-800/80'
                            }`}
                          >
                            <span className="text-xs font-bold text-white line-clamp-2 pr-4">{s.nombre}</span>
                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5">
                              <span className="text-xs font-black text-green-400">{formatCurrency(s.precio)}</span>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-green-400 absolute top-2 right-2" />}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}

                {tipoVenta === 'producto' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto pr-1">
                    {productos
                      .filter(p => !itemSearchText || p.nombre.toLowerCase().includes(itemSearchText.toLowerCase()))
                      .map(p => {
                        const isSelected = form.cuenta_codigo === `prd-${p.id}`
                        return (
                          <div
                            key={p.id}
                            onClick={() => setForm({ ...form, cuenta_codigo: `prd-${p.id}`, costo: p.precio_venta.toString(), glosa: `Venta: ${p.nombre}` })}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition select-none relative flex flex-col justify-between min-h-[72px] ${
                              isSelected
                                ? 'bg-emerald-500/15 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500'
                                : 'bg-zinc-900/80 border-white/10 hover:border-white/30 hover:bg-zinc-800/80'
                            }`}
                          >
                            <span className="text-xs font-bold text-white line-clamp-2 pr-4">{p.nombre}</span>
                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5">
                              <span className="text-xs font-black text-emerald-400">{formatCurrency(p.precio_venta)}</span>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute top-2 right-2" />}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}

                {tipoVenta === 'otro' && (
                  <div>
                    <select
                      value={form.cuenta_codigo}
                      onChange={(e) => {
                        const val = e.target.value
                        const c = cuentas.find(x => x.codigo === val)
                        setForm({ ...form, cuenta_codigo: val, glosa: c ? `Ingreso: ${c.detalle}` : '' })
                      }}
                      className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-green-500 outline-none"
                    >
                      <option value="">-- Seleccionar cuenta de ingreso --</option>
                      {cuentas.filter(c => c.codigo.startsWith('4.1')).map(c => (
                        <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.detalle}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* SECCIÓN 2: BARBERO / PROFESIONAL QUE ATENDIÓ */}
              <div className="space-y-3 bg-zinc-950/60 p-4 rounded-2xl border border-white/5">
                <label className="text-xs font-black uppercase tracking-wider text-green-400 flex items-center gap-1.5">
                  <span>2.</span> 👨‍🦱 ¿Quién atendió al cliente o realizó la venta?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, barbero_id: '' })}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition text-left flex items-center justify-between ${
                      form.barbero_id === ''
                        ? 'bg-zinc-800 border-white/40 text-white shadow-md'
                        : 'bg-zinc-900 border-white/5 text-zinc-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span>🏬 Venta Directa / Tienda</span>
                    {form.barbero_id === '' && <CheckCircle2 className="w-3.5 h-3.5 text-zinc-300" />}
                  </button>
                  {profiles.map(prof => {
                    const isSelected = form.barbero_id === prof.id
                    return (
                      <button
                        key={prof.id}
                        type="button"
                        onClick={() => setForm({ ...form, barbero_id: prof.id })}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition text-left flex items-center justify-between truncate ${
                          isSelected
                            ? 'bg-green-600/20 border-green-500 text-white shadow-md'
                            : 'bg-zinc-900 border-white/5 text-zinc-400 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        <span className="truncate">💈 {prof.full_name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 ml-1" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* SECCIÓN 3: DATOS DEL CLIENTE */}
              <div className="space-y-3 bg-zinc-950/60 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-green-400 flex items-center gap-1.5">
                    <span>3.</span> 👤 Datos del Cliente (Opcional)
                  </label>
                  {clienteEncontrado && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-400 bg-green-500/10 px-2.5 py-0.5 rounded-full border border-green-500/20">
                      <Sparkles className="w-3 h-3" /> Cliente Registrado
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Carnet / C.I. / Tel</label>
                    <div className="relative">
                      <input
                        value={form.ci}
                        onChange={handleCiChange}
                        placeholder="Ej: 1234567 o teléfono..."
                        className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-xs text-white focus:border-green-500 outline-none"
                      />
                      {buscandoCi && <div className="absolute right-3 top-3 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Nombre y Apellido</label>
                    <input
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      placeholder="Ej: Juan Pérez"
                      className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-xs text-white focus:border-green-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Correo Electrónico</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="cliente@correo.com"
                      className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-xs text-white focus:border-green-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 4: DETALLE Y MONTO TOTAL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950/60 p-4 rounded-2xl border border-white/5">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-green-400 mb-1 block">Glosa / Concepto del Cobro</label>
                  <input
                    value={form.glosa}
                    onChange={(e) => setForm({ ...form, glosa: e.target.value })}
                    placeholder="Ej: Servicio de Corte Clásico..."
                    className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-xs text-white focus:border-green-500 outline-none font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-green-400 mb-1 block">Monto a Cobrar (Bs.)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-green-400">Bs.</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.costo}
                      onChange={(e) => setForm({ ...form, costo: e.target.value })}
                      placeholder="0.00"
                      className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-4 text-base font-black text-white focus:border-green-500 outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 5: MÉTODO DE PAGO Y DESGLOSE */}
              <div className="space-y-4 bg-zinc-950/60 p-4 rounded-2xl border border-white/5">
                <label className="text-xs font-black uppercase tracking-wider text-green-400 block">4. Método de Pago</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'efectivo', label: '💵 Efectivo', icon: DollarSign, color: 'emerald' },
                    { id: 'qr', label: '📱 QR / Transf.', icon: QrCode, color: 'blue' },
                    { id: 'tarjeta', label: '💳 Tarjeta POS', icon: CreditCard, color: 'purple' },
                    { id: 'mixto', label: '🔄 Mixto (Combinado)', icon: Layers, color: 'amber' },
                  ].map(m => {
                    const active = form.metodo_pago === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setForm({ ...form, metodo_pago: m.id })}
                        className={`h-12 rounded-xl border text-xs font-black transition flex items-center justify-center gap-2 ${
                          active
                            ? m.id === 'efectivo'
                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                              : m.id === 'qr'
                              ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                              : m.id === 'tarjeta'
                              ? 'bg-purple-600 border-purple-500 text-white shadow-lg'
                              : 'bg-amber-600 border-amber-500 text-white shadow-lg'
                            : 'bg-zinc-900 border-white/10 text-zinc-400 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        <span>{m.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* DESGLOSE MIXTO */}
                {form.metodo_pago === 'mixto' && (
                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-3 animate-in fade-in duration-200">
                    <p className="text-[11px] font-black uppercase tracking-widest text-amber-400">🔄 Desglose de Pago Combinado</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 block">💵 Efectivo</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={form.mixto_efectivo}
                          onChange={(e) => setForm({ ...form, mixto_efectivo: e.target.value })}
                          placeholder="0.00"
                          className="w-full h-10 bg-zinc-900 border border-amber-500/30 rounded-xl px-3 text-xs font-bold text-white focus:border-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 block">📱 QR / Transf.</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={form.mixto_qr}
                          onChange={(e) => setForm({ ...form, mixto_qr: e.target.value })}
                          placeholder="0.00"
                          className="w-full h-10 bg-zinc-900 border border-amber-500/30 rounded-xl px-3 text-xs font-bold text-white focus:border-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 block">💳 Tarjeta</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={form.mixto_tarjeta}
                          onChange={(e) => setForm({ ...form, mixto_tarjeta: e.target.value })}
                          placeholder="0.00"
                          className="w-full h-10 bg-zinc-900 border border-amber-500/30 rounded-xl px-3 text-xs font-bold text-white focus:border-amber-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Alerta inteligente de cuadre */}
                    {(() => {
                      const ef = parseFloat(form.mixto_efectivo || '0')
                      const qr = parseFloat(form.mixto_qr || '0')
                      const tj = parseFloat(form.mixto_tarjeta || '0')
                      const suma = ef + qr + tj
                      const total = parseFloat(form.costo || '0')
                      const dif = suma - total

                      if (Math.abs(dif) <= 0.05 && total > 0) {
                        return (
                          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between text-xs font-bold text-emerald-300">
                            <span>✅ Desglose Cuadrado Exactamente</span>
                            <span>Suma: {formatCurrency(suma)}</span>
                          </div>
                        )
                      }
                      return (
                        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-between text-xs font-bold text-rose-300">
                          <span>⚠️ {dif < 0 ? `Faltan ${formatCurrency(Math.abs(dif))}` : `Sobran ${formatCurrency(dif)}`} para alcanzar el total ({formatCurrency(total)})</span>
                          <span>Suma: {formatCurrency(suma)}</span>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* COMPROBANTE DE PAGO (QR / Tarjeta / Mixto) */}
                {(form.metodo_pago === 'qr' || form.metodo_pago === 'tarjeta' || form.metodo_pago === 'mixto') && (
                  <div className="pt-2">
                    <label className="text-[11px] font-bold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-blue-400" /> Adjuntar Comprobante o Captura del Pago (Opcional)
                    </label>
                    <ImageUpload
                      label="Captura de pantalla o voucher del pago QR / POS"
                      defaultImage={form.comprobante_url || undefined}
                      onUploadSuccess={(url) => setForm({ ...form, comprobante_url: url })}
                      onUploadError={(err) => toastError(err)}
                    />
                  </div>
                )}
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="h-11 px-6 font-bold text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving || !form.cuenta_codigo || !form.costo || parseFloat(form.costo) <= 0}
                  className="h-11 px-8 font-black uppercase tracking-wider bg-green-600 hover:bg-green-500 text-xs shadow-lg shadow-green-600/20 flex items-center gap-2"
                >
                  {saving ? 'Guardando Venta...' : '💰 Confirmar y Registrar Venta'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tabla con columnas ordenables */}
      <Card className="border-white/5 bg-zinc-900/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {sorted.length} registro{sorted.length !== 1 ? 's' : ''} · Click en columna para ordenar
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('fecha')}>
                    Fecha <SortIcon col="fecha" />
                  </th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500">C.I.</th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('nombre')}>
                    Nombre <SortIcon col="nombre" />
                  </th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('cuenta_detalle')}>
                    Servicio / Producto <SortIcon col="cuenta_detalle" />
                  </th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500">Detalle</th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('metodo_pago')}>
                    Pago <SortIcon col="metodo_pago" />
                  </th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('costo')}>
                    Monto <SortIcon col="costo" />
                  </th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sorted.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-zinc-600">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="w-8 h-8 text-zinc-700" />
                      <p className="font-bold">Sin ventas registradas</p>
                      <p className="text-xs text-zinc-700">Usa el botón &quot;Nueva Venta&quot; para agregar una</p>
                    </div>
                  </td></tr>
                ) : (
                  sorted.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap text-xs font-mono">{tx.fecha}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px]">
                        {tx.ci && tx.ci !== '0000000' && tx.ci !== '0' && tx.ci !== '—' ? (
                          <span className="text-emerald-400 font-bold">{tx.ci}</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-white font-semibold text-xs">{tx.nombre}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col">
                          <span className="text-zinc-300 text-xs font-medium">{tx.cuenta_detalle}</span>
                          <span className="text-[10px] text-zinc-600 font-mono">{tx.cuenta_codigo}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-zinc-400 text-xs max-w-[240px]">
                        {(() => {
                          const cleanNotas = (tx.notas || '')
                            .replace(/\n?\[Comprobante\]:\s*data:[^\s]+/gi, '')
                            .replace(/\[Comprobante\]:\s*data:[^\s]+/gi, '')
                            .trim()
                          const matchDesc = (cleanNotas || '').match(/Desc:\s*-Bs\s*([0-9.]+)/i) || (tx.glosa || '').match(/Desc.*:\s*-Bs\s*([0-9.]+)/i)
                          const descMonto = (tx as any).descuento ? Number((tx as any).descuento) : (matchDesc ? parseFloat(matchDesc[1]) : 0)
                          return (
                            <div className="flex flex-col">
                              <span className="truncate text-zinc-300 font-medium">{tx.glosa}</span>
                              {cleanNotas && (
                                <span className={`text-[10px] truncate mt-0.5 ${String(cleanNotas).includes('Desc') || String(cleanNotas).includes('Precio original') ? 'text-amber-400 font-semibold' : 'text-zinc-500'}`} title={cleanNotas}>
                                  {cleanNotas}
                                </span>
                              )}
                              {descMonto > 0 && (
                                <span className="inline-flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 w-fit mt-1 shadow-sm">
                                  ⭐ Descuento Especial: -{formatCurrency(descMonto)}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Badge 
                            variant={tx.metodo_pago === 'descuento_caja' ? 'warning' : tx.metodo_pago === 'qr' ? 'info' : 'default'} 
                            className={`text-[9px] uppercase whitespace-nowrap ${tx.metodo_pago === 'descuento_caja' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' : ''}`}
                          >
                            {tx.metodo_pago === 'efectivo' ? '💵 Efect.' : tx.metodo_pago === 'qr' ? '📱 QR' : tx.metodo_pago === 'tarjeta' ? '💳 Tarj.' : tx.metodo_pago === 'descuento_caja' ? '⚡ Desc.' : tx.metodo_pago === 'mixto' ? '🔄 Mix' : tx.metodo_pago || '—'}
                          </Badge>
                          {tx.tipo_movimiento === 'USO_TIENDA' && (
                            <Badge className="text-[8px] uppercase bg-violet-600/20 text-violet-300 border-violet-500/30">TIENDA</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {(() => {
                          const matchDesc = (tx.notas || '').match(/Desc:\s*-Bs\s*([0-9.]+)/i) || (tx.glosa || '').match(/Desc.*:\s*-Bs\s*([0-9.]+)/i)
                          const matchOrig = (tx.notas || '').match(/Original:\s*Bs\s*([0-9.]+)/i) || (tx.glosa || '').match(/Original:\s*Bs\s*([0-9.]+)/i)
                          const descMonto = (tx as any).descuento ? Number((tx as any).descuento) : (matchDesc ? parseFloat(matchDesc[1]) : 0)
                          const origMonto = matchOrig ? parseFloat(matchOrig[1]) : (descMonto > 0 ? (Number(tx.costo) + descMonto) : Number(tx.costo))
                          return (
                            <div className="flex flex-col items-end">
                              {descMonto > 0 && (
                                <div className="flex items-center gap-1 text-[10px] font-mono leading-none mb-0.5">
                                  <span className="line-through text-zinc-500">{formatCurrency(origMonto)}</span>
                                  <span className="text-amber-400 font-black">(-{formatCurrency(descMonto)})</span>
                                </div>
                              )}
                              <span className={`font-black text-sm font-mono ${tx.tipo_movimiento === 'EGRESO' ? 'text-red-400' : 'text-green-400'}`}>
                                {tx.tipo_movimiento === 'EGRESO' ? '-' : '+'}{formatCurrency(tx.costo)}
                              </span>
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setTxToEdit(tx)}
                          className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-400 text-[11px] font-bold transition flex items-center gap-1 mx-auto"
                          title="Editar este registro"
                        >
                          <Edit3 size={12} />
                          <span>Editar</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal para editar cualquier registro contable */}
      <ModalEditarTransaccion
        transaction={txToEdit}
        isOpen={!!txToEdit}
        onClose={() => setTxToEdit(null)}
        onSuccess={loadData}
      />
    </div>
  )
}
