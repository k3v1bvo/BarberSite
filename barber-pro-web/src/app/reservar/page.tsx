'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, User, Scissors, CheckCircle, Package, Plus, Minus, X, Info, AlertTriangle, Clock, UserPlus, Gift } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { CATEGORIAS_SERVICIOS } from '@/types'
import { ServicioGalleryBanner } from '@/components/ui/ServicioGalleryBanner'

// Interfaces
interface Servicio {
  id: string
  nombre: string
  precio: number
  duracion_minutos: number
  descripcion: string | null
  barberos_excluidos?: string[]
  imagen_url?: string | null
  imagenes?: string[] | null
  categoria?: string
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
  const [step, setStep] = useState(1)
  const [filterCategoria, setFilterCategoria] = useState<string>('todos')
  const [tipoReserva, setTipoReserva] = useState<'adelanto_20' | 'adelanto_10' | 'pago_total' | 'sin_adelanto'>('adelanto_20')

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
  const [tiempoMinimoReserva, setTiempoMinimoReserva] = useState(60) // minutos

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

      const [resServicios, resBarberos, resProductos, configQr, resPromos, configTiempo] = await Promise.all([
        supabase.from('servicios').select('*').eq('is_active', true),
        supabase.from('profiles').select('id, full_name, email, avatar_url').eq('role', 'barbero').eq('is_active', true),
        supabase.from('productos').select('id, nombre, precio_venta, stock_actual, image_url').eq('is_active', true).gt('stock_actual', 0).order('nombre'),
        supabase.from('configuraciones').select('valor').eq('llave', 'qr_pago').maybeSingle(),
        supabase.from('promociones').select('*').eq('activa', true),
        supabase.from('configuraciones').select('valor').eq('llave', 'tiempo_minimo_reserva').maybeSingle()
      ])

      setServicios(resServicios.data || [])
      setBarberos(resBarberos.data || [])
      setProductos(resProductos.data || [])
      setPromociones(resPromos.data || [])
      if (configTiempo.data?.valor?.minutos) {
        setTiempoMinimoReserva(Number(configTiempo.data.valor.minutos))
      }
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
        // Verificar que el registro en "clientes" realmente exista (por si fue borrado en un truncate)
        const { data: clienteVerificado } = await supabase.from('clientes').select('id').eq('id', user.id).single()
        if (!clienteVerificado) {
          const { error: insertErr } = await supabase.from('clientes').insert({
            id: user.id,
            nombre: formData.nombre || user.full_name || 'Sin Nombre',
            email: formData.email || user.email,
            telefono: formData.telefono || user.phone || null,
          })
          if (insertErr) throw new Error('No se pudo restaurar el registro del cliente: ' + insertErr.message)
        }
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
      const descuentoCruzado = (formData.servicio_id && carrito.length > 0) ? 10 : 0
      const precioFinalTotal = Math.max(0, precioServicioFinal + totalProductos - descuentoCruzado)

      if (descuentoCruzado > 0) {
        const promoCruzada = '[PROMO: Descuento 10 Bs por compra de producto + servicio]'
        notasFinales = notasFinales ? `${notasFinales}\n${promoCruzada}` : promoCruzada
      }

      let anticipoCalculado = 20
      if (tipoReserva === 'adelanto_10') anticipoCalculado = 10
      else if (tipoReserva === 'adelanto_20') anticipoCalculado = 20
      else if (tipoReserva === 'pago_total') anticipoCalculado = precioFinalTotal
      else if (tipoReserva === 'sin_adelanto') anticipoCalculado = 0

      let notaReserva = ''
      if (tipoReserva === 'sin_adelanto') {
        notaReserva = '[Reserva]: Sin adelanto QR (Paga en local. Reprogramación +5 Bs)'
      } else if (tipoReserva === 'pago_total') {
        notaReserva = `[Reserva QR]: Pago Completo por QR (Bs ${precioFinalTotal})`
      } else {
        notaReserva = `[Reserva QR]: Adelanto de Bs ${anticipoCalculado} por Reserva`
      }
      notasFinales = notasFinales ? `${notasFinales}\n${notaReserva}` : notaReserva

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
          estado: tipoReserva === 'sin_adelanto' ? 'confirmado' : 'pendiente_pago',
          notas: formData.comprobante_url ? `${notasFinales}\n[Comprobante]: ${formData.comprobante_url}` : notasFinales,
          anticipo_monto: anticipoCalculado,
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
      
