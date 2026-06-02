'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { 
  Users, 
  BarChart3,
  TrendingUp,
  DollarSign,
  ArrowLeft,
  Calendar,
  Package,
  Scissors
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts'

interface VentaDiaria {
  fecha: string
  ventas: number
  citas: number
}

interface ProductividadBarbero {
  barbero: string
  citas: number
  ventas: number
  comision: number
}

interface ClienteFrecuente {
  nombre: string
  telefono: string
  visitas: number
  gastado: number
}

interface CitasPorEstado {
  estado: string
  cantidad: number
}

interface CitaData {
  estado: string
  precio: number
  comision_barbero?: number | null
  barbero_id?: string
}

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']

export default function ReportesPage() {
  const [loading, setLoading] = useState(true)
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0])
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0])
  const [ventasDiarias, setVentasDiarias] = useState<VentaDiaria[]>([])
  const [productividadBarberos, setProductividadBarberos] = useState<ProductividadBarbero[]>([])
  const [clientesFrecuentes, setClientesFrecuentes] = useState<ClienteFrecuente[]>([])
  const [citasPorEstado, setCitasPorEstado] = useState<CitasPorEstado[]>([])
  const [resumen, setResumen] = useState({
    totalVentas: 0,
    totalCitas: 0,
    totalClientes: 0,
    promedioPorCita: 0,
  })
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadReportes()
  }, [fechaInicio, fechaFin])

  const loadReportes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        router.push('/')
        return
      }

      // Ventas diarias
      const { data: ventasData } = await supabase
        .from('citas')
        .select('fecha_hora, precio')
        .eq('estado', 'completado')
        .gte('fecha_hora', `${fechaInicio}T00:00:00`)
        .lte('fecha_hora', `${fechaFin}T23:59:59`)

      // Citas por estado
      const { data: citasData } = await supabase
        .from('citas')
        .select('estado, precio, comision_barbero, barbero_id')
        .gte('fecha_hora', `${fechaInicio}T00:00:00`)
        .lte('fecha_hora', `${fechaFin}T23:59:59`)

      // Productividad por barbero
      const { data: barberosData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'barbero')

      // Clientes más frecuentes
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('*')
        .order('total_visitas', { ascending: false })
        .limit(10)

      // Procesar datos
      const ventasPorDia: Record<string, { ventas: number; citas: number }> = {}
      const citasEstado: Record<string, number> = {}
      let totalVentas = 0

      ventasData?.forEach(v => {
        const fecha = v.fecha_hora.split('T')[0]
        if (!ventasPorDia[fecha]) {
          ventasPorDia[fecha] = { ventas: 0, citas: 0 }
        }
        ventasPorDia[fecha].ventas += v.precio
        ventasPorDia[fecha].citas += 1
        totalVentas += v.precio
      })

      citasData?.forEach(c => {
        citasEstado[c.estado] = (citasEstado[c.estado] || 0) + 1
      })

      // Convertir a arrays
      const ventasDiariasArray = Object.entries(ventasPorDia)
        .map(([fecha, data]) => ({
          fecha: new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }),
          ventas: data.ventas,
          citas: data.citas
        }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha))

      const citasEstadoArray = Object.entries(citasEstado)
        .map(([estado, cantidad]) => ({ estado, cantidad }))

      // Productividad por barbero
      const productividadArray = (barberosData || []).map(b => {
        const citasBarbero = (citasData || []).filter((c: CitaData) => c.barbero_id === b.id && c.estado === 'completado')
        const ventasBarbero = citasBarbero.reduce((sum: number, c: CitaData) => sum + c.precio, 0)
        const comisionBarbero = citasBarbero.reduce((sum: number, c: CitaData) => sum + (c.comision_barbero || 0), 0)
        return {
          barbero: b.full_name || 'Sin nombre',
          citas: citasBarbero.length,
          ventas: ventasBarbero,
          comision: comisionBarbero
        }
      }).sort((a, b) => b.ventas - a.ventas)

      // Clientes frecuentes
      const clientesArray = (clientesData || [])
        .filter((c: any) => c.total_visitas > 0)
        .slice(0, 10)
        .map((c: any) => ({
          nombre: c.nombre,
          telefono: c.telefono || '',
          visitas: c.total_visitas,
          gastado: c.total_gastado
        }))

      setVentasDiarias(ventasDiariasArray)
      setCitasPorEstado(citasEstadoArray)
      setProductividadBarberos(productividadArray)
      setClientesFrecuentes(clientesArray)
      setResumen({
        totalVentas,
        totalCitas: ventasData?.length || 0,
        totalClientes: clientesData?.length || 0,
        promedioPorCita: ventasData?.length ? totalVentas / ventasData.length : 0
      })

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Generando Reportes...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin')} className="p-3 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl transition-all btn-press group">
             <ArrowLeft className="w-5 h-5 text-zinc-500 group-hover:text-amber-500" />
          </button>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white uppercase">
              Business <span className="text-amber-500">Analytics</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-1">Monitorea el crecimiento y rendimiento de tu barbería</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="secondary" size="md">Exportar PDF</Button>
           <Button variant="primary" size="md" className="shadow-lg shadow-amber-500/20">Imprimir Reporte</Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-amber-500/10 bg-zinc-900/40">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-6 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fecha Inicio</label>
              <input
                type="date"
                className="h-12 w-48 border border-white/10 bg-zinc-950 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fecha Fin</label>
              <input
                type="date"
                className="h-12 w-48 border border-white/10 bg-zinc-950 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
            <Button variant="primary" size="lg" className="h-12 uppercase tracking-widest font-black" onClick={loadReportes}>
              <TrendingUp className="w-4 h-4 mr-2" />
              Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumen de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-amber-500 text-black border-none glow-amber">
          <CardContent className="p-6 text-center">
            <p className="text-[10px] uppercase font-black tracking-widest text-black/60">Facturación Total</p>
            <p className="text-4xl font-black mt-2 leading-none">{formatCurrency(resumen.totalVentas)}</p>
            <div className="inline-flex items-center gap-1 mt-3 px-2 py-0.5 bg-black/10 rounded-full text-[10px] font-bold">
               <TrendingUp size={10}/> +12% vs mes anterior
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-white/5">
          <CardContent className="p-6 text-center">
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Servicios Realizados</p>
            <p className="text-4xl font-black mt-2 text-white leading-none">{resumen.totalCitas}</p>
            <p className="text-[10px] font-bold text-zinc-600 mt-2 uppercase tracking-widest">EN EL PERÍODO SELECCIONADO</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-white/5">
          <CardContent className="p-6 text-center">
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Base de Clientes</p>
            <p className="text-4xl font-black mt-2 text-white leading-none">{resumen.totalClientes}</p>
            <p className="text-[10px] font-bold text-zinc-600 mt-2 uppercase tracking-widest">CLIENTES REGISTRADOS</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-white/5">
          <CardContent className="p-6 text-center">
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Ticket Promedio</p>
            <p className="text-4xl font-black mt-2 text-amber-500 leading-none">{formatCurrency(resumen.promedioPorCita)}</p>
            <p className="text-[10px] font-bold text-zinc-600 mt-2 uppercase tracking-widest">INGRESOS POR SERVICIO</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos Principales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ventas Diarias */}
        <Card className="lg:col-span-2 border-white/5 bg-zinc-900 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Ventas por Día</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ventasDiarias}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                  <XAxis dataKey="fecha" stroke="#52525b" fontSize={10} fontStyle="bold" />
                  <YAxis stroke="#52525b" fontSize={10} fontStyle="bold" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                    itemStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                    formatter={(value: any) => formatCurrency(value as number)} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ventas" 
                    stroke="#f59e0b" 
                    strokeWidth={4} 
                    dot={{ fill: '#f59e0b', r: 4 }}
                    activeDot={{ r: 8, stroke: '#000', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Citas por Estado */}
        <Card className="border-white/5 bg-zinc-900 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg text-center">Citas por Estado</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={citasPorEstado}
                    dataKey="cantidad"
                    nameKey="estado"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                  >
                    {citasPorEstado.map((entry, index) => (
                      <Cell key={entry.estado} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.5)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalles Secundarios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
        {/* Productividad Barberos */}
        <Card className="border-white/5 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg">💰 Productividad por Barbero</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {productividadBarberos.map((b, i) => (
                <div key={i} className="group flex justify-between items-center p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-amber-500/30 transition-all card-hover">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-black">
                        {b.barbero.charAt(0)}
                     </div>
                     <div>
                        <p className="font-black text-white hover:text-amber-500 transition-colors uppercase tracking-tight">{b.barbero}</p>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{b.citas} SERVICIOS REALIZADOS</p>
                     </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-amber-500">{formatCurrency(b.ventas)}</p>
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Comisión: {formatCurrency(b.comision)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Clientes Frecuentes */}
        <Card className="border-white/5 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg">👑 Salón de la Fama (Clientes)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {clientesFrecuentes.map((cliente, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-zinc-950/50 border border-white/5 rounded-2xl hover:bg-zinc-900 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center text-black font-black text-xl shadow-lg shadow-amber-500/10">
                      {cliente.nombre.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg">{cliente.nombre}</p>
                      <p className="text-zinc-500 text-xs font-medium">{cliente.telefono}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest leading-none mb-1">FIDELIDAD</p>
                    <div className="flex items-center gap-1 justify-end">
                       <p className="text-lg font-black text-white">{cliente.visitas}</p>
                       <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">visitas</span>
                    </div>
                    <p className="text-sm font-bold text-amber-500/80">{formatCurrency(cliente.gastado)} gastado</p>
                  </div>
                </div>
              ))}
              {clientesFrecuentes.length === 0 && (
                <div className="text-center py-12 opacity-30">
                   <Users className="w-16 h-16 mx-auto mb-2" />
                   <p className="font-black uppercase tracking-widest text-xs">Sin clientes recurrentes aún</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
