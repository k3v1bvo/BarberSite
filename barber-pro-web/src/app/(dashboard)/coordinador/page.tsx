'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import {
  Wallet,
  Receipt,
  Landmark,
  Scale,
  AlertTriangle,
  Coins,
  ArrowDownCircle,
  TrendingUp,
  Clock,
  Package,
  ArrowRight,
  BarChart3,
  Users
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DaySummary {
  caja_chica: number
  ventas: number
  banco: number
  total: number
  movimientos: number
}

interface RecentTx {
  id: string
  libro: string
  ci: string
  nombre: string
  glosa: string
  costo: number
  es_sancion: boolean
  creado_en: string
}

export default function CoordinadorDashboard() {
  const supabase = createClient()
  const [summary, setSummary] = useState<DaySummary>({ caja_chica: 0, ventas: 0, banco: 0, total: 0, movimientos: 0 })
  const [recentTx, setRecentTx] = useState<RecentTx[]>([])
  const [arqueoCerrado, setArqueoCerrado] = useState(false)
  const [topBarberos, setTopBarberos] = useState<{nombre: string, ventas: number}[]>([])
  const [loading, setLoading] = useState(true)
  const hoy = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const loadData = async () => {
      // Summary del día
      const { data: txHoy } = await supabase
        .from('transactions')
        .select('libro, costo')
        .eq('fecha', hoy)

      if (txHoy) {
        const s = { caja_chica: 0, ventas: 0, banco: 0, total: 0, movimientos: txHoy.length }
        txHoy.forEach((t) => {
          if (t.libro === 'CAJA_CHICA') s.caja_chica += Number(t.costo)
          else if (t.libro === 'VENTAS' || t.libro === 'SERVICIOS') s.ventas += Number(t.costo)
          else if (t.libro === 'BANCO') s.banco += Number(t.costo)
          s.total += Number(t.costo)
        })
        setSummary(s)
      }

      // Últimos movimientos
      const { data: recent } = await supabase
        .from('transactions')
        .select('id, libro, ci, nombre, glosa, costo, es_sancion, creado_en')
        .order('creado_en', { ascending: false })
        .limit(10)

      if (recent) setRecentTx(recent)

      // Arqueo del día
      const { data: arqueo } = await supabase
        .from('daily_closures')
        .select('cerrado')
        .eq('fecha', hoy)
        .maybeSingle()

      setArqueoCerrado(arqueo?.cerrado ?? false)

      // Top Barberos de la semana
      const hace7Dias = new Date()
      hace7Dias.setDate(hace7Dias.getDate() - 7)
      const { data: citasMes } = await supabase
        .from('citas')
        .select('precio, barberos:profiles!barbero_id(full_name)')
        .eq('estado', 'completado')
        .gte('fecha_hora', hace7Dias.toISOString())

      const barberosStats: Record<string, number> = {}
      if (citasMes) {
        citasMes.forEach((c: any) => {
          const barberoNombre = c.barberos?.full_name || 'Sin asignar'
          barberosStats[barberoNombre] = (barberosStats[barberoNombre] || 0) + c.precio
        })
      }
      
      const arrTopBarberos = Object.entries(barberosStats)
        .map(([n, v]) => ({ nombre: n, ventas: v }))
        .sort((a, b) => b.ventas - a.ventas)
        .slice(0, 5)

      setTopBarberos(arrTopBarberos)
      setLoading(false)
    }

    loadData()
  }, [hoy, supabase])

  const libroColor: Record<string, string> = {
    CAJA_CHICA: 'text-amber-400',
    VENTAS: 'text-green-400',
    SERVICIOS: 'text-green-400',
    BANCO: 'text-blue-400',
  }

  const libroLabel: Record<string, string> = {
    CAJA_CHICA: 'Caja Chica',
    VENTAS: 'Ventas',
    SERVICIOS: 'Servicios',
    BANCO: 'Banco',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Header */}
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-4xl font-black tracking-tight text-white uppercase">
          Panel de <span className="text-amber-500">Coordinación</span>
        </h1>
        <p className="text-zinc-500 font-medium mt-1">
          Resumen del día — {new Date().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-zinc-900/80 hover:border-amber-500/30 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Wallet className="w-5 h-5 text-amber-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/60">Caja Chica</span>
            </div>
            <p className="text-2xl font-black text-white">{formatCurrency(summary.caja_chica)}</p>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-zinc-900/80 hover:border-green-500/30 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Receipt className="w-5 h-5 text-green-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-green-500/60">Ventas Hoy</span>
            </div>
            <p className="text-2xl font-black text-white">{formatCurrency(summary.ventas)}</p>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-zinc-900/80 hover:border-blue-500/30 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Landmark className="w-5 h-5 text-blue-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500/60">Banco</span>
            </div>
            <p className="text-2xl font-black text-white">{formatCurrency(summary.banco)}</p>
          </CardContent>
        </Card>

        <Card className={`border-white/5 bg-zinc-900/80 transition-all ${arqueoCerrado ? 'hover:border-green-500/30' : 'hover:border-red-500/30 border-red-500/20'}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Scale className="w-5 h-5 text-zinc-400" />
              <span className={`text-[10px] font-black uppercase tracking-widest ${arqueoCerrado ? 'text-green-500' : 'text-red-400'}`}>
                Arqueo
              </span>
            </div>
            <p className={`text-lg font-black ${arqueoCerrado ? 'text-green-400' : 'text-red-400'}`}>
              {arqueoCerrado ? '✅ Cerrado' : '⚠️ Pendiente'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Acciones rápidas */}
      <div>
        <p className="text-[10px] uppercase font-black text-zinc-600 tracking-[0.3em] mb-3 ml-1">
          Acciones rápidas
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Caja Chica', href: '/coordinador/caja-chica', icon: Wallet, color: 'hover:border-amber-500/50 hover:bg-amber-500/5' },
            { label: 'Venta', href: '/coordinador/ventas', icon: Receipt, color: 'hover:border-green-500/40 hover:bg-green-500/5' },
            { label: 'Sanciones', href: '/coordinador/sanciones', icon: AlertTriangle, color: 'hover:border-red-500/40 hover:bg-red-500/5' },
            { label: 'Banco', href: '/coordinador/banco', icon: Landmark, color: 'hover:border-blue-500/40 hover:bg-blue-500/5' },
            { label: 'Comisiones', href: '/admin/comisiones', icon: Coins, color: 'hover:border-purple-500/40 hover:bg-purple-500/5' },
            { label: 'Arqueo', href: '/coordinador/arqueo', icon: Scale, color: 'hover:border-orange-500/40 hover:bg-orange-500/5' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 p-4 rounded-2xl bg-zinc-900/80 border border-white/5 transition-all duration-300 hover:scale-[1.02] active:scale-95 ${item.color}`}
            >
              <item.icon className="w-5 h-5 text-zinc-400" />
              <span className="text-xs font-black uppercase tracking-widest text-white">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Barberos */}
        <Card className="border-white/5 bg-gradient-to-br from-zinc-900 to-black relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              Top Barberos (Semana)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBarberos} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff05" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="nombre" type="category" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} width={80} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10', borderRadius: '12px' }}
                    itemStyle={{ color: '#a855f7', fontWeight: 'bold' }}
                    cursor={{fill: '#ffffff05'}}
                    formatter={(value: any) => formatCurrency(value)} 
                  />
                  <Bar dataKey="ventas" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Últimos movimientos */}
        <Card className="border-white/5 bg-zinc-900/50">
          <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">
              Últimos movimientos
            </h2>
            <span className="text-xs text-zinc-600 font-bold">{summary.movimientos} hoy</span>
          </div>

          {recentTx.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-600 font-bold text-sm">No hay movimientos registrados aún</p>
              <p className="text-zinc-700 text-xs mt-1">Registra tu primera transacción desde los módulos contables</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTx.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-xl bg-zinc-950/50 hover:bg-zinc-900/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`text-[10px] font-black uppercase tracking-widest w-20 shrink-0 ${libroColor[tx.libro] || 'text-zinc-500'}`}>
                      {libroLabel[tx.libro] || tx.libro}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {tx.es_sancion && <span className="text-red-400 mr-1">⚠</span>}
                        {tx.glosa}
                      </p>
                      <p className="text-[10px] text-zinc-600 font-bold">{tx.ci} — {tx.nombre}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-white">{formatCurrency(tx.costo)}</p>
                    <p className="text-[10px] text-zinc-600">
                      {new Date(tx.creado_en).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
