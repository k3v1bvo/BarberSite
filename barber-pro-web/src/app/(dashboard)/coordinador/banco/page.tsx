'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { Landmark, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Transaction {
  id: string; fecha: string; ci: string; nombre: string
  glosa: string; costo: number; tipo_movimiento: string; creado_en: string
}

export default function BancoPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showSaldoModal, setShowSaldoModal] = useState(false)
  const [nuevoSaldoReal, setNuevoSaldoReal] = useState('')
  const [saving, setSaving] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const supabase = createClient()

  const [form, setForm] = useState({
    ci: '', nombre: '', glosa: '', costo: '',
    tipo_movimiento: 'DEPOSITO',
  })

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile) setUserRole(profile.role)
    }
    const res = await fetch('/api/transactions?libro=BANCO&limit=50')
    if (res.ok) setTransactions(await res.json())
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        libro: 'BANCO',
        ci: form.ci, nombre: form.nombre,
        cuenta_codigo: '1.1.1.4.1',
        cuenta_detalle: 'Caja de ahorro M.N. BANCO GANADERO',
        glosa: form.glosa,
        costo: parseFloat(form.costo),
        tipo_movimiento: form.tipo_movimiento,
        metodo_pago: 'qr',
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ ci: '', nombre: '', glosa: '', costo: '', tipo_movimiento: 'DEPOSITO' })
      loadData()
    }
    setSaving(false)
  }

  const handleAjusteSaldo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (userRole !== 'admin') return
    const saldoDeseado = parseFloat(nuevoSaldoReal)
    if (isNaN(saldoDeseado)) return
    const diferencia = saldoDeseado - totalBalance
    if (Math.abs(diferencia) < 0.01) {
      setShowSaldoModal(false)
      return
    }
    setSaving(true)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        libro: 'BANCO',
        ci: '000000',
        nombre: 'SISTEMA ADMINISTRATIVO',
        cuenta_codigo: '1.1.1.4.1',
        cuenta_detalle: 'Caja de ahorro M.N. BANCO GANADERO (AJUSTE REAL)',
        glosa: `Ajuste de Saldo Inicial / Conciliación Bancaria a ${formatCurrency(saldoDeseado)}`,
        costo: Math.abs(diferencia),
        tipo_movimiento: diferencia > 0 ? 'DEPOSITO' : 'RETIRO',
        metodo_pago: 'qr',
      }),
    })
    if (res.ok) {
      setShowSaldoModal(false)
      setNuevoSaldoReal('')
      loadData()
    }
    setSaving(false)
  }

  const getMontoBanco = (t: any) => {
    if (t.libro === 'BANCO') return Number(t.costo || 0)
    if (t.monto_qr && Number(t.monto_qr) > 0) return Number(t.monto_qr)
    return Number(t.costo || 0)
  }

  const isRetiroBanco = (t: any) => {
    return t.tipo_movimiento === 'RETIRO' || t.tipo_movimiento === 'EGRESO' || t.libro === 'EGRESOS' || String(t.cuenta_codigo || '').startsWith('EGR')
  }

  const totalBalance = transactions.reduce((s, t) => {
    const monto = getMontoBanco(t)
    return isRetiroBanco(t) ? s - monto : s + monto
  }, 0)

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            Libro de <span className="text-blue-500">Banco</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Depósitos, transferencias QR y retiros — Banco Ganadero</p>
        </div>
        <div className="flex items-center gap-4">
          <Card className="border-white/5 bg-zinc-900/80">
            <CardContent className="px-4 py-3 flex items-center gap-3">
              <Landmark className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Saldo en Banco</p>
                <p className={`text-lg font-black ${totalBalance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{formatCurrency(totalBalance)}</p>
              </div>
            </CardContent>
          </Card>
          {userRole === 'admin' && (
            <Button variant="outline" onClick={() => setShowSaldoModal(true)} className="gap-2 font-bold text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
              ⚙️ Ajustar Saldo
            </Button>
          )}
          <Button variant="primary" onClick={() => setShowForm(!showForm)} className="gap-2 font-black uppercase tracking-wider">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cerrar' : 'Nuevo'}
          </Button>
        </div>
      </div>

      {showSaldoModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">
              ⚙️ Ajustar Saldo Real del Banco
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Ingresa el saldo real en tu cuenta del Banco Ganadero. El sistema creará un asiento de ajuste automático para que coincida exactamente.
            </p>
            <form onSubmit={handleAjusteSaldo} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                  Nuevo Saldo Real (Bs)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej: 15400.00"
                  value={nuevoSaldoReal}
                  onChange={(e) => setNuevoSaldoReal(e.target.value)}
                  className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-blue-500/50 outline-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowSaldoModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Confirmar Ajuste'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <Card className="border-blue-500/30 bg-zinc-900/80 animate-in slide-in-from-top-2 duration-300">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Tipo</label>
                <select value={form.tipo_movimiento} onChange={(e) => setForm({ ...form, tipo_movimiento: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-blue-500/50 outline-none appearance-none">
                  <option value="DEPOSITO">Depósito</option>
                  <option value="RETIRO">Retiro</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">C.I.</label>
                <input value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-blue-500/50 outline-none" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Nombre</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-blue-500/50 outline-none" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Glosa</label>
                <input value={form.glosa} onChange={(e) => setForm({ ...form, glosa: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-blue-500/50 outline-none" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Monto (Bs)</label>
                <input type="number" step="0.01" min="0" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-blue-500/50 outline-none" required />
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="primary" disabled={saving} className="w-full font-black uppercase tracking-wider">{saving ? 'Guardando...' : 'Registrar'}</Button>
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
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Origen / Tipo</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Nombre</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Glosa</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Monto en Banco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-600">No hay movimientos bancarios o en QR registrados</td></tr>
                ) : (
                  transactions.map((tx: any) => {
                    const retiro = isRetiroBanco(tx)
                    const monto = getMontoBanco(tx)
                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{tx.fecha}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                            retiro
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : tx.libro === 'SERVICIOS'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : tx.libro === 'VENTAS'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            {tx.libro === 'SERVICIOS'
                              ? 'SERVICIO (QR)'
                              : tx.libro === 'VENTAS'
                              ? 'VENTA (QR)'
                              : retiro
                              ? 'RETIRO / EGRESO'
                              : 'DEPÓSITO BANCARIO'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white font-bold">{tx.nombre || '—'}</td>
                        <td className="px-4 py-3 text-zinc-300">{tx.glosa}</td>
                        <td className={`px-4 py-3 text-right font-black ${retiro ? 'text-red-400' : 'text-blue-400'}`}>
                          {retiro ? '-' : '+'}{formatCurrency(monto)}
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
