'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import {
  DollarSign, Clock, TrendingUp,
  Plus, X, Scissors, Calendar, BarChart3, CalendarDays
} from 'lucide-react'
import { AsistenciaWidget } from '@/components/ui/AsistenciaWidget'
import { useToast } from '@/components/ui/Toast'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

interface Stats {
  hoy: { citas: number, completadas: number, ventas: number, comision: number }
  semana: { citas: number, ventas: number, comision: number }
}

interface Cita {
  id: string
  estado: string
  precio: number
  comision_barbero: number | null
  fecha_hora: string
  clientes?: { nombre: string; telefono: string | null }
  servicios?: { nombre: string }
}

export default function BarberoPage() {
  const { success, error: toastError } = useToast()
  const [stats, setStats] = useState<Stats>({
    hoy: { citas: 0, completadas: 0, ventas: 0, comision: 0 },
    semana: { citas: 0, ventas: 0, comision: 0 }
  })
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroFecha, setFiltroFecha] = useState('hoy')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [search, setSearch] = useState('')
  const [servicios, setServicios] = useState<{id:string, nombre:string, precio:number}[]>([])
  const [showWalkinModal, setShowWalkinModal] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [walkinData, setWalkinData] = useState({
    nombreCliente: '', emailCliente: '', telefonoCliente: '', servicio_id: '', metodo_pago: 'efectivo', propinas: 0
  })
  const [submittingWalkin, setSubmittingWalkin] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [filtroFecha, filtroEstado, search])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      setUserId(user.id)

      const { data: servs } = await supabase.from('servicios').select('id, nombre, precio').eq('is_active', true)
      if (servs) setServicios(servs)

      const hoy = new Date().toISOString().split('T')[0]
      const semanaAtras = new Date()
      semanaAtras.setDate(semanaAtras.getDate() - 7)
      const semanaInicio = semanaAtras.toISOString().split('T')[0]

      // Stats Hoy
      const { data: citasHoy } = await supabase
        .from('citas')
        .select('estado, precio, comision_barbero, clientes(nombre), servicios(nombre)')
        .eq('barbero_id', user.id)
        .gte('fecha_hora', `${hoy}T00:00:00`)
        .lte('fecha_hora', `${hoy}T23:59:59`)

      const hoyStats = citasHoy?.reduce((acc, c) => ({
        citas: acc.citas + 1,
        completadas: acc.completadas + (c.estado === 'completado' ? 1 : 0),
        ventas: acc.ventas + c.precio,
        comision: acc.comision + (c.comision_barbero || 0)
      }), { citas: 0, completadas: 0, ventas: 0, comision: 0 }) || { citas: 0, completadas: 0, ventas: 0, comision: 0 }

      // Stats Semana
      const { data: citasSemana } = await supabase
        .from('citas')
        .select('estado, precio, comision_barbero')
        .eq('barbero_id', user.id)
        .gte('fecha_hora', `${semanaInicio}T00:00:00`)
        .lte('fecha_hora', `${hoy}T23:59:59`)
        .eq('estado', 'completado')

      const semanaStats = citasSemana?.reduce((acc, c) => ({
        citas: acc.citas + 1,
        ventas: acc.ventas + c.precio,
        comision: acc.comision + (c.comision_barbero || 0)
      }), { citas: 0, ventas: 0, comision: 0 }) || { citas: 0, ventas: 0, comision: 0 }

      // Citas filtradas
      let query = supabase
        .from('citas')
        .select(`
          id, estado, precio, comision_barbero, fecha_hora,
          clientes(nombre, telefono),
          servicios(nombre)
        `)
        .eq('barbero_id', user.id)
        .order('fecha_hora', { ascending: false })

      if (filtroFecha === 'hoy') {
        const hoyInicio = `${new Date().toISOString().split('T')[0]}T00:00:00`
        const hoyFin = `${new Date().toISOString().split('T')[0]}T23:59:59`
        query = query.gte('fecha_hora', hoyInicio).lte('fecha_hora', hoyFin)
      } else if (filtroFecha === 'semana') {
        const semanaAtras = new Date()
        semanaAtras.setDate(semanaAtras.getDate() - 7)
        query = query.gte('fecha_hora', semanaAtras.toISOString())
      }

      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado)
      }

      if (search) {
        query = query.or(`clientes.nombre.ilike.%${search}%, servicios.nombre.ilike.%${search}%`)
      }

      const { data: citasData } = await query.limit(50)

      const transformedCitas: Cita[] = (citasData || []).map(cita => {
        const getCliente = () => {
          if (!cita.clientes) return undefined
          const raw = Array.isArray(cita.clientes) ? cita.clientes[0] : cita.clientes
          if (!raw) return undefined
          return {
            nombre: raw.nombre,
            telefono: raw.telefono ?? null
          }
        }
        const getServicio = () => {
          if (!cita.servicios) return undefined
          const raw = Array.isArray(cita.servicios) ? cita.servicios[0] : cita.servicios
          if (!raw) return undefined
          return { nombre: raw.nombre }
        }
        return {
          id: cita.id,
          estado: cita.estado,
          precio: cita.precio,
          comision_barbero: cita.comision_barbero,
          fecha_hora: cita.fecha_hora,
          clientes: getCliente(),
          servicios: getServicio()
        }
      })

      setStats({ hoy: hoyStats, semana: semanaStats })
      setCitas(transformedCitas)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [filtroFecha, filtroEstado, search, router, supabase])

  const getEstadoBadge = (estado: string) => {
    const variants = {
      pendiente: 'warning' as const,
      confirmado: 'info' as const,
      en_proceso: 'info' as const,
      completado: 'success' as const,
      cancelado: 'danger' as const,
    }
    return variants[estado as keyof typeof variants] || 'default'
  }

  const iniciarServicio = async (id: string) => {
    await supabase.from('citas').update({ estado: 'en_proceso' }).eq('id', id)
    loadData()
  }

  const finalizarServicio = async (id: string) => {
    await supabase.from('citas').update({ estado: 'completado' }).eq('id', id)
    loadData()
  }

  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingWalkin(true)
    try {
      const res = await fetch('/api/citas/walkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(walkinData)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setShowWalkinModal(false)
      setWalkinData({ nombreCliente: '', emailCliente: '', telefonoCliente: '', servicio_id: '', metodo_pago: 'efectivo', propinas: 0 })
      loadData()
      success('Venta procesada con éxito')
    } catch (e: unknown) {
      toastError('Error: ' + (e instanceof Error ? e.message : 'desconocido'))
    } finally {
      setSubmittingWalkin(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando Agenda...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            Panel <span className="text-amber-500">Barbero</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Sigue tu progreso y gestiona tus citas hoy</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => userId && router.push(`/agenda/${userId}`)} variant="outline" size="lg" className="uppercase tracking-wider font-black">
            <CalendarDays className="w-5 h-5 mr-2" /> Ver Agenda
          </Button>
          <Button onClick={() => setShowWalkinModal(true)} variant="primary" size="lg" className="shadow-lg shadow-amber-500/20 uppercase tracking-wider font-black">
            <Plus className="w-5 h-5 mr-2" /> Venta Rápida
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none bg-zinc-900 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Citas Hoy</p>
                <p className="text-4xl font-black text-white mt-1">{stats.hoy.citas}</p>
                <p className="text-[10px] font-bold text-zinc-600 mt-1">{stats.hoy.completadas} FINALIZADAS</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                <Clock className="text-blue-500 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-zinc-900 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Ventas Hoy</p>
                <p className="text-4xl font-black text-green-500 mt-1 tracking-tighter">{formatCurrency(stats.hoy.ventas)}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center">
                <DollarSign className="text-green-500 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-zinc-900 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Semana</p>
                <p className="text-4xl font-black text-blue-500 mt-1 tracking-tighter">{stats.semana.citas}</p>
                <p className="text-[10px] font-bold text-zinc-600 mt-1">{formatCurrency(stats.semana.ventas)} TOTALES</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                <TrendingUp className="text-blue-500 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-amber-500 text-black glow-amber">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-black/60 text-[10px] font-black uppercase tracking-widest">Tu Comisión</p>
                <p className="text-4xl font-black text-black mt-1 tracking-tighter">{formatCurrency(stats.hoy.comision)}</p>
              </div>
              <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center">
                <DollarSign className="text-black w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Control */}
      <Card className="border-white/5 bg-zinc-900/30">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-6 items-end">
            <div className="w-48 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Período</label>
              <select 
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
              >
                <option value="hoy">Hoy</option>
                <option value="semana">Esta semana</option>
                <option value="mes">Este mes</option>
                <option value="todo">Todas</option>
              </select>
            </div>
            
            <div className="w-48 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Estado</label>
              <select 
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendientes</option>
                <option value="confirmado">Confirmadas</option>
                <option value="en_proceso">En proceso</option>
                <option value="completado">Completadas</option>
              </select>
            </div>

            <div className="flex-1 min-w-[300px]">
              <Input
                label="Búsqueda rápida"
                placeholder="Cliente o servicio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Citas List */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <Card className="border-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>📅 Citas Programadas</CardTitle>
              <Badge variant="outline" className="border-zinc-800 text-zinc-600 font-black uppercase text-[10px] tracking-widest px-3">
                {citas.length} Servicios
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {citas.length > 0 ? (
                citas.map((cita) => (
                  <div key={cita.id} className="group bg-white/5 border border-white/5 rounded-2xl p-6 transition-all hover:border-amber-500/30 card-hover">
                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-1">
                        <p className="text-4xl font-black text-white tracking-tighter">
                          {new Date(cita.fecha_hora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xl font-bold text-zinc-200">{cita.clientes?.nombre}</p>
                        <Badge variant={getEstadoBadge(cita.estado)} className="uppercase font-black text-[10px] tracking-widest px-3 mt-2">
                           {cita.estado}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-amber-500 tracking-tighter">{formatCurrency(cita.precio)}</p>
                        <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest mt-1">Comisión {formatCurrency(cita.comision_barbero || 0)}</p>
                        <div className="mt-4 flex items-center justify-end gap-2 text-zinc-500 text-[10px] uppercase font-black">
                           <Scissors size={12}/> {cita.servicios?.nombre}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      {cita.estado === 'pendiente' && (
                        <Button 
                          onClick={() => iniciarServicio(cita.id)}
                          className="flex-1 h-12 uppercase tracking-widest font-black"
                          variant="primary"
                        >
                          Iniciar Servicio
                        </Button>
                      )}
                      {cita.estado === 'en_proceso' && (
                        <Button 
                          variant="success" 
                          onClick={() => finalizarServicio(cita.id)}
                          className="flex-1 h-12 uppercase tracking-widest font-black shadow-lg shadow-green-500/10"
                        >
                          Finalizar y Cobrar
                        </Button>
                      )}
                      {cita.estado === 'completado' && (
                        <div className="flex-1 h-12 flex items-center justify-center bg-green-500/10 text-green-500 rounded-xl font-black uppercase text-xs tracking-widest border border-green-500/20">
                          Servicio Finalizado
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
                   <Clock className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                   <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">No hay citas en este período</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Weekly Chart & Asistencia */}
        <div className="space-y-6">
          <AsistenciaWidget />
          <Card className="border-white/5 h-fit sticky top-24">
            <CardHeader>
               <CardTitle className="text-sm">📈 Rendimiento Semanal</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {stats.semana.citas > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={citas.slice(0, 7).reverse()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                      <XAxis dataKey="fecha_hora" hide />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10', borderRadius: '12px' }}
                        itemStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                        labelStyle={{ display: 'none' }}
                        formatter={(value: any) => formatCurrency(value)} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="precio" 
                        stroke="#f59e0b" 
                        strokeWidth={4}
                        dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#000', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-[10px] text-zinc-600 text-center uppercase font-black tracking-widest mt-4">Ventas por Servicio (Últimos 7)</p>
                </div>
              ) : (
                <div className="text-center py-10 opacity-30">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-xs font-black uppercase">Sin datos suficientes</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-zinc-900 to-black border-white/5">
             <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                      <Calendar size={20}/>
                   </div>
                   <div>
                      <p className="text-[10px] font-black uppercase text-zinc-500">Próximo día libre</p>
                      <p className="text-sm font-bold text-white">Lunes, 21 de Abril</p>
                   </div>
                </div>
                <div className="h-px bg-white/5" />
                <Button variant="outline" size="sm" className="w-full text-[10px] uppercase font-black tracking-widest h-10">Ver Calendario Completo</Button>
             </CardContent>
          </Card>
        </div>
      </div>

      {/* Walk-in Modal */}
      {showWalkinModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <Card className="w-full max-w-md shadow-2xl border-amber-500/20">
            <CardHeader className="flex flex-row items-center justify-between border-b-0">
              <CardTitle className="text-amber-500">Venta Rápida (Walk-in)</CardTitle>
              <button onClick={() => setShowWalkinModal(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleWalkinSubmit} className="space-y-6">
                <Input 
                  required 
                  label="Nombre del Cliente" 
                  placeholder="Ej: Carlos Gómez..." 
                  value={walkinData.nombreCliente} 
                  onChange={e=>setWalkinData({...walkinData, nombreCliente: e.target.value})} 
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    type="tel" 
                    label="Teléfono" 
                    placeholder="770..." 
                    value={walkinData.telefonoCliente} 
                    onChange={e=>setWalkinData({...walkinData, telefonoCliente: e.target.value})} 
                  />
                  <Input 
                    type="email" 
                    label="Email" 
                    placeholder="carlos@..." 
                    value={walkinData.emailCliente} 
                    onChange={e=>setWalkinData({...walkinData, emailCliente: e.target.value})} 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Servicio Realizado</label>
                  <select required value={walkinData.servicio_id} onChange={e=>setWalkinData({...walkinData, servicio_id: e.target.value})} className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all">
                    <option value="">Selecciona un servicio</option>
                    {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} — {formatCurrency(s.precio)}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Pago</label>
                    <select required value={walkinData.metodo_pago} onChange={e=>setWalkinData({...walkinData, metodo_pago: e.target.value})} className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm font-bold text-white">
                      <option value="efectivo">Efectivo 💵</option>
                      <option value="tarjeta">Tarjeta 💳</option>
                      <option value="transferencia">QR / Trans 📱</option>
                    </select>
                  </div>
                  <Input 
                    type="number" 
                    label="Propina" 
                    placeholder="0.00" 
                    min="0" 
                    value={walkinData.propinas} 
                    onChange={e=>setWalkinData({...walkinData, propinas: parseFloat(e.target.value) || 0})} 
                  />
                </div>
                
                <div className="pt-4">
                  <Button type="submit" disabled={submittingWalkin} className="w-full py-6 text-lg uppercase tracking-widest font-black" variant="primary">
                    {submittingWalkin ? 'Registrando...' : 'Finalizar y Cobrar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
