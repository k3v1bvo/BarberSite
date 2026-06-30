'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, User, Scissors, CheckCircle, Package, Plus, Minus, X, Info, AlertTriangle, Clock, UserPlus } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { ImageUpload } from '@/components/ui/ImageUpload'

// Interfaces
interface Servicio {
  id: string
  nombre: string
  precio: number
  duracion_minutos: number
  descripcion: string | null
}
interface Producto {
  id: string
  nombre: string
  precio_venta: number
  stock_actual: number
  image_url: string | null
}
interface ProductoCarrito {
  producto: Producto
  cantidad: number
}
interface Barbero {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}
interface UserProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
}

export default function ReservarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black text-amber-500 font-bold uppercase tracking-widest">Cargando...</div>}>
      <ReservarContent />
    </Suspense>
  )
}

function ReservarContent() {
  const { error: toastError, success: toastSuccess } = useToast()
  
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<ProductoCarrito[]>([])
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [promociones, setPromociones] = useState<any[]>([])
  const [promoSeleccionada, setPromoSeleccionada] = useState<string>('')
  const [acompanante, setAcompanante] = useState({ nombre: '', email: '' })
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [qrPago, setQrPago] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    servicio_id: '',
    barbero_id: '',
    fecha: '',
    hora: '',
    nombre: '',
    telefono: '',
    email: '',
    notas: '',
    comprobante_url: '',
  })
  
  const [horasOcupadas, setHorasOcupadas] = useState<{hora: string, duracion: number}[]>([])
  const [loadingDisponibilidad, setLoadingDisponibilidad] = useState(false)
  const [lealtadInfo, setLealtadInfo] = useState<{descuento: number, mensaje: string} | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    loadData()
    const servicioId = searchParams.get('servicio')
    if (servicioId) {
      setFormData(prev => ({ ...prev, servicio_id: servicioId }))
    }
  }, [searchParams])

  useEffect(() => {
    if (formData.barbero_id && formData.fecha) {
      const fetchDisponibilidad = async () => {
        setLoadingDisponibilidad(true)
        try {
          const res = await fetch(`/api/citas/disponibilidad?barbero_id=${formData.barbero_id}&fecha=${formData.fecha}`)
          const data = await res.json()
          if (data.ocupados) {
            setHorasOcupadas(data.ocupados)
          }
        } catch (error) {
          console.error('Error cargando disponibilidad:', error)
        } finally {
          setLoadingDisponibilidad(false)
        }
      }
      fetchDisponibilidad()
    }
  }, [formData.barbero_id, formData.fecha])

  const loadData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name, phone')
          .eq('id', authUser.id)
          .single()
        if (profile) {
          setUser(profile as UserProfile)
          setFormData(prev => ({
            ...prev,
            nombre: profile.full_name || '',
            telefono: profile.phone || '',
            email: profile.email || '',
          }))
          const { data: clienteData } = await supabase
            .from('clientes')
            .select('total_visitas')
            .eq('id', authUser.id)
            .single()
          if (clienteData) {
            const visitasActuales = clienteData.total_visitas || 0
            const enCiclo = visitasActuales % 10
            if (enCiclo === 4) {
              setLealtadInfo({ descuento: 0.5, mensaje: '¡5to Corte! Tienes 50% de descuento en el servicio.' })
            } else if (enCiclo === 9) {
              setLealtadInfo({ descuento: 1, mensaje: '¡10mo Corte! Tu servicio es GRATIS.' })
            }
          }
        }
      }

      const [resServicios, resBarberos, resProductos, configQr, resPromos] = await Promise.all([
        supabase.from('servicios').select('*').eq('is_active', true),
        supabase.from('profiles').select('id, full_name, email, avatar_url').eq('role', 'barbero').eq('is_active', true),
        supabase.from('productos').select('id, nombre, precio_venta, stock_actual, image_url').eq('is_active', true).gt('stock_actual', 0).order('nombre'),
        supabase.from('configuraciones').select('valor').eq('llave', 'qr_pago').maybeSingle(),
        supabase.from('promociones').select('*').eq('activa', true)
      ])

      setServicios(resServicios.data || [])
      setBarberos(resBarberos.data || [])
      setProductos(resProductos.data || [])
      setPromociones(resPromos.data || [])
      if (configQr.data?.valor?.url) {
        setQrPago(configQr.data.valor.url)
      } else if (typeof configQr.data?.valor === 'string') {
        setQrPago(configQr.data.valor)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let clienteId: string | null = null

      if (user) {
        clienteId = user.id
      } else {
        const { data: clienteExistente } = await supabase
          .from('clientes')
          .select('id')
          .eq('email', formData.email)
          .single()

        if (clienteExistente) {
          clienteId = clienteExistente.id
        } else {
          const { data: nuevoCliente, error: clienteError } = await supabase
            .from('clientes')
            .insert({
              nombre: formData.nombre,
              email: formData.email,
              telefono: formData.telefono,
            })
            .select('id')
            .single()

          if (clienteError) throw new Error('No se pudo crear el cliente')
          clienteId = nuevoCliente?.id
        }
      }

      if (!clienteId) throw new Error('No se encontró el ID del cliente')

      const fechaHora = `${formData.fecha}T${formData.hora}:00`

      const { data: citaExistente } = await supabase
        .from('citas')
        .select('id')
        .eq('barbero_id', formData.barbero_id)
        .eq('fecha_hora', fechaHora)
        .not('estado', 'eq', 'cancelada')
        .single()

      if (citaExistente) {
        throw new Error('Lo sentimos, este horario acaba de ser ocupado. Por favor selecciona otro.')
      }

      const servicio = servicios.find(s => s.id === formData.servicio_id)
      let precioServicioFinal = servicio?.precio || 0
      let notasFinales = formData.notas

      const promoElegida = promociones.find(p => p.id === promoSeleccionada)
      if (promoElegida?.tipo === '2x1' && !acompanante.nombre.trim()) {
        setSubmitting(false)
        toastError('Debe ingresar el nombre del acompañante para la promoción 2x1.')
        return
      }

      if (lealtadInfo && servicio) {
        precioServicioFinal = precioServicioFinal * (1 - lealtadInfo.descuento)
        const promoNota = `[PROMO: ${lealtadInfo.mensaje}]`
        notasFinales = formData.notas ? `${formData.notas}\n${promoNota}` : promoNota
      }

      if (promoElegida) {
        if (promoElegida.tipo === 'descuento_fijo') precioServicioFinal = Math.max(0, precioServicioFinal - promoElegida.valor)
        if (promoElegida.tipo === 'descuento_porcentaje') precioServicioFinal = precioServicioFinal * (1 - (promoElegida.valor / 100))
        
        let infoPromo = `[PROMO: ${promoElegida.nombre}]`
        if (promoElegida.tipo === '2x1') {
          infoPromo += ` Acompañante: ${acompanante.nombre}${acompanante.email ? ` (${acompanante.email})` : ''}`
        }
        notasFinales = notasFinales ? `${notasFinales}\n${infoPromo}` : infoPromo
      }

      const totalProductos = carrito.reduce((s, item) => s + (item.producto.precio_venta * item.cantidad), 0)
      const precioFinalTotal = precioServicioFinal + totalProductos
      const anticipoCalculado = Math.max(20, precioFinalTotal * 0.5)

      const barbero = barberos.find((b) => b.id === formData.barbero_id)

      const { data: citaNueva, error: citaError } = await supabase
        .from('citas')
        .insert({
          cliente_id: clienteId,
          barbero_id: formData.barbero_id,
          servicio_id: formData.servicio_id || null,
          fecha_hora: fechaHora,
          precio: precioFinalTotal,
          duracion_real_minutos: servicio?.duracion_minutos || 30,
          estado: 'pendiente_pago',
          notas: notasFinales,
          anticipo_monto: anticipoCalculado,
          comprobante_url: formData.comprobante_url || null,
        })
        .select('id')
        .single()

      if (citaError) throw new Error(citaError.message)

      if (carrito.length > 0) {
        const { error: prodError } = await supabase.from('citas_productos').insert(
          carrito.map(item => ({
            cita_id: citaNueva.id,
            producto_id: item.producto.id,
            cantidad: item.cantidad,
            precio_unitario: item.producto.precio_venta,
            subtotal: item.producto.precio_venta * item.cantidad
          }))
        )
        if (prodError) console.error('Error insertando productos de la cita', prodError)
      }

      try {
        await fetch('/api/notificaciones/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'pago_pendiente',
            allowPublic: true,
            payload: {
              citaId: citaNueva.id,
              barberoId: formData.barbero_id,
              barberoNombre: barbero?.full_name,
              barberoEmail: barbero?.email,
              clienteNombre: formData.nombre,
              clienteEmail: formData.email,
              servicioNombre: servicio?.nombre || 'Solo Productos',
              fecha: formData.fecha,
              hora: formData.hora,
              monto: anticipoCalculado,
              comprobante_url: formData.comprobante_url || null,
            },
          }),
        })
      } catch (e) {
        console.error('Error enviando notificación', e)
      }

      if (promoElegida?.tipo === '2x1' && acompanante.email) {
        try {
          await fetch('/api/notificaciones/dispatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'invitacion_2x1',
              allowPublic: true,
              payload: {
                citaId: citaNueva.id,
                acompananteNombre: acompanante.nombre,
                acompananteEmail: acompanante.email,
                clienteNombre: formData.nombre,
                fecha: formData.fecha,
                hora: formData.hora,
              },
            }),
          })
        } catch (e) {
          console.error('Error enviando invitación 2x1', e)
        }
      }

      setSuccess(true)
    } catch (error: any) {
      console.error('Error completo:', error)
      toastError('Error al reservar: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  // --- Helpers for Availability & Products ---
  const generarHorarios = () => {
    const horarios = []
    for (let h = 9; h <= 20; h++) {
      horarios.push(`${h.toString().padStart(2, '0')}:00`)
      if (h < 20) {
        horarios.push(`${h.toString().padStart(2, '0')}:30`)
      }
    }
    return horarios
  }

  const hoyLocal = new Date()
  const hoy = new Date(hoyLocal.getTime() - (hoyLocal.getTimezoneOffset() * 60000)).toISOString().split('T')[0]

  const checkDisponibilidad = (hora: string) => {
    const servicioSeleccionado = servicios.find(s => s.id === formData.servicio_id)
    if (!servicioSeleccionado) return false

    const [hrs, mins] = hora.split(':').map(Number)
    
    if (formData.fecha === hoy) {
      const ahora = new Date()
      const horaCita = new Date()
      horaCita.setHours(hrs, mins, 0, 0)
      
      const diffHoras = (horaCita.getTime() - ahora.getTime()) / (1000 * 60 * 60)
      if (diffHoras < 3) return true
    }

    const getMinutos = (h: string) => {
      const [hs, ms] = h.split(':').map(Number)
      return hs * 60 + ms
    }

    const slotInicio = getMinutos(hora)
    const slotFin = slotInicio + servicioSeleccionado.duracion_minutos

    return horasOcupadas.some(cita => {
      const citaInicio = getMinutos(cita.hora)
      const citaFin = citaInicio + cita.duracion
      return (slotInicio < citaFin) && (citaInicio < slotFin)
    })
  }

  const agregarProducto = (producto: Producto) => {
    setCarrito(prev => {
      const existe = prev.find(p => p.producto.id === producto.id)
      if (existe) {
        if (existe.cantidad >= producto.stock_actual) {
          toastError(`Sin stock suficiente de ${producto.nombre}`)
          return prev
        }
        return prev.map(p => p.producto.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p)
      }
      return [...prev, { producto, cantidad: 1 }]
    })
  }

  const quitarProducto = (productoId: string) => {
    setCarrito(prev => {
      const item = prev.find(p => p.producto.id === productoId)
      if (item && item.cantidad > 1) {
        return prev.map(p => p.producto.id === productoId ? { ...p, cantidad: p.cantidad - 1 } : p)
      }
      return prev.filter(p => p.producto.id !== productoId)
    })
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-black text-amber-500 font-bold tracking-widest animate-pulse">Cargando...</div>
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-4">
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-md text-center p-8">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-3xl font-bold mb-3 text-amber-400">¡Pago Pendiente!</h2>
          <p className="text-zinc-400 mb-8">Hemos registrado tu reserva. Quedará confirmada en cuanto verifiquemos tu pago.</p>
          <Button onClick={() => router.push('/cliente')} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
            Ver mis citas
          </Button>
        </Card>
      </div>
    )
  }

  const servicioSeleccionado = servicios.find(s => s.id === formData.servicio_id)
  let precioServicio = servicioSeleccionado?.precio || 0
  if (lealtadInfo && servicioSeleccionado) {
    precioServicio = precioServicio * (1 - lealtadInfo.descuento)
  }
  const totalProductos = carrito.reduce((s, i) => s + (i.producto.precio_venta * i.cantidad), 0)
  const totalReserva = precioServicio + totalProductos
  const anticipo = Math.max(20, totalReserva * 0.5)

  const missingFields = []
  if (!formData.servicio_id && carrito.length === 0) missingFields.push('Servicio o Producto')
  if (!formData.barbero_id) missingFields.push('Barbero')
  if (!formData.fecha || !formData.hora) missingFields.push('Fecha y Hora')
  if (!formData.nombre || !formData.telefono || !formData.email) missingFields.push('Tus Datos')
  if (totalReserva > 0 && !formData.comprobante_url) missingFields.push('Comprobante de Pago')

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white pb-24">
      <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase leading-none">
            Agenda tu <span className="text-amber-500">Cita</span>
          </h1>
          {user && (
            <p className="text-zinc-400 mt-2 text-lg">
              👋 Hola, <span className="text-amber-400 font-bold">{user.full_name}</span>. Todo en un solo lugar.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LADO IZQUIERDO: SELECCIÓN */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* SERVICIOS */}
            <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-800/80">
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-amber-500" /> 1. Selección de Servicio
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {servicios.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setFormData({ ...formData, servicio_id: s.id })}
                      className={`p-4 border rounded-xl cursor-pointer transition flex flex-col justify-between ${
                        formData.servicio_id === s.id
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-zinc-800 bg-black/50 hover:border-amber-500/50'
                      }`}
                    >
                      <div>
                        <h3 className="font-bold text-lg mb-1">{s.nombre}</h3>
                        {s.descripcion && <p className="text-sm text-zinc-500 mb-2 line-clamp-2">{s.descripcion}</p>}
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-800">
                        <span className="text-amber-500 font-bold">{formatCurrency(s.precio)}</span>
                        <span className="text-xs text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {s.duracion_minutos} min</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* PROMOCIONES PUBLICAS */}
                {promociones.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-zinc-800">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-amber-500" /> Promoción Especial (Opcional)
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setPromoSeleccionada('')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                          !promoSeleccionada ? 'bg-amber-500 text-black' : 'bg-black/50 border border-zinc-800 text-zinc-400 hover:border-amber-500/50'
                        }`}
                      >
                        Sin promo
                      </button>
                      {promociones.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setPromoSeleccionada(p.id === promoSeleccionada ? '' : p.id)}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                            promoSeleccionada === p.id ? 'bg-amber-500 text-black' : 'bg-black/50 border border-zinc-800 text-amber-500/80 hover:border-amber-500/50'
                          }`}
                        >
                          <span>{p.icono}</span>
                          {p.nombre}
                        </button>
                      ))}
                    </div>

                    {promociones.find(p => p.id === promoSeleccionada)?.tipo === '2x1' && (
                      <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <h4 className="text-amber-500 font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4" />
                          Datos de tu Acompañante 2x1 (Requerido)
                        </h4>
                        <p className="text-xs text-amber-500/80 mb-3">Tu acompañante debe venir contigo en el mismo horario. Le enviaremos una invitación oficial si nos dejas su correo.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input
                            placeholder="Nombre completo *"
                            value={acompanante.nombre}
                            onChange={(e) => setAcompanante({ ...acompanante, nombre: e.target.value })}
                            className="bg-black/50 border-amber-500/30 text-sm"
                          />
                          <Input
                            placeholder="Correo electrónico (Opcional)"
                            type="email"
                            value={acompanante.email}
                            onChange={(e) => setAcompanante({ ...acompanante, email: e.target.value })}
                            className="bg-black/50 border-amber-500/30 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PRODUCTOS (Opcional) */}
            <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-800/80">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Package className="w-5 h-5 text-violet-500" /> Productos Tienda (Opcional)
                  </h2>
                </div>
                <p className="text-sm text-zinc-500 mb-4">¿Deseas agregar algún producto a tu reserva para recogerlo?</p>
                {productos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {productos.map((p) => {
                      const enCarrito = carrito.find(c => c.producto.id === p.id)
                      return (
                        <div key={p.id} className={`p-3 border rounded-xl transition ${enCarrito ? 'border-violet-500 bg-violet-500/10' : 'border-white/5 bg-black/20 hover:border-violet-500/30'}`}>
                          {p.image_url && <img src={p.image_url} alt={p.nombre} className="w-full h-24 object-cover rounded-lg mb-2 bg-zinc-800" />}
                          <h3 className="font-semibold text-xs line-clamp-2 min-h-[2rem]">{p.nombre}</h3>
                          <p className="font-bold text-violet-400 mt-1">{formatCurrency(p.precio_venta)}</p>
                          {enCarrito ? (
                            <div className="mt-2 flex items-center justify-between bg-black/50 rounded-lg p-1">
                              <button onClick={() => quitarProducto(p.id)} className="w-6 h-6 flex items-center justify-center rounded-md bg-zinc-800 text-white hover:bg-zinc-700"><Minus className="w-3 h-3" /></button>
                              <span className="text-sm font-bold">{enCarrito.cantidad}</span>
                              <button onClick={() => agregarProducto(p)} className="w-6 h-6 flex items-center justify-center rounded-md bg-violet-600 text-white hover:bg-violet-500"><Plus className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <button onClick={() => agregarProducto(p)} className="w-full mt-2 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-violet-600 transition text-white">Agregar</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No hay productos disponibles por ahora.</p>
                )}
              </CardContent>
            </Card>

            {/* BARBERO */}
            <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-800/80">
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-500" /> 2. Elige tu Barbero
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {barberos.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => setFormData({ ...formData, barbero_id: b.id })}
                      className={`flex flex-col items-center gap-3 p-4 border rounded-xl cursor-pointer transition ${
                        formData.barbero_id === b.id
                          ? 'border-amber-400 bg-amber-500/10 scale-105'
                          : 'border-white/5 hover:border-amber-400/40 bg-black/20'
                      }`}
                    >
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800 border-2 border-transparent relative">
                        {formData.barbero_id === b.id && <div className="absolute inset-0 border-2 border-amber-500 rounded-full" />}
                        {b.avatar_url ? (
                          <img src={b.avatar_url} alt={b.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-zinc-800">{b.full_name.charAt(0)}</div>
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-center">{b.full_name}</h3>
                      <span className="text-[10px] uppercase tracking-widest text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">Especialista</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* FECHA Y HORA */}
            <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-800/80">
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" /> 3. Fecha y Hora
                </h2>
                {!formData.barbero_id || (!formData.servicio_id && carrito.length === 0) ? (
                  <p className="text-zinc-500 text-sm">Selecciona un servicio/producto y un barbero para ver la disponibilidad.</p>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-2 font-semibold">Selecciona una fecha</label>
                      <input
                        type="date"
                        value={formData.fecha}
                        onChange={(e) => setFormData({ ...formData, fecha: e.target.value, hora: '' })}
                        min={hoy}
                        className="w-full md:w-1/2 p-3 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500"
                      />
                    </div>
                    {formData.fecha && (
                      <div>
                        <label className="flex items-center gap-2 text-sm text-zinc-400 mb-3 font-semibold">
                          Horarios Disponibles {loadingDisponibilidad && <span className="text-amber-500 text-xs animate-pulse">(Cargando...)</span>}
                        </label>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {generarHorarios().map((hora) => {
                            const estaOcupado = checkDisponibilidad(hora)
                            return (
                              <button
                                key={hora}
                                type="button"
                                disabled={estaOcupado}
                                onClick={() => setFormData({ ...formData, hora })}
                                className={`py-2 rounded-lg text-sm font-semibold transition ${
                                  formData.hora === hora
                                    ? 'bg-amber-500 text-black'
                                    : estaOcupado
                                      ? 'bg-red-500/10 text-red-500/40 cursor-not-allowed border border-red-500/20'
                                      : 'bg-black/50 hover:bg-amber-500/20 hover:text-amber-400 text-white border border-white/5'
                                }`}
                              >
                                {hora}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* DATOS PERSONALES */}
            <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-800/80">
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-500" /> 4. Tus Datos Personales
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nombre completo" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} disabled={!!user} />
                  <Input label="Teléfono" type="tel" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} disabled={!!user} />
                  <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} disabled={!!user} className="md:col-span-2" />
                  <div className="md:col-span-2">
                    <label className="block text-sm text-zinc-400 mb-2">Notas (opcional)</label>
                    <textarea value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500" rows={2} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* LADO DERECHO: RESUMEN STICKY */}
          <div className="lg:col-span-4">
            <Card className="bg-zinc-900 border-amber-500/30 sticky top-8 shadow-2xl">
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold mb-6 text-amber-500">Resumen de tu Reserva</h2>
                
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                    <span className="text-zinc-400">Cuándo</span>
                    <span className="font-semibold text-right text-white">
                      {formData.fecha && formData.hora ? `${formData.fecha} a las ${formData.hora}` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                    <span className="text-zinc-400">Especialista</span>
                    <span className="font-semibold text-right text-white">
                      {barberos.find(b => b.id === formData.barbero_id)?.full_name || '—'}
                    </span>
                  </div>

                  {/* Servicio */}
                  {servicioSeleccionado && (
                    <div className="flex justify-between items-center text-sm pt-2">
                      <span className="text-zinc-300 font-medium">Corte / Servicio</span>
                      <span className="font-bold text-amber-400">{formatCurrency(servicioSeleccionado.precio)}</span>
                    </div>
                  )}

                  {/* Descuentos Lealtad */}
                  {lealtadInfo && servicioSeleccionado && (
                    <div className="flex justify-between items-center text-sm bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 mt-2">
                      <span className="text-emerald-400 font-bold text-xs">{lealtadInfo.mensaje}</span>
                      <span className="font-bold text-emerald-400">-{formatCurrency(servicioSeleccionado.precio * lealtadInfo.descuento)}</span>
                    </div>
                  )}

                  {/* Productos */}
                  {carrito.length > 0 && (
                    <div className="pt-2 border-t border-white/10 mt-2">
                      <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2 block">Productos Agregados</span>
                      {carrito.map(item => (
                        <div key={item.producto.id} className="flex justify-between items-center text-sm mb-1">
                          <span className="text-zinc-300 text-xs">{item.cantidad}x {item.producto.nombre}</span>
                          <span className="text-violet-400 font-medium">{formatCurrency(item.producto.precio_venta * item.cantidad)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-black/40 p-4 rounded-xl border border-white/5 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-zinc-400 font-semibold">Total Reserva</span>
                    <span className="font-bold text-lg text-white">{formatCurrency(totalReserva)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-amber-500 font-bold text-sm">Anticipo Requerido</span>
                    <span className="font-black text-xl text-amber-500">{formatCurrency(anticipo)}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-2 text-center">Mínimo 20 Bs o el 50% del total para confirmar.</p>
                </div>

                {/* PAGO QR (Aparece si ya llenó lo básico) */}
                {totalReserva > 0 && formData.nombre && formData.barbero_id && formData.fecha && formData.hora && (
                  <div className="mb-6 space-y-4 p-4 bg-zinc-950 rounded-xl border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                    <p className="text-sm font-bold text-center text-amber-400 mb-2">Escanea y sube tu comprobante</p>
                    {qrPago ? (
                      <div className="flex justify-center">
                        <img src={qrPago} alt="QR de Pago" className="w-48 h-48 object-contain rounded-lg bg-white p-2" />
                      </div>
                    ) : (
                      <div className="w-40 h-40 bg-zinc-900 rounded-lg mx-auto flex items-center justify-center border border-dashed border-zinc-700">
                        <span className="text-xs text-zinc-600 text-center px-4">QR no configurado por el admin</span>
                      </div>
                    )}
                    <ImageUpload
                      label="Captura del Comprobante (Obligatorio)"
                      defaultImage={formData.comprobante_url || undefined}
                      onUploadSuccess={(url) => setFormData({ ...formData, comprobante_url: url })}
                      onUploadError={(err) => toastError(err)}
                    />
                  </div>
                )}

                {missingFields.length > 0 && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                    <p className="text-[11px] text-red-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Faltan datos:
                    </p>
                    <ul className="text-[11px] text-red-300/80 list-disc list-inside space-y-0.5 ml-1">
                      {missingFields.map(f => <li key={f}>{f}</li>)}
                    </ul>
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || missingFields.length > 0}
                  className="w-full h-14 text-lg font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                >
                  {submitting ? 'Confirmando...' : 'Confirmar Reserva'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}