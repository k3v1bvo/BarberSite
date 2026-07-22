'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { formatCurrency, getTodayBolivia } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DollarSign, Clock, TrendingUp,
  Plus, X, Scissors, Calendar, BarChart3, CalendarDays, Package, Minus, ShoppingCart
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
  comprobante_url?: string | null
  notas?: string | null
  clientes?: { nombre: string; telefono: string | null }
  servicios?: { nombre: string }
  productos?: { notas: string }[]
}

export default function BarberoPage() {
  const { success, error: toastError } = useToast()
  const [stats, setStats] = useState<Stats>({
    hoy: { citas: 0, completadas: 0, ventas: 0, comision: 0 },
    semana: { citas: 0, ventas: 0, comision: 0 }
  })
  const [citas, setCitas] = useState<Cita[]>([])
  const [finanzas, setFinanzas] = useState<{
    saldo_adelantos: number, 
    total_sanciones: number, 
    total_bonos: number,
    bonos_pendientes: any[],
    sanciones_pendientes: any[]
  }>({ 
    saldo_adelantos: 0, 
    total_sanciones: 0, 
    total_bonos: 0,
    bonos_pendientes: [],
    sanciones_pendientes: []
  })
  const [loading, setLoading] = useState(true)
  const [filtroFecha, setFiltroFecha] = useState('hoy')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [servicios, setServicios] = useState<{id:string, nombre:string, precio:number}[]>([])
  const [productosDisp, setProductosDisp] = useState<{id:string, nombre:string, precio_venta:number, stock_actual:number}[]>([])
  const [showWalkinModal, setShowWalkinModal] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [walkinData, setWalkinData] = useState({
    nombreCliente: '', emailCliente: '', telefonoCliente: '', servicio_id: '', metodo_pago: 'efectivo', propinas: 0
  })
  const [walkinProductos, setWalkinProductos] = useState<{id:string, nombre:string, precio:number, cantidad:number}[]>([])
  const [submittingWalkin, setSubmittingWalkin] = useState(false)
  const [walkinMontoRecibido, setWalkinMontoRecibido] = useState<string>('')
  const [selectedCita, setSelectedCita] = useState<Cita | null>(null)
  const [metaServicios, setMetaServicios] = useState<number>(30)
  const [maxServiciosMes, setMaxServiciosMes] = useState<number>(0)
  const [misServiciosMes, setMisServiciosMes] = useState<number>(0)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const citaId = searchParams.get('cita_id')
    if (citaId && !selectedCita) {
      const fetchCita = async () => {
        const { data: cita } = await supabase
          .from('citas')
          .select('id, estado, precio, comision_barbero, fecha_hora, notas, clientes(nombre, telefono), servicios(nombre)')
          .eq('id', citaId)
          .single()
          
        if (cita) {
          const getCliente = () => {
            if (!cita.clientes) return undefined
            const raw = Array.isArray(cita.clientes) ? cita.clientes[0] : cita.clientes
            if (!raw) return undefined
            return { nombre: raw.nombre, telefono: raw.telefono ?? null }
          }
          const getServicio = () => {
            if (!cita.servicios) return undefined
            const raw = Array.isArray(cita.servicios) ? cita.servicios[0] : cita.servicios
            if (!raw) return undefined
            return { nombre: raw.nombre }
          }
          const comprobanteMatch = cita.notas?.match(/\[Comprobante\]:\s*(https?:\/\/[^\s]+)/)
          setSelectedCita({
            id: cita.id,
            estado: cita.estado,
            precio: cita.precio,
            comision_barbero: cita.comision_barbero,
            fecha_hora: cita.fecha_hora,
            comprobante_url: comprobanteMatch ? comprobanteMatch[1] : null,
            notas: cita.notas,
            clientes: getCliente(),
            servicios: getServicio(),
            productos: []
          })
        }
      }
      fetchCita()
    }
  }, [searchParams, supabase])

  useEffect(() => {
    loadData()
  }, [filtroFecha, filtroEstado, debouncedSearch])

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      setUserId(user.id)

      const { data: servs } = await supabase.from('servicios').select('id, nombre, precio').eq('is_active', true)
      if (servs) setServicios(servs)

      const { data: prods } = await supabase.from('productos').select('id, nombre, precio_venta, stock_actual').eq('is_active', true).gt('stock_actual', 0).order('nombre')
      if (prods) setProductosDisp(prods)

      const { data: config } = await supabase.from('configuraciones').select('valor').eq('llave', 'bonos_config').single()
      if (config?.valor?.cantidad_servicios?.meta_cantidad) {
        setMetaServicios(config.valor.cantidad_servicios.meta_cantidad)
      }

      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      const semanaAtras = new Date()
      semanaAtras.setDate(semanaAtras.getDate() - 7)
      const semanaInicio = semanaAtras.toISOString().split('T')[0]

      // Stats Hoy
      const { data: citasHoy } = await supabase
        .from('citas')
        .select('estado, precio, comision_barbero, clientes(nombre), servicios(nombre)')
        .eq('barbero_id', user.id)
        .gte('fecha_hora', `${hoy}T00:00:00-04:00`)
        .lte('fecha_hora', `${hoy}T23:59:59-04:00`)

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
        .gte('fecha_hora', `${semanaInicio}T00:00:00-04:00`)
        .lte('fecha_hora', `${hoy}T23:59:59-04:00`)
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
          id, estado, precio, comision_barbero, fecha_hora, notas,
          clientes(nombre, telefono),
          servicios(nombre)
        `)
        .eq('barbero_id', user.id)
        .order('fecha_hora', { ascending: false })

      if (!debouncedSearch) {
        if (filtroFecha === 'hoy') {
          const hoyStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
          const hoyInicio = `${hoyStr}T00:00:00-04:00`
          const hoyFin = `${hoyStr}T23:59:59-04:00`
          query = query.gte('fecha_hora', hoyInicio).lte('fecha_hora', hoyFin)
        } else if (filtroFecha === 'semana') {
          const semanaAtras = new Date()
          semanaAtras.setDate(semanaAtras.getDate() - 7)
          query = query.gte('fecha_hora', semanaAtras.toISOString())
        } else if (filtroFecha === 'mes') {
          const mesAtras = new Date()
          mesAtras.setMonth(mesAtras.getMonth() - 1)
          query = query.gte('fecha_hora', mesAtras.toISOString())
        }
      }

      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado)
      }

      if (debouncedSearch) {
        // Buscar clientes coincidentes
        const { data: matchClientes } = await supabase
          .from('clientes')
          .select('id')
          .or(`nombre.ilike.%${debouncedSearch}%,telefono.ilike.%${debouncedSearch}%,ci.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`)
        
        // Buscar servicios coincidentes
        const { data: matchServicios } = await supabase
          .from('servicios')
          .select('id')
          .ilike('nombre', `%${debouncedSearch}%`)

        const cIds = matchClientes?.map(c => c.id) || []
        const sIds = matchServicios?.map(s => s.id) || []

        const ors = []
        if (cIds.length > 0) ors.push(`cliente_id.in.(${cIds.join(',')})`)
        if (sIds.length > 0) ors.push(`servicio_id.in.(${sIds.join(',')})`)

        if (ors.length > 0) {
          query = query.or(ors.join(','))
        } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000') // Forzar vacío
        }
      }

      const { data: citasData } = await query.limit(50)

      let movimientos: any[] = []
      if (citasData && citasData.length > 0) {
        const citaIds = citasData.map(c => c.id)
        const { data: movs } = await supabase
          .from('inventario_movimientos')
          .select('referencia, notas')
          .in('referencia', citaIds)
        if (movs) movimientos = movs
      }

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

        // Extraer comprobante_url de las notas si existe
        const comprobanteMatch = cita.notas?.match(/\[Comprobante\]:\s*(https?:\/\/[^\s]+)/)
        const extractedUrl = comprobanteMatch ? comprobanteMatch[1] : null

        return {
          id: cita.id,
          estado: cita.estado,
          precio: cita.precio,
          comision_barbero: cita.comision_barbero,
          fecha_hora: cita.fecha_hora,
          comprobante_url: extractedUrl,
          notas: cita.notas,
          clientes: getCliente(),
          servicios: getServicio(),
          productos: movimientos.filter(m => m.referencia === cita.id).map(m => ({ notas: m.notas }))
        }
      })

      setStats({ hoy: hoyStats, semana: semanaStats })
      setCitas(transformedCitas)

      // Calcular récord del mes (meta a superar del mes anónima)
      try {
        const hoyDate = new Date()
        const primerDiaMes = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), 1).toISOString()
        const { data: mesData } = await supabase
          .from('citas')
          .select('barbero_id')
          .in('estado', ['completado', 'completada'])
          .gte('fecha_hora', primerDiaMes)

        if (mesData) {
          const conteoPorBarbero: Record<string, number> = {}
          mesData.forEach(c => {
            if (c.barbero_id) {
              conteoPorBarbero[c.barbero_id] = (conteoPorBarbero[c.barbero_id] || 0) + 1
            }
          })
          const conteos = Object.values(conteoPorBarbero)
          setMaxServiciosMes(conteos.length > 0 ? Math.max(...conteos) : 0)
          setMisServiciosMes(conteoPorBarbero[user.id] || 0)
        }
      } catch (err) {
        console.error('Error fetching meta mes', err)
      }
      
      // Fetch finanzas (Adelantos, Sanciones, Bonos pendientes)
      try {
        const finReq = await fetch(`/api/comisiones?barbero_id=${user.id}&estado=pendiente`)
        if (finReq.ok) {
          const finData = await finReq.json()
          setFinanzas(finData.finanzas || { saldo_adelantos: 0, total_sanciones: 0, total_bonos: 0, bonos_pendientes: [], sanciones_pendientes: [] })
        }
      } catch (err) {
        console.error('Error fetching finanzas', err)
      }

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [filtroFecha, filtroEstado, debouncedSearch, router, supabase])

  const getEstadoBadge = (estado: string) => {
    const variants = {
      pendiente: 'warning' as const,
      pendiente_pago: 'warning' as const,
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
    const { data: cData } = await supabase.from('citas').select('*, clientes(nombre), servicios(nombre)').eq('id', id).single()
    await supabase.from('citas').update({ estado: 'completado' }).eq('id', id)
    if (cData) {
      await supabase.from('transactions').insert({
        libro: 'SERVICIOS',
        fecha: getTodayBolivia(),
        ci: '0000000',
        nombre: (cData.clientes as any)?.nombre || 'Cliente',
        cuenta_codigo: 'ING-001',
        cuenta_detalle: 'Ingresos por Servicios',
        glosa: `Servicio ${(cData.servicios as any)?.nombre || ''} - Cita #${id.slice(0, 6)}`,
        costo: Number(cData.precio || 0),
        tipo_movimiento: 'INGRESO',
        subcategoria: 'SERVICIO',
        es_sancion: false,
        empleado_id: cData.barbero_id,
        cliente_id: cData.cliente_id,
        metodo_pago: 'efectivo',
        usuario_registro: 'Barbero'
      })
    }
    loadData()
  }

  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!walkinData.servicio_id && walkinProductos.length === 0) {
      toastError('Selecciona un servicio o agrega un producto')
      return
    }
    setSubmittingWalkin(true)
    try {
      const res = await fetch('/api/citas/walkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...walkinData,
          productos_carrito: walkinProductos.map(p => ({
            id: p.id, nombre: p.nombre, precio: p.precio, cantidad: p.cantidad,
          }))
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setShowWalkinModal(false)
      setWalkinData({ nombreCliente: '', emailCliente: '', telefonoCliente: '', servicio_id: '', metodo_pago: 'efectivo', propinas: 0 })
      setWalkinProductos([])
      loadData()
      success('Venta procesada con éxito')
    } catch (e: unknown) {
      toastError('Error: ' + (e instanceof Error ? e.message : 'desconocido'))
    } finally {
      setSubmittingWalkin(false)
    }
  }

  const addWalkinProduct = (p: {id:string, nombre:string, precio_venta:number, stock_actual:number}) => {
    setWalkinProductos(prev => {
      const existing = prev.find(x => x.id === p.id)
      if (existing) {
        if (existing.cantidad >= p.stock_actual) return prev
        return prev.map(x => x.id === p.id ? { ...x, cantidad: x.cantidad + 1 } : x)
      }
      return [...prev, { id: p.id, nombre: p.nombre, precio: p.precio_venta, cantidad: 1 }]
    })
  }

  const removeWalkinProduct = (id: string) => {
    setWalkinProductos(prev => {
      const item = prev.find(x => x.id === id)
      if (item && item.cantidad > 1) return prev.map(x => x.id === id ? { ...x, cantidad: x.cantidad - 1 } : x)
      return prev.filter(x => x.id !== id)
    })
  }

  const walkinProductoTotal = walkinProductos.reduce((s, p) => s + p.precio * p.cantidad, 0)

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
          <Button onClick={() => userId && router.push(`/agenda/${userId}`)} variant="primary" size="lg" className="shadow-lg shadow-amber-500/20 uppercase tracking-wider font-black">
            <CalendarDays className="w-5 h-5 mr-2" /> Ver Mi Agenda
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
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
        
        <Card className="border-none bg-zinc-900 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Sanciones / Deuda</p>
                <p className="text-3xl font-black text-red-500 mt-1 tracking-tighter">
                  {formatCurrency(finanzas.saldo_adelantos + finanzas.total_sanciones)}
                </p>
                <p className="text-[9px] font-bold text-zinc-600 mt-1 uppercase">
                  A DESCONTAR
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-zinc-900 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Bonos Extra</p>
                <p className="text-3xl font-black text-green-500 mt-1 tracking-tighter">
                  {formatCurrency(finanzas.total_bonos)}
                </p>
                <p className="text-[9px] font-bold text-zinc-600 mt-1 uppercase">
                  A COBRAR
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Récord Mensual Anónimo (Meta a Vencer del Mes) */}
      <Card className="bg-gradient-to-r from-zinc-900 via-amber-950/20 to-zinc-900 border-amber-500/20 shadow-2xl relative overflow-hidden">
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl shrink-0">
              🏆
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] uppercase font-black tracking-widest">
                  Récord del Mes
                </Badge>
                <span className="text-[11px] text-zinc-500 font-bold uppercase">Se actualiza cada 1 del mes</span>
              </div>
              <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                Meta Mensual a Vencer: <span className="text-amber-400">{maxServiciosMes} Servicios</span>
              </h3>
              <p className="text-zinc-400 text-sm mt-1">
                Llevas <span className="font-bold text-white">{misServiciosMes} servicios</span> este mes. {maxServiciosMes > misServiciosMes ? `¡Estás a ${maxServiciosMes - misServiciosMes} servicios del récord actual!` : '¡Actualmente estás liderando la meta de servicios del mes!'}
              </p>
            </div>
          </div>
          <div className="text-center md:text-right shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Récord Actual</p>
            <p className="text-4xl font-black text-amber-400 tracking-tighter mt-0.5">{maxServiciosMes}</p>
          </div>
        </CardContent>
      </Card>

      {/* Meta de la Semana (Progress) */}
      <Card className="bg-gradient-to-r from-zinc-900 to-black border-white/5 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none transition-all group-hover:bg-amber-500/10"></div>
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="relative w-32 h-32 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#ffffff10" strokeWidth="8" />
              <circle 
                cx="50" cy="50" r="40" fill="transparent" stroke="#f59e0b" strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - Math.min(stats.semana.citas / metaServicios, 1))}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white">{stats.semana.citas}</span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase">/ {metaServicios}</span>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left z-10">
            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1 mb-3">🔥 Reto Semanal</Badge>
            <h3 className="text-2xl font-black text-white tracking-tight uppercase">Bono por Servicios</h3>
            <p className="text-zinc-400 text-sm mt-2 max-w-md">
              {stats.semana.citas >= metaServicios 
                ? '¡Felicidades! Has alcanzado la meta semanal de servicios. Sigue así para aumentar tu bono.' 
                : `Te faltan ${metaServicios - stats.semana.citas} servicios esta semana para alcanzar tu bono por meta de cantidad. ¡Tú puedes!`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filters & Control */}
      {/* Filters & Control */}
      <Card className="border-white/5 bg-zinc-900/30">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-stretch sm:items-end">
            <div className="w-full sm:w-48 space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Período</label>
              <select 
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
              >
                <option value="hoy">Hoy</option>
                <option value="semana">Esta semana</option>
                <option value="mes">Este mes</option>
                <option value="todo">Todas</option>
              </select>
            </div>
            
            <div className="w-full sm:w-48 space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Estado</label>
              <select 
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
              >
                <option value="todos">Todos</option>
                <option value="pendiente_pago">Pendiente Pago</option>
                <option value="pendiente">Pendientes</option>
                <option value="confirmado">Confirmadas</option>
                <option value="en_proceso">En proceso</option>
                <option value="completado">Completadas</option>
              </select>
            </div>

            <div className="w-full sm:flex-1 sm:min-w-[200px]">
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
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">📅 Citas Programadas</CardTitle>
              <Badge variant="outline" className="border-zinc-800 text-zinc-400 font-black uppercase text-[10px] tracking-widest px-3">
                {citas.length} Servicios
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-6 pt-0 sm:pt-0">
              {citas.length > 0 ? (
                citas.map((cita) => (
                  <div key={cita.id} onClick={() => setSelectedCita(cita)} className="group bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-6 transition-all hover:border-amber-500/30 card-hover cursor-pointer">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between sm:justify-start gap-3">
                          <p className="text-3xl sm:text-4xl font-black text-white tracking-tighter">
                            {new Date(cita.fecha_hora).toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hour12: false })}
                          </p>
                          <Badge variant={getEstadoBadge(cita.estado)} className="uppercase font-black text-[10px] tracking-widest px-2.5 py-1">
                            {cita.estado}
                          </Badge>
                        </div>
                        <p className="text-lg sm:text-xl font-bold text-zinc-100">{cita.clientes?.nombre || 'Cliente'}</p>
                        {cita.clientes?.telefono && (
                          <p className="text-xs text-zinc-400 font-medium">📞 {cita.clientes.telefono}</p>
                        )}
                      </div>

                      <div className="sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start border-t border-white/5 sm:border-none pt-3 sm:pt-0">
                        <div>
                          <p className="text-2xl sm:text-3xl font-black text-amber-500 tracking-tighter">{formatCurrency(cita.precio)}</p>
                          <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest mt-0.5">Comisión {formatCurrency(cita.comision_barbero || 0)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-zinc-400 text-[10px] uppercase font-black">
                          {cita.servicios?.nombre && (
                            <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg"><Scissors size={12} className="text-amber-400"/> {cita.servicios.nombre}</span>
                          )}
                          {cita.productos?.map((p, idx) => (
                            <span key={idx} className="flex items-center gap-1 text-violet-400 bg-violet-500/10 px-2 py-1 rounded-lg">
                              <Package size={12}/> {p.notas.replace('Venta POS - ', '')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 bg-white/5 rounded-2xl border border-dashed border-white/10">
                   <Clock className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                   <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No hay citas en este período</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Weekly Chart & Asistencia */}
        <div className="space-y-6">
          <AsistenciaWidget />
          <Card className="border-white/5 h-fit xl:sticky xl:top-24">
            <CardHeader>
               <CardTitle className="text-sm">📈 Rendimiento Semanal</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {stats.semana.citas > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
             <CardHeader className="pb-2">
                <CardTitle className="text-sm">💰 Finanzas Pendientes</CardTitle>
             </CardHeader>
             <CardContent className="p-6 space-y-4 pt-2">
                {finanzas.bonos_pendientes?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Bonos Ganados</p>
                    {finanzas.bonos_pendientes.map((b: any) => (
                      <div key={b.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                        <span className="text-zinc-300 font-bold">{b.motivo}</span>
                        <span className="text-green-400 font-black">+{formatCurrency(b.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {finanzas.sanciones_pendientes?.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Sanciones</p>
                    {finanzas.sanciones_pendientes.map((s: any) => (
                      <div key={s.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                        <span className="text-zinc-300 font-bold">{s.motivo}</span>
                        <span className="text-red-400 font-black">-{formatCurrency(s.costo)}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {finanzas.saldo_adelantos > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Adelantos</p>
                    <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                      <span className="text-zinc-300 font-bold">Saldo Adelantos</span>
                      <span className="text-red-400 font-black">-{formatCurrency(finanzas.saldo_adelantos)}</span>
                    </div>
                  </div>
                )}

                {finanzas.total_bonos === 0 && finanzas.total_sanciones === 0 && finanzas.saldo_adelantos === 0 && (
                  <p className="text-zinc-500 text-xs font-bold text-center">Sin bonos ni deudas pendientes.</p>
                )}
             </CardContent>
          </Card>
        </div>
      </div>

      {/* Walk-in Modal */}
      {showWalkinModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Servicio (Opcional)</label>
                  <select value={walkinData.servicio_id} onChange={e=>setWalkinData({...walkinData, servicio_id: e.target.value})} className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all">
                    <option value="">Sin servicio</option>
                    {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} — {formatCurrency(s.precio)}</option>)}
                  </select>
                </div>

                {/* Productos */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Productos (Opcional)
                  </label>
                  {walkinProductos.length > 0 && (
                    <div className="bg-zinc-950 border border-violet-500/20 rounded-xl p-3 space-y-2 mb-2">
                      {walkinProductos.map(p => (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="text-zinc-300 text-xs">{p.cantidad}x {p.nombre}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-violet-400 font-bold text-xs">{formatCurrency(p.precio * p.cantidad)}</span>
                            <button type="button" onClick={() => removeWalkinProduct(p.id)} className="w-5 h-5 rounded bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/40">
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-white/5 pt-1 flex justify-between text-xs">
                        <span className="text-zinc-500">Subtotal productos</span>
                        <span className="text-violet-400 font-black">{formatCurrency(walkinProductoTotal)}</span>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {productosDisp.map(p => (
                      <button key={p.id} type="button" onClick={() => addWalkinProduct(p)}
                        className="text-left px-3 py-2 bg-zinc-950 border border-white/10 rounded-lg hover:border-violet-500/40 transition text-xs">
                        <p className="font-bold text-white truncate">{p.nombre}</p>
                        <p className="text-violet-400 font-bold">{formatCurrency(p.precio_venta)}</p>
                      </button>
                    ))}
                  </div>
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

                {/* Total */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-sm font-bold text-zinc-300">Total a Cobrar</span>
                  <span className="text-xl font-black text-amber-400">
                    {formatCurrency(
                      (servicios.find(s => s.id === walkinData.servicio_id)?.precio || 0) 
                      + walkinProductoTotal 
                      + (walkinData.propinas || 0)
                    )}
                  </span>
                </div>

                {walkinData.metodo_pago === 'efectivo' && (
                  <div className="p-3 bg-zinc-900/90 border border-emerald-500/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-400">💵 ¿Con cuánto paga? (Opcional)</span>
                      {walkinMontoRecibido && Number(walkinMontoRecibido) >= ((servicios.find(s => s.id === walkinData.servicio_id)?.precio || 0) + walkinProductoTotal + (walkinData.propinas || 0)) && (
                        <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Vuelto: {formatCurrency(Number(walkinMontoRecibido) - ((servicios.find(s => s.id === walkinData.servicio_id)?.precio || 0) + walkinProductoTotal + (walkinData.propinas || 0)))}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="Ej. 100"
                        value={walkinMontoRecibido}
                        onChange={(e) => setWalkinMontoRecibido(e.target.value)}
                        className="w-full h-9 bg-zinc-950 border border-white/10 rounded-lg px-3 text-sm font-bold text-white outline-none focus:border-emerald-500"
                      />
                      {[20, 50, 100, 200].map(b => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setWalkinMontoRecibido(String(b))}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300"
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-2">
                  <Button type="submit" disabled={submittingWalkin || (!walkinData.servicio_id && walkinProductos.length === 0)} className="w-full py-6 text-lg uppercase tracking-widest font-black" variant="primary">
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    {submittingWalkin ? 'Registrando...' : 'Finalizar y Cobrar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Modal Detalles Cita */}
      {selectedCita && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedCita(null)}>
          <div className="w-[95%] md:w-full max-w-md max-h-[90vh] overflow-y-auto bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Detalle de cita</h3>
                <p className="text-sm text-zinc-500 mt-1">{new Date(selectedCita.fecha_hora).toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' })} {new Date(selectedCita.fecha_hora).toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hour12: false })}</p>
              </div>
              <button onClick={() => setSelectedCita(null)} className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Cliente</span><span className="text-white font-bold text-right">{selectedCita.clientes?.nombre}</span></div>
              {selectedCita.clientes?.telefono && <div className="flex justify-between gap-4"><span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Teléfono</span><span className="text-white font-bold text-right">{selectedCita.clientes.telefono}</span></div>}
              <div className="flex justify-between gap-4"><span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Servicio</span><span className="text-amber-400 font-bold text-right">{selectedCita.servicios?.nombre || '—'}</span></div>
              <div className="flex justify-between gap-4 items-center"><span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Estado</span><Badge variant={getEstadoBadge(selectedCita.estado)} className="uppercase text-xs">{selectedCita.estado.replace('_', ' ')}</Badge></div>
              <div className="flex justify-between gap-4"><span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Precio</span><span className="text-white font-black">{formatCurrency(selectedCita.precio)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Comisión Barbero</span><span className="text-white font-black">{formatCurrency(selectedCita.comision_barbero || 0)}</span></div>
            </div>

            <div className="p-4 bg-zinc-950 rounded-xl border border-white/5 space-y-2">
              <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Notas del cliente / Reserva</span>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap">{selectedCita.notas ? selectedCita.notas.replace(/\[Comprobante\]:\s*(https?:\/\/[^\s]+)/, '') : 'Sin notas registradas.'}</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-4 border-t border-white/10">
              {selectedCita.estado === 'pendiente_pago' && (
                <div className="flex flex-col w-full gap-3">
                  <div className="flex w-full gap-3">
                    {selectedCita.comprobante_url && (
                      <Button onClick={() => window.open(selectedCita.comprobante_url!, '_blank')} variant="outline" className="flex-1 h-12 uppercase tracking-widest font-black text-amber-500 border-amber-500/20 hover:bg-amber-500/10">
                        📷 Comprobante
                      </Button>
                    )}
                    <Button 
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/citas/verificar-pago', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ citaId: selectedCita.id }) })
                          if (!res.ok) throw new Error('Error al verificar')
                          success('✅ Pago verificado')
                          setSelectedCita(null)
                          loadData()
                        } catch (e) { toastError('No se pudo verificar el pago') }
                      }}
                      className="flex-1 h-12 uppercase tracking-widest font-black bg-amber-500 hover:bg-amber-600 text-black"
                    >
                      ✅ Aprobar Pago
                    </Button>
                  </div>
                  <Button 
                    onClick={async () => {
                      if (!confirm('¿Cancelar esta cita o marcar que no asistió?')) return
                      try {
                        const res = await fetch('/api/citas/cancelar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cita_id: selectedCita.id, motivo: 'No asistió / Comprobante inválido' }) })
                        if (!res.ok) throw new Error('Error')
                        success('Cita cancelada correctamente')
                        setSelectedCita(null)
                        loadData()
                      } catch (e) { toastError('No se pudo cancelar la cita') }
                    }}
                    variant="outline" className="w-full h-10 uppercase tracking-widest font-black text-xs text-red-500 border-red-500/20 hover:bg-red-500/10"
                  >
                    ❌ No Asistió / Cancelar
                  </Button>
                </div>
              )}
              {selectedCita.estado === 'pendiente' && (
                <div className="flex gap-2 w-full">
                  <Button onClick={() => { iniciarServicio(selectedCita.id); setSelectedCita(null) }} className="flex-1 h-12 uppercase tracking-widest font-black" variant="primary">
                    ▶ Iniciar Servicio
                  </Button>
                  <Button onClick={async () => {
                    if (!confirm('¿Cancelar esta cita o marcar que no asistió?')) return
                    try {
                      const res = await fetch('/api/citas/cancelar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cita_id: selectedCita.id, motivo: 'No asistió' }) })
                      if (!res.ok) throw new Error('Error')
                      success('Cita cancelada correctamente')
                      setSelectedCita(null)
                      loadData()
                    } catch (e) { toastError('No se pudo cancelar la cita') }
                  }} variant="outline" className="h-12 uppercase tracking-widest font-black text-red-500 border-red-500/20 hover:bg-red-500/10 px-3">
                    ❌ Cancelar
                  </Button>
                </div>
              )}
              {selectedCita.estado === 'en_proceso' && (
                <Button variant="success" onClick={() => { finalizarServicio(selectedCita.id); setSelectedCita(null) }} className="w-full h-12 uppercase tracking-widest font-black shadow-lg shadow-green-500/10">
                  ✔ Finalizar y Cobrar
                </Button>
              )}
              {selectedCita.estado === 'completado' && (
                <div className="w-full h-12 flex items-center justify-center bg-green-500/10 text-green-500 rounded-xl font-black uppercase text-xs tracking-widest border border-green-500/20">
                  Servicio Finalizado
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
