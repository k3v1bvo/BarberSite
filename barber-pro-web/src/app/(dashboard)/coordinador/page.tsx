'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, getTodayBolivia } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users,
  DollarSign,
  Package,
  Calendar,
  ArrowRight,
  Search,
  BarChart3,
  Store,
  Wallet,
  Receipt,
  Landmark,
  Scale,
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  Gift,
} from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { StatCard } from '@/components/admin/StatCard'
import { AdminAlertsPanel } from '@/components/admin/AdminAlertsPanel'
import { AdminAsistenciaSummary } from '@/components/admin/AdminAsistenciaSummary'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const libroLabel: Record<string, string> = {
  CAJA_CHICA: 'Caja Chica',
  VENTAS: 'Ventas',
  SERVICIOS: 'Servicios',
  BANCO: 'Banco',
  USO_TIENDA: 'Uso Tienda',
}

const libroColor: Record<string, string> = {
  CAJA_CHICA: 'text-amber-500',
  VENTAS: 'text-green-500',
  SERVICIOS: 'text-emerald-500',
  BANCO: 'text-blue-500',
  USO_TIENDA: 'text-violet-500',
}

type DateRangeOption = 'hoy' | 'ayer' | 'esta_semana' | 'este_mes' | 'mes_pasado' | 'este_año' | 'personalizado'

const getDateRange = (option: DateRangeOption, customStart?: string, customEnd?: string) => {
  const hoy = new Date()
  let start = new Date(hoy)
  let end = new Date(hoy)

  switch (option) {
    case 'hoy':
      break
    case 'ayer':
      start.setDate(start.getDate() - 1)
      end.setDate(end.getDate() - 1)
      break
    case 'esta_semana':
      const day = start.getDay()
      const diff = start.getDate() - day + (day === 0 ? -6 : 1)
      start.setDate(diff)
      break
    case 'este_mes':
      start = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      break
    case 'mes_pasado':
      start = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      end = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      break
    case 'este_año':
      start = new Date(hoy.getFullYear(), 0, 1)
      break
    case 'personalizado':
      if (customStart) start = new Date(customStart + 'T00:00:00')
      if (customEnd) end = new Date(customEnd + 'T23:59:59')
      break
  }
  
  const formatYMD = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  
  return {
    start: formatYMD(start),
    end: formatYMD(end),
  }
}

interface Stats {
  ventasHoy: number
  citasHoy: number
  clientesTotal: number
  productosStockBajo: number
  pedidosPendientes: number
}

interface Cita {
  id: string
  estado: string
  precio: number
  clientes?: { nombre: string }
  barberos?: { full_name: string }
  servicios?: { nombre: string }
}

