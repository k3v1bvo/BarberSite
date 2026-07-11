'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle, Plus, X, User, Phone, Mail, CheckCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface PlanCuenta { codigo: string; detalle: string; es_sancion: boolean }
interface Barbero { id: string; full_name: string; role: string; avatar_url: string | null; phone: string | null; email: string }
interface Sancion {
  id: string; 
  fecha: string; 
  barbero_id: string;
  empleado?: { full_name: string };
  tipo: string; 
  descripcion: string; 
  monto: number;
  estado: string;
  creado_en: string;
  pagado_at?: string;
}

export default function SancionesPage() {
  const supabase = createClient()
  const { success, error } = useToast()
  
  const [sanciones, setSanciones] = useState<Sancion[]>([])
  const [cuentasSancion, setCuentasSancion] = useState<PlanCuenta[]>([])
  const [barberos, setBarberos] = useState<Barbero[]>([])
  
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    empleado_id: '', cuenta_codigo: '', glosa: '', costo: '',
  })
  
  const [showNewMotivo, setShowNewMotivo] = useState(false)
  const [newMotivoName, setNewMotivoName] = useState('')
  const [savingMotivo, setSavingMotivo] = useState(false)

  // Payment state
  const [cobrandoId, setCobrandoId] = useState<string | null>(null)
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [isCobrando, setIsCobrando] = useState(false)

  const handleCreateMotivo = async () => {
    if (!newMotivoName.trim()) return
    setSavingMotivo(true)
    const codigo = `SAN-${Date.now().toString().slice(-4)}`
    const res = await fetch('/api/plan-cuentas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo,
        detalle: newMotivoName.trim(),
        tipo: 'ING',
        es_sancion: true
      })
    })
    if (res.ok) {
      const created = await res.json()
      setCuentasSancion(prev => [...prev, created])
      setForm(prev => ({ ...prev, cuenta_codigo: created.codigo }))
      setShowNewMotivo(false)
      setNewMotivoName('')
      success('Motivo creado correctamente')
    } else {
      error('Error al crear motivo')
    }
    setSavingMotivo(false)
  }

  const loadData = useCallback(async () => {
    const res = await fetch('/api/sanciones')
    if (res.ok) {
      const data = await res.json()
      setSanciones(data.sanciones || [])
      setCuentasSancion(data.catalogo || [])
      setBarberos(data.barberos || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const cuenta = cuentasSancion.find((c) => c.codigo === form.cuenta_codigo)
    const res = await fetch('/api/sanciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barbero_id: form.empleado_id,
        cuenta_codigo: form.cuenta_codigo,
        cuenta_detalle: cuenta?.detalle || form.cuenta_codigo,
        glosa: form.glosa,
        monto: parseFloat(form.costo),
      }),
    })
    
    if (res.ok) {
      success('Sanción registrada correctamente (Deuda)')
      setShowForm(false)
      setForm({ empleado_id: '', cuenta_codigo: '', glosa: '', costo: '' })
      loadData()
    } else {
      error('Error al registrar sanción')
    }
    setSaving(false)
  }

  const handleCobrar = async (id: string) => {
    setIsCobrando(true)
    const res = await fetch('/api/sanciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        metodo_pago: metodoPago,
      }),
    })
    
    if (res.ok) {
      success('Sanción cobrada exitosamente. Ingreso registrado en Caja.')
      setCobrandoId(null)
      loadData()
    } else {
      const data = await res.json()
      error(data.error || 'Error al cobrar sanción')
    }
    setIsCobrando(false)
  }

  const selectedBarbero = barberos.find(b => b.id === form.empleado_id)
  const pendientes = sanciones.filter(s => s.estado === 'pendiente')
  const totalSanciones = pendientes.reduce((s, t) => s + Number(t.monto), 0)

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
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Pendiente</p>
                <p className="text-lg font-black text-red-400">{formatCurrency(totalSanciones)}</p>
              </div>
            </CardContent>
          </Card>
          <Button variant="primary" onClick={() => setShowForm(!showForm)} className="gap-2 font-black uppercase tracking-wider bg-red-500 hover:bg-red-400">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancelar' : 'Nueva'}
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Empleado</label>
                  <select value={form.empleado_id} onChange={(e) => setForm({ ...form, empleado_id: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-red-500/50 outline-none appearance-none" required>
                    <option value="">Seleccionar...</option>
                    {barberos.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Motivo</label>
                    <button
                      type="button"
                      onClick={() => setShowNewMotivo(!showNewMotivo)}
                      className="text-[10px] font-black uppercase tracking-wider text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> {showNewMotivo ? 'Cancelar' : 'Nuevo'}
                    </button>
                  </div>
                  {showNewMotivo ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ej: Uniforme..."
                        value={newMotivoName}
                        onChange={(e) => setNewMotivoName(e.target.value)}
                        className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-xs text-white outline-none focus:border-red-500"
                      />
                      <button
                        type="button"
                        onClick={handleCreateMotivo}
                        disabled={savingMotivo || !newMotivoName.trim()}
                        className="px-3 h-11 bg-red-500 hover:bg-red-400 text-white font-black text-xs uppercase tracking-wider rounded-xl shrink-0"
                      >
                        {savingMotivo ? '...' : 'Crear'}
                      </button>
                    </div>
                  ) : (
                    <select value={form.cuenta_codigo} onChange={(e) => setForm({ ...form, cuenta_codigo: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-red-500/50 outline-none appearance-none" required>
                      <option value="">Seleccionar...</option>
                      {cuentasSancion.map((c) => <option key={c.codigo} value={c.codigo}>{c.detalle}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Descripción</label>
                  <input value={form.glosa} onChange={(e) => setForm({ ...form, glosa: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-red-500/50 outline-none" required />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Monto (Bs)</label>
                  <input type="number" step="0.01" min="0" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-red-500/50 outline-none" required />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button type="submit" variant="primary" disabled={saving} className="h-11 font-black uppercase tracking-wider bg-red-500 hover:bg-red-400 px-8">
                  {saving ? 'Guardando...' : 'Registrar Sanción (Deuda)'}
                </Button>
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
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Estado / Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sanciones.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-600">No hay sanciones registradas</td></tr>
                ) : (
                  sanciones.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                        {tx.creado_en ? new Date(tx.creado_en).toLocaleDateString('es-BO') : ''}
                      </td>
                      <td className="px-4 py-3 text-white font-bold">{tx.empleado?.full_name || 'Desconocido'}</td>
                      <td className="px-4 py-3"><Badge variant="danger" className="text-[10px] uppercase">{tx.tipo}</Badge></td>
                      <td className="px-4 py-3 text-zinc-300">{tx.descripcion}</td>
                      <td className="px-4 py-3 text-right font-black text-red-400">{formatCurrency(tx.monto)}</td>
                      <td className="px-4 py-3 flex justify-center">
                        {tx.estado === 'pendiente' ? (
                          cobrandoId === tx.id ? (
                            <div className="flex flex-col items-center gap-2">
                              <select 
                                value={metodoPago} 
                                onChange={(e) => setMetodoPago(e.target.value)}
                                className="h-8 bg-zinc-950 border border-white/10 rounded text-xs px-2 text-white"
                              >
                                <option value="efectivo">Efectivo</option>
                                <option value="qr">QR / Banco</option>
                              </select>
                              <div className="flex gap-1">
                                <Button size="sm" variant="primary" className="bg-emerald-600 hover:bg-emerald-500 text-[10px] h-7 px-2" onClick={() => handleCobrar(tx.id)} disabled={isCobrando}>
                                  {isCobrando ? '...' : 'Confirmar'}
                                </Button>
                                <Button size="sm" variant="outline" className="text-[10px] h-7 px-2" onClick={() => setCobrandoId(null)}>
                                  X
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="text-amber-500 border-amber-500/20 hover:bg-amber-500/10 text-[10px] h-8" onClick={() => setCobrandoId(tx.id)}>
                              COBRAR
                            </Button>
                          )
                        ) : (
                          <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10 text-[10px] flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {tx.estado === 'aplicada' ? 'Descontada' : 'Pagada'}
                          </Badge>
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
    </div>
  )
}
