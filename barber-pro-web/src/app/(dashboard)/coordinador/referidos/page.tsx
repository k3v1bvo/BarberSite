'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { UserPlus, Gift, Check, Search, X, Users, Settings2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'

interface Cliente {
  id: string
  nombre: string
  ci: string | null
  telefono: string | null
}

interface Referral {
  id: string
  fecha: string
  bono_otorgado: boolean
  monto_bono: number
  creado_en: string
  recomendante: Cliente | null
  recomendado: Cliente | null
}

export default function ReferidosPage() {
  const supabase = createClient()
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchRecomendante, setSearchRecomendante] = useState('')
  const [searchRecomendado, setSearchRecomendado] = useState('')
  
  const [montoBonoConfig, setMontoBonoConfig] = useState('10')
  const [savingConfig, setSavingConfig] = useState(false)

  const [form, setForm] = useState({
    cliente_recomendante_id: '',
    cliente_recomendado_id: '',
    monto_bono: '10',
  })

  const loadData = useCallback(async () => {
    const [refRes, clientesRes, configRes] = await Promise.all([
      fetch('/api/referidos'),
      supabase.from('clientes').select('id, nombre, ci, telefono').order('nombre'),
      supabase.from('configuraciones').select('valor').eq('llave', 'monto_bono_referido').single()
    ])
    if (refRes.ok) setReferrals(await refRes.json())
    if (clientesRes.data) setClientes(clientesRes.data as Cliente[])
    if (configRes.data) {
      setMontoBonoConfig(configRes.data.valor)
      setForm(f => ({ ...f, monto_bono: configRes.data.valor }))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.cliente_recomendante_id === form.cliente_recomendado_id) {
      alert('El recomendante y recomendado no pueden ser la misma persona')
      return
    }
    setSaving(true)
    const res = await fetch('/api/referidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_recomendante_id: form.cliente_recomendante_id,
        cliente_recomendado_id: form.cliente_recomendado_id,
        monto_bono: parseFloat(form.monto_bono),
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ cliente_recomendante_id: '', cliente_recomendado_id: '', monto_bono: '10' })
      setSearchRecomendante('')
      setSearchRecomendado('')
      loadData()
    }
    setSaving(false)
  }

  const toggleBono = async (referral: Referral) => {
    await fetch('/api/referidos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: referral.id, bono_otorgado: !referral.bono_otorgado }),
    })
    loadData()
  }

  const handleUpdateConfig = async () => {
    setSavingConfig(true)
    try {
      const { error } = await supabase
        .from('configuraciones')
        .upsert({ llave: 'monto_bono_referido', valor: montoBonoConfig }, { onConflict: 'llave' })
      if (error) throw error
      alert('Configuración guardada exitosamente')
    } catch (e: any) {
      alert('Error al guardar configuración: ' + e.message)
    } finally {
      setSavingConfig(false)
    }
  }

  const filteredRecomendantes = clientes.filter(c =>
    c.nombre.toLowerCase().includes(searchRecomendante.toLowerCase()) ||
    (c.ci && c.ci.includes(searchRecomendante))
  ).slice(0, 8)

  const filteredRecomendados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(searchRecomendado.toLowerCase()) ||
    (c.ci && c.ci.includes(searchRecomendado))
  ).slice(0, 8)

  const bonosDisponiblesCanje = referrals.filter(r => r.bono_otorgado && !r.bono_usado)
  const totalMontoCanje = bonosDisponiblesCanje.reduce((s, r) => s + Number(r.monto_bono || 10), 0)
  const bonosCanjeados = referrals.filter(r => r.bono_otorgado && r.bono_usado)
  const totalMontoUsado = bonosCanjeados.reduce((s, r) => s + Number(r.monto_bono || 10), 0)
  const pendientesAsistencia = referrals.filter(r => !r.bono_otorgado).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <AdminPageHeader
        title="Programa de"
        highlight="Referidos"
        description="Asocia clientes que recomiendan y otorga bonificaciones."
        actions={
          <Button variant="primary" onClick={() => setShowForm(!showForm)} className="gap-2 font-black uppercase tracking-wider">
            {showForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {showForm ? 'Cerrar' : 'Nuevo Referido'}
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="px-5 py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Referidos</p>
              <p className="text-2xl font-black text-white">{referrals.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="px-5 py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Saldo Activo por Canjear</p>
              <p className="text-2xl font-black text-emerald-400">Bs. {totalMontoCanje.toFixed(0)}</p>
              <p className="text-[10px] text-zinc-500 font-bold">{bonosDisponiblesCanje.length} bonos listos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="px-5 py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Amigos en Espera</p>
              <p className="text-2xl font-black text-amber-400">{pendientesAsistencia}</p>
              <p className="text-[10px] text-zinc-500 font-bold">Sin 1er servicio aún</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="px-5 py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Bonos Ya Canjeados</p>
              <p className="text-2xl font-black text-white">Bs. {totalMontoUsado.toFixed(0)}</p>
              <p className="text-[10px] text-zinc-500 font-bold">{bonosCanjeados.length} bonos consumidos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Monto por Defecto (Bs)</p>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    value={montoBonoConfig} 
                    onChange={e => setMontoBonoConfig(e.target.value)}
                    className="w-20 h-8 text-center font-bold bg-black/50 border-white/10"
                  />
                  <Button size="sm" onClick={handleUpdateConfig} disabled={savingConfig} className="h-8">
                    Guardar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Formulario */}
      {showForm && (
        <Card className="border-amber-500/30 bg-zinc-900/80 animate-in slide-in-from-top-2 duration-300">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Recomendante */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Quien Recomienda</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    value={searchRecomendante}
                    onChange={(e) => { setSearchRecomendante(e.target.value); setForm({ ...form, cliente_recomendante_id: '' }) }}
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 text-sm text-white focus:border-amber-500/50 outline-none"
                    placeholder="Buscar por nombre o C.I..."
                    required={!form.cliente_recomendante_id}
                  />
                </div>
                {searchRecomendante && !form.cliente_recomendante_id && (
                  <div className="bg-zinc-950 border border-white/10 rounded-xl max-h-40 overflow-y-auto">
                    {filteredRecomendantes.map(c => (
                      <button key={c.id} type="button" onClick={() => { setForm({ ...form, cliente_recomendante_id: c.id }); setSearchRecomendante(c.nombre) }}
                        className="w-full text-left px-4 py-2 hover:bg-white/5 text-sm text-white transition-colors">
                        <span className="font-bold">{c.nombre}</span>
                        {c.ci && <span className="text-zinc-500 ml-2 text-xs">C.I. {c.ci}</span>}
                      </button>
                    ))}
                    {filteredRecomendantes.length === 0 && <p className="px-4 py-3 text-zinc-600 text-xs">Sin resultados</p>}
                  </div>
                )}
                {form.cliente_recomendante_id && (
                  <Badge variant="success" className="text-[10px] uppercase">✓ Seleccionado</Badge>
                )}
              </div>

              {/* Recomendado */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Cliente Nuevo (Referido)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    value={searchRecomendado}
                    onChange={(e) => { setSearchRecomendado(e.target.value); setForm({ ...form, cliente_recomendado_id: '' }) }}
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 text-sm text-white focus:border-amber-500/50 outline-none"
                    placeholder="Buscar por nombre o C.I..."
                    required={!form.cliente_recomendado_id}
                  />
                </div>
                {searchRecomendado && !form.cliente_recomendado_id && (
                  <div className="bg-zinc-950 border border-white/10 rounded-xl max-h-40 overflow-y-auto">
                    {filteredRecomendados.map(c => (
                      <button key={c.id} type="button" onClick={() => { setForm({ ...form, cliente_recomendado_id: c.id }); setSearchRecomendado(c.nombre) }}
                        className="w-full text-left px-4 py-2 hover:bg-white/5 text-sm text-white transition-colors">
                        <span className="font-bold">{c.nombre}</span>
                        {c.ci && <span className="text-zinc-500 ml-2 text-xs">C.I. {c.ci}</span>}
                      </button>
                    ))}
                    {filteredRecomendados.length === 0 && <p className="px-4 py-3 text-zinc-600 text-xs">Sin resultados</p>}
                  </div>
                )}
                {form.cliente_recomendado_id && (
                  <Badge variant="success" className="text-[10px] uppercase">✓ Seleccionado</Badge>
                )}
              </div>

              {/* Bono + Submit */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Bono (Bs)</label>
                <input
                  type="number" step="0.5" min="0"
                  value={form.monto_bono} onChange={(e) => setForm({ ...form, monto_bono: e.target.value })}
                  className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none"
                />
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
                  <Button type="submit" variant="primary" size="sm" disabled={saving || !form.cliente_recomendante_id || !form.cliente_recomendado_id}
                    className="font-black uppercase tracking-wider flex-1">
                    {saving ? 'Guardando...' : 'Registrar'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tabla */}
      <Card className="border-white/5 bg-zinc-900/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Fecha</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Recomendante</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Referido (Nuevo)</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Bono</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Estado</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {referrals.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-16 text-center text-zinc-600">
                    <UserPlus className="w-12 h-12 mx-auto opacity-20 mb-3" />
                    <p className="font-bold uppercase tracking-widest text-xs">Aún no hay referidos registrados</p>
                  </td></tr>
                ) : (
                  referrals.map((ref) => (
                    <tr key={ref.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{ref.fecha}</td>
                      <td className="px-4 py-3">
                        <p className="text-white font-bold">{ref.recomendante?.nombre || '—'}</p>
                        {ref.recomendante?.ci && <p className="text-[10px] text-zinc-500 font-mono">C.I. {ref.recomendante.ci}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white font-bold">{ref.recomendado?.nombre || '—'}</p>
                        {ref.recomendado?.ci && <p className="text-[10px] text-zinc-500 font-mono">C.I. {ref.recomendado.ci}</p>}
                      </td>
                      <td className="px-4 py-3 text-center font-black text-amber-500">Bs {Number(ref.monto_bono).toFixed(0)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={ref.bono_otorgado ? 'success' : 'warning'} className="text-[10px] uppercase font-black">
                          {ref.bono_otorgado ? 'Pagado' : 'Pendiente'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant={ref.bono_otorgado ? 'outline' : 'primary'} size="sm" onClick={() => toggleBono(ref)}
                          className="text-[10px] uppercase font-black tracking-wider">
                          <Check className="w-3 h-3 mr-1" />
                          {ref.bono_otorgado ? 'Revertir' : 'Pagar'}
                        </Button>
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
