'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { UserPlus, Gift, Check, Search, Users, Settings2, Trophy, Crown, Flame, Star, Sparkles, Scissors, DollarSign } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface Cliente {
  id: string
  nombre: string
  ci: string | null
  telefono: string | null
}

interface Referral {
  id: string
  fecha?: string
  bono_otorgado: boolean
  bono_usado?: boolean
  monto_bono: number
  creado_en: string
  recomendante: Cliente | null
  recomendado: Cliente | null
}

export default function ReferidosPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'embajadores' | 'frecuentes' | 'registros'>('embajadores')
  const [periodo, setPeriodo] = useState<'mes' | 'historico'>('mes')

  const [referrals, setReferrals] = useState<Referral[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [topEmbajadores, setTopEmbajadores] = useState<any[]>([])
  const [topFrecuentes, setTopFrecuentes] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [loadingRankings, setLoadingRankings] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchRecomendante, setSearchRecomendante] = useState('')
  const [searchRecomendado, setSearchRecomendado] = useState('')
  
  const [montoBonoConfig, setMontoBonoConfig] = useState('15')
  const [savingConfig, setSavingConfig] = useState(false)

  const [form, setForm] = useState({
    cliente_recomendante_id: '',
    cliente_recomendado_id: '',
    monto_bono: '15',
  })

  const loadData = useCallback(async () => {
    try {
      const [refRes, clientesRes, configRes] = await Promise.all([
        fetch('/api/referidos'),
        supabase.from('clientes').select('id, nombre, ci, telefono').order('nombre'),
        supabase.from('configuraciones').select('valor').eq('llave', 'monto_bono_referido').maybeSingle()
      ])
      if (refRes.ok) setReferrals(await refRes.json())
      if (clientesRes.data) setClientes(clientesRes.data as Cliente[])
      if (configRes.data?.valor) {
        const raw = configRes.data.valor
        const val = typeof raw === 'object' ? String((raw as any).monto || '10') : String(raw)
        setMontoBonoConfig(val)
        setForm(f => ({ ...f, monto_bono: val }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const loadRankings = useCallback(async () => {
    try {
      setLoadingRankings(true)
      const res = await fetch(`/api/referidos/ranking?periodo=${periodo}`)
      if (res.ok) {
        const json = await res.json()
        setTopEmbajadores(json.top_embajadores || [])
        setTopFrecuentes(json.top_frecuentes || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingRankings(false)
    }
  }, [periodo])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { loadRankings() }, [loadRankings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.cliente_recomendante_id === form.cliente_recomendado_id) {
      alert('El recomendante y recomendado no pueden ser la misma persona')
      return
    }
    setSaving(true)
    try {
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
        setForm({ cliente_recomendante_id: '', cliente_recomendado_id: '', monto_bono: montoBonoConfig })
        setSearchRecomendante('')
        setSearchRecomendado('')
        loadData()
        loadRankings()
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleBono = async (referral: Referral) => {
    await fetch('/api/referidos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: referral.id, bono_otorgado: !referral.bono_otorgado }),
    })
    loadData()
    loadRankings()
  }

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      await supabase
        .from('configuraciones')
        .upsert({
          llave: 'monto_bono_referido',
          valor: { monto: parseFloat(montoBonoConfig) },
          descripcion: 'Monto de bono por referido en Bolivianos (Bs.)'
        }, { onConflict: 'llave' })
      alert('Monto de bono actualizado exitosamente')
    } finally {
      setSavingConfig(false)
    }
  }

  const filteredRecomendantes = clientes.filter(c =>
    c.nombre.toLowerCase().includes(searchRecomendante.toLowerCase()) ||
    (c.ci && c.ci.includes(searchRecomendante))
  )

  const filteredRecomendados = clientes.filter(c =>
    c.id !== form.cliente_recomendante_id &&
    (c.nombre.toLowerCase().includes(searchRecomendado.toLowerCase()) ||
    (c.ci && c.ci.includes(searchRecomendado)))
  )

  const totalBonosPagados = referrals.filter(r => r.bono_otorgado).reduce((s, r) => s + Number(r.monto_bono), 0)
  const totalBonosPendientes = referrals.filter(r => !r.bono_otorgado).reduce((s, r) => s + Number(r.monto_bono), 0)

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <AdminPageHeader
        title="Fidelización &"
        highlight="Referidos"
        description="Rankings de clientes embajadores, clientes frecuentes y control de bonos"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-zinc-900/60 shadow-xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Referidos</p>
              <p className="text-3xl font-black text-white mt-1">{referrals.length}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-zinc-900/60 shadow-xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Bonos Acreditados</p>
              <p className="text-3xl font-black text-emerald-400 mt-1">Bs {formatCurrency(totalBonosPagados)}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Gift className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-zinc-900/60 shadow-xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pendientes 1er Corte</p>
              <p className="text-3xl font-black text-amber-400 mt-1">Bs {formatCurrency(totalBonosPendientes)}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Configuración Rápida */}
        <Card className="border-white/5 bg-zinc-900/60 shadow-xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                <Settings2 size={12} /> Bono por Amigo
              </span>
              <span className="text-xs font-black text-amber-400">Bs {montoBonoConfig}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                value={montoBonoConfig}
                onChange={e => setMontoBonoConfig(e.target.value)}
                className="w-20 bg-zinc-950 border border-white/10 rounded-xl px-2.5 py-1 text-xs font-bold text-white text-center"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="text-[10px] font-black uppercase tracking-wider flex-1 h-8"
              >
                {savingConfig ? '...' : 'Guardar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-zinc-900/60 p-3 rounded-2xl border border-white/5 shadow-lg">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('embajadores')}
            className={cn(
              'px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap',
              activeTab === 'embajadores'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white'
            )}
          >
            <Trophy size={14} /> Top Embajadores ({topEmbajadores.length})
          </button>

          <button
            onClick={() => setActiveTab('frecuentes')}
            className={cn(
              'px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap',
              activeTab === 'frecuentes'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white'
            )}
          >
            <Scissors size={14} /> Top Clientes Frecuentes ({topFrecuentes.length})
          </button>

          <button
            onClick={() => setActiveTab('registros')}
            className={cn(
              'px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap',
              activeTab === 'registros'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white'
            )}
          >
            <Users size={14} /> Registro de Bonos ({referrals.length})
          </button>
        </div>

        {/* Filtro Período */}
        {activeTab !== 'registros' && (
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-white/5 shrink-0">
            <button
              onClick={() => setPeriodo('mes')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                periodo === 'mes' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              📅 Este Mes
            </button>
            <button
              onClick={() => setPeriodo('historico')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                periodo === 'historico' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              👑 Histórico Total
            </button>
          </div>
        )}

        {activeTab === 'registros' && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowForm(!showForm)}
            className="font-black uppercase tracking-wider text-xs h-10 px-4 shrink-0"
          >
            <UserPlus size={14} className="mr-1.5" /> Vincular Manualmente
          </Button>
        )}
      </div>

      {/* ════════════ TAB 1: TOP EMBAJADORES ════════════ */}
      {activeTab === 'embajadores' && (
        <div className="space-y-6">
          {/* Podium de los 3 primeros */}
          {topEmbajadores.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 2do Lugar (Plata) */}
              <div className="order-2 md:order-1 bg-gradient-to-b from-zinc-800/40 via-zinc-900/60 to-zinc-950 border border-zinc-700/40 rounded-3xl p-6 text-center relative overflow-hidden shadow-xl">
                <div className="w-12 h-12 mx-auto rounded-full bg-zinc-700/50 border border-zinc-500/50 flex items-center justify-center text-xl mb-3">
                  🥈
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-800 px-2.5 py-0.5 rounded-full">
                  2° Puesto
                </span>
                <h4 className="text-base font-black text-white uppercase mt-2 truncate">{topEmbajadores[1].nombre}</h4>
                <p className="text-xs text-zinc-400 mt-1">{topEmbajadores[1].amigos_convertidos} amigos atendidos</p>
                <div className="mt-4 pt-3 border-t border-white/5 flex justify-center items-center gap-2">
                  <span className="text-xs text-emerald-400 font-black">Bs {formatCurrency(topEmbajadores[1].bonos_ganados)} ganados</span>
                </div>
              </div>

              {/* 1er Lugar (Oro) */}
              <div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/20 via-zinc-900 to-zinc-950 border-2 border-amber-500/50 rounded-3xl p-6 text-center relative overflow-hidden shadow-2xl shadow-amber-500/10 md:-translate-y-2">
                <div className="w-14 h-14 mx-auto rounded-full bg-amber-500 text-black flex items-center justify-center text-2xl mb-3 shadow-lg shadow-amber-500/30">
                  🥇
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-black bg-amber-500 px-3 py-1 rounded-full shadow">
                  🏆 Máximo Embajador
                </span>
                <h4 className="text-lg font-black text-white uppercase mt-2 truncate">{topEmbajadores[0].nombre}</h4>
                <p className="text-xs text-amber-200 mt-1">{topEmbajadores[0].amigos_convertidos} amigos atendidos ({topEmbajadores[0].total_amigos_invitados} invitados)</p>
                <div className="mt-4 pt-3 border-t border-amber-500/20 flex justify-center items-center gap-2">
                  <span className="text-sm text-emerald-400 font-black">Bs {formatCurrency(topEmbajadores[0].bonos_ganados)} ganados</span>
                </div>
              </div>

              {/* 3er Lugar (Bronce) */}
              <div className="order-3 bg-gradient-to-b from-amber-900/20 via-zinc-900/60 to-zinc-950 border border-amber-800/40 rounded-3xl p-6 text-center relative overflow-hidden shadow-xl">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-800/40 border border-amber-600/40 flex items-center justify-center text-xl mb-3">
                  🥉
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-950 px-2.5 py-0.5 rounded-full">
                  3° Puesto
                </span>
                <h4 className="text-base font-black text-white uppercase mt-2 truncate">{topEmbajadores[2].nombre}</h4>
                <p className="text-xs text-zinc-400 mt-1">{topEmbajadores[2].amigos_convertidos} amigos atendidos</p>
                <div className="mt-4 pt-3 border-t border-white/5 flex justify-center items-center gap-2">
                  <span className="text-xs text-emerald-400 font-black">Bs {formatCurrency(topEmbajadores[2].bonos_ganados)} ganados</span>
                </div>
              </div>
            </div>
          )}

          {/* Tabla Ranking Completa */}
          <Card className="border-white/5 bg-zinc-900/50 overflow-hidden shadow-xl">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Posición</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Cliente Embajador</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Nivel</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Invitados</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Completados</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Total Ganado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {topEmbajadores.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-16 text-center text-zinc-600">
                          <Trophy className="w-12 h-12 mx-auto opacity-20 mb-3" />
                          <p className="font-bold uppercase tracking-widest text-xs">Sin recomendaciones registradas en este período</p>
                        </td>
                      </tr>
                    ) : (
                      topEmbajadores.map((item, idx) => (
                        <tr key={item.cliente_id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-4 font-black">
                            {idx === 0 && <span className="text-amber-400 font-black text-base">🥇 #1</span>}
                            {idx === 1 && <span className="text-zinc-300 font-black text-base">🥈 #2</span>}
                            {idx === 2 && <span className="text-amber-600 font-black text-base">🥉 #3</span>}
                            {idx > 2 && <span className="text-zinc-500 font-bold">#{idx + 1}</span>}
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-black text-white uppercase text-xs">{item.nombre}</p>
                            <p className="text-[10px] text-zinc-500">{item.telefono || item.email || 'Sin contacto'}</p>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <Badge variant="outline" className="text-[10px] font-black uppercase">
                              {item.nivel_fidelidad}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-center font-bold text-zinc-300">
                            {item.total_amigos_invitados}
                          </td>
                          <td className="px-5 py-4 text-center font-black text-emerald-400">
                            {item.amigos_convertidos}
                          </td>
                          <td className="px-5 py-4 text-right font-black text-emerald-400">
                            Bs {formatCurrency(item.bonos_ganados)}
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
      )}

      {/* ════════════ TAB 2: TOP CLIENTES FRECUENTES / VIP ════════════ */}
      {activeTab === 'frecuentes' && (
        <div className="space-y-6">
          <Card className="border-white/5 bg-zinc-900/50 overflow-hidden shadow-xl">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Posición</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Cliente VIP</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Nivel Lealtad</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Servicios / Visitas</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Consumo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {topFrecuentes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-16 text-center text-zinc-600">
                          <Scissors className="w-12 h-12 mx-auto opacity-20 mb-3" />
                          <p className="font-bold uppercase tracking-widest text-xs">Sin servicios completados en este período</p>
                        </td>
                      </tr>
                    ) : (
                      topFrecuentes.map((item, idx) => (
                        <tr key={item.cliente_id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-4 font-black">
                            {idx === 0 && <span className="text-amber-400 font-black text-base">🥇 #1</span>}
                            {idx === 1 && <span className="text-zinc-300 font-black text-base">🥈 #2</span>}
                            {idx === 2 && <span className="text-amber-600 font-black text-base">🥉 #3</span>}
                            {idx > 2 && <span className="text-zinc-500 font-bold">#{idx + 1}</span>}
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-black text-white uppercase text-xs">{item.nombre}</p>
                            <p className="text-[10px] text-zinc-500">{item.telefono || item.email || 'Sin contacto'}</p>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <Badge variant="outline" className="text-[10px] font-black uppercase">
                              {item.nivel_fidelidad}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-center font-black text-amber-400">
                            {item.total_visitas} cortes
                          </td>
                          <td className="px-5 py-4 text-right font-black text-emerald-400">
                            Bs {formatCurrency(item.total_gastado)}
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
      )}

      {/* ════════════ TAB 3: REGISTROS & VINCULACIÓN MANUAL ════════════ */}
      {activeTab === 'registros' && (
        <div className="space-y-6">
          {showForm && (
            <Card className="border-amber-500/30 bg-zinc-900 shadow-2xl p-6 rounded-3xl animate-in fade-in slide-in-from-top-4">
              <h3 className="text-base font-black text-white uppercase mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-500" /> Vincular Nuevo Referido Manualmente
              </h3>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Recomendante */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Cliente que Recomienda</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      value={searchRecomendante}
                      onChange={e => { setSearchRecomendante(e.target.value); setForm({ ...form, cliente_recomendante_id: '' }) }}
                      className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 text-sm text-white focus:border-amber-500/50 outline-none"
                      placeholder="Buscar por nombre o CI..."
                      required={!form.cliente_recomendante_id}
                    />
                  </div>
                  {searchRecomendante && !form.cliente_recomendante_id && (
                    <div className="bg-zinc-950 border border-white/10 rounded-xl max-h-40 overflow-y-auto">
                      {filteredRecomendantes.map(c => (
                        <button key={c.id} type="button" onClick={() => { setForm({ ...form, cliente_recomendante_id: c.id }); setSearchRecomendante(c.nombre) }}
                          className="w-full text-left px-4 py-2 hover:bg-white/5 text-sm text-white transition-colors">
                          <span className="font-bold">{c.nombre}</span>
                          {c.ci && <span className="text-zinc-500 ml-2 text-xs">CI: {c.ci}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {form.cliente_recomendante_id && <Badge variant="success" className="text-[10px] uppercase font-black">✓ Seleccionado</Badge>}
                </div>

                {/* Recomendado */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Amigo Recomendado (Nuevo)</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      value={searchRecomendado}
                      onChange={e => { setSearchRecomendado(e.target.value); setForm({ ...form, cliente_recomendado_id: '' }) }}
                      className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 text-sm text-white focus:border-amber-500/50 outline-none"
                      placeholder="Buscar por nombre o CI..."
                      required={!form.cliente_recomendado_id}
                    />
                  </div>
                  {searchRecomendado && !form.cliente_recomendado_id && (
                    <div className="bg-zinc-950 border border-white/10 rounded-xl max-h-40 overflow-y-auto">
                      {filteredRecomendados.map(c => (
                        <button key={c.id} type="button" onClick={() => { setForm({ ...form, cliente_recomendado_id: c.id }); setSearchRecomendado(c.nombre) }}
                          className="w-full text-left px-4 py-2 hover:bg-white/5 text-sm text-white transition-colors">
                          <span className="font-bold">{c.nombre}</span>
                          {c.ci && <span className="text-zinc-500 ml-2 text-xs">CI: {c.ci}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {form.cliente_recomendado_id && <Badge variant="success" className="text-[10px] uppercase font-black">✓ Seleccionado</Badge>}
                </div>

                {/* Bono & Submit */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Bono (Bs)</label>
                  <input
                    type="number"
                    value={form.monto_bono}
                    onChange={e => setForm({ ...form, monto_bono: e.target.value })}
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
            </Card>
          )}

          <Card className="border-white/5 bg-zinc-900/50 overflow-hidden shadow-xl">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Fecha</th>
                      <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Recomendante</th>
                      <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Referido (Nuevo)</th>
                      <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Bono</th>
                      <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Estado</th>
                      <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {referrals.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-16 text-center text-zinc-600">
                          <UserPlus className="w-12 h-12 mx-auto opacity-20 mb-3" />
                          <p className="font-bold uppercase tracking-widest text-xs">Aún no hay referidos registrados</p>
                        </td>
                      </tr>
                    ) : (
                      referrals.map((ref) => (
                        <tr key={ref.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3.5 text-zinc-400 whitespace-nowrap text-xs">{ref.fecha}</td>
                          <td className="px-4 py-3.5">
                            <p className="text-white font-bold">{ref.recomendante?.nombre || '—'}</p>
                            {ref.recomendante?.ci && <p className="text-[10px] text-zinc-500 font-mono">CI: {ref.recomendante.ci}</p>}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-white font-bold">{ref.recomendado?.nombre || '—'}</p>
                            {ref.recomendado?.ci && <p className="text-[10px] text-zinc-500 font-mono">CI: {ref.recomendado.ci}</p>}
                          </td>
                          <td className="px-4 py-3.5 text-center font-black text-amber-500">Bs {Number(ref.monto_bono).toFixed(0)}</td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge variant={ref.bono_otorgado ? 'success' : 'warning'} className="text-[10px] uppercase font-black">
                              {ref.bono_otorgado ? 'Acreditado' : 'Pendiente'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <Button variant={ref.bono_otorgado ? 'outline' : 'primary'} size="sm" onClick={() => toggleBono(ref)}
                              className="text-[10px] uppercase font-black tracking-wider h-8">
                              <Check className="w-3 h-3 mr-1" />
                              {ref.bono_otorgado ? 'Revertir' : 'Acreditar'}
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
      )}
    </div>
  )
}
