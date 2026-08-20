'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Gift, Plus, X } from 'lucide-react'

interface Barbero { id: string; full_name: string }
interface Bono {
  id: string
  creado_en: string
  tipo: string
  descripcion: string | null
  monto: number
  mes: number
  anio: number
  pagado: boolean
  perfiles?: { full_name: string }
}

const TIPOS_BONO_BASE = [
  { value: 'puntualidad', label: '⏰ Puntualidad' },
  { value: 'cantidad_servicios', label: '✂️ Cantidad de Servicios' },
  { value: 'metas', label: '🎯 Metas' },
  { value: 'otro', label: '⭐ Otro' },
]

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function BonosPage() {
  const supabase = createClient()
  const [bonos, setBonos] = useState<Bono[]>([])
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bonosConfig, setBonosConfig] = useState<Record<string, { descripcion: string; monto_sugerido: number }>>({})


  const now = new Date()
  const [form, setForm] = useState({
    barbero_id: '',
    tipo: 'puntualidad',
    descripcion: '',
    monto: '',
    mes: String(now.getMonth() + 1),
    anio: String(now.getFullYear()),
  })

  const loadData = useCallback(async () => {
    try {
      const { data: bList } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['barbero', 'coordinador'])
        .eq('is_active', true)
      if (bList) setBarberos(bList)

      const { data: cfg } = await supabase.from('configuraciones').select('valor').eq('llave', 'bonos_config').single()
      if (cfg?.valor) setBonosConfig(cfg.valor)

      const res = await fetch('/api/finanzas/bonos')
      if (res.ok) {
        const data = await res.json()
        setBonos(data.bonos || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/finanzas/bonos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barbero_id: form.barbero_id,
        tipo: form.tipo,
        descripcion: form.descripcion,
        monto: parseFloat(form.monto),
        mes: parseInt(form.mes),
        anio: parseInt(form.anio),
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ barbero_id: '', tipo: 'puntualidad', descripcion: '', monto: '', mes: String(now.getMonth() + 1), anio: String(now.getFullYear()) })
      loadData()
    }
    setSaving(false)
  }

  // Actualizar descripcion y monto sugerido cuando cambia el tipo
  const handleTipoChange = (nuevoTipo: string) => {
    const config = bonosConfig[nuevoTipo]
    if (config) {
      setForm(prev => ({
        ...prev,
        tipo: nuevoTipo,
        descripcion: config.descripcion || prev.descripcion,
        monto: config.monto_sugerido ? String(config.monto_sugerido) : prev.monto
      }))
    } else {
      setForm(prev => ({ ...prev, tipo: nuevoTipo }))
    }
  }

  const totalPendientes = bonos.filter(b => !b.pagado).reduce((s, t) => s + Number(t.monto), 0)

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-green-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            <span className="text-green-500">Bonos y Premios</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Reconocimientos y bonificaciones al equipo</p>
        </div>
        <div className="flex items-center gap-4">
          <Card className="border-green-500/20 bg-zinc-900/80">
            <CardContent className="px-4 py-3 flex items-center gap-3">
              <Gift className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pendientes de pago</p>
                <p className="text-lg font-black text-green-400">{formatCurrency(totalPendientes)}</p>
              </div>
            </CardContent>
          </Card>
          <Button variant="primary" onClick={() => setShowForm(!showForm)} className="gap-2 font-black uppercase tracking-wider" style={{ backgroundColor: '#16a34a' }}>
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cerrar' : 'Nuevo Bono'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="border-green-500/30 bg-zinc-900/80 animate-in slide-in-from-top-2 duration-300">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Empleado</label>
                <select value={form.barbero_id} onChange={(e) => setForm({ ...form, barbero_id: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-green-500/50 outline-none appearance-none" required>
                  <option value="">Seleccionar empleado...</option>
                  {barberos.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Tipo de Bono</label>
                <select value={form.tipo} onChange={(e) => handleTipoChange(e.target.value)} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-green-500/50 outline-none appearance-none">
                  {TIPOS_BONO_BASE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Descripción</label>
                <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: Superó la meta del mes" className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-green-500/50 outline-none" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Mes</label>
                <select value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-green-500/50 outline-none appearance-none">
                  {MESES.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Año</label>
                <input type="number" value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-green-500/50 outline-none" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Monto (Bs)</label>
                <input type="number" step="0.01" min="0.01" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-green-500/50 outline-none" required />
              </div>
              <div className="lg:col-span-3 flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} variant="primary" className="font-black uppercase">{saving ? 'Guardando...' : '🎁 Otorgar Bono'}</Button>
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
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Empleado</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Tipo</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Descripción</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Período</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Estado</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {bonos.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-600">No hay bonos registrados aún</td></tr>
                ) : bonos.map((b) => (
                  <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-white font-bold">{b.perfiles?.full_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="info" className="text-[10px] uppercase">{TIPOS_BONO_BASE.find(t => t.value === b.tipo)?.label ?? b.tipo}</Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{b.descripcion}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{MESES[b.mes - 1]} {b.anio}</td>
                    <td className="px-4 py-3">
                      <Badge variant={b.pagado ? 'success' : 'warning'} className="text-[10px] uppercase">{b.pagado ? '✅ Pagado' : '⏳ Pendiente'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-green-400">{formatCurrency(b.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