      const diffMinutos = (horaCita.getTime() - ahora.getTime()) / (1000 * 60)
      if (diffMinutos < tiempoMinimoReserva) return true
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
  const descuentoCruzado = (formData.servicio_id && carrito.length > 0) ? 10 : 0
  const totalReserva = Math.max(0, precioServicio + totalProductos - descuentoCruzado)
  let anticipo = 20
  if (tipoReserva === 'adelanto_10') anticipo = 10
  else if (tipoReserva === 'adelanto_20') anticipo = 20
  else if (tipoReserva === 'pago_total') anticipo = totalReserva
  else if (tipoReserva === 'sin_adelanto') anticipo = 0

  const missingFields = []
  if (!formData.servicio_id && carrito.length === 0) missingFields.push('Servicio o Producto')
  if (!formData.barbero_id) missingFields.push('Barbero')
  if (!formData.fecha || !formData.hora) missingFields.push('Fecha y Hora')
  if (!formData.nombre || !formData.telefono || !formData.email) missingFields.push('Tus Datos')
  if (tipoReserva !== 'sin_adelanto' && totalReserva > 0 && !formData.comprobante_url) missingFields.push('Comprobante de Pago QR')

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white pb-24 font-sans selection:bg-amber-500/30">
      <div className="max-w-4xl mx-auto px-4 py-8 lg:py-12">
        <div className="mb-10 text-center animate-in fade-in slide-in-from-top-4 duration-700">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white uppercase leading-none drop-shadow-lg">
            Agenda tu <span className="text-amber-500">Cita</span>
          </h1>
          {user && (
            <p className="text-zinc-400 mt-3 text-lg font-medium">
              👋 Hola, <span className="text-amber-400 font-bold">{user.full_name}</span>. Todo en un solo lugar.
            </p>
          )}
        </div>

