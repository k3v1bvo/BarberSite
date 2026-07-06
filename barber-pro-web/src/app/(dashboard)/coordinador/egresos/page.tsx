'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { ArrowDownCircle, Plus, X, FileText } from 'lucide-react'

interface PlanCuenta { codigo: string; detalle: string; tipo: string }
interface Egreso {
  id: string; fecha: string; concepto: string; proveedor: string | null
  monto_bruto: number; tiene_factura: boolean; iva: number; it: number
  monto_neto: number; numero_factura: string | null; cuenta_codigo: string | null
  creado_en: string
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
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Cuenta</label>
                <select value={form.cuenta_codigo} onChange={(e) => setForm({ ...form, cuenta_codigo: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-rose-500/50 outline-none appearance-none">
                  <option value="">Seleccionar...</option>
                  {cuentas.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.detalle}</option>)}
                </select>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {egresos.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-600">No hay egresos registrados</td></tr>
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
