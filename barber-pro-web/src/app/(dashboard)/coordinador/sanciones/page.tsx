'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle, Plus, X, User, Phone, Mail } from 'lucide-react'

interface PlanCuenta { codigo: string; detalle: string; es_sancion: boolean }
interface Barbero { id: string; full_name: string; role: string; avatar_url: string | null; phone: string | null; email: string }
interface Sancion {
  id: string; fecha: string; ci: string; nombre: string
  cuenta_detalle: string; glosa: string; costo: number
  empleado_id: string | null; creado_en: string
}

export default function SancionesPage() {
  const supabase = createClient()
  const [sanciones, setSanciones] = useState<Sancion[]>([])
  const [cuentasSancion, setCuentasSancion] = useState<PlanCuenta[]>([])
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    empleado_id: '', ci: '', nombre: '', cuenta_codigo: '',
    glosa: '', costo: '',
  })

  const loadData = useCallback(async () => {
    const [txRes, ctasRes] = await Promise.all([
      fetch('/api/transactions?sancion=true&limit=50'),
      fetch('/api/plan-cuentas'),
    ])
    if (txRes.ok) setSanciones(await txRes.json())
    if (ctasRes.ok) {
      const all = await ctasRes.json()
      setCuentasSancion(all.filter((c: PlanCuenta) => c.es_sancion))
    }

    const { data: bList } = await supabase
      .from('profiles')
      .select('id, full_name, role, avatar_url, phone, email')
      .in('role', ['barbero', 'coordinador'])
      .eq('is_active', true)
    if (bList) setBarberos(bList)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const handleBarberoChange = (id: string) => {
    const b = barberos.find((b) => b.id === id)
    setForm({ ...form, empleado_id: id, nombre: b?.full_name || '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const cuenta = cuentasSancion.find((c) => c.codigo === form.cuenta_codigo)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        libro: 'CAJA_CHICA',
        ci: form.ci, nombre: form.nombre,
        cuenta_codigo: form.cuenta_codigo,
        cuenta_detalle: cuenta?.detalle || form.cuenta_codigo,
        glosa: form.glosa,
        costo: parseFloat(form.costo),
        tipo_movimiento: 'SANCCION',
        es_sancion: true,
        empleado_id: form.empleado_id || null,
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ empleado_id: '', ci: '', nombre: '', cuenta_codigo: '', glosa: '', costo: '' })
      loadData()
    }
    setSaving(false)
  }

  const selectedBarbero = barberos.find(b => b.id === form.empleado_id)
  const totalSanciones = sanciones.reduce((s, t) => s + Number(t.costo), 0)

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-red-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            <span className="text-red-500">Sanciones</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Incumplimientos, ausencias, retiros sin permiso</p>
        </div>
        <div className="flex items-center gap-4">
          <Card className="border-red-500/20 bg-zinc-900/80">
            <CardContent className="px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total</p>
                <p className="text-lg font-black text-red-400">{formatCurrency(totalSanciones)}</p>
              </div>
            </CardContent>
          </Card>
          <Button variant="primary" onClick={() => setShowForm(!showForm)} className="gap-2 font-black uppercase tracking-wider bg-red-500 hover:bg-red-400">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cerrar' : 'Nueva'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="border-red-500/30 bg-zinc-900/80 animate-in slide-in-from-top-2 duration-300">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {selectedBarbero && (
                <div className="flex items-center gap-5 p-4 bg-zinc-950/50 border border-white/5 rounded-xl animate-in fade-in duration-300">
                  {selectedBarbero.avatar_url ? (
                    <img src={selectedBarbero.avatar_url} alt={selectedBarbero.full_name} className="w-16 h-16 rounded-full object-cover border-2 border-zinc-800" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-zinc-700">
                      <User className="w-8 h-8 text-zinc-500" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <h3 className="font-black text-white text-lg uppercase tracking-wide">{selectedBarbero.full_name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-zinc-400">
                       <Badge variant="outline" className="text-[10px] uppercase border-white/10">{selectedBarbero.role}</Badge>
                       {selectedBarbero.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedBarbero.phone}</span>}
                       {selectedBarbero.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {selectedBarbero.email}</span>}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Empleado</label>
                  <select value={form.empleado_id} onChange={(e) => handleBarberoChange(e.target.value)} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-red-500/50 outline-none appearance-none" required>
                    <option value="">Seleccionar...</option>
                    {barberos.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">C.I.</label>
                  <input value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-red-500/50 outline-none" required />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Motivo</label>
                  <select value={form.cuenta_codigo} onChange={(e) => setForm({ ...form, cuenta_codigo: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-red-500/50 outline-none appearance-none" required>
                    <option value="">Seleccionar...</option>
                    {cuentasSancion.map((c) => <option key={c.codigo} value={c.codigo}>{c.detalle}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Descripción</label>
                  <input value={form.glosa} onChange={(e) => setForm({ ...form, glosa: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-red-500/50 outline-none" required />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Monto (Bs)</label>
                  <input type="number" step="0.01" min="0" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-red-500/50 outline-none" required />
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary" disabled={saving} className="w-full h-11 font-black uppercase tracking-wider bg-red-500 hover:bg-red-400">{saving ? 'Guardando...' : 'Registrar Sanción'}</Button>
                </div>
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
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Empleado</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Motivo</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Detalle</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sanciones.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-600">No hay sanciones registradas</td></tr>
                ) : (
                  sanciones.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{tx.fecha}</td>
                      <td className="px-4 py-3 text-white font-bold">{tx.nombre}</td>
                      <td className="px-4 py-3"><Badge variant="danger" className="text-[10px] uppercase">{tx.cuenta_detalle}</Badge></td>
                      <td className="px-4 py-3 text-zinc-300">{tx.glosa}</td>
                      <td className="px-4 py-3 text-right font-black text-red-400">{formatCurrency(tx.costo)}</td>
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