        {/* PROGRESS BAR */}
        <div className="mb-12 max-w-2xl mx-auto px-4 animate-in fade-in duration-1000 delay-150">
          <div className="flex justify-between items-center relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-zinc-800 rounded-full z-0 shadow-inner"></div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-amber-500 rounded-full z-0 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${((step - 1) / 4) * 100}%` }}></div>
            
            {[
              { s: 1, label: 'Servicio', icon: Scissors },
              { s: 2, label: 'Barbero', icon: User },
              { s: 3, label: 'Fecha', icon: Calendar },
              { s: 4, label: 'Tienda', icon: Package },
              { s: 5, label: 'Resumen', icon: CheckCircle }
            ].map((item) => (
              <div key={item.s} className="relative z-10 flex flex-col items-center gap-2">
                <button
                  onClick={() => {
                    // Permite navegar a pasos anteriores
                    if (item.s < step) setStep(item.s)
                  }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all duration-500 ${
                    step === item.s ? 'bg-amber-500 text-black scale-110 shadow-[0_0_20px_rgba(245,158,11,0.6)] ring-4 ring-amber-500/20' 
                    : item.s < step ? 'bg-amber-500 text-black cursor-pointer hover:bg-amber-400' 
                    : 'bg-zinc-900 border-2 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                </button>
                <span className={`text-[10px] md:text-xs uppercase font-bold tracking-widest hidden sm:block transition-colors duration-300 ${step >= item.s ? 'text-amber-500 drop-shadow-md' : 'text-zinc-600'}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CONTENIDO DE LOS PASOS */}
        <div className="relative animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
          
          {/* PASO 1: SERVICIO */}
          {step === 1 && (
            <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-800/80 shadow-2xl rounded-3xl overflow-hidden">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-3xl font-black mb-6 text-center tracking-tight">Selecciona tu <span className="text-amber-500">Servicio</span></h2>
                
                {/* Pestañas / Filtros de Categorías */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                  <button
                    type="button"
                    onClick={() => setFilterCategoria('todos')}
                    className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                      filterCategoria === 'todos'
                        ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105'
                        : 'bg-black/60 border border-zinc-800 text-zinc-400 hover:border-amber-500/50 hover:text-white'
                    }`}
                  >
                    Todos ({servicios.length})
                  </button>
                  {CATEGORIAS_SERVICIOS.map(cat => {
                    const count = servicios.filter(s => (s.categoria || 'Cortes') === cat.id).length
                    if (count === 0 && filterCategoria !== cat.id) return null
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFilterCategoria(cat.id)}
                        className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                          filterCategoria === cat.id
                            ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105'
                            : 'bg-black/60 border border-zinc-800 text-zinc-400 hover:border-amber-500/50 hover:text-white'
                        }`}
                      >
                        <span>{cat.id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/30 font-mono">{count}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Renderizado de Servicios (Agrupado si es todos, o grid si es filtrado) */}
                {filterCategoria === 'todos' ? (
                  <div className="space-y-12">
                    {CATEGORIAS_SERVICIOS.map(cat => {
                      const servsDeCat = servicios.filter(s => (s.categoria || 'Cortes') === cat.id)
                      if (servsDeCat.length === 0) return null
                      return (
                        <div key={cat.id} className="space-y-4">
                          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
                            <div className="w-2 h-6 bg-amber-500 rounded-full" />
                            <h3 className="text-xl font-black uppercase tracking-tight text-white">{cat.label}</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {servsDeCat.map((s) => {
                              const allImgs = s.imagenes && s.imagenes.length > 0
                                ? s.imagenes
                                : (s.imagen_url ? [s.imagen_url] : [])
                              return (
                              <div
                                key={s.id}
                                onClick={() => {
                                  setFormData({ ...formData, servicio_id: s.id, barbero_id: '' })
                                  setTimeout(() => setStep(2), 250)
                                }}
                                className={`p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1 ${
                                  formData.servicio_id === s.id
                                    ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_25px_rgba(245,158,11,0.15)] scale-[1.02]'
                                    : 'border-zinc-800 bg-black/50 hover:border-amber-500/50 hover:bg-zinc-800/80'
                                }`}
                              >
                                <div className="flex gap-4 items-start">
                                  {allImgs.length > 0 && (
                                    <ServicioGalleryBanner
                                      imagenes={allImgs}
                                      categoria={s.categoria}
                                      aspectRatio="w-24 h-24 sm:w-28 sm:h-28 rounded-xl shrink-0 border border-zinc-800"
                                      showBadge={false}
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <h4 className="font-black text-lg text-white group-hover:text-amber-400 transition-colors truncate">{s.nombre}</h4>
                                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-zinc-800 text-amber-400 border border-zinc-700 shrink-0">
                                        {s.categoria || 'Cortes'}
                                      </span>
                                    </div>
                                    {s.descripcion && <p className="text-xs text-zinc-400 mb-2 line-clamp-2 leading-relaxed">{s.descripcion}</p>}
                                  </div>
                                </div>
                                <div className="flex justify-between items-center mt-4 pt-4 border-t border-zinc-800/50">
                                  <span className="text-amber-400 font-black text-xl tracking-tight">{formatCurrency(s.precio)}</span>
                                  <span className="text-xs font-bold text-zinc-400 bg-zinc-950 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-inner"><Clock className="w-3.5 h-3.5 text-amber-500"/> {s.duracion_minutos} min</span>
                                </div>
                              </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {servicios.filter(s => (s.categoria || 'Cortes') === filterCategoria).map((s) => {
                      const allImgs = s.imagenes && s.imagenes.length > 0
                        ? s.imagenes
                        : (s.imagen_url ? [s.imagen_url] : [])
                      return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setFormData({ ...formData, servicio_id: s.id, barbero_id: '' })
                          setTimeout(() => setStep(2), 250)
                        }}
                        className={`p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1 ${
                          formData.servicio_id === s.id
                            ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_25px_rgba(245,158,11,0.15)] scale-[1.02]'
                            : 'border-zinc-800 bg-black/50 hover:border-amber-500/50 hover:bg-zinc-800/80'
                        }`}
                      >
                        <div className="flex gap-4 items-start">
                          {allImgs.length > 0 && (
                            <ServicioGalleryBanner
                              imagenes={allImgs}
                              categoria={s.categoria}
                              aspectRatio="w-24 h-24 sm:w-28 sm:h-28 rounded-xl shrink-0 border border-zinc-800"
                              showBadge={false}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h4 className="font-black text-lg text-white group-hover:text-amber-400 transition-colors truncate">{s.nombre}</h4>
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-zinc-800 text-amber-400 border border-zinc-700 shrink-0">
                                {s.categoria || 'Cortes'}
                              </span>
                            </div>
                            {s.descripcion && <p className="text-xs text-zinc-400 mb-2 line-clamp-2 leading-relaxed">{s.descripcion}</p>}
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-zinc-800/50">
                          <span className="text-amber-400 font-black text-xl tracking-tight">{formatCurrency(s.precio)}</span>
                          <span className="text-xs font-bold text-zinc-400 bg-zinc-950 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-inner"><Clock className="w-3.5 h-3.5 text-amber-500"/> {s.duracion_minutos} min</span>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                )}

                {/* PROMOCIONES PUBLICAS */}
                {promociones.length > 0 && (
                  <div className="mt-10 pt-8 border-t border-zinc-800/50">
                    <h2 className="text-xs md:text-sm uppercase tracking-[0.2em] font-black mb-5 text-center text-zinc-500">
                      Promociones Especiales (Opcional)
                    </h2>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        onClick={() => setPromoSeleccionada('')}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          !promoSeleccionada ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-black/50 border border-zinc-800 text-zinc-400 hover:border-amber-500/50 hover:text-white'
                        }`}
                      >
                        Sin promo
                      </button>
                      {promociones.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setPromoSeleccionada(p.id === promoSeleccionada ? '' : p.id)}
                          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                            promoSeleccionada === p.id ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-black/50 border border-zinc-800 text-amber-500/80 hover:border-amber-500/50 hover:text-amber-400'
                          }`}
                        >
                          <span>{p.icono}</span>
                          {p.nombre}
                        </button>
                      ))}
                    </div>
                    {promociones.find(p => p.id === promoSeleccionada)?.tipo === '2x1' && (
                      <div className="mt-6 max-w-lg mx-auto p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl animate-in fade-in zoom-in-95 duration-300">
                        <h4 className="text-amber-500 font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                          <UserPlus className="w-4 h-4" />
                          Datos de tu Acompañante 2x1
                        </h4>
                        <p className="text-xs text-amber-500/80 mb-4 font-medium leading-relaxed">Tu acompañante debe venir contigo en el mismo horario.</p>
                        <div className="space-y-4">
                          <Input placeholder="Nombre completo *" value={acompanante.nombre} onChange={(e) => setAcompanante({ ...acompanante, nombre: e.target.value })} className="bg-black/60 border-amber-500/20 text-sm h-12" />
                          <Input placeholder="Correo electrónico (Opcional)" type="email" value={acompanante.email} onChange={(e) => setAcompanante({ ...acompanante, email: e.target.value })} className="bg-black/60 border-amber-500/20 text-sm h-12" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-10 flex justify-center">
                  <Button variant="ghost" onClick={() => setStep(4)} className="text-zinc-500 hover:text-white text-xs uppercase tracking-[0.2em] font-bold py-6 hover:bg-white/5 rounded-xl">
                    Saltar a la tienda (Solo Comprar)
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PASO 2: BARBERO */}
          {step === 2 && (
            <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-800/80 shadow-2xl rounded-3xl overflow-hidden">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-3xl font-black mb-8 text-center tracking-tight">Elige tu <span className="text-amber-500">Barbero</span></h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {barberos
                    .filter(b => {
                      if (!formData.servicio_id) return true
                      const servicio = servicios.find(s => s.id === formData.servicio_id)
                      if (!servicio?.barberos_excluidos?.length) return true
                      return !servicio.barberos_excluidos.includes(b.id)
                    })
                    .map((b) => (
                    <div
                      key={b.id}
                      onClick={() => {
                        setFormData({ ...formData, barbero_id: b.id, fecha: '', hora: '' })
                        setTimeout(() => setStep(3), 250)
                      }}
                      className={`flex flex-col items-center gap-4 p-6 border-2 rounded-2xl cursor-pointer transition-all duration-300 group hover:-translate-y-1 ${
                        formData.barbero_id === b.id
                          ? 'border-amber-500 bg-amber-500/10 scale-105 shadow-[0_0_25px_rgba(245,158,11,0.2)]'
                          : 'border-zinc-800 hover:border-amber-500/40 bg-black/50 hover:bg-zinc-800/80'
                      }`}
                    >
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-950 border-4 border-zinc-800 relative group-hover:border-amber-500/50 transition-colors">
                        {formData.barbero_id === b.id && <div className="absolute inset-0 border-4 border-amber-500 rounded-full z-10" />}
                        {b.avatar_url ? (
                          <img src={b.avatar_url} alt={b.full_name} className="w-full h-full object-cover relative z-0" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl font-black bg-zinc-900 text-zinc-600 relative z-0">{b.full_name.charAt(0)}</div>
                        )}
                      </div>
                      <div className="text-center">
                        <h3 className="font-black text-base text-white group-hover:text-amber-400 transition-colors">{b.full_name}</h3>
                        <span className="inline-block mt-2 text-[10px] uppercase tracking-[0.2em] text-amber-500 font-bold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">Especialista</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-10 flex justify-between items-center border-t border-zinc-800/50 pt-6">
                  <Button variant="ghost" onClick={() => setStep(1)} className="text-zinc-400 hover:text-white uppercase tracking-widest font-bold text-xs">
                    ← Atrás
                  </Button>
                  <Button disabled={!formData.barbero_id} onClick={() => setStep(3)} className="bg-amber-500 hover:bg-amber-400 text-black font-black px-10 py-6 text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-amber-500/20">
                    Siguiente
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PASO 3: FECHA Y HORA */}
          {step === 3 && (
            <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-800/80 shadow-2xl rounded-3xl overflow-hidden">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-3xl font-black mb-8 text-center tracking-tight">Fecha y <span className="text-amber-500">Hora</span></h2>
                <div className="max-w-2xl mx-auto space-y-10">
                  <div className="bg-black/40 p-6 rounded-2xl border border-white/5">
                    <label className="block text-sm text-zinc-400 mb-4 font-black text-center uppercase tracking-[0.2em]">1. Selecciona un Día</label>
                    <input
                      type="date"
                      value={formData.fecha}
                      onChange={(e) => setFormData({ ...formData, fecha: e.target.value, hora: '' })}
                      min={hoy}
                      className="w-full max-w-sm mx-auto block p-4 bg-zinc-900 border-2 border-zinc-700 rounded-xl text-white text-lg font-black outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all text-center hover:border-zinc-500 cursor-pointer"
                    />
                  </div>
                  {formData.fecha && (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                      <label className="flex items-center justify-center gap-2 text-sm text-zinc-400 mb-6 font-black uppercase tracking-[0.2em]">
                        2. Horarios Disponibles 
                        {loadingDisponibilidad && <span className="text-amber-500 text-xs animate-pulse bg-amber-500/10 px-2 py-1 rounded-full ml-2">Cargando...</span>}
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {generarHorarios().map((hora) => {
                          const estaOcupado = checkDisponibilidad(hora)
                          return (
                            <button
                              key={hora}
                              type="button"
                              disabled={estaOcupado}
                              onClick={() => {
                                setFormData({ ...formData, hora })
                                setTimeout(() => setStep(4), 300)
                              }}
                              className={`py-3.5 rounded-xl text-sm font-black transition-all duration-200 ${
                                formData.hora === hora
                                  ? 'bg-amber-500 text-black scale-105 shadow-[0_0_20px_rgba(245,158,11,0.4)] ring-2 ring-amber-400'
                                  : estaOcupado
                                    ? 'bg-zinc-950/50 text-zinc-800 cursor-not-allowed border-2 border-zinc-900/50'
                                    : 'bg-zinc-900 hover:bg-amber-500/10 hover:text-amber-400 text-zinc-300 border-2 border-zinc-800 hover:border-amber-500/30'
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
                <div className="mt-12 flex justify-between items-center border-t border-zinc-800/50 pt-6">
                  <Button variant="ghost" onClick={() => setStep(2)} className="text-zinc-400 hover:text-white uppercase tracking-widest font-bold text-xs">
                    ← Atrás
                  </Button>
                  <Button disabled={!formData.fecha || !formData.hora} onClick={() => setStep(4)} className="bg-amber-500 hover:bg-amber-400 text-black font-black px-10 py-6 text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-amber-500/20">
                    Siguiente
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PASO 4: TIENDA CROSS-SELL */}
          {step === 4 && (
            <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-800/80 shadow-2xl rounded-3xl overflow-hidden relative">
              <div className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-black/20 mix-blend-multiply"></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                <div className="relative z-10">
                  <h2 className="text-3xl md:text-4xl font-black mb-3 text-white drop-shadow-lg flex items-center justify-center gap-3">
                    <Gift className="w-8 h-8 text-amber-300" /> ¡Completa tu Experiencia!
                  </h2>
                  <p className="text-white/95 font-medium text-lg drop-shadow-md leading-relaxed max-w-2xl mx-auto">
                    Agrega cualquier producto a tu reserva de servicio hoy y obtén un <span className="inline-block bg-black/60 text-amber-400 px-4 py-1.5 rounded-xl mx-1 font-black shadow-inner border border-amber-500/30 transform -rotate-1 mt-2 mb-1 sm:mt-0 sm:mb-0">-10 Bs de DESCUENTO EXTRA</span> en tu total final.
                  </p>
                </div>
              </div>

              <CardContent className="p-6 md:p-8 bg-zinc-950/50">
                {productos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {productos.map((p) => {
                      const enCarrito = carrito.find(c => c.producto.id === p.id)
                      return (
                        <div key={p.id} className={`p-5 border-2 rounded-2xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1 ${enCarrito ? 'border-violet-500 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]' : 'border-zinc-800 bg-zinc-900/80 hover:border-violet-500/40 hover:bg-zinc-800'}`}>
                          <div className="mb-4">
                            {p.image_url ? (
                               <img src={p.image_url} alt={p.nombre} className="w-full h-32 md:h-40 object-cover rounded-xl mb-4 bg-zinc-950 shadow-inner group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                               <div className="w-full h-32 md:h-40 bg-zinc-950 rounded-xl mb-4 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-500 border border-zinc-800/50"><Package className="w-10 h-10 text-zinc-700"/></div>
                            )}
                            <h3 className="font-bold text-sm line-clamp-2 min-h-[2.5rem] leading-snug text-white group-hover:text-violet-300 transition-colors">{p.nombre}</h3>
                          </div>
                          <div>
                            <p className="font-black text-violet-400 text-xl mb-4 tracking-tight">{formatCurrency(p.precio_venta)}</p>
                            {enCarrito ? (
                              <div className="flex items-center justify-between bg-black/60 rounded-xl p-2 border border-violet-500/30">
                                <button onClick={() => quitarProducto(p.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 active:scale-95 transition-all"><Minus className="w-4 h-4" /></button>
                                <span className="text-lg font-black text-white">{enCarrito.cantidad}</span>
                                <button onClick={() => agregarProducto(p)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-500 active:scale-95 transition-all shadow-md shadow-violet-600/20"><Plus className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <button onClick={() => agregarProducto(p)} className="w-full py-3 text-xs uppercase tracking-widest font-black rounded-xl bg-zinc-800 hover:bg-violet-600 transition-all text-white shadow-lg hover:shadow-violet-600/20">Agregar a la Cita</button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 opacity-50">
                     <Package className="w-16 h-16 mb-4 text-zinc-700" />
                     <p className="text-lg text-zinc-500 font-bold uppercase tracking-widest">Sin productos disponibles</p>
                  </div>
                )}
                
                <div className="mt-12 pt-6 border-t border-zinc-800/50 flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                  <Button variant="ghost" onClick={() => setStep(formData.servicio_id ? 3 : 1)} className="text-zinc-500 hover:text-white uppercase tracking-widest font-bold text-xs w-full sm:w-auto">
                    ← Atrás
                  </Button>
                  <Button onClick={() => setStep(5)} className={`font-black px-10 py-6 text-sm uppercase tracking-widest rounded-xl transition-all w-full sm:w-auto ${carrito.length > 0 ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_25px_rgba(245,158,11,0.3)] scale-105' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white'}`}>
                    {carrito.length > 0 ? 'Ir al Resumen y Pagar' : 'Omitir Tienda y Continuar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PASO 5: DATOS Y RESUMEN */}
          {step === 5 && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              {/* Formulario Izquierda */}
              <div className="xl:col-span-7">
                <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-800/80 shadow-2xl rounded-3xl h-full">
                  <CardContent className="p-6 md:p-10">
                    <h2 className="text-3xl font-black mb-8 flex items-center gap-3">
                      <User className="w-8 h-8 text-amber-500" /> Tus Datos
                    </h2>
                    <div className="space-y-5">
                      <Input label="Nombre completo" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} disabled={!!user} className="bg-zinc-950 border-zinc-800 h-14 text-lg" />
                      <Input label="Teléfono" type="tel" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} disabled={!!user} className="bg-zinc-950 border-zinc-800 h-14 text-lg" />
                      <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} disabled={!!user} className="bg-zinc-950 border-zinc-800 h-14 text-lg" />
                      <div>
                        <label className="block text-sm text-zinc-400 mb-2 font-bold uppercase tracking-wider">Notas (opcional)</label>
                        <textarea value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} className="w-full p-5 bg-zinc-950 border border-zinc-800 rounded-2xl text-white text-lg outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors" rows={3} placeholder="Algún requerimiento especial, detalle del corte..." />
                      </div>
                    </div>

                    {/* SELECCIÓN DE OPCIÓN DE PAGO DE RESERVA */}
                    {totalReserva > 0 && (
                      <div className="mt-8 space-y-3">
                        <label className="text-xs font-black uppercase tracking-widest text-amber-500 block">
                          💳 Elige cómo confirmar tu reserva:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setTipoReserva('adelanto_20')}
                            className={`p-4 rounded-2xl border text-left transition-all ${tipoReserva === 'adelanto_20' ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'border-zinc-800 bg-zinc-950 hover:border-amber-500/30'}`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-black text-sm text-white">Adelanto Bs 20 (QR)</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-black font-black">RECOMENDADO</span>
                            </div>
                            <p className="text-xs text-zinc-400">Permite reprogramar sin costo extra si tienes algún imprevisto.</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setTipoReserva('adelanto_10')}
                            className={`p-4 rounded-2xl border text-left transition-all ${tipoReserva === 'adelanto_10' ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'border-zinc-800 bg-zinc-950 hover:border-amber-500/30'}`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-black text-sm text-white">Adelanto Bs 10 (QR)</span>
                            </div>
                            <p className="text-xs text-zinc-400">Reserva con adelanto mínimo. Reprogramación sin recargo.</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setTipoReserva('pago_total')}
                            className={`p-4 rounded-2xl border text-left transition-all ${tipoReserva === 'pago_total' ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'border-zinc-800 bg-zinc-950 hover:border-emerald-500/30'}`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-black text-sm text-emerald-400">Pagar Total 100% (QR)</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-black font-black">COMPLETO</span>
                            </div>
                            <p className="text-xs text-zinc-400">Cita 100% pagada. Evitas trámites en local y puedes reprogramar.</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setTipoReserva('sin_adelanto')}
                            className={`p-4 rounded-2xl border text-left transition-all ${tipoReserva === 'sin_adelanto' ? 'border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'border-zinc-800 bg-zinc-950 hover:border-red-500/30'}`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-black text-sm text-red-400">Pagar en Local (Bs 0 QR)</span>
                            </div>
                            <p className="text-xs text-zinc-400">⚠️ Tolerancia estricta o pierdes turno. Reprogramar costará +Bs 5 extra.</p>
                          </button>
                        </div>
                      </div>
                    )}

                    {tipoReserva === 'sin_adelanto' && totalReserva > 0 && (
                      <div className="mt-6 p-5 bg-red-500/10 border border-red-500/30 rounded-2xl">
                        <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-1">⚠️ Aviso importante para reserva sin adelanto:</p>
                        <p className="text-xs text-zinc-300 font-medium">
                          Tu reserva es válida, pero requerimos máxima puntualidad. Si no llegas a tu hora exacta, el turno pasará a otro cliente. Si necesitas reprogramar tu cita, tendrá un costo adicional de <strong>+Bs 5.00</strong> en el local.
                        </p>
                      </div>
                    )}

                    {tipoReserva !== 'sin_adelanto' && totalReserva > 0 && (
                      <div className="mt-10 space-y-5 p-6 md:p-8 bg-zinc-950 rounded-3xl border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.03)] relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500/0 via-amber-500 to-amber-500/0"></div>
                        <p className="text-sm font-black text-center text-amber-500 mb-4 uppercase tracking-[0.2em]">Escanea y Sube tu Comprobante</p>
                        {qrPago ? (
                          <div className="flex flex-col items-center mb-6">
                            <div className="p-3 bg-white rounded-2xl shadow-lg shadow-white/5 mb-3">
                              <img src={qrPago} alt="QR de Pago" className="w-56 h-56 object-contain rounded-xl" />
                            </div>
                            <a
                              href={qrPago}
                              download="QR_Pago_Barberia.png"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg"
                            >
                              📥 Descargar QR para Pagar
                            </a>
                          </div>
                        ) : (
                          <div className="w-48 h-48 bg-zinc-900 rounded-2xl mx-auto flex items-center justify-center border-2 border-dashed border-zinc-800 mb-6">
                            <span className="text-xs text-zinc-600 text-center px-4 font-bold uppercase tracking-widest">QR no configurado</span>
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
                    
                    <div className="mt-10 pt-6 border-t border-zinc-800/50 flex justify-start">
                      <Button variant="ghost" onClick={() => setStep(4)} className="text-zinc-500 hover:text-white uppercase tracking-widest font-bold text-xs">
                        ← Volver a la Tienda
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Resumen Final Derecha */}
              <div className="xl:col-span-5">
                <Card className="bg-zinc-900 border-2 border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.1)] sticky top-8 rounded-3xl overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500"></div>
                  <CardContent className="p-6 md:p-8">
                    <h2 className="text-2xl font-black mb-8 text-white uppercase tracking-tight">Resumen Final</h2>
                    
                    <div className="space-y-5 mb-8">
                      {formData.fecha && formData.hora && (
                        <div className="flex justify-between items-center text-sm border-b border-white/5 pb-5">
                          <span className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Cuándo</span>
                          <span className="font-black text-right text-white bg-white/5 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
                            {formData.fecha} <span className="text-amber-500 mx-1">•</span> {formData.hora}
                          </span>
                        </div>
                      )}
                      {formData.barbero_id && (
                        <div className="flex justify-between items-center text-sm border-b border-white/5 pb-5">
                          <span className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Especialista</span>
                          <span className="font-black text-right text-white text-base">
                            {barberos.find(b => b.id === formData.barbero_id)?.full_name || '—'}
                          </span>
                        </div>
                      )}

                      {/* Servicio */}
                      {servicioSeleccionado && (
                        <div className="flex justify-between items-center text-sm pt-2">
                          <span className="text-zinc-300 font-black">Corte / Servicio</span>
                          <span className="font-black text-amber-400 text-lg">{formatCurrency(servicioSeleccionado.precio)}</span>
                        </div>
                      )}

                      {/* Descuentos Lealtad */}
                      {lealtadInfo && servicioSeleccionado && (
                        <div className="flex justify-between items-center text-sm bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 p-4 rounded-2xl border border-emerald-500/30 mt-3 shadow-inner">
                          <span className="text-emerald-400 font-black text-xs uppercase tracking-wider">{lealtadInfo.mensaje}</span>
                          <span className="font-black text-emerald-400 text-lg">-{formatCurrency(servicioSeleccionado.precio * lealtadInfo.descuento)}</span>
                        </div>
                      )}

                      {/* Productos */}
                      {carrito.length > 0 && (
                        <div className="pt-5 border-t border-white/5 mt-5">
                          <span className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-4 block flex items-center gap-2"><Package className="w-4 h-4 text-violet-500"/> Productos Extra</span>
                          <div className="space-y-3">
                            {carrito.map(item => (
                              <div key={item.producto.id} className="flex justify-between items-center text-sm bg-black/40 p-3 rounded-xl border border-white/5">
                                <span className="text-zinc-300 font-bold text-xs"><span className="text-violet-400 font-black mr-2">{item.cantidad}x</span> {item.producto.nombre}</span>
                                <span className="text-violet-400 font-black text-base">{formatCurrency(item.producto.precio_venta * item.cantidad)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Descuento Cruzado 10 Bs */}
                      {formData.servicio_id && carrito.length > 0 && (
                        <div className="flex justify-between items-center text-sm bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-violet-500/20 p-4 rounded-2xl border border-amber-500/40 mt-4 shadow-inner animate-in fade-in zoom-in-95 duration-500">
                          <div className="flex flex-col">
                             <span className="text-amber-400 font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-1"><Gift className="w-4 h-4"/> Promo Especial</span>
                             <span className="text-[10px] text-amber-500/70 font-bold uppercase tracking-wider">Servicio + Producto</span>
                          </div>
                          <span className="font-black text-amber-400 text-xl drop-shadow-md">-Bs 10.00</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-black/80 p-6 md:p-8 rounded-3xl border border-zinc-800 mb-8 shadow-inner relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl"></div>
                      <div className="relative z-10">
                        <div className="flex justify-between items-end mb-4 pb-4 border-b border-zinc-800/80">
                          <span className="text-zinc-500 font-black uppercase tracking-[0.2em] text-xs">Total Reserva</span>
                          {(() => {
                            let calcPrecioServicio = servicioSeleccionado?.precio || 0
                            if (lealtadInfo && servicioSeleccionado) calcPrecioServicio = calcPrecioServicio * (1 - lealtadInfo.descuento)
                            const calcTotalProductos = carrito.reduce((s, i) => s + (i.producto.precio_venta * i.cantidad), 0)
                            const calcDescuentoCruzado = (formData.servicio_id && carrito.length > 0) ? 10 : 0
                            const calcTotal = Math.max(0, calcPrecioServicio + calcTotalProductos - calcDescuentoCruzado)
                            return <span className="font-black text-2xl text-white leading-none">{formatCurrency(calcTotal)}</span>
                          })()}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-amber-500 font-black text-sm uppercase tracking-widest">
                            {tipoReserva === 'pago_total' ? 'A Pagar Hoy (100% QR)' : tipoReserva === 'sin_adelanto' ? 'A Pagar Hoy (QR)' : 'A Pagar Hoy (Adelanto)'}
                          </span>
                          {(() => {
                            let calcPrecioServicio = servicioSeleccionado?.precio || 0
                            if (lealtadInfo && servicioSeleccionado) calcPrecioServicio = calcPrecioServicio * (1 - lealtadInfo.descuento)
                            const calcTotalProductos = carrito.reduce((s, i) => s + (i.producto.precio_venta * i.cantidad), 0)
                            const calcDescuentoCruzado = (formData.servicio_id && carrito.length > 0) ? 10 : 0
                            const calcTotal = Math.max(0, calcPrecioServicio + calcTotalProductos - calcDescuentoCruzado)
                            let calcAnticipo = 20
                            if (tipoReserva === 'adelanto_10') calcAnticipo = 10
                            else if (tipoReserva === 'adelanto_20') calcAnticipo = 20
                            else if (tipoReserva === 'pago_total') calcAnticipo = calcTotal
                            else if (tipoReserva === 'sin_adelanto') calcAnticipo = 0
                            return <span className="font-black text-4xl text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">{formatCurrency(calcAnticipo)}</span>
                          })()}
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-4 text-center uppercase tracking-widest font-bold">
                          {tipoReserva === 'sin_adelanto'
                            ? 'Pago pendiente en local. Tolerancia cero al retraso.'
                            : 'Pago por QR verificado por administración.'}
                        </p>
                      </div>
                    </div>

                    {missingFields.length > 0 && (
                      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl mb-6">
                        <p className="text-xs text-red-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> Faltan datos:
                        </p>
                        <ul className="text-xs text-red-300/80 list-disc list-inside space-y-1 font-bold ml-1">
                          {missingFields.map(f => <li key={f}>{f}</li>)}
                        </ul>
                      </div>
                    )}

                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || missingFields.length > 0}
                      className="w-full h-16 md:h-20 text-lg md:text-xl font-black bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_30px_rgba(245,158,11,0.3)] rounded-2xl uppercase tracking-widest transition-all duration-300 hover:scale-[1.03] active:scale-95"
                    >
                      {submitting ? 'Confirmando...' : 'Confirmar Reserva'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}