export default function CoordinadorDashboard() {
  const [stats, setStats] = useState<Stats>({
    ventasHoy: 0,
    citasHoy: 0,
    clientesTotal: 0,
    productosStockBajo: 0,
    pedidosPendientes: 0,
  })
  const [turnosAbiertos, setTurnosAbiertos] = useState(0)
  const [citasRecientes, setCitasRecientes] = useState<Cita[]>([])
  const [ventasSemana, setVentasSemana] = useState<{fecha: string, total: number}[]>([])
  const [topBarberos, setTopBarberos] = useState<{nombre: string, ventas: number, citas: number}[]>([])
  const [usoTiendaHoy, setUsoTiendaHoy] = useState(0)
  const [summaryContable, setSummaryContable] = useState({
    caja_chica: 0,
    ventas: 0,
    banco: 0,
    total: 0,
    arqueoCerrado: false,
  })
  const [recentTx, setRecentTx] = useState<any[]>([])
  const [tabTabla, setTabTabla] = useState<'citas' | 'movimientos'>('citas')
  const [loading, setLoading] = useState(true)
  
  // Date range state
  const [rangoSeleccionado, setRangoSeleccionado] = useState<DateRangeOption>('hoy')
  const [fechaInicioStr, setFechaInicioStr] = useState(getTodayBolivia())
  const [fechaFinStr, setFechaFinStr] = useState(getTodayBolivia())
  
  const router = useRouter()
  const supabase = createClient()

  const loadData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { start, end } = getDateRange(rangoSeleccionado, fechaInicioStr, fechaFinStr)

      const [
        { data: ventasData },
        { count: citasHoy },
        { count: clientesTotal },
        { data: productosStock },
        { count: pedidosPendientes },
        { data: citasRecientesData },
      ] = await Promise.all([
        supabase
          .from('citas')
          .select('precio')
          .eq('estado', 'completado')
          .gte('fecha_hora', `${start}T00:00:00`)
          .lte('fecha_hora', `${end}T23:59:59`),
        supabase
          .from('citas')
          .select('*', { count: 'exact', head: true })
          .gte('fecha_hora', `${start}T00:00:00`)
          .lte('fecha_hora', `${end}T23:59:59`),
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('productos').select('id').lte('stock_actual', 5),
        supabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true })
          .in('estado', ['pendiente', 'confirmado']),
        supabase
          .from('citas')
          .select(
            `
          id,
          estado,
          precio,
          fecha_hora,
          clientes (nombre),
          barberos:profiles!barbero_id (full_name),
          servicios (nombre)
        `
          )
          .gte('fecha_hora', `${start}T00:00:00`)
          .lte('fecha_hora', `${end}T23:59:59`)
          .order('fecha_hora', { ascending: false })
          .limit(10),
      ])

      const { data: citasMes } = await supabase
        .from('citas')
        .select('precio, fecha_hora, barberos:profiles!barbero_id(full_name)')
        .eq('estado', 'completado')
        .gte('fecha_hora', `${start}T00:00:00`)
        .lte('fecha_hora', `${end}T23:59:59`)

      const startDate = new Date(`${start}T00:00:00`)
      const endDate = new Date(`${end}T23:59:59`)
      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const groupByMonth = diffDays > 31

      const ventasPorDia: Record<string, number> = {}
      const barberosStats: Record<string, { ventas: number, citas: number }> = {}

      if (citasMes) {
        citasMes.forEach((c: any) => {
          let fechaStr = ''
          const d = new Date(c.fecha_hora)
          if (groupByMonth) {
            fechaStr = d.toLocaleDateString('es-BO', { month: 'short', year: 'numeric' })
          } else {
            fechaStr = d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })
          }
          
          ventasPorDia[fechaStr] = (ventasPorDia[fechaStr] || 0) + c.precio

          const barberoNombre = c.barberos?.full_name || 'Sin asignar'
          if (!barberosStats[barberoNombre]) barberosStats[barberoNombre] = { ventas: 0, citas: 0 }
          barberosStats[barberoNombre].ventas += c.precio
          barberosStats[barberoNombre].citas += 1
        })
      }

      const arrVentasSemana = Object.entries(ventasPorDia).map(([f, t]) => ({ fecha: f, total: t }))
      const arrTopBarberos = Object.entries(barberosStats)
        .map(([n, s]) => ({ nombre: n, ventas: s.ventas, citas: s.citas }))
        .sort((a, b) => b.ventas - a.ventas)
        .slice(0, 5)

      setVentasSemana(arrVentasSemana)
      setTopBarberos(arrTopBarberos)

      const ventasHoy =
        ventasData?.reduce((acc: number, v: { precio: number }) => acc + v.precio, 0) || 0

      setStats({
        ventasHoy,
        citasHoy: citasHoy || 0,
        clientesTotal: clientesTotal || 0,
        productosStockBajo: productosStock?.length || 0,
        pedidosPendientes: pedidosPendientes || 0,
      })

      const hoy = getTodayBolivia()
      const { data: txTienda } = await supabase
        .from('transactions')
        .select('costo')
        .eq('libro', 'USO_TIENDA')
        .eq('fecha', hoy)
      setUsoTiendaHoy(txTienda?.reduce((s: number, t: any) => s + Number(t.costo), 0) || 0)

      // Resumen Contable Operativo del período
      const { data: txPeriodo } = await supabase
        .from('transactions')
        .select('libro, costo')
        .gte('fecha', start)
        .lte('fecha', end)

      const sContable = { caja_chica: 0, ventas: 0, banco: 0, total: 0, arqueoCerrado: false }
      if (txPeriodo) {
        txPeriodo.forEach((t) => {
          if (t.libro === 'CAJA_CHICA') sContable.caja_chica += Number(t.costo)
          else if (t.libro === 'VENTAS' || t.libro === 'SERVICIOS') sContable.ventas += Number(t.costo)
          else if (t.libro === 'BANCO') sContable.banco += Number(t.costo)
          sContable.total += Number(t.costo)
        })
      }

      const { data: arqueoData } = await supabase
        .from('daily_closures')
        .select('cerrado')
        .eq('fecha', end)
        .maybeSingle()
      sContable.arqueoCerrado = arqueoData?.cerrado ?? false
      setSummaryContable(sContable)

      // Últimos movimientos contables
      const { data: recTx } = await supabase
        .from('transactions')
        .select('id, libro, ci, nombre, glosa, costo, es_sancion, creado_en')
        .order('creado_en', { ascending: false })
        .limit(10)
      if (recTx) setRecentTx(recTx)

      setCitasRecientes((citasRecientesData as unknown as Cita[]) || [])
    } catch (error) {
      console.error('Error cargando datos del coordinador:', error)
    } finally {
      setLoading(false)
    }
  }, [router, supabase, rangoSeleccionado, fechaInicioStr, fechaFinStr])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 45_000)
    return () => clearInterval(interval)
  }, [loadData])

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      pendiente: 'warning',
      confirmado: 'info',
      en_proceso: 'info',
      completado: 'success',
      cancelado: 'danger',
    }
    return variants[estado] || 'default'
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando panel de coordinación…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-24 lg:pb-8">
      <AdminPageHeader
        title="Panel"
        highlight="Coordinador"
        description="Supervisión operativa, control contable del salón y equipo en tiempo real."
        actions={
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-xl px-2 py-1 overflow-x-auto w-full max-w-full sm:w-auto">
              <select 
                className="bg-transparent text-sm font-bold text-zinc-300 outline-none p-2 cursor-pointer border-none min-w-[120px]"
                value={rangoSeleccionado}
                onChange={(e) => setRangoSeleccionado(e.target.value as DateRangeOption)}
              >
                <option value="hoy" className="bg-zinc-900">Hoy</option>
                <option value="ayer" className="bg-zinc-900">Ayer</option>
                <option value="esta_semana" className="bg-zinc-900">Esta Semana</option>
                <option value="este_mes" className="bg-zinc-900">Este Mes</option>
                <option value="mes_pasado" className="bg-zinc-900">Mes Pasado</option>
                <option value="este_año" className="bg-zinc-900">Este Año</option>
                <option value="personalizado" className="bg-zinc-900">Personalizado...</option>
              </select>
              {rangoSeleccionado === 'personalizado' && (
                <div className="flex items-center gap-2 pl-2 border-l border-white/10 shrink-0">
                  <input 
                    type="date" 
                    className="bg-transparent text-sm text-zinc-300 outline-none cursor-pointer" 
                    value={fechaInicioStr} 
                    onChange={e => setFechaInicioStr(e.target.value)} 
                  />
                  <span className="text-zinc-500">-</span>
                  <input 
                    type="date" 
                    className="bg-transparent text-sm text-zinc-300 outline-none cursor-pointer" 
                    value={fechaFinStr} 
                    onChange={e => setFechaFinStr(e.target.value)} 
                  />
                </div>
              )}
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
              <Button variant="secondary" size="md" onClick={() => router.push('/admin/reportes')}>
                <BarChart3 className="w-4 h-4 mr-2 hidden sm:block" />
                Reportes
              </Button>
              <Button
                variant="primary"
                size="md"
                className="shadow-lg shadow-amber-500/20 font-black uppercase tracking-wider"
                onClick={() => router.push('/admin/buscar')}
              >
                <Search className="w-4 h-4 mr-2 hidden sm:block" />
                Buscar
              </Button>
            </div>
          </div>
        }
      />

      {/* Operación Rápida */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Ventas del período"
          value={formatCurrency(stats.ventasHoy)}
          icon={DollarSign}
          variant="primary"
          delay={0}
          onClick={() => router.push('/coordinador/ventas')}
        />
        <StatCard
          label="Citas del período"
          value={stats.citasHoy}
          icon={Calendar}
          delay={75}
          onClick={() => router.push('/agenda')}
        />
        <StatCard
          label="Clientes"
          value={stats.clientesTotal}
          icon={Users}
          delay={150}
          onClick={() => router.push('/admin/clientes')}
        />
        <StatCard
          label="Stock en alerta"
          value={stats.productosStockBajo}
          icon={Package}
          variant={stats.productosStockBajo > 0 ? 'danger' : 'default'}
          delay={225}
          onClick={() => router.push('/admin/productos')}
        />
      </div>

      {/* Libros Contables del Período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-zinc-900/80 hover:border-amber-500/30 transition-all cursor-pointer" onClick={() => router.push('/coordinador/caja-chica')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Wallet className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/70">Caja Chica</span>
            </div>
            <p className="text-xl font-black text-white">{formatCurrency(summaryContable.caja_chica)}</p>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-zinc-900/80 hover:border-green-500/30 transition-all cursor-pointer" onClick={() => router.push('/coordinador/ventas')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Receipt className="w-4 h-4 text-green-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-green-500/70">Ventas / Servicios</span>
            </div>
            <p className="text-xl font-black text-white">{formatCurrency(summaryContable.ventas)}</p>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-zinc-900/80 hover:border-blue-500/30 transition-all cursor-pointer" onClick={() => router.push('/coordinador/banco')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Landmark className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500/70">Banco</span>
            </div>
            <p className="text-xl font-black text-white">{formatCurrency(summaryContable.banco)}</p>
          </CardContent>
        </Card>

        <Card className={`border-white/5 bg-zinc-900/80 transition-all cursor-pointer ${summaryContable.arqueoCerrado ? 'hover:border-green-500/30' : 'hover:border-red-500/30 border-red-500/20'}`} onClick={() => router.push('/coordinador/arqueo')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Scale className="w-4 h-4 text-zinc-400" />
              <span className={`text-[10px] font-black uppercase tracking-widest ${summaryContable.arqueoCerrado ? 'text-green-500' : 'text-red-400'}`}>
                Arqueo
              </span>
            </div>
            <p className={`text-base font-black ${summaryContable.arqueoCerrado ? 'text-green-400' : 'text-red-400'}`}>
              {summaryContable.arqueoCerrado ? '✅ Cerrado' : '⚠️ Pendiente'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Acciones Rápidas del Coordinador */}
      <div>
        <p className="text-[10px] uppercase font-black text-zinc-500 tracking-[0.3em] mb-3 ml-1">
          Operaciones Diarias y Módulos
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Caja / POS', href: '/coordinador/caja', icon: ShoppingBag, color: 'hover:border-emerald-500/50 hover:bg-emerald-500/5' },
            { label: 'Caja Chica', href: '/coordinador/caja-chica', icon: Wallet, color: 'hover:border-amber-500/50 hover:bg-amber-500/5' },
            { label: 'Ventas', href: '/coordinador/ventas', icon: Receipt, color: 'hover:border-green-500/40 hover:bg-green-500/5' },
            { label: 'Sanciones', href: '/coordinador/sanciones', icon: AlertTriangle, color: 'hover:border-red-500/40 hover:bg-red-500/5' },
            { label: 'Bonos', href: '/coordinador/bonos', icon: Gift, color: 'hover:border-purple-500/40 hover:bg-purple-500/5' },
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

      {/* Gráficas de Rendimiento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500 delay-200 fill-mode-both">
        <Card className="border-white/5 bg-gradient-to-br from-zinc-900 to-black relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none"></div>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              Ingresos del Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ventasSemana}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                  <XAxis dataKey="fecha" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10', borderRadius: '12px' }}
                    itemStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                    formatter={(value: any) => formatCurrency(value)} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#f59e0b" 
                    strokeWidth={4}
                    dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#000', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-gradient-to-bl from-zinc-900 to-black relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              Top Barberos del Período
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
      </div>

      {/* Tablas y Supervisión */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Card className="border-white/5 animate-in fade-in duration-500 delay-200 fill-mode-both">
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTabTabla('citas')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    tabTabla === 'citas'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Citas del período
                </button>
                <button
                  onClick={() => setTabTabla('movimientos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    tabTabla === 'movimientos'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Últimos Movimientos
                </button>
              </div>

              {tabTabla === 'citas' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-500 font-bold text-xs"
                  onClick={() => router.push('/agenda')}
                >
                  Agenda completa
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-500 font-bold text-xs"
                  onClick={() => router.push('/coordinador/caja-chica')}
                >
                  Ver libros
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {tabTabla === 'citas' ? (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left min-w-[700px]">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="py-3 px-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                          Cliente
                        </th>
                        <th className="py-3 px-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest hidden sm:table-cell">
                          Servicio
                        </th>
                        <th className="py-3 px-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right">
                          Monto
                        </th>
                        <th className="py-3 px-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-center">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {citasRecientes.map((cita, idx) => (
                        <tr
                          key={cita.id}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors duration-200"
                        >
                          <td className="py-4 px-5">
                            <p className="font-bold text-white text-sm">
                              {cita.clientes?.nombre || 'Walk-in'}
                            </p>
                            <p className="text-[10px] text-zinc-600 sm:hidden">
                              {cita.servicios?.nombre || '—'} · {cita.barberos?.full_name || '—'}
                            </p>
                          </td>
                          <td className="py-4 px-5 hidden sm:table-cell">
                            <p className="text-sm text-zinc-300">{cita.servicios?.nombre || 'General'}</p>
                            <p className="text-[10px] text-zinc-500">{cita.barberos?.full_name || 'Sin asignar'}</p>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <p className="font-black text-amber-500">{formatCurrency(cita.precio)}</p>
                          </td>
                          <td className="py-4 px-5 text-center">
                            <Badge
                              variant={getEstadoBadge(cita.estado)}
                              className="uppercase font-black text-[10px] tracking-widest"
                            >
                              {cita.estado.replace('_', ' ')}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {citasRecientes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-16 text-center">
                            <Calendar size={40} className="mx-auto text-zinc-800 mb-3 opacity-40" />
                            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">
                              Sin citas en el período
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-4"
                              onClick={() => router.push('/coordinador/caja')}
                            >
                              Crear cita
                            </Button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {recentTx.length === 0 ? (
                    <div className="text-center py-12">
                      <TrendingUp className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                      <p className="text-zinc-600 font-bold text-sm">Sin movimientos registrados</p>
                    </div>
                  ) : (
                    recentTx.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-4 p-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-900 transition-colors"
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
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-500 delay-300 fill-mode-both">
          <AdminAsistenciaSummary onTurnosAbiertos={setTurnosAbiertos} />
          <AdminAlertsPanel
            stockBajo={stats.productosStockBajo}
            turnosAbiertos={turnosAbiertos}
            pedidosPendientes={stats.pedidosPendientes}
          />
        </div>
      </div>
    </div>
  )
}
