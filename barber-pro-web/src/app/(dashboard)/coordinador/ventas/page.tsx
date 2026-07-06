'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Receipt, Plus, X, Store, Filter } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'

interface PlanCuenta { codigo: string; detalle: string; tipo: string }
interface Transaction {
  id: string; fecha: string; ci: string; nombre: string
  cuenta_codigo: string; cuenta_detalle: string; glosa: string
  costo: number; tipo_movimiento: string; metodo_pago: string | null
  creado_en: string
}
interface Servicio { id: string; nombre: string; precio: number }
interface Producto { id: string; nombre: string; precio_venta: number }

export default function VentasPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cuentas, setCuentas] = useState<PlanCuenta[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filtroLibro, setFiltroLibro] = useState<'VENTAS' | 'USO_TIENDA' | 'TODOS'>('TODOS')
  const [buscandoCi, setBuscandoCi] = useState(false)
  const [cumpleanosMsg, setCumpleanosMsg] = useState<string | null>(null)
  const hoy = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    ci: '', nombre: '', cuenta_codigo: '', glosa: '', costo: '',
    metodo_pago: 'efectivo', notas: '',
    mixto_efectivo: '', mixto_qr: '', mixto_tarjeta: '',
  })

  // Timeout para debounce
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

  const handleCiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ci = e.target.value
    setForm(prev => ({ ...prev, ci }))
    
    if (searchTimeout) clearTimeout(searchTimeout)
    setCumpleanosMsg(null)
    
    if (ci.length >= 4) {
      setSearchTimeout(setTimeout(async () => {
        setBuscandoCi(true)
        try {
          const supabase = createClient()
          const { data: cliente } = await supabase
            .from('clientes')
            .select('nombre, cumpleanos')
            .eq('ci', ci)
            .single()

          if (cliente) {
            setForm(prev => ({ ...prev, nombre: cliente.nombre }))
            
            // Check birthday
            if (cliente.cumpleanos) {
              const cumple = new Date(cliente.cumpleanos)
              const today = new Date()
              if (cumple.getMonth() === today.getMonth() && cumple.getDate() === today.getDate()) {
                setCumpleanosMsg(`Hoy es el cumpleaños de ${cliente.nombre}. Puedes ofrecerle un corte gratis o un producto sorpresa.`)
              }
            }
          }
        } catch (error) {
          // Ignore errors
        } finally {
          setBuscandoCi(false)
        }
      }, 800))
    }
  }

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const libroParam = filtroLibro === 'TODOS' ? 'VENTAS&libro=USO_TIENDA' : filtroLibro
    const [txRes, ctasRes, { data: sData }, { data: pData }] = await Promise.all([
      filtroLibro === 'TODOS'
        ? Promise.all([
            fetch(`/api/transactions?libro=VENTAS&limit=50`),
            fetch(`/api/transactions?libro=USO_TIENDA&limit=50`),
          ]).then(async ([r1, r2]) => {
            const d1 = r1.ok ? await r1.json() : []
            const d2 = r2.ok ? await r2.json() : []
            return [...d1, ...d2].sort((a: any, b: any) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()).slice(0, 100)
          })
        : fetch(`/api/transactions?libro=${filtroLibro}&limit=50`).then(r => r.ok ? r.json() : []),
      fetch('/api/plan-cuentas'),
      supabase.from('servicios').select('id, nombre, precio').eq('is_active', true),
      supabase.from('productos').select('id, nombre, precio_venta').eq('is_active', true)
    ])
    if (Array.isArray(txRes)) setTransactions(txRes)
    else if (txRes.ok) setTransactions(await txRes.json())
    else setTransactions(txRes)
    if (ctasRes.ok) setCuentas(await ctasRes.json())
    if (sData) setServicios(sData)
    if (pData) setProductos(pData)
    setLoading(false)
  }, [filtroLibro])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        libro: 'VENTAS',
        ci: form.ci, nombre: form.nombre,
        cuenta_codigo: realCuentaCodigo,
        cuenta_detalle: realCuentaDetalle,
        producto_id: productoId,
        glosa: form.glosa, costo: parseFloat(form.costo),
        tipo_movimiento: 'VENTA_SERVICIO',
        metodo_pago: form.metodo_pago,
        notas: form.metodo_pago === 'mixto'
          ? `Efectivo: Bs ${form.mixto_efectivo || 0} | QR: Bs ${form.mixto_qr || 0} | Tarjeta: Bs ${form.mixto_tarjeta || 0}${form.notas ? ' | ' + form.notas : ''}`
          : form.notas || null,
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ ci: '', nombre: '', cuenta_codigo: '', glosa: '', costo: '', metodo_pago: 'efectivo', notas: '', mixto_efectivo: '', mixto_qr: '', mixto_tarjeta: '' })
      loadData()
    }
    setSaving(false)
  }

  const totalHoy = transactions.filter((t) => t.fecha === hoy && t.tipo_movimiento !== 'USO_TIENDA').reduce((s, t) => s + Number(t.costo), 0)
  const totalTiendaHoy = transactions.filter((t) => t.fecha === hoy && t.tipo_movimiento === 'USO_TIENDA').reduce((s, t) => s + Number(t.costo), 0)
  const ventasCuentas = cuentas.filter((c) => c.codigo.startsWith('4.1'))

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-green-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            Ventas / <span className="text-green-500">Servicios</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Pagos de clientes por cortes, barba y productos</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Card className="border-white/5 bg-zinc-900/80">
            <CardContent className="px-4 py-3 flex items-center gap-3">
              <Receipt className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Ventas Hoy</p>
                <p className="text-lg font-black text-white">{formatCurrency(totalHoy)}</p>
              </div>
            </CardContent>
          </Card>
          {totalTiendaHoy > 0 && (
            <Card className="border-violet-500/20 bg-zinc-900/80">
              <CardContent className="px-4 py-3 flex items-center gap-3">
                <Store className="w-5 h-5 text-violet-400" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Uso Tienda Hoy</p>
                  <p className="text-lg font-black text-violet-400">{formatCurrency(totalTiendaHoy)}</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Button variant="primary" onClick={() => setShowForm(!showForm)} className="gap-2 font-black uppercase tracking-wider">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cerrar' : 'Nuevo'}
          </Button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-zinc-500" />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mr-2">Filtrar:</span>
        {(['TODOS', 'VENTAS', 'USO_TIENDA'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltroLibro(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              filtroLibro === f
                ? f === 'USO_TIENDA'
                  ? 'bg-violet-600 text-white'
                  : 'bg-amber-500 text-black'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {f === 'TODOS' ? 'Todas' : f === 'VENTAS' ? 'Ventas' : '⚡ Uso Tienda'}
          </button>
        ))}
      </div>

      {showForm && (
        <Card className="border-green-500/30 bg-zinc-900/80 animate-in slide-in-from-top-2 duration-300">
          <CardContent className="p-6">
            {/* 🎂 BANNER DE CUMPLEAÑOS 🎂 */}
            {cumpleanosMsg && (
              <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 animate-in fade-in zoom-in">
                <span className="text-2xl mt-1">🎂</span>
                <div>
                  <h3 className="font-black text-amber-500 uppercase tracking-widest text-sm">¡Feliz Cumpleaños!</h3>
                  <p className="text-amber-200/80 text-xs mt-1">{cumpleanosMsg}</p>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">C.I.</label>
                <div className="relative">
                  <input value={form.ci} onChange={handleCiChange} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-green-500/50 outline-none" required placeholder="Carnet de Identidad..." />
                  {buscandoCi && <div className="absolute right-3 top-3 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Nombre</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-green-500/50 outline-none" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Servicio / Producto</label>
                <select value={form.cuenta_codigo} onChange={(e) => {
                  const val = e.target.value
                  let newCosto = form.costo
                  let newGlosa = form.glosa
                  if (val.startsWith('srv-')) {
                    const s = servicios.find(x => x.id === val.replace('srv-', ''))
                    if (s) { newCosto = s.precio.toString(); newGlosa = `Venta: ${s.nombre}` }
                  } else if (val.startsWith('prd-')) {
                    const p = productos.find(x => x.id === val.replace('prd-', ''))
                    if (p) { newCosto = p.precio_venta.toString(); newGlosa = `Venta: ${p.nombre}` }
                  }
                  setForm({ ...form, cuenta_codigo: val, costo: newCosto, glosa: newGlosa })
                }} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-green-500/50 outline-none appearance-none" required>
                  <option value="">Seleccionar...</option>
                  <optgroup label="Servicios">
                    {servicios.map((s) => (
                      <option key={`srv-${s.id}`} value={`srv-${s.id}`}>{s.nombre} - {formatCurrency(s.precio)}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Productos">
                    {productos.map((p) => (
                      <option key={`prd-${p.id}`} value={`prd-${p.id}`}>{p.nombre} - {formatCurrency(p.precio_venta)}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Otras Cuentas de Ingreso">
                    {ventasCuentas.map((c) => (
                      <option key={c.codigo} value={c.codigo}>{c.detalle}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Glosa</label>
                <input value={form.glosa} onChange={(e) => setForm({ ...form, glosa: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-green-500/50 outline-none" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Monto (Bs)</label>
                <input type="number" step="0.01" min="0" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-green-500/50 outline-none" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Método pago</label>
                <select value={form.metodo_pago} onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-green-500/50 outline-none appearance-none">
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="qr">📱 QR</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                  <option value="mixto">🔄 Mixto (Efectivo + QR + Tarjeta)</option>
                </select>
              </div>
              {form.metodo_pago === 'mixto' && (
                <div className="md:col-span-2 lg:col-span-3">
                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-3">🔄 Desglose Mixto</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">💵 Efectivo (Bs)</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={form.mixto_efectivo}
                          onChange={(e) => setForm({ ...form, mixto_efectivo: e.target.value })}
                          placeholder="0.00"
                          className="w-full h-11 bg-zinc-950 border border-amber-500/30 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">📱 QR / Transf. (Bs)</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={form.mixto_qr}
                          onChange={(e) => setForm({ ...form, mixto_qr: e.target.value })}
                          placeholder="0.00"
                          className="w-full h-11 bg-zinc-950 border border-amber-500/30 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">💳 Tarjeta (Bs)</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={form.mixto_tarjeta}
                          onChange={(e) => setForm({ ...form, mixto_tarjeta: e.target.value })}
                          placeholder="0.00"
                          className="w-full h-11 bg-zinc-950 border border-amber-500/30 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none"
                        />
                      </div>
                    </div>
                    {form.costo && (parseFloat(form.mixto_efectivo || '0') + parseFloat(form.mixto_qr || '0') + parseFloat(form.mixto_tarjeta || '0')) !== parseFloat(form.costo) && (
                      <p className="text-red-400 text-xs mt-2 font-bold">
                        ⚠ La suma ({formatCurrency(parseFloat(form.mixto_efectivo || '0') + parseFloat(form.mixto_qr || '0') + parseFloat(form.mixto_tarjeta || '0'))}) no coincide con el monto total ({formatCurrency(parseFloat(form.costo))})
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" disabled={saving} className="font-black uppercase tracking-wider">{saving ? 'Guardando...' : 'Registrar Venta'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-white/5 bg-zinc-900/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Fecha</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">C.I.</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Nombre</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Servicio</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Glosa</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Pago</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-600">No hay ventas registradas</td></tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{tx.fecha}</td>
                      <td className="px-4 py-3 text-zinc-300 font-mono text-xs">{tx.ci}</td>
                      <td className="px-4 py-3 text-white font-bold">{tx.nombre}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">{tx.cuenta_detalle}</td>
                      <td className="px-4 py-3 text-zinc-300">{tx.glosa}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge 
                            variant={tx.metodo_pago === 'descuento_caja' ? 'warning' : tx.metodo_pago === 'qr' ? 'info' : 'default'} 
                            className={`text-[10px] uppercase ${tx.metodo_pago === 'descuento_caja' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' : ''}`}
                          >
                            {tx.metodo_pago === 'descuento_caja' ? 'Desc. Caja' : (tx.metodo_pago || '—')}
                          </Badge>
                          {tx.tipo_movimiento === 'USO_TIENDA' && (
                            <Badge className="text-[9px] uppercase bg-violet-600/20 text-violet-300 border-violet-500/30">TIENDA</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-green-400">{formatCurrency(tx.costo)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
