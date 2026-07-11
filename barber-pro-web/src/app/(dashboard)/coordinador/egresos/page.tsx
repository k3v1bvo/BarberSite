'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { ArrowDownCircle, Plus, X, FileText, Search, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ImageUpload } from '@/components/ui/ImageUpload'

interface PlanCuenta { id?: string; codigo: string; detalle: string; tipo: string }
interface Egreso {
  id: string; fecha: string; concepto: string; proveedor: string | null
  monto_bruto: number; tiene_factura: boolean; iva: number; it: number
  monto_neto: number; numero_factura: string | null; cuenta_codigo: string | null
  creado_en: string; metodo_pago?: string; monto_qr?: number; comprobante_url?: string | null
}

export default function EgresosPage() {
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [cuentas, setCuentas] = useState<PlanCuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    concepto: '', proveedor: '', monto_bruto: '', cuenta_codigo: '',
    tiene_factura: false, numero_factura: '', notas: '', metodo_pago: 'efectivo', monto_efectivo: '', monto_qr: ''
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
      setSelectedEgresoQr(null)
      setQrModalUrl('')
      loadData()
    }
    setSavingQr(false)
  }
  
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const [eRes, ctasRes] = await Promise.all([
      fetch('/api/egresos'),
      fetch('/api/plan-cuentas'),
    ])
    if (eRes.ok) setEgresos(await eRes.json())
    if (ctasRes.ok) {
      const all = await ctasRes.json()
      setCuentas(all.filter((c: PlanCuenta) => c.tipo === 'EGRESO'))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

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
    } catch (err) {
      console.error(err)
      alert('Error al crear categoría')
    } finally {
      setSavingCategoria(false)
    }
  }

  const eliminarCategoria = async (id: string, detalle: string) => {
    if (!confirm(`¿Estás seguro de eliminar la categoría "${detalle}"?`)) return
    try {
      const { error } = await supabase.from('plan_cuentas').delete().eq('id', id)
      if (error) throw error
      setCuentas(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      console.error(e)
      alert('Error al eliminar, asegúrate que no esté en uso.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/egresos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concepto: form.concepto,
        proveedor: form.proveedor || null,
        monto_bruto: parseFloat(form.monto_bruto),
        cuenta_codigo: form.cuenta_codigo || null,
        tiene_factura: form.tiene_factura,
        numero_factura: form.numero_factura || null,
        notas: form.notas || null,
        metodo_pago: form.metodo_pago,
        monto_efectivo: form.metodo_pago === 'mixto' ? parseFloat(form.monto_efectivo) : 0,
        monto_qr: form.metodo_pago === 'mixto' ? parseFloat(form.monto_qr) : 0,
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ concepto: '', proveedor: '', monto_bruto: '', cuenta_codigo: '', tiene_factura: false, numero_factura: '', notas: '', metodo_pago: 'efectivo', monto_efectivo: '', monto_qr: '' })
      setSearchCategoria('')
      loadData()
    }
    setSaving(false)
  }

  const totalEgresos = egresos.reduce((s, e) => s + Number(e.monto_neto), 0)

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-rose-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            <span className="text-rose-500">Egresos</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Gastos con y sin factura (IVA 13%, IT 3%)</p>
        </div>
        <div className="flex items-center gap-4">
          <Card className="border-white/5 bg-zinc-900/80">
            <CardContent className="px-4 py-3 flex items-center gap-3">
              <ArrowDownCircle className="w-5 h-5 text-rose-500" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Neto</p>
                <p className="text-lg font-black text-rose-400">{formatCurrency(totalEgresos)}</p>
              </div>
            </CardContent>
          </Card>
          <Button variant="primary" onClick={() => setShowForm(!showForm)} className="gap-2 font-black uppercase tracking-wider bg-rose-500 hover:bg-rose-400">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cerrar' : 'Nuevo'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="border-rose-500/30 bg-zinc-900/80 animate-in slide-in-from-top-2 duration-300">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Concepto</label>
                <input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-rose-500/50 outline-none" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Proveedor</label>
                <input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-rose-500/50 outline-none" />
              </div>
              <div className="relative">
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
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl pl-9 pr-8 text-sm text-white focus:border-rose-500/50 outline-none"
                    placeholder="Buscar por código o nombre de cuenta..."
                    value={searchCategoria}
                    onChange={e => {
                      setSearchCategoria(e.target.value)
                      setShowCategoriaDropdown(true)
                      if (!e.target.value) setForm({ ...form, cuenta_codigo: '' })
                    }}
                    onFocus={() => setShowCategoriaDropdown(true)}
                    required
                  />
                  {searchCategoria && (
                    <button type="button" onClick={() => { setSearchCategoria(''); setForm({ ...form, cuenta_codigo: '' }) }}
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
                            <div key={cat.id || cat.codigo} className={`group flex items-center gap-2 pr-1 hover:bg-white/5 transition-colors ${
                                form.cuenta_codigo === cat.codigo ? 'bg-rose-500/10 border-l-2 border-rose-500' : ''
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
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const sug = sugerirSubcategoria(cat.codigo)
                                  setNewCategoriaCodigo(sug)
                                  setNewCategoriaNombre('')
                                  setShowNewCategoria(true)
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-all shrink-0"
                                title={`Crear subcategoría de ${cat.codigo} (${cat.detalle})`}
                              >
                                <Plus size={12} />
                              </button>
                              {cat.id && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); eliminarCategoria(cat.id!, cat.detalle) }}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-all shrink-0"
                                  title={`Eliminar "${cat.detalle}"`}
                                >
                                  <X size={12} />
                                </button>
                              )}
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
                
                {/* Crear nueva categoría inline */}
                {showNewCategoria && (
                  <div className="mt-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase text-amber-500 tracking-widest">Nueva Categoría</p>
                      <button type="button" onClick={() => setShowNewCategoria(false)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
                    </div>
                    <input placeholder="Nombre de la categoría *" value={newCategoriaNombre} onChange={e => setNewCategoriaNombre(e.target.value)}
                      className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white outline-none focus:border-amber-500/50" />
                    <input placeholder="Código contable (ej: 5.1.1)" value={newCategoriaCodigo} onChange={e => setNewCategoriaCodigo(e.target.value)}
                      className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white font-mono outline-none focus:border-amber-500/50" />
                    <p className="text-[10px] text-zinc-500">💡 Usa código 5.x para egresos.</p>
                    <Button type="button" onClick={crearNuevaCategoria} disabled={savingCategoria || !newCategoriaNombre.trim()}
                      className="w-full bg-amber-600 hover:bg-amber-500 text-black font-black h-10 text-xs uppercase tracking-widest">
                      <Plus size={14} className="mr-2" /> {savingCategoria ? 'Creando...' : 'Crear y Seleccionar'}
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Monto Bruto (Bs)</label>
                <input type="number" step="0.01" min="0" value={form.monto_bruto} onChange={(e) => setForm({ ...form, monto_bruto: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-rose-500/50 outline-none" required />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox" id="tiene_factura"
                  checked={form.tiene_factura}
                  onChange={(e) => setForm({ ...form, tiene_factura: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20 bg-zinc-900 text-rose-500 focus:ring-rose-500"
                />
                <label htmlFor="tiene_factura" className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Con factura
                </label>
              </div>
              {form.tiene_factura && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Nro. Factura</label>
                  <input value={form.numero_factura} onChange={(e) => setForm({ ...form, numero_factura: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-rose-500/50 outline-none" />
                </div>
              )}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Método de Pago</label>
                <select value={form.metodo_pago} onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-rose-500/50 outline-none appearance-none">
                  <option value="efectivo">Efectivo</option>
                  <option value="qr">QR / Transferencia</option>
                  <option value="mixto">Mixto (Efectivo + QR)</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
              {form.metodo_pago === 'mixto' && (
                <>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Monto Efectivo (Bs)</label>
                    <input type="number" step="0.01" min="0" value={form.monto_efectivo} onChange={(e) => setForm({ ...form, monto_efectivo: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-rose-500/50 outline-none" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Monto QR (Bs)</label>
                    <input type="number" step="0.01" min="0" value={form.monto_qr} onChange={(e) => setForm({ ...form, monto_qr: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-rose-500/50 outline-none" required />
                  </div>
                </>
              )}
              <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" disabled={saving} className="font-black uppercase tracking-wider bg-rose-500 hover:bg-rose-400">{saving ? 'Guardando...' : 'Registrar Egreso'}</Button>
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
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Concepto</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Proveedor</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Bruto</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Factura</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">IVA</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Neto</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Comprobante QR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {egresos.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-zinc-600">No hay egresos registrados</td></tr>
                ) : (
                  egresos.map((eg) => (
                    <tr key={eg.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{eg.fecha}</td>
                      <td className="px-4 py-3 text-white font-bold">{eg.concepto}</td>
                      <td className="px-4 py-3 text-zinc-400">{eg.proveedor || '—'}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{formatCurrency(eg.monto_bruto)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={eg.tiene_factura ? 'success' : 'default'} className="text-[10px]">
                          {eg.tiene_factura ? `✓ ${eg.numero_factura || ''}` : 'Sin'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 text-xs">{formatCurrency(eg.iva)}</td>
                      <td className="px-4 py-3 text-right font-black text-rose-400">{formatCurrency(eg.monto_neto)}</td>
                      <td className="px-4 py-3 text-center">
                        {eg.metodo_pago === 'qr' || (eg.monto_qr && eg.monto_qr > 0) || String(eg.metodo_pago).toLowerCase().includes('qr') || eg.comprobante_url ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEgresoQr(eg)
                              setQrModalUrl(eg.comprobante_url || '')
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                              eg.comprobante_url
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                            }`}
                          >
                            {eg.comprobante_url ? '📱 Ver / Cambiar QR' : '📄 + Subir QR'}
                          </button>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* QR Upload / View Modal */}
      {selectedEgresoQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 sm:p-6 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-base font-black uppercase tracking-wider text-white">Comprobante de Pago QR</h3>
              <button type="button" onClick={() => setSelectedEgresoQr(null)} className="text-zinc-500 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold text-white">{selectedEgresoQr.concepto}</p>
              <p className="text-xs text-zinc-400">Proveedor: {selectedEgresoQr.proveedor || '—'} | Monto: <b className="text-orange-400">Bs {formatCurrency(selectedEgresoQr.monto_neto)}</b></p>
            </div>

            {selectedEgresoQr.comprobante_url && (
              <div className="p-3 bg-zinc-950 border border-white/10 rounded-xl space-y-2">
                <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Comprobante Actual</p>
                {selectedEgresoQr.comprobante_url.startsWith('http') ? (
                  <a href={selectedEgresoQr.comprobante_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 underline break-all flex items-center gap-1">
                    Ver Comprobante <ExternalLink size={12} />
                  </a>
                ) : (
                  <p className="text-xs text-zinc-300 font-mono break-all">{selectedEgresoQr.comprobante_url}</p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <ImageUpload
                label="Subir Imagen / Captura del QR"
                onUploadSuccess={(url) => setQrModalUrl(url)}
              />
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">O pegar enlace / nota de comprobante</label>
                <input
                  type="text"
                  value={qrModalUrl}
                  onChange={(e) => setQrModalUrl(e.target.value)}
                  placeholder="https://... o referencia del comprobante"
                  className="w-full h-10 bg-zinc-950 border border-white/10 rounded-xl px-3 text-xs text-white outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
              <Button variant="outline" onClick={() => setSelectedEgresoQr(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={savingQr}
                onClick={handleSaveQrModal}
                className="bg-orange-500 hover:bg-orange-400 font-black text-xs uppercase tracking-wider"
              >
                {savingQr ? 'Guardando...' : 'Guardar Comprobante QR'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
