'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import {
  Users, Search, TrendingUp, DollarSign, Calendar,
  Star, Crown, X, ChevronRight, Phone, Mail,
  CreditCard, Package, Scissors, ArrowUpRight,
  ArrowDownRight, Clock, CheckCircle, ShoppingBag, UserPlus
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

interface Cliente {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  ci: string | null
  total_visitas: number
  total_gastado: number
  nivel_fidelidad: string | null
  created_at: string
}

interface Cita {
  id: string
  fecha_hora: string
  estado: string
  precio: number
  servicios?: { nombre: string }
  barberos?: { full_name: string }
}

interface Transaccion {
  id: string
  fecha: string
  glosa: string
  costo: number
  tipo_movimiento: string
  metodo_pago: string | null
  cuenta_detalle: string
  libro: string
  creado_en: string
}

const NIVEL_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  bronce:   { label: 'Bronce',   color: 'text-amber-600 bg-amber-600/10 border-amber-600/30',   icon: Star  },
  plata:    { label: 'Plata',    color: 'text-zinc-300 bg-zinc-300/10 border-zinc-300/30',       icon: Star  },
  oro:      { label: 'Oro',      color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', icon: Crown },
  platino:  { label: 'Platino',  color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',       icon: Crown },
  diamante: { label: 'Diamante', color: 'text-violet-400 bg-violet-400/10 border-violet-400/30', icon: Crown },
}

const TIPO_ICON: Record<string, { icon: any; color: string }> = {
  PAGO_CLIENTE:   { icon: CheckCircle,    color: 'text-emerald-400' },
  VENTA_PRODUCTO: { icon: ShoppingBag,    color: 'text-violet-400' },
  VENTA_SERVICIO: { icon: Scissors,       color: 'text-amber-400' },
  INGRESO:        { icon: ArrowUpRight,   color: 'text-emerald-400' },
  EGRESO:         { icon: ArrowDownRight, color: 'text-red-400' },
  SANCION:        { icon: ArrowDownRight, color: 'text-red-500' },
  COMISION:       { icon: DollarSign,     color: 'text-blue-400' },
}

export default function ClientesAdminPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtrados, setFiltrados] = useState<Cliente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroNivel, setFiltroNivel] = useState<string>('todos')
  const [orden, setOrden] = useState<'visitas' | 'gastado' | 'nombre' | 'reciente'>('reciente')

  // Panel lateral del cliente seleccionado
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [citas, setCitas] = useState<Cita[]>([])
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [tabDetalle, setTabDetalle] = useState<'actividad' | 'citas'>('actividad')

  // Stats generales
  const [stats, setStats] = useState({ total: 0, conEmail: 0, totalGastado: 0, nuevosHoy: 0, nuevosSemana: 0, nuevosMes: 0 })
  const [registrosDiarios, setRegistrosDiarios] = useState<{dia: string; label: string; nuevos: number}[]>([])

  useEffect(() => {
    loadClientes()
  }, [])

  useEffect(() => {
    aplicarFiltros()
  }, [clientes, busqueda, filtroNivel, orden])

  const loadClientes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return router.push('/')

    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, email, telefono, ci, total_visitas, total_gastado, nivel_fidelidad, created_at')
      .order('created_at', { ascending: false })

    const lista = (data || []) as Cliente[]
    setClientes(lista)

    const hoy = new Date()
    const hoyStr = hoy.toISOString().split('T')[0]
    
    const inicioSemana = new Date(hoy)
    inicioSemana.setDate(hoy.getDate() - 7)
    const inicioMes = new Date(hoy)
    inicioMes.setDate(hoy.getDate() - 30)

    // Registros de los últimos 30 días agrupados por día
    const diasMap: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(hoy)
      d.setDate(hoy.getDate() - i)
      diasMap[d.toISOString().split('T')[0]] = 0
    }
    lista.forEach(c => {
      const dia = c.created_at?.split('T')[0]
      if (dia && diasMap[dia] !== undefined) diasMap[dia]++
    })
    const registros = Object.entries(diasMap).map(([dia, nuevos]) => ({
      dia,
      label: new Date(dia + 'T12:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }),
      nuevos,
    }))
    setRegistrosDiarios(registros)

    setStats({
      total: lista.length,
      conEmail: lista.filter(c => c.email).length,
      totalGastado: lista.reduce((s, c) => s + (c.total_gastado || 0), 0),
      nuevosHoy: lista.filter(c => c.created_at?.startsWith(hoyStr)).length,
      nuevosSemana: lista.filter(c => c.created_at && new Date(c.created_at) >= inicioSemana).length,
      nuevosMes: lista.filter(c => c.created_at && new Date(c.created_at) >= inicioMes).length,
    })
    setLoading(false)
  }

  const aplicarFiltros = useCallback(() => {
    let result = [...clientes]

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      result = result.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.telefono?.includes(q) ||
        c.ci?.toLowerCase().includes(q)
      )
    }

    if (filtroNivel !== 'todos') {
      result = result.filter(c => c.nivel_fidelidad === filtroNivel)
    }

    result.sort((a, b) => {
      if (orden === 'visitas')  return (b.total_visitas || 0) - (a.total_visitas || 0)
      if (orden === 'gastado')  return (b.total_gastado || 0) - (a.total_gastado || 0)
      if (orden === 'nombre')   return a.nombre.localeCompare(b.nombre)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    setFiltrados(result)
  }, [clientes, busqueda, filtroNivel, orden])

  const abrirDetalle = async (cliente: Cliente) => {
    setClienteSeleccionado(cliente)
    setLoadingDetalle(true)
    setCitas([])
    setTransacciones([])

    const [citasRes, txRes] = await Promise.all([
      supabase
        .from('citas')
        .select('id, fecha_hora, estado, precio, servicios(nombre), barberos:profiles(full_name)')
        .eq('cliente_id', cliente.id)
        .order('fecha_hora', { ascending: false })
        .limit(20),
      supabase
        .from('transactions')
        .select('id, fecha, glosa, costo, tipo_movimiento, metodo_pago, cuenta_detalle, libro, creado_en')
        .eq('cliente_id', cliente.id)
        .order('creado_en', { ascending: false })
        .limit(30),
    ])

    setCitas((citasRes.data || []) as any)
    setTransacciones((txRes.data || []) as Transaccion[])
    setLoadingDetalle(false)
  }

  const formatFecha = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatHora = (iso: string) => {
    return new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
  }

  const nivelInfo = (nivel: string | null) => NIVEL_CONFIG[nivel || ''] || { label: nivel || 'Sin nivel', color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20', icon: Star }

  const ESTADO_COLOR: Record<string, string> = {
    completado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    en_proceso: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    cancelado:  'bg-red-500/10 text-red-400 border-red-500/20',
    pendiente:  'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            Gestión de <span className="text-amber-500">Clientes</span>
          </h1>
          <p className="text-zinc-500 mt-1">Directorio completo · historial de visitas y movimientos</p>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Clientes',   value: stats.total,                                                                     icon: Users,     color: 'text-amber-500'   },
          { label: 'Con Cuenta',       value: stats.conEmail,                                                                   icon: Mail,      color: 'text-emerald-500', sub: `${Math.round(stats.conEmail / Math.max(stats.total,1) * 100)}%` },
          { label: 'Ingresos Acum.',   value: formatCurrency(stats.totalGastado),                                               icon: DollarSign, color: 'text-violet-400' },
          { label: 'Nuevos Hoy',       value: stats.nuevosHoy,                                                                  icon: UserPlus,  color: 'text-cyan-400'    },
          { label: 'Esta Semana',      value: stats.nuevosSemana,                                                               icon: UserPlus,  color: 'text-blue-400',   sub: '7 días' },
          { label: 'Este Mes',         value: stats.nuevosMes,                                                                  icon: UserPlus,  color: 'text-pink-400',   sub: '30 días' },
        ].map(s => (
          <Card key={s.label} className="bg-zinc-900/80 border-white/5">
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg bg-zinc-800 shrink-0 ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 truncate">{s.label}</p>
                <p className="text-lg font-black text-white leading-none mt-0.5">{s.value}</p>
                {'sub' in s && <p className="text-[9px] text-zinc-600 mt-0.5">{(s as any).sub}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* GRÁFICO NUEVOS REGISTROS */}
      <Card className="bg-zinc-900/80 border-white/5">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-cyan-400" />
            Nuevos Clientes — Últimos 30 días
            <span className="ml-auto text-[10px] font-normal text-zinc-500">
              Total: <span className="text-cyan-400 font-bold">{stats.nuevosMes}</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={registrosDiarios} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: '#52525b' }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis tick={{ fontSize: 9, fill: '#52525b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10', borderRadius: '10px', fontSize: '12px' }}
                  itemStyle={{ color: '#22d3ee', fontWeight: 'bold' }}
                  labelStyle={{ color: '#a1a1aa' }}
                  cursor={{ fill: '#ffffff05' }}
                  formatter={(v: any) => [v, 'Nuevos']}
                />
                <Bar dataKey="nuevos" fill="#22d3ee" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* LAYOUT: TABLA + PANEL LATERAL */}
      <div className="flex gap-5 min-h-[60vh]">

        {/* TABLA DE CLIENTES */}
        <div className={`flex-1 min-w-0 space-y-4 transition-all duration-300 ${clienteSeleccionado ? 'lg:max-w-[55%]' : ''}`}>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, CI, teléfono o correo..."
                className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:border-amber-500/50 outline-none"
              />
            </div>
            <select
              value={filtroNivel}
              onChange={e => setFiltroNivel(e.target.value)}
              className="h-10 px-3 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500/50 outline-none"
            >
              <option value="todos">Todos los niveles</option>
              <option value="bronce">Bronce</option>
              <option value="plata">Plata</option>
              <option value="oro">Oro</option>
              <option value="platino">Platino</option>
              <option value="diamante">Diamante</option>
            </select>
            <select
              value={orden}
              onChange={e => setOrden(e.target.value as any)}
              className="h-10 px-3 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500/50 outline-none"
            >
              <option value="reciente">Más recientes</option>
              <option value="visitas">Más visitas</option>
              <option value="gastado">Mayor gasto</option>
              <option value="nombre">Nombre A-Z</option>
            </select>
          </div>

          {/* Conteo */}
          <p className="text-xs text-zinc-600 font-medium">
            {filtrados.length} {filtrados.length === 1 ? 'cliente' : 'clientes'} encontrados
          </p>

          {/* Lista */}
          <Card className="bg-zinc-900/60 border-white/5 overflow-hidden">
            <div className="divide-y divide-white/5 max-h-[calc(100vh-320px)] overflow-y-auto">
              {filtrados.length === 0 ? (
                <div className="py-16 text-center text-zinc-600">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No se encontraron clientes</p>
                </div>
              ) : (
                filtrados.map(c => {
                  const niv = nivelInfo(c.nivel_fidelidad)
                  const NivIcon = niv.icon
                  const isSelected = clienteSeleccionado?.id === c.id
                  return (
                    <div
                      key={c.id}
                      onClick={() => abrirDetalle(c)}
                      className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-all hover:bg-white/[0.04] ${isSelected ? 'bg-amber-500/5 border-l-2 border-amber-500' : 'border-l-2 border-transparent'}`}
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-700/30 flex items-center justify-center shrink-0 text-amber-400 font-black text-base">
                        {c.nombre.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-sm truncate">{c.nombre}</p>
                          {c.nivel_fidelidad && (
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${niv.color} hidden sm:flex items-center gap-0.5`}>
                              <NivIcon className="w-2.5 h-2.5" /> {niv.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {c.ci && <span className="text-[11px] text-zinc-500 flex items-center gap-1"><CreditCard className="w-3 h-3" />{c.ci}</span>}
                          {c.telefono && <span className="text-[11px] text-zinc-500 flex items-center gap-1"><Phone className="w-3 h-3" />{c.telefono}</span>}
                          {!c.telefono && !c.ci && <span className="text-[11px] text-zinc-600 italic">Sin datos de contacto</span>}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-sm font-black text-amber-400">{formatCurrency(c.total_gastado || 0)}</p>
                        <p className="text-[11px] text-zinc-500">{c.total_visitas || 0} visitas</p>
                      </div>

                      <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${isSelected ? 'text-amber-500' : 'text-zinc-700'}`} />
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </div>

        {/* PANEL LATERAL DE DETALLE */}
        {clienteSeleccionado && (
          <div className="hidden lg:flex flex-col w-[42%] shrink-0 animate-in slide-in-from-right-4 duration-300">
            <Card className="bg-zinc-900 border-white/5 flex flex-col h-full">

              {/* Header del panel */}
              <CardHeader className="pb-0 border-b border-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/40 to-amber-700/40 flex items-center justify-center text-amber-400 font-black text-xl shrink-0">
                      {clienteSeleccionado.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white leading-tight">{clienteSeleccionado.nombre}</h2>
                      {clienteSeleccionado.nivel_fidelidad && (() => {
                        const niv = nivelInfo(clienteSeleccionado.nivel_fidelidad)
                        const NivIcon = niv.icon
                        return (
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${niv.color}`}>
                            <NivIcon className="w-3 h-3" /> {niv.label}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                  <button
                    onClick={() => setClienteSeleccionado(null)}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Datos de contacto */}
                <div className="grid grid-cols-2 gap-2 mt-4 pb-4">
                  {[
                    { icon: CreditCard, value: clienteSeleccionado.ci,     label: 'Carnet' },
                    { icon: Phone,      value: clienteSeleccionado.telefono, label: 'Teléfono' },
                    { icon: Mail,       value: clienteSeleccionado.email,   label: 'Correo' },
                    { icon: Calendar,   value: formatFecha(clienteSeleccionado.created_at), label: 'Desde' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2 text-xs">
                      <item.icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-widest text-zinc-600">{item.label}</p>
                        <p className={`font-medium truncate ${item.value ? 'text-zinc-300' : 'text-zinc-600 italic'}`}>
                          {item.value || 'Sin dato'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* KPIs del cliente */}
                <div className="grid grid-cols-3 gap-3 pb-5">
                  <div className="bg-black/30 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-amber-400">{clienteSeleccionado.total_visitas || 0}</p>
                    <p className="text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5">Visitas</p>
                  </div>
                  <div className="bg-black/30 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-emerald-400">{formatCurrency(clienteSeleccionado.total_gastado || 0)}</p>
                    <p className="text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5">Gastado</p>
                  </div>
                  <div className="bg-black/30 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-violet-400">
                      {clienteSeleccionado.total_visitas
                        ? formatCurrency(Math.round((clienteSeleccionado.total_gastado || 0) / clienteSeleccionado.total_visitas))
                        : 'Bs. 0'}
                    </p>
                    <p className="text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5">Prom./Visita</p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 pb-1">
                  {(['actividad', 'citas'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setTabDetalle(tab)}
                      className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${tabDetalle === tab ? 'bg-amber-500 text-black' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                    >
                      {tab === 'actividad' ? '💳 Movimientos' : '✂️ Citas'}
                    </button>
                  ))}
                </div>
              </CardHeader>

              {/* Contenido scrollable */}
              <CardContent className="flex-1 overflow-y-auto p-0">
                {loadingDetalle ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">

                    {/* TAB: MOVIMIENTOS */}
                    {tabDetalle === 'actividad' && (
                      transacciones.length === 0 ? (
                        <div className="py-12 text-center text-zinc-600 text-sm">Sin movimientos registrados</div>
                      ) : (
                        transacciones.map(tx => {
                          const tipoInfo = TIPO_ICON[tx.tipo_movimiento] || TIPO_ICON['INGRESO']
                          const TxIcon = tipoInfo.icon
                          return (
                            <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
                              <div className={`p-1.5 rounded-lg bg-zinc-800 shrink-0 ${tipoInfo.color}`}>
                                <TxIcon className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-zinc-200 truncate">{tx.cuenta_detalle || tx.glosa}</p>
                                <p className="text-[11px] text-zinc-500 truncate">{tx.glosa}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[10px] text-zinc-600">{tx.fecha}</p>
                                  {tx.metodo_pago && (
                                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{tx.metodo_pago}</span>
                                  )}
                                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800/50 text-zinc-500">{tx.libro}</span>
                                </div>
                              </div>
                              <p className={`text-sm font-black shrink-0 ${tipoInfo.color}`}>
                                {formatCurrency(tx.costo)}
                              </p>
                            </div>
                          )
                        })
                      )
                    )}

                    {/* TAB: CITAS */}
                    {tabDetalle === 'citas' && (
                      citas.length === 0 ? (
                        <div className="py-12 text-center text-zinc-600 text-sm">Sin citas registradas</div>
                      ) : (
                        citas.map(cita => {
                          const servicio = Array.isArray(cita.servicios) ? cita.servicios[0] : cita.servicios
                          const barbero  = Array.isArray(cita.barberos)  ? cita.barberos[0]  : cita.barberos
                          return (
                            <div key={cita.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
                              <div className="p-1.5 rounded-lg bg-zinc-800 text-amber-400 shrink-0">
                                <Scissors className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-zinc-200 truncate">{servicio?.nombre || 'Servicio'}</p>
                                <p className="text-[11px] text-zinc-500 truncate">{barbero?.full_name || 'Sin barbero'}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[10px] text-zinc-600">{formatFecha(cita.fecha_hora)}</p>
                                  <p className="text-[10px] text-zinc-600">{formatHora(cita.fecha_hora)}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-black text-amber-400">{formatCurrency(cita.precio)}</p>
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${ESTADO_COLOR[cita.estado] || 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20'}`}>
                                  {cita.estado}
                                </span>
                              </div>
                            </div>
                          )
                        })
                      )
                    )}

                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
