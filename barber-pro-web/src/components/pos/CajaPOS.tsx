'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { User, Scissors, DollarSign, Search, CheckCircle, Clock, Package, Plus, Minus, X, Store, Gift, UserPlus, Edit3, Save, Star, Tag, QrCode, AlertTriangle, Calendar, Zap, CreditCard, History, ShoppingBag } from 'lucide-react'
import { formatCurrency, toTitleCase } from '@/lib/utils'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { CATEGORIAS_SERVICIOS } from '@/types'

interface Cliente {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  ci: string | null
  nivel_fidelidad?: string
  total_visitas?: number
  total_gastado?: number
  codigo_tarjeta?: string | null
}

interface Promocion {
  id: string
  nombre: string
  tipo: string
  valor: number
  activa: boolean
  icono: string
  servicio_id: string | null
  nivel_requerido: string | null
}

interface LealtadMeta {
  id: string
  nombre: string
  visitas_requeridas: number
  tipo_recompensa: string
  valor_recompensa: number
  is_active: boolean
}

interface ReferralBonus {
  id: string
  monto_bono: number
  bono_otorgado: boolean
  recomendado: { nombre: string } | null
}

interface Servicio {
  id: string
  nombre: string
  precio: number
  duracion_minutos: number
  barberos_excluidos?: string[]
  imagen_url?: string | null
  imagenes?: string[] | null
  categoria?: string
}

interface Barbero {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  qr_code_url?: string | null
}

interface Producto {
  id: string
  nombre: string
  precio_venta: number
  stock_actual: number
  image_url: string | null
  categoria: string | null
}

interface ProductoCarrito {
  producto: Producto
  cantidad: number
}

export function CajaPOS() {
  const { success: toastSuccess, error: toastError } = useToast()
  const supabase = createClient()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [filterCategoriaPOS, setFilterCategoriaPOS] = useState<string>('todos')
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<ProductoCarrito[]>([])
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [promocionSeleccionada, setPromocionSeleccionada] = useState<Promocion | null>(null)
  const [referralBonuses, setReferralBonuses] = useState<ReferralBonus[]>([])
  const [referralSeleccionado, setReferralSeleccionado] = useState<ReferralBonus | null>(null)
  const [lealtadMetas, setLealtadMetas] = useState<LealtadMeta[]>([])
  const [cumpleanosVerifData, setCumpleanosVerifData] = useState<any | null>(null)
  const [pareja2x1PendienteData, setPareja2x1PendienteData] = useState<any | null>(null)
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null)
  const [qrPagoUrl, setQrPagoUrl] = useState<string | null>(null)
  const [citasPendientes, setCitasPendientes] = useState<any[]>([])
  const [ultimosServicios, setUltimosServicios] = useState<any[]>([])
  const [ultimosMovimientos, setUltimosMovimientos] = useState<any[]>([])
  const [posTab, setPosTab] = useState<'operar' | 'movimientos'>('operar')
  const [searchMovimiento, setSearchMovimiento] = useState<string>('')
  const [montoRecibido, setMontoRecibido] = useState<string>('')

  const [searchCliente, setSearchCliente] = useState('')
  const [searchCi, setSearchCi] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showCiDropdown, setShowCiDropdown] = useState(false)
  const [editingCliente, setEditingCliente] = useState(false)
  const [savingCliente, setSavingCliente] = useState(false)
  const [promoSeleccionada, setPromoSeleccionada] = useState<string>('')
  const [aplicarReferido, setAplicarReferido] = useState(false)
  
  const [acompanante, setAcompanante] = useState({ nombre: '', email: '' })
  const [showAcompananteDropdown, setShowAcompananteDropdown] = useState(false)
  const [acompanantesOptions, setAcompanantesOptions] = useState<Cliente[]>([])
  
  const [referidoPorSearch, setReferidoPorSearch] = useState('')
  const [showReferidoDropdown, setShowReferidoDropdown] = useState(false)
  const [referidoPorId, setReferidoPorId] = useState<string>('')
  const [referidoPorNombre, setReferidoPorNombre] = useState<string>('')
  const [referidoresOptions, setReferidoresOptions] = useState<Cliente[]>([])

  // Turno rotation & agenda
  const [barberoTurno, setBarberoTurno] = useState<string | null>(null)
  const [modoReserva, setModoReserva] = useState(false)
  const [reservaFecha, setReservaFecha] = useState('')
  const [reservaHora, setReservaHora] = useState('')
  const [horasOcupadas, setHorasOcupadas] = useState<{hora: string, duracion: number}[]>([])
  const [disponibleAgenda, setDisponibleAgenda] = useState(true)
  const [motivoAgenda, setMotivoAgenda] = useState('')
  const [rangoHorario, setRangoHorario] = useState({ inicio: '09:00', fin: '20:00' })
  const [loadingAgenda, setLoadingAgenda] = useState(false)
  const [tiempoMinimoReserva, setTiempoMinimoReserva] = useState(60)
  const [updatingTiempo, setUpdatingTiempo] = useState(false)
  const [citaSeleccionadaFechaHora, setCitaSeleccionadaFechaHora] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    cita_id: '',
    cliente_id: '',
    nombre: '',
    email: '',
    telefono: '',
    ci: '',
    servicio_id: '',
    barbero_id: '',
    metodo_pago: 'efectivo',
    propinas: 0,
    notas: 'Venta desde Caja',
    comprobante_url: '',
    monto_efectivo: 0,
    monto_qr: 0,
    anticipo_monto: 0,
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [resServicios, resBarberos, resProductos, resPromos, resQr, resTiempo, resMetas] = await Promise.all([
          supabase.from('servicios').select('id, nombre, precio, duracion_minutos, barberos_excluidos').eq('is_active', true),
          supabase.from('profiles').select('id, full_name, email, avatar_url, qr_code_url').eq('role', 'barbero').eq('is_active', true),
          supabase.from('productos').select('id, nombre, precio_venta, stock_actual, image_url, categoria').eq('is_active', true).gt('stock_actual', 0).order('nombre'),
          supabase.from('promociones').select('id, nombre, tipo, valor, activa, icono, servicio_id, nivel_requerido').eq('activa', true),
          supabase.from('configuraciones').select('valor').eq('llave', 'qr_pago').maybeSingle(),
          supabase.from('configuraciones').select('valor').eq('llave', 'tiempo_minimo_reserva').maybeSingle(),
          supabase.from('lealtad_metas').select('id, nombre, visitas_requeridas, tipo_recompensa, valor_recompensa, is_active').eq('is_active', true)
        ])

        setServicios(resServicios.data || [])
        setBarberos(resBarberos.data || [])
        setProductos(resProductos.data || [])
        setPromociones(resPromos.data || [])
        setLealtadMetas(resMetas.data || [])
        
        if (resQr.data?.valor?.url) {
          setQrPagoUrl(resQr.data.valor.url)
        }
        if (resTiempo.data?.valor?.minutos) {
          setTiempoMinimoReserva(Number(resTiempo.data.valor.minutos))
        }

        const hoy = new Date().toISOString().split('T')[0]
        
        const { data: citasPendientesData } = await supabase
          .from('citas')
          .select('id, cliente_id, barbero_id, servicio_id, estado, fecha_hora, notas, anticipo_monto, clientes(nombre, email, telefono, ci, nivel_fidelidad, total_visitas, total_gastado, codigo_tarjeta), profiles!citas_barbero_id_fkey(full_name), servicios(nombre, precio)')
          .in('estado', ['en_proceso', 'pendiente', 'pendiente_pago', 'confirmado'])
          .order('fecha_hora', { ascending: true })

        setCitasPendientes(citasPendientesData || [])

        // Fetch last 3 completed services
        const { data: ultimosData } = await supabase
          .from('citas')
          .select('id, estado, fecha_hora, updated_at, metodo_pago, total, propinas, clientes(nombre), profiles!citas_barbero_id_fkey(full_name), servicios(nombre, precio)')
          .eq('estado', 'completado')
          .order('updated_at', { ascending: false })
          .limit(15)
        setUltimosServicios(ultimosData || [])

        const { data: ultimosTxData } = await supabase
          .from('transactions')
          .select('id, fecha, created_at, concepto, subcategoria, costo, monto_efectivo, monto_qr, metodo_pago, libro, tipo_movimiento, glosa, usuario_registro, nombre')
          .in('libro', ['SERVICIOS', 'VENTAS', 'CAJA_CHICA'])
          .order('created_at', { ascending: false })
          .limit(30)
        setUltimosMovimientos(ultimosTxData || [])

        // Calculate barbero rotation (who has the least recent completed appointment today)
        const { data: citasHoy } = await supabase
          .from('citas')
          .select('barbero_id, updated_at')
          .gte('fecha_hora', `${hoy}T00:00:00`)
          .lte('fecha_hora', `${hoy}T23:59:59`)
          .eq('estado', 'completado')
          .order('updated_at', { ascending: false })

        const barberIds = (resBarberos.data || []).map((b: any) => b.id)
        if (citasHoy && citasHoy.length > 0) {
          // Find the barber who hasn't had a client yet, or the one whose last completed cita is the oldest
          const lastServed = new Map<string, string>()
          for (const c of citasHoy) {
            if (!lastServed.has(c.barbero_id)) lastServed.set(c.barbero_id, c.updated_at)
          }
          // Barber with no clients today goes first
          const sinClientes = barberIds.filter((id: string) => !lastServed.has(id))
          if (sinClientes.length > 0) {
            setBarberoTurno(sinClientes[0])
          } else {
            // Oldest last-served barber goes next
            let oldest: string | null = null
            let oldestTime = ''
            lastServed.forEach((time, id) => {
              if (!oldest || time < oldestTime) { oldest = id; oldestTime = time }
            })
            setBarberoTurno(oldest)
          }
        } else if (barberIds.length > 0) {
          setBarberoTurno(barberIds[0])
        }
      } catch (err) {
        toastError('Error al cargar datos iniciales.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (modoReserva && formData.barbero_id && reservaFecha) {
      const fetchDisponibilidad = async () => {
        setLoadingAgenda(true)
        try {
          const res = await fetch(`/api/citas/disponibilidad?barbero_id=${formData.barbero_id}&fecha=${reservaFecha}`)
          const data = await res.json()
          if (data.ocupados) {
            setHorasOcupadas(data.ocupados)
          }
          if (typeof data.disponible !== 'undefined') {
            setDisponibleAgenda(data.disponible)
            setMotivoAgenda(data.motivo || '')
            setRangoHorario({
              inicio: data.hora_inicio || '09:00',
              fin: data.hora_fin || '20:00'
            })
          }
        } catch (error) {
          console.error('Error cargando disponibilidad:', error)
        } finally {
          setLoadingAgenda(false)
        }
      }
      fetchDisponibilidad()
    }
  }, [formData.barbero_id, reservaFecha, modoReserva])

  const handleSaveTiempo = async (minutos: number) => {
    setUpdatingTiempo(true)
    try {
      await supabase.from('configuraciones')
        .upsert({ llave: 'tiempo_minimo_reserva', valor: { minutos } }, { onConflict: 'llave' })
      setTiempoMinimoReserva(minutos)
      toastSuccess(`Tiempo mínimo actualizado a ${minutos} min`)
    } catch (e: any) {
      toastError(e.message)
    } finally {
      setUpdatingTiempo(false)
    }
  }

  useEffect(() => {
    if (!searchCliente || searchCliente.trim().length < 2) {
      setClientes([])
      return
    }

    const timeoutId = setTimeout(async () => {
      const q = searchCliente.trim()
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, email, telefono, ci, nivel_fidelidad, total_visitas, total_gastado, codigo_tarjeta')
        .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%,ci.ilike.%${q}%,codigo_tarjeta.ilike.%${q}%`)
        .limit(15)

      setClientes(data || [])
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchCliente, supabase])

  useEffect(() => {
    if (!acompanante.nombre || acompanante.nombre.trim().length < 2) {
      setAcompanantesOptions([])
      return
    }

    const timeoutId = setTimeout(async () => {
      const q = acompanante.nombre.trim()
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, email, telefono, ci')
        .or(`nombre.ilike.%${q}%,email.ilike.%${q}%,ci.ilike.%${q}%`)
        .limit(5)

      setAcompanantesOptions(data || [])
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [acompanante.nombre, supabase])

  useEffect(() => {
    if (!referidoPorSearch || referidoPorSearch.trim().length < 2) {
      setReferidoresOptions([])
      return
    }

    const timeoutId = setTimeout(async () => {
      const q = referidoPorSearch.trim()
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, email, telefono, ci')
        .or(`nombre.ilike.%${q}%,email.ilike.%${q}%,ci.ilike.%${q}%`)
        .limit(5)

      setReferidoresOptions(data || [])
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [referidoPorSearch, supabase])

  useEffect(() => {
    if (!searchCi || searchCi.trim().length < 2) {
      if (searchCliente.trim().length < 2) setClientes([])
      return
    }

    const timeoutId = setTimeout(async () => {
      const q = searchCi.trim()
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, email, telefono, ci, nivel_fidelidad, total_visitas, total_gastado, codigo_tarjeta')
        .or(`ci.ilike.%${q}%,codigo_tarjeta.ilike.%${q}%`)
        .limit(10)

      setClientes(data || [])
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchCi, supabase, searchCliente])

  // Fetch referral bonuses and client extras when a client is selected
  const fetchClientExtras = useCallback(async (clienteId: string, cliente?: Cliente) => {
    const cl = cliente || clientes.find(c => c.id === clienteId) || null
    setClienteDetalle(cl)
    setAplicarReferido(false)
    setPromoSeleccionada('')
    setCumpleanosVerifData(null)
    setPareja2x1PendienteData(null)
    try {
      const res = await fetch(`/api/pos/client-extras?cliente_id=${clienteId}&nombre=${encodeURIComponent(cl?.nombre || '')}&email=${encodeURIComponent(cl?.email || '')}&ci=${encodeURIComponent(cl?.ci || '')}`)
      const data = await res.json()
      if (res.ok) {
        setReferralBonuses(data.referralBonuses || [])
        setCumpleanosVerifData(data.cumpleanosVerificado || null)
        setPareja2x1PendienteData(data.pareja2x1Pendiente || null)
        
        // Si hay promoción de cumpleaños verificada y no hay otra promo seleccionada, preseleccionarla
        if (data.cumpleanosVerificado?.promo?.id) {
          setPromoSeleccionada(data.cumpleanosVerificado.promo.id)
        }
      } else {
        setReferralBonuses([])
      }
    } catch {
      setReferralBonuses([])
      setCumpleanosVerifData(null)
      setPareja2x1PendienteData(null)
    }
  }, [clientes])

  useEffect(() => {
    const citaIdParam = searchParams.get('cita_id')
    if (citaIdParam && citasPendientes.length > 0 && !formData.cita_id) {
      const cita = citasPendientes.find(c => c.id === citaIdParam)
      if (cita) {
        setFormData(prev => ({
          ...prev,
          cita_id: cita.id,
          cliente_id: cita.cliente_id || '',
          nombre: cita.clientes?.nombre || 'Cliente',
          email: cita.clientes?.email || '',
          telefono: cita.clientes?.telefono || '',
          ci: cita.clientes?.ci || '',
          servicio_id: cita.servicio_id || '',
          barbero_id: cita.barbero_id || ''
        }))
        setSearchCliente(cita.clientes?.nombre || 'Cliente')
        setSearchCi(cita.clientes?.ci || '')
        if (cita.cliente_id && cita.clientes) {
          fetchClientExtras(cita.cliente_id, {
             id: cita.cliente_id, 
             nombre: cita.clientes.nombre,
             email: cita.clientes.email,
             telefono: cita.clientes.telefono,
             ci: cita.clientes.ci,
             nivel_fidelidad: cita.clientes.nivel_fidelidad,
             total_visitas: cita.clientes.total_visitas,
             total_gastado: cita.clientes.total_gastado,
             codigo_tarjeta: cita.clientes.codigo_tarjeta
          })
        }
        
        if (cita.fecha_hora) {
          const d = new Date(cita.fecha_hora)
          const pad = (n: number) => n.toString().padStart(2, '0')
          setReservaFecha(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
          setReservaHora(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
          setModoReserva(true)
        }
        
        setCitaSeleccionadaFechaHora(cita.fecha_hora || null)
        toastSuccess(`Cita pre-cargada: ${cita.clientes?.nombre || 'cliente'}`)
      }
    }
  }, [citasPendientes, searchParams, formData.cita_id, fetchClientExtras, toastSuccess])

  const handleSaveCliente = async () => {
    if (!formData.cliente_id) return
    setSavingCliente(true)
    try {
      await supabase.from('clientes').update({
        nombre: formData.nombre,
        ci: formData.ci || null,
        telefono: formData.telefono || null,
        email: formData.email || null,
      }).eq('id', formData.cliente_id)
      toastSuccess('Cliente actualizado')
      setEditingCliente(false)
    } catch { toastError('Error al actualizar') }
    setSavingCliente(false)
  }

  const handleSelectCliente = (cliente: Cliente) => {
    setFormData(prev => ({
      ...prev,
      cliente_id: cliente.id,
      nombre: cliente.nombre,
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      ci: cliente.ci || '',
    }))
    setSearchCliente(cliente.nombre)
    setSearchCi(cliente.ci || '')
    setShowDropdown(false)
    setShowCiDropdown(false)
    setEditingCliente(false)
    fetchClientExtras(cliente.id, cliente)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchCliente(val)
    setShowDropdown(true)
    setShowCiDropdown(false)
    
    setFormData(prev => ({ 
      ...prev, 
      cliente_id: '', 
      nombre: val,
      ...(val === '' ? { email: '', telefono: '', ci: '' } : {})
    }))
  }

  const handleCiSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchCi(val)
    setShowCiDropdown(true)
    setShowDropdown(false)
    
    setFormData(prev => ({ 
      ...prev, 
      cliente_id: '', 
      ci: val
    }))
  }

  const clientesFiltrados = clientes

  // --- Carrito de productos ---
  const agregarProducto = (producto: Producto) => {
    setCarrito(prev => {
      const existe = prev.find(p => p.producto.id === producto.id)
      if (existe) {
        if (existe.cantidad >= producto.stock_actual) {
          toastError(`Sin stock suficiente de ${producto.nombre}`)
          return prev
        }
        return prev.map(p => 
          p.producto.id === producto.id 
            ? { ...p, cantidad: p.cantidad + 1 } 
            : p
        )
      }
      return [...prev, { producto, cantidad: 1 }]
    })
  }



  const quitarProducto = (productoId: string) => {
    setCarrito(prev => {
      const item = prev.find(p => p.producto.id === productoId)
      if (item && item.cantidad > 1) {
        return prev.map(p => 
          p.producto.id === productoId 
            ? { ...p, cantidad: p.cantidad - 1 } 
            : p
        )
      }
      return prev.filter(p => p.producto.id !== productoId)
    })
  }

  const eliminarProducto = (productoId: string) => {
    setCarrito(prev => prev.filter(p => p.producto.id !== productoId))
  }

  const precioItemCarrito = (item: ProductoCarrito) => item.producto.precio_venta

  const totalProductos = carrito.reduce((sum, item) => sum + (precioItemCarrito(item) * item.cantidad), 0)

  const handleFinalizar = async (estado: string = 'completado') => {
    if (!formData.servicio_id && carrito.length === 0) {
      toastError('Debes seleccionar un servicio o agregar productos')
      return
    }
    if (!formData.barbero_id) {
      toastError('Debes seleccionar un barbero')
      return
    }

    setSubmitting(true)

    const promoActiva = promociones.find(p => p.id === promoSeleccionada)
    if (promoActiva?.tipo === '2x1' && !acompanante.nombre.trim()) {
      return toastError('Debe ingresar el nombre del acompañante para la promoción 2x1')
    }

    try {
      const res = await fetch('/api/admin/caja/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          estado,
          cita_id: formData.cita_id || undefined,
          referido_por_id: referidoPorId || undefined,
          descuento: descuentoTotal,
          promo_id: promoSeleccionada || null,
          referral_ids: aplicarReferido ? referralBonuses.map(r => r.id) : [],
          comprobante_url: formData.comprobante_url || null,
          reserva_fecha: modoReserva ? reservaFecha : null,
          reserva_hora: modoReserva ? reservaHora : null,
          productos_carrito: carrito.map(item => ({
            id: item.producto.id,
            nombre: item.producto.nombre,
            precio: precioItemCarrito(item),
            cantidad: item.cantidad
          })),
          acompanante_2x1: promoActiva?.tipo === '2x1' ? acompanante : null
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al procesar')

      toastSuccess(`Cita registrada como ${estado === 'completado' ? 'Completada y Cobrada' : 'En Proceso'}`)
      
      // Refresh pending appointments
      const hoy = new Date().toISOString().split('T')[0]
      const { data: citasPendientesData } = await supabase
        .from('citas')
        .select('id, cliente_id, barbero_id, servicio_id, estado, fecha_hora, notas, clientes(nombre, email, telefono, ci, nivel_fidelidad, total_visitas, total_gastado, codigo_tarjeta), profiles!citas_barbero_id_fkey(full_name), servicios(nombre, precio)')
        .in('estado', ['en_proceso', 'pendiente', 'pendiente_pago', 'confirmado'])
        .order('fecha_hora', { ascending: true })
      setCitasPendientes(citasPendientesData || [])

      // Refresh last completed services
      const { data: ultimosData } = await supabase
        .from('citas')
        .select('id, estado, fecha_hora, updated_at, metodo_pago, total, propinas, clientes(nombre), profiles!citas_barbero_id_fkey(full_name), servicios(nombre, precio)')
        .eq('estado', 'completado')
        .order('updated_at', { ascending: false })
        .limit(15)
      setUltimosServicios(ultimosData || [])

      const { data: ultimosTxData } = await supabase
        .from('transactions')
        .select('id, fecha, created_at, concepto, subcategoria, costo, monto_efectivo, monto_qr, metodo_pago, libro, tipo_movimiento, glosa, usuario_registro, nombre')
        .in('libro', ['SERVICIOS', 'VENTAS', 'CAJA_CHICA'])
        .order('created_at', { ascending: false })
        .limit(30)
      setUltimosMovimientos(ultimosTxData || [])
      
      setFormData({
        cita_id: '', cliente_id: '', nombre: '', email: '', telefono: '', ci: '',
        servicio_id: '', barbero_id: '', metodo_pago: 'efectivo', propinas: 0, notas: 'Venta desde Caja', comprobante_url: '', monto_efectivo: 0, monto_qr: 0, anticipo_monto: 0
      })
      setSearchCliente('')
      setSearchCi('')
      setCarrito([])
      setClienteDetalle(null)
      setReferralBonuses([])
      setCumpleanosVerifData(null)
      setPareja2x1PendienteData(null)
      setAplicarReferido(false)
      setPromoSeleccionada('')
      setAcompanante({ nombre: '', email: '' })
      setEditingCliente(false)
      setModoReserva(false)
      setReservaFecha('')
      setReservaHora('')
      setCitaSeleccionadaFechaHora(null)

      // Recargar productos para reflejar stock actualizado
      const { data: newProductos } = await supabase
        .from('productos')
        .select('id, nombre, precio_venta, stock_actual, image_url, categoria')
        .eq('is_active', true)
        .gt('stock_actual', 0)
        .order('nombre')
      setProductos(newProductos || [])
    } catch (err: any) {
      toastError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const servicioSeleccionado = servicios.find(s => s.id === formData.servicio_id)
  const subtotalServicio = servicioSeleccionado?.precio || 0

  // Discount calculations
  const promoActiva = promociones.find(p => p.id === promoSeleccionada)
  const descuentoPromo = promoActiva
    ? promoActiva.tipo === 'descuento_porcentaje' || (promoActiva.tipo === 'cumpleanos' && promoActiva.valor > 0 && promoActiva.valor <= 100)
      ? (subtotalServicio * promoActiva.valor) / 100
      : promoActiva.tipo === 'descuento_fijo' || promoActiva.tipo === 'referido' || (promoActiva.tipo === 'cumpleanos' && promoActiva.valor > 100)
        ? promoActiva.valor
        : promoActiva.tipo === 'servicio_gratis' || (promoActiva.tipo === '2x1' && pareja2x1PendienteData) || (promoActiva.tipo === 'cumpleanos' && promoActiva.valor === 0)
          ? subtotalServicio
          : 0
    : (pareja2x1PendienteData ? subtotalServicio : 0)
  const totalBonoReferido = aplicarReferido
    ? referralBonuses.reduce((s, r) => s + Number(r.monto_bono || 10), 0)
    : 0

  // Descuento automático por lealtad (metas de visitas)
  let descuentoLealtad = 0
  let metaAlcanzadaNombre = ''
  if (clienteDetalle && lealtadMetas.length > 0) {
    const proximasVisitas = (clienteDetalle.total_visitas || 0) + 1
    // Buscar la meta más alta que cumpla la visita actual
    const metasCumplidas = lealtadMetas.filter(m => proximasVisitas % m.visitas_requeridas === 0)
    if (metasCumplidas.length > 0) {
      // Tomar la que requiere más visitas
      const meta = metasCumplidas.sort((a, b) => b.visitas_requeridas - a.visitas_requeridas)[0]
      metaAlcanzadaNombre = meta.nombre
      if (meta.tipo_recompensa === 'porcentaje') {
        descuentoLealtad = (subtotalServicio * meta.valor_recompensa) / 100
      } else if (meta.tipo_recompensa === 'monto_fijo') {
        descuentoLealtad = meta.valor_recompensa
      } else if (meta.tipo_recompensa === 'servicio_gratis') {
        const allowedServices = meta.servicio_id ? meta.servicio_id.split(',').filter(Boolean) : []
        if (allowedServices.length === 0 || (formData.servicio_id && allowedServices.includes(formData.servicio_id))) {
          descuentoLealtad = subtotalServicio
        }
      }
    }
  }

  const descuentoReservaProducto = (formData.servicio_id && carrito.length > 0) ? 10 : 0
  const descuentoTotal = descuentoPromo + totalBonoReferido + descuentoReservaProducto + descuentoLealtad
  const anticipoPagado = Number(formData.anticipo_monto || 0)
  const totalACobrar = Math.max(0, subtotalServicio + totalProductos + Number(formData.propinas || 0) - descuentoTotal - anticipoPagado)

  const checkDisponibilidad = (hora: string) => {
    const servicioSeleccionado = servicios.find(s => s.id === formData.servicio_id)
    if (!servicioSeleccionado) return false

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

  const generarHorarios = () => {
    if (!disponibleAgenda) return []
    const horarios: string[] = []
    const [hStart, mStart] = (rangoHorario.inicio || '09:00').split(':').map(Number)
    const [hEnd, mEnd] = (rangoHorario.fin || '20:00').split(':').map(Number)
    let cur = (isNaN(hStart) ? 9 : hStart) * 60 + (isNaN(mStart) ? 0 : mStart)
    const end = (isNaN(hEnd) ? 20 : hEnd) * 60 + (isNaN(mEnd) ? 0 : mEnd)
    while (cur < end) {
      const hh = Math.floor(cur / 60).toString().padStart(2, '0')
      const mm = (cur % 60).toString().padStart(2, '0')
      horarios.push(`${hh}:${mm}`)
      cur += 30
    }
    return horarios
  }

  const hoyLocal = new Date()
  const hoy = new Date(hoyLocal.getTime() - (hoyLocal.getTimezoneOffset() * 60000)).toISOString().split('T')[0]

  if (loading) {
    return <div className="p-8 text-center text-zinc-400">Cargando Caja...</div>
  }

  const handleMarcarNoAsistio = async (citaId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('¿Marcar esta cita como NO ASISTIÓ / CANCELADA?')) return
    
    try {
      const res = await fetch('/api/citas/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cita_id: citaId, motivo: 'Cancelado/No asistió (desde Caja POS)' })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Error al cancelar cita')
      }
      
      toastSuccess('Cita marcada como No Asistió')
      setCitasPendientes(prev => prev.filter(c => c.id !== citaId))
      
      if (formData.cita_id === citaId) {
        setFormData({
          cita_id: '', cliente_id: '', nombre: '', email: '', telefono: '', ci: '',
          servicio_id: '', barbero_id: '', metodo_pago: 'efectivo', propinas: 0, notas: 'Venta desde Caja', comprobante_url: '', monto_efectivo: 0, monto_qr: 0
        })
        setSearchCliente('')
      }
    } catch(err: any) {
      console.error(err)
      toastError(err.message || 'Error al actualizar cita')
    }
  }

  return (
    <div className="p-3 sm:p-6 max-w-[1600px] mx-auto space-y-6 pb-32 animate-in fade-in zoom-in-95 duration-500 overflow-x-hidden">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
            Punto de Venta / Caja
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm">Atiende a clientes que llegan a pie, asigna y cobra al instante.</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-zinc-900/90 border border-zinc-800 p-3 sm:p-3.5 rounded-2xl shadow-lg w-full xl:w-auto">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 shrink-0">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Tiempo Mín. Reserva Web</p>
              <p className="font-black text-white text-xs">{tiempoMinimoReserva} minutos</p>
            </div>
          </div>

          <div className="hidden sm:block h-7 w-px bg-zinc-800 mx-1"></div>

          <div className="grid grid-cols-5 sm:flex sm:flex-row items-center gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
            <Button 
              size="sm" 
              variant={tiempoMinimoReserva === 0 ? 'primary' : 'outline'}
              className="h-8 text-[10px] px-0 sm:px-2.5 font-black uppercase tracking-wider flex justify-center w-full sm:w-auto"
              disabled={updatingTiempo}
              onClick={() => handleSaveTiempo(0)}
              title="Sin Límite"
            >
              0 min
            </Button>
            <Button 
              size="sm" 
              variant={tiempoMinimoReserva === 60 ? 'primary' : 'outline'}
              className="h-8 text-[10px] px-0 sm:px-2.5 font-black uppercase tracking-wider flex justify-center w-full sm:w-auto"
              disabled={updatingTiempo}
              onClick={() => handleSaveTiempo(60)}
            >
              1 hr
            </Button>
            <Button 
              size="sm" 
              variant={tiempoMinimoReserva === 120 ? 'primary' : 'outline'}
              className="h-8 text-[10px] px-0 sm:px-2.5 font-black uppercase tracking-wider flex justify-center w-full sm:w-auto"
              disabled={updatingTiempo}
              onClick={() => handleSaveTiempo(120)}
            >
              2 hrs
            </Button>
            <Button 
              size="sm" 
              variant={tiempoMinimoReserva === 180 ? 'primary' : 'outline'}
              className="h-8 text-[10px] px-0 sm:px-2.5 font-black uppercase tracking-wider flex justify-center w-full sm:w-auto"
              disabled={updatingTiempo}
              onClick={() => handleSaveTiempo(180)}
            >
              3 hrs
            </Button>

            <div className="flex items-center bg-zinc-950 border border-white/10 rounded-xl overflow-hidden h-8 w-full sm:w-auto col-span-1">
              <input 
                type="number" 
                className="w-full sm:w-14 h-full bg-transparent text-center text-xs text-white font-bold outline-none px-1 sm:px-2" 
                placeholder="Min" 
                min="0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseInt(e.currentTarget.value)
                    if (!isNaN(val)) handleSaveTiempo(val)
                  }
                }}
              />
              <button 
                className="px-2 sm:px-3 h-full bg-amber-500 text-black hover:bg-amber-400 transition font-black flex items-center justify-center shrink-0" 
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement
                  const val = parseInt(input.value)
                  if (!isNaN(val)) handleSaveTiempo(val)
                }}
              >
                <Save size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TABS DE VISTA EN CAJA POS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setPosTab('operar')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${posTab === 'operar' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-[1.02]' : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
        >
          <ShoppingBag className="w-4 h-4" /> Operación de Caja (POS)
        </button>
        <button
          onClick={() => setPosTab('movimientos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${posTab === 'movimientos' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 scale-[1.02]' : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
        >
          <History className="w-4 h-4" /> Últimos Movimientos y Cobros
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${posTab === 'movimientos' ? 'bg-black/20 text-black' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
            {ultimosMovimientos.length > 0 ? ultimosMovimientos.length : ultimosServicios.length} registros
          </span>
        </button>
      </div>

      {posTab === 'movimientos' ? (
        <Card className="bg-zinc-900 border-zinc-800 animate-in fade-in duration-300">
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <History className="w-5 h-5 text-emerald-500" />
                  </div>
                  Historial en Vivo de Movimientos en Caja / POS
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Muestra todos los cobros recientes de servicios, ventas directas de productos e ingresos registrados desde esta terminal.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Buscar por cliente, barbero o detalle..."
                    value={searchMovimiento}
                    onChange={(e) => setSearchMovimiento(e.target.value)}
                    className="pl-9 h-10 w-64 bg-zinc-950 border-zinc-800 text-xs"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => setPosTab('operar')} className="h-10 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                  ← Volver a Operación POS
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-[11px] font-black uppercase tracking-wider">
                    <th className="pb-3 pl-2">Hora / Fecha</th>
                    <th className="pb-3">Libro</th>
                    <th className="pb-3">Detalle / Cliente</th>
                    <th className="pb-3">Barbero / Empleado</th>
                    <th className="pb-3">Método Pago</th>
                    <th className="pb-3 text-right pr-2">Total Cobrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {(ultimosMovimientos.length > 0 ? ultimosMovimientos : ultimosServicios)
                    .filter((m: any) => {
                      if (!searchMovimiento) return true
                      const term = searchMovimiento.toLowerCase()
                      const nombre = (m.nombre || m.clientes?.nombre || '').toLowerCase()
                      const barbero = (m.usuario_registro || m.profiles?.full_name || '').toLowerCase()
                      const detalle = (m.cuenta_detalle || m.glosa || m.servicios?.nombre || '').toLowerCase()
                      return nombre.includes(term) || barbero.includes(term) || detalle.includes(term)
                    })
                    .map((item: any, idx: number) => {
                      const isTx = item.libro !== undefined
                      const nombreCliente = isTx ? (item.nombre || 'Cliente') : (item.clientes?.nombre || 'Cliente')
                      const barberoNombre = isTx ? (item.usuario_registro || 'Barbero') : (item.profiles?.full_name || 'Barbero')
                      const detalle = isTx ? (item.cuenta_detalle || item.glosa || item.concepto || item.libro) : (item.servicios?.nombre || 'Servicio Barbería')
                      const monto = isTx ? Number(item.costo || 0) : Number(item.total ?? item.servicios?.precio ?? 0)
                      const mp = (item.metodo_pago || 'efectivo').toLowerCase()
                      const libro = isTx ? item.libro : 'SERVICIOS'
                      
                      const dateObj = isTx ? (item.created_at ? new Date(item.created_at) : new Date(item.fecha)) : (item.updated_at ? new Date(item.updated_at) : new Date(item.fecha_hora))
                      const dateFormatted = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) + ' · ' + dateObj.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }) : (item.fecha || '')

                      return (
                        <tr key={item.id || idx} className="hover:bg-zinc-800/40 transition">
                          <td className="py-3.5 pl-2 font-mono text-xs text-zinc-400">{dateFormatted}</td>
                          <td className="py-3.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider border ${
                              libro === 'SERVICIOS' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              libro === 'VENTAS' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              'bg-zinc-800 text-zinc-300 border-zinc-700'
                            }`}>
                              {libro}
                            </span>
                          </td>
                          <td className="py-3.5">
                            <p className="font-bold text-white text-xs">{nombreCliente}</p>
                            <p className="text-[11px] text-zinc-400 truncate max-w-xs">{detalle}</p>
                          </td>
                          <td className="py-3.5 text-xs font-semibold text-zinc-300">{barberoNombre}</td>
                          <td className="py-3.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              mp === 'efectivo' ? 'bg-emerald-500/10 text-emerald-400' :
                              mp === 'qr' ? 'bg-purple-500/10 text-purple-400' :
                              'bg-amber-500/10 text-amber-400'
                            }`}>
                              {mp === 'efectivo' ? '💵 Efectivo' : mp === 'qr' ? '📱 QR' : '🔄 Mixto'}
                            </span>
                          </td>
                          <td className="py-3.5 text-right pr-2 font-black text-emerald-400 text-sm">
                            {formatCurrency(monto)}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LADO IZQUIERDO: SELECCIÓN DE DATOS */}
          <div className="lg:col-span-8 space-y-6">
          
          {citasPendientes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-zinc-400 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" /> Citas Pendientes de Cobro (Hoy y Anteriores)
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                {citasPendientes.map((cita) => (
                  <div key={cita.id} className="relative shrink-0 snap-start w-64">
                    <button
                      className={`w-full text-left bg-zinc-900 border transition-all rounded-xl p-4 hover:border-amber-500/50 ${formData.cita_id === cita.id ? 'border-amber-500 ring-1 ring-amber-500' : 'border-zinc-800'}`}
                      onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        cita_id: cita.id,
                        cliente_id: cita.cliente_id || '',
                        nombre: cita.clientes?.nombre || 'Cliente',
                        email: cita.clientes?.email || '',
                        telefono: cita.clientes?.telefono || '',
                        ci: cita.clientes?.ci || '',
                        servicio_id: cita.servicio_id || '',
                        barbero_id: cita.barbero_id || '',
                        anticipo_monto: Number(cita.anticipo_monto || 0),
                      }))
                      setSearchCliente(cita.clientes?.nombre || 'Cliente')
                      setSearchCi(cita.clientes?.ci || '')
                      if (cita.cliente_id && cita.clientes) {
                        fetchClientExtras(cita.cliente_id, {
                           id: cita.cliente_id, 
                           nombre: cita.clientes.nombre,
                           email: cita.clientes.email,
                           telefono: cita.clientes.telefono,
                           ci: cita.clientes.ci,
                           nivel_fidelidad: cita.clientes.nivel_fidelidad,
                           total_visitas: cita.clientes.total_visitas,
                           total_gastado: cita.clientes.total_gastado,
                           codigo_tarjeta: cita.clientes.codigo_tarjeta
                        })
                      }
                      
                      // Cargar la fecha y hora guardadas para permitir reprogramar fácilmente
                      if (cita.fecha_hora) {
                        const d = new Date(cita.fecha_hora)
                        const pad = (n: number) => n.toString().padStart(2, '0')
                        setReservaFecha(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
                        setReservaHora(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
                        setModoReserva(true)
                      }
                      
                      toastSuccess(`Cita de ${cita.clientes?.nombre || 'cliente'} seleccionada · Puedes editar servicio o agregar productos`)
                      setCitaSeleccionadaFechaHora(cita.fecha_hora || null)
                    }}
                  >
                    <div className="flex justify-between items-start mb-2 pr-6">
                      <p className="font-bold text-white truncate text-sm">{cita.clientes?.nombre || 'Sin nombre'}</p>
                      <Badge variant={cita.estado === 'en_proceso' ? 'info' : 'warning'} className="text-[10px] uppercase">{cita.estado.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-xs text-zinc-400 truncate mb-1">{cita.servicios?.nombre}</p>
                    <p className="text-[10px] text-zinc-500 uppercase font-black">
                      {cita.profiles?.full_name} • {new Date(cita.fecha_hora).toLocaleDateString()}
                    </p>
                  </button>
                  <button 
                    onClick={(e) => handleMarcarNoAsistio(cita.id, e)}
                    className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                    title="Marcar como No Asistió / Cancelar"
                  >
                    <X size={14} />
                  </button>
                </div>
                ))}
              </div>
              
              {/* Banner de cita seleccionada */}
              {formData.cita_id && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Edit3 className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-amber-400 font-black text-xs uppercase tracking-widest">✏️ Editando Cita Seleccionada</p>
                    {citaSeleccionadaFechaHora && (
                      <p className="text-amber-300/60 text-[10px] mt-0.5 font-mono">
                        📅 Original: {new Date(citaSeleccionadaFechaHora).toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit', month: 'short' })} · {new Date(citaSeleccionadaFechaHora).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    <p className="text-amber-200/70 text-[11px] mt-1">
                      Puedes <strong>cambiar el servicio</strong>, <strong>agregar productos</strong>, <strong>reprogramar fecha/hora</strong> (activar &quot;Programar Cita&quot; abajo) y <strong>modificar el método de pago</strong> antes de cobrar.
                    </p>
                  </div>
                  <button onClick={() => {
                    setFormData({
                      cita_id: '', cliente_id: '', nombre: '', email: '', telefono: '', ci: '',
                      servicio_id: '', barbero_id: '', metodo_pago: 'efectivo', propinas: 0, notas: 'Venta desde Caja', comprobante_url: '', monto_efectivo: 0, monto_qr: 0, anticipo_monto: 0
                    })
                    setSearchCliente('')
                    setSearchCi('')
                    setCarrito([])
                    setClienteDetalle(null)
                    setCitaSeleccionadaFechaHora(null)
                  }} className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors shrink-0" title="Deseleccionar cita">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* RESUMEN RÁPIDO DE ÚLTIMOS COBROS EN POS */}
          {(ultimosMovimientos.length > 0 || ultimosServicios.length > 0) && (
            <div className="p-4 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-md">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <History className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  Últimos Movimientos y Cobros Recientes
                </h3>
                <button
                  onClick={() => setPosTab('movimientos')}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20"
                >
                  Ver historial completo ({ultimosMovimientos.length || ultimosServicios.length}) →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {(ultimosMovimientos.length > 0 ? ultimosMovimientos : ultimosServicios).slice(0, 3).map((item: any, idx: number) => {
                  const isTx = item.libro !== undefined
                  const nombreCliente = isTx ? (item.nombre || 'Cliente') : (item.clientes?.nombre || 'Cliente')
                  const barberoNombre = isTx ? (item.usuario_registro || 'Barbero') : (item.profiles?.full_name || 'Barbero')
                  const detalle = isTx ? (item.cuenta_detalle || item.glosa || item.concepto || item.libro) : (item.servicios?.nombre || 'Servicio Barbería')
                  const monto = isTx ? Number(item.costo || 0) : Number(item.total ?? item.servicios?.precio ?? 0)
                  const mp = (item.metodo_pago || 'efectivo').toLowerCase()
                  const libro = isTx ? item.libro : 'SERVICIOS'

                  return (
                    <div key={item.id || idx} className="p-2.5 bg-black/40 border border-white/5 rounded-xl flex flex-col justify-between hover:border-emerald-500/30 transition">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-black uppercase tracking-wider bg-zinc-800 text-zinc-300">
                              {libro}
                            </span>
                            <span className="text-xs font-bold text-white truncate">{nombreCliente}</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 truncate">{detalle}</p>
                        </div>
                        <span className="text-xs font-black text-emerald-400 shrink-0">
                          {formatCurrency(monto)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1 pt-1 border-t border-white/5">
                        <span className="truncate">{barberoNombre}</span>
                        <span className="font-bold text-zinc-400 uppercase">
                          {mp === 'efectivo' ? '💵 Efectivo' : mp === 'qr' ? '📱 QR' : '🔄 Mixto'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* CLIENTE */}
          <Card className="bg-zinc-900 border-zinc-800 relative z-30" style={{ overflow: 'visible' }}>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <User className="w-5 h-5 text-amber-500" /> 1. Datos del Cliente
              </h2>
              
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Input
                  className="pl-9 bg-black/50"
                  placeholder="Buscar por nombre, carnet, teléfono o correo..."
                  value={searchCliente}
                  onChange={handleSearchChange}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                />
                
                {showDropdown && searchCliente && (
                  <div className="absolute z-10 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {clientesFiltrados.length > 0 ? (
                      clientesFiltrados.map(c => (
                        <div 
                          key={c.id} 
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleSelectCliente(c)
                          }}
                          className="px-4 py-2 hover:bg-zinc-800 cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <p className="font-semibold">{c.nombre} {c.codigo_tarjeta ? `(Cód: ${c.codigo_tarjeta})` : ''}</p>
                            <p className="text-xs text-zinc-400">CI: {c.ci || 'N/A'} • {c.telefono || 'Sin cel'}</p>
                          </div>
                          <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded-full">Seleccionar</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-zinc-400 text-sm">
                        No encontrado. Se creará como nuevo cliente.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Input 
                  label="Nombre Completo" 
                  value={formData.nombre} 
                  onChange={e => setFormData(p => ({...p, nombre: e.target.value}))} 
                  required
                />
                <div className="space-y-1 relative">
                  <Input 
                    label="Carnet / CI / Cód. Tarjeta" 
                    value={formData.ci || searchCi} 
                    onChange={handleCiSearchChange} 
                    onFocus={() => setShowCiDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCiDropdown(false), 200)}
                  />
                  {showCiDropdown && searchCi && (
                    <div className="absolute z-10 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {clientesFiltrados.length > 0 ? (
                        clientesFiltrados.map(c => (
                          <div 
                            key={c.id} 
                            onMouseDown={(e) => {
                              e.preventDefault()
                              handleSelectCliente(c)
                            }}
                            className="px-4 py-2 hover:bg-zinc-800 cursor-pointer flex justify-between items-center"
                          >
                            <div>
                              <p className="font-semibold">{c.ci || 'Sin CI'} {c.codigo_tarjeta ? `| Cód: ${c.codigo_tarjeta}` : ''}</p>
                              <p className="text-xs text-zinc-400">{c.nombre}</p>
                            </div>
                            <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded-full">Seleccionar</span>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-zinc-400 text-sm">
                          CI no encontrado.
                        </div>
                      )}
                    </div>
                  )}
                  {!formData.ci ? (
                    <p className="text-[11px] text-amber-500/90 leading-tight flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Faltan datos del CI. Pregúntale al cliente si desea completarlo para facturación o registro.
                    </p>
                  ) : formData.cliente_id && clientes.find(c => c.id === formData.cliente_id)?.ci === formData.ci ? (
                    <p className="text-[11px] text-emerald-500/80 leading-tight flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> CI guardado correctamente en sistema.
                    </p>
                  ) : (
                    <p className="text-[11px] text-emerald-500/80 leading-tight flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> CI listo para ser guardado/usado.
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Input 
                    label="Correo Electrónico (Para invitar al sistema)" 
                    type="email"
                    value={formData.email} 
                    onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                  />
                  {!formData.cliente_id ? (
                     <p className="text-[11px] text-zinc-400 leading-tight">
                       Opcional. Si lo agregas, el cliente recibirá un correo para crear su cuenta y ver sus puntos/citas.
                     </p>
                  ) : clientes.find(c => c.id === formData.cliente_id)?.email ? (
                     <p className="text-[11px] text-emerald-500/80 leading-tight flex items-center gap-1">
                       <CheckCircle className="w-3 h-3" /> Este cliente ya tiene cuenta en el sistema.
                     </p>
                  ) : (
                     <p className="text-[11px] text-amber-500/90 leading-tight flex items-center gap-1">
                       <CheckCircle className="w-3 h-3" /> Aún no tiene correo. ¡Agrégalo ahora para enviarle una invitación automática!
                     </p>
                  )}
                </div>
                <Input 
                  label="Teléfono" 
                  value={formData.telefono} 
                  onChange={e => setFormData(p => ({...p, telefono: e.target.value}))} 
                />
              </div>

              {/* Botón Editar Cliente */}
              {formData.cliente_id && (
                <div className="flex items-center gap-2 pt-2">
                  {editingCliente ? (
                    <>
                      <Button size="sm" variant="primary" onClick={handleSaveCliente} disabled={savingCliente} className="gap-1 text-xs">
                        <Save className="w-3 h-3" /> {savingCliente ? 'Guardando...' : 'Guardar Cambios'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingCliente(false)} className="text-xs">Cancelar</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditingCliente(true)} className="gap-1 text-xs text-amber-500 border-amber-500/30">
                      <Edit3 className="w-3 h-3" /> Editar datos del cliente
                    </Button>
                  )}
                </div>
              )}

              {/* ASIGNAR REFERIDO */}
              <div className="mt-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl" style={{ overflow: 'visible' }}>
                <h3 className="text-amber-500 font-black text-xs uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4" /> Asignar Referido (Opcional)
                </h3>
                <p className="text-[10px] text-zinc-400 mb-3 leading-tight">
                  Si este cliente vino recomendado por alguien, busca a esa persona. Se le otorgará el bono de referido al completar este pago.
                </p>
                
                {referidoPorId ? (
                  <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-lg border border-amber-500/30">
                    <div>
                      <p className="text-xs text-zinc-400">Referido por:</p>
                      <p className="font-bold text-amber-500">{referidoPorNombre}</p>
                    </div>
                    <button 
                      onClick={() => { setReferidoPorId(''); setReferidoPorNombre(''); setReferidoPorSearch(''); }}
                      className="text-zinc-500 hover:text-red-400 transition"
                      title="Quitar referidor"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Buscar referidor por nombre, CI o Cód. Tarjeta..."
                      value={referidoPorSearch}
                      onChange={(e) => {
                        setReferidoPorSearch(e.target.value)
                        setShowReferidoDropdown(true)
                      }}
                      onFocus={() => setShowReferidoDropdown(true)}
                      className="bg-black/50 border-white/10 text-sm h-9"
                    />
                    {showReferidoDropdown && referidoresOptions.length > 0 && (
                      <div className="absolute z-[9999] w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto" style={{ bottom: 'auto' }}>
                        {referidoresOptions.map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setReferidoPorId(c.id)
                              setReferidoPorNombre(c.nombre)
                              setShowReferidoDropdown(false)
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-amber-500/10 border-b border-zinc-800 last:border-b-0 flex flex-col gap-0.5 transition"
                          >
                            <span className="font-bold text-white text-sm">{c.nombre}</span>
                            <span className="text-xs text-zinc-400">{c.email || c.telefono || 'Sin correo'} {c.ci && `· CI: ${c.ci}`}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* INFO CLIENTE: Lealtad + Referidos + Promociones */}
          {clienteDetalle && formData.cliente_id && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Nivel de Fidelidad */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                    clienteDetalle.nivel_fidelidad === 'ORO' ? 'bg-yellow-500/20 border border-yellow-500/30' :
                    clienteDetalle.nivel_fidelidad === 'PLATA' ? 'bg-zinc-400/20 border border-zinc-400/30' :
                    'bg-amber-700/20 border border-amber-700/30'
                  }`}>
                    <Star className={`w-5 h-5 ${
                      clienteDetalle.nivel_fidelidad === 'ORO' ? 'text-yellow-400' :
                      clienteDetalle.nivel_fidelidad === 'PLATA' ? 'text-zinc-300' :
                      'text-amber-600'
                    }`} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nivel</p>
                    <p className="text-sm font-black text-white">{clienteDetalle.nivel_fidelidad || 'BRONCE'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Visitas */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Visitas</p>
                    <p className="text-sm font-black text-white">{clienteDetalle.total_visitas || 0} visitas</p>
                  </div>
                </CardContent>
              </Card>

              {/* Cumpleaños Verificado */}
              {cumpleanosVerifData && (
                <Card className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-zinc-900 border-amber-500/40">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
                        🎂
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Cumpleañero Verificado esta semana</p>
                        <p className="text-sm font-black text-white">
                          🎁 {cumpleanosVerifData.promo?.nombre || 'Beneficio de Cumpleaños'} {cumpleanosVerifData.promo?.tipo === 'descuento_porcentaje' ? `(-${cumpleanosVerifData.promo.valor}%)` : cumpleanosVerifData.promo?.tipo === 'descuento_fijo' ? `(-Bs ${cumpleanosVerifData.promo.valor})` : 'Corte Especial'}
                        </p>
                      </div>
                    </div>
                    {cumpleanosVerifData.promo?.id && promoSeleccionada !== cumpleanosVerifData.promo.id && (
                      <Button size="sm" variant="primary" className="font-black shrink-0" onClick={() => setPromoSeleccionada(cumpleanosVerifData.promo.id)}>
                        Aplicar Regalo
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Pareja 2x1 Pendiente */}
              {pareja2x1PendienteData && (
                <Card className="bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-zinc-900 border-emerald-500/40 animate-pulse">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xl shrink-0">
                        ✨
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Pareja 2x1 Detectada</p>
                        <p className="text-sm font-black text-white">
                          Registrado en 2x1 por <span className="text-emerald-300 underline">{pareja2x1PendienteData.principal_nombre}</span>. Le corresponde su servicio <span className="text-emerald-400">GRATIS (Bs 0)</span>.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Referidos pendientes */}
              <Card className={`bg-zinc-900 ${referralBonuses.length > 0 ? 'border-green-500/30' : 'border-zinc-800'}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    referralBonuses.length > 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-zinc-800 border border-zinc-700'
                  }`}>
                    <Gift className={`w-5 h-5 ${referralBonuses.length > 0 ? 'text-green-400' : 'text-zinc-600'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Bonos Referidos</p>
                    {referralBonuses.length > 0 ? (
                      <>
                        <p className="text-sm font-black text-green-400">
                          {referralBonuses.length} bonos ({formatCurrency(referralBonuses.reduce((s, r) => s + Number(r.monto_bono || 10), 0))}) disponible
                        </p>
                        <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={aplicarReferido}
                            onChange={(e) => setAplicarReferido(e.target.checked)}
                            className="accent-green-500"
                          />
                          <span className="text-[10px] text-green-400 font-bold uppercase">Aplicar descuento por referidos</span>
                        </label>
                      </>
                    ) : (
                      <p className="text-sm text-zinc-500">Sin bonos canjeables</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* PROMOCIONES */}
          {formData.cliente_id && promociones.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-amber-500" /> Aplicar Promoción
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setPromoSeleccionada('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      !promoSeleccionada ? 'bg-zinc-700 text-white' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    Sin promo
                  </button>
                  {promociones.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPromoSeleccionada(p.id === promoSeleccionada ? '' : p.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        promoSeleccionada === p.id ? 'bg-amber-500 text-black' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {p.icono} {p.nombre} {p.tipo === 'descuento_porcentaje' ? `(-${p.valor}%)` : p.tipo === 'descuento_fijo' ? `(-${formatCurrency(p.valor)})` : ''}
                    </button>
                  ))}
                </div>

                {promociones.find(p => p.id === promoSeleccionada)?.tipo === '2x1' && (
                  <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <h4 className="text-amber-500 font-black text-xs uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" />
                      Pareja / Acompañante (Promo 2x1)
                    </h4>
                    <p className="text-[11px] text-amber-500/90 mb-3 leading-relaxed font-medium">
                      💡 <span className="font-bold">¿Cómo funciona?</span><br />
                      • <span className="underline">Pagan juntos hoy:</span> Cobra este servicio aquí y el acompañante entrará gratis en el acto.<br />
                      • <span className="underline">Viene más tarde (o se corta después):</span> Al registrar a la pareja abajo y cobrar este corte, cuando la pareja pase por caja después y se seleccione su nombre, el sistema la detectará para aplicarle su corte gratis (0 Bs).
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <div className="relative">
                        <Input
                          placeholder="Nombre completo, correo o CI *"
                          value={acompanante.nombre}
                          onChange={(e) => {
                            setAcompanante({ ...acompanante, nombre: e.target.value })
                            setShowAcompananteDropdown(true)
                          }}
                          onFocus={() => setShowAcompananteDropdown(true)}
                          className="bg-black/50 border-white/10 text-sm h-9"
                        />
                        {showAcompananteDropdown && acompanantesOptions.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
                            {acompanantesOptions.map(c => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setAcompanante({ nombre: c.nombre, email: c.email || '' })
                                  setShowAcompananteDropdown(false)
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-zinc-800 flex flex-col transition"
                              >
                                <span className="font-semibold text-white text-sm">{c.nombre}</span>
                                <span className="text-xs text-zinc-500">{c.email || c.telefono || 'Sin datos extra'} {c.ci && `| CI: ${c.ci}`}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Input
                        placeholder="Correo de la pareja (opcional)"
                        type="email"
                        value={acompanante.email}
                        onChange={(e) => setAcompanante({ ...acompanante, email: e.target.value })}
                        className="bg-black/50 border-white/10 text-sm h-9"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* SERVICIO */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-amber-500" /> 2. Selección de Servicio
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterCategoriaPOS('todos')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      filterCategoriaPOS === 'todos'
                        ? 'bg-amber-500 text-black'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Todos ({servicios.length})
                  </button>
                  {CATEGORIAS_SERVICIOS.map(cat => {
                    const count = servicios.filter(s => (s.categoria || 'Cortes') === cat.id).length
                    if (count === 0 && filterCategoriaPOS !== cat.id) return null
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFilterCategoriaPOS(cat.id)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          filterCategoriaPOS === cat.id
                            ? 'bg-amber-500 text-black'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {cat.id}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {servicios
                  .filter(s => filterCategoriaPOS === 'todos' || (s.categoria || 'Cortes') === filterCategoriaPOS)
                  .map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setFormData({ ...formData, servicio_id: s.id })}
                    className={`p-3 border rounded-xl cursor-pointer transition flex items-center gap-3 ${
                      formData.servicio_id === s.id
                        ? 'border-amber-400 bg-amber-500/10 shadow-sm'
                        : 'border-white/10 hover:border-amber-400/40 bg-black/20'
                    }`}
                  >
                    {(() => {
                      const firstImg = (s.imagenes && s.imagenes.length > 0) ? s.imagenes[0] : s.imagen_url
                      return firstImg ? (
                        <img
                          src={firstImg}
                          alt={s.nombre}
                          className="w-12 h-12 rounded-lg object-cover shrink-0 bg-zinc-950 border border-zinc-800"
                        />
                      ) : null
                    })()}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h3 className="font-semibold text-sm line-clamp-1 truncate">{s.nombre}</h3>
                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 shrink-0">
                          {s.categoria || 'Cortes'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-zinc-400">{s.duracion_minutos} min</p>
                        <p className="font-bold text-amber-400">{formatCurrency(s.precio)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* BARBERO */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-500" /> 3. Asignar Barbero
                </h2>
                {!formData.servicio_id && (
                  <span className="text-xs text-amber-500/70">Seleccione un servicio primero</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {barberos
                  .filter(b => {
                    // Filter out excluded barbers for the selected service
                    if (!formData.servicio_id) return true
                    const servicio = servicios.find(s => s.id === formData.servicio_id)
                    if (!servicio?.barberos_excluidos?.length) return true
                    return !servicio.barberos_excluidos.includes(b.id)
                  })
                  .map((b) => (
                  <div
                    key={b.id}
                    onClick={() => setFormData({ ...formData, barbero_id: b.id })}
                    className={`relative flex flex-col items-center gap-2 p-3 border rounded-xl cursor-pointer transition ${
                      formData.barbero_id === b.id
                        ? 'border-amber-400 bg-amber-500/10'
                        : barberoTurno === b.id
                          ? 'border-emerald-500/50 bg-emerald-500/5 hover:border-amber-400/40'
                          : 'border-white/10 hover:border-amber-400/40 bg-black/20'
                    }`}
                  >
                    {barberoTurno === b.id && (
                      <div className="absolute -top-2.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                        Próximo Turno
                      </div>
                    )}
                    <div className={`w-12 h-12 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center shrink-0 ${barberoTurno === b.id && formData.barbero_id !== b.id ? 'ring-2 ring-emerald-500/50' : ''}`}>
                      {b.avatar_url ? (
                        <img src={b.avatar_url} alt={b.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold">{b.full_name.charAt(0)}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-xs text-center line-clamp-1">{b.full_name}</h3>
                  </div>
                ))}
              </div>

              {/* MODO RESERVA (AGENDA) */}
              {formData.barbero_id && formData.servicio_id && (
                <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-500" /> Modalidad de Atención
                      </h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Puedes pasarlo directo o agendarlo para después.</p>
                    </div>
                    <div className="flex bg-black/50 p-1 rounded-lg border border-white/10">
                      <button
                        onClick={() => {
                          setModoReserva(false)
                          setReservaFecha('')
                          setReservaHora('')
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${!modoReserva ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                      >
                        Atención Inmediata
                      </button>
                      <button
                        onClick={() => setModoReserva(true)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${modoReserva ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                      >
                        Programar Cita
                      </button>
                    </div>
                  </div>

                  {modoReserva && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Fecha</label>
                        <Input
                          type="date"
                          min={hoy}
                          value={reservaFecha}
                          onChange={(e) => {
                            setReservaFecha(e.target.value)
                            setReservaHora('')
                          }}
                          className="bg-black/50"
                        />
                      </div>
                      
                      {reservaFecha && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                            Hora <span className="font-normal normal-case text-[10px] ml-1">(No respeta tiempo mín.)</span>
                          </label>
                          {!disponibleAgenda ? (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300 font-medium">
                              ⚠️ {motivoAgenda || 'El barbero no atiende en esta fecha (Horario / Día libre / Vacaciones).'}
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                              {generarHorarios().map(hora => {
                                const ocupado = checkDisponibilidad(hora)
                                return (
                                  <button
                                    key={hora}
                                    onClick={() => !ocupado && setReservaHora(hora)}
                                    disabled={ocupado || loadingAgenda}
                                    className={`py-1.5 text-xs font-bold rounded-md transition ${
                                      reservaHora === hora
                                        ? 'bg-amber-500 text-black'
                                        : ocupado
                                          ? 'bg-zinc-800/30 text-zinc-600 cursor-not-allowed line-through'
                                          : 'bg-black/50 border border-white/5 text-zinc-300 hover:border-amber-500/50 hover:text-amber-500'
                                    }`}
                                  >
                                    {hora}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                          {loadingAgenda && <p className="text-[10px] text-zinc-500 animate-pulse">Consultando agenda...</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* PRODUCTOS */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Package className="w-5 h-5 text-violet-500" /> Productos (Opcional)
                </h2>
                {carrito.length > 0 && (
                  <span className="text-xs bg-violet-500/20 text-violet-400 px-3 py-1 rounded-full font-semibold">
                    {carrito.reduce((s, i) => s + i.cantidad, 0)} en carrito
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 mb-4">
                ¿El cliente quiere llevarse un producto? Agrégalo aquí y se sumará al cobro total.
              </p>
              
              {productos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {productos.map((p) => {
                    const enCarrito = carrito.find(c => c.producto.id === p.id)
                    return (
                      <div
                        key={p.id}
                        className={`p-3 border rounded-xl transition relative ${
                          enCarrito
                            ? 'border-violet-400 bg-violet-500/10'
                            : 'border-white/10 hover:border-violet-400/40 bg-black/20'
                        }`}
                      >
                        {p.image_url && (
                          <div className="w-full h-16 rounded-lg overflow-hidden mb-2 bg-zinc-800">
                            <img src={p.image_url} alt={p.nombre} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <h3 className="font-semibold text-xs line-clamp-2 min-h-[2rem]">{p.nombre}</h3>
                        <div className="mt-1 space-y-0.5">
                          <div className="flex justify-between items-center">
                            <p className="text-[10px] text-zinc-500">Stock: {p.stock_actual}</p>
                            <p className="font-bold text-violet-400 text-sm">{formatCurrency(p.precio_venta)}</p>
                          </div>
                        </div>
                        
                        {enCarrito ? (
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-center justify-between bg-black/40 rounded-lg px-2 py-1">
                              <button 
                                onClick={() => quitarProducto(p.id)}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 transition text-white"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-bold text-white">{enCarrito.cantidad}</span>
                              <button 
                                onClick={() => agregarProducto(p)}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-violet-600 hover:bg-violet-500 transition text-white"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => agregarProducto(p)}
                            className="w-full mt-2 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-violet-600 transition text-zinc-300 hover:text-white flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Agregar
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 text-center py-4">No hay productos disponibles con stock.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* LADO DERECHO: TICKET Y PAGO */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-zinc-900 border-amber-500/30 sticky top-6">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" /> Resumen y Pago
              </h2>
              
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Cliente</span>
                  <span className="font-medium truncate max-w-[150px]">{formData.nombre || 'No seleccionado'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Servicio</span>
                  <span className="font-medium text-right">{servicioSeleccionado?.nombre || 'No seleccionado'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Barbero</span>
                  <span className="font-medium text-right">{barberos.find(b => b.id === formData.barbero_id)?.full_name || 'No seleccionado'}</span>
                </div>
                
                <div className="pt-4 border-t border-zinc-800">
                  {/* Subtotal servicio */}
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-zinc-400 text-sm">Servicio</span>
                    <span>{formatCurrency(subtotalServicio)}</span>
                  </div>

                  {/* Productos en carrito */}
                  {carrito.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Productos</span>
                      {carrito.map(item => (
                        <div key={item.producto.id} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <button 
                              onClick={() => eliminarProducto(item.producto.id)}
                              className="w-4 h-4 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 transition shrink-0"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                            <div className="min-w-0">
                              <span className="text-zinc-300 truncate text-xs block">{item.cantidad}x {item.producto.nombre}</span>
                            </div>
                          </div>
                          <span className="text-violet-400 font-medium shrink-0 ml-2">{formatCurrency(precioItemCarrito(item) * item.cantidad)}</span>
                        </div>

                      ))}
                      <div className="flex justify-between items-center text-sm pt-1 border-t border-zinc-800/50">
                        <span className="text-zinc-400 text-xs">Subtotal Productos</span>
                        <span className="text-violet-400 font-semibold">{formatCurrency(totalProductos)}</span>
                      </div>

                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-zinc-400 text-sm">Propinas (opcional)</span>
                    <Input 
                      type="number" 
                      className="w-24 h-8 text-right bg-black" 
                      value={formData.propinas}
                      onChange={e => setFormData(p => ({...p, propinas: Number(e.target.value)}))}
                    />
                  </div>
                  


                  {descuentoReservaProducto > 0 && (
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-amber-500 text-xs flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Promo Producto + Servicio
                      </span>
                      <span className="text-amber-400 font-semibold">-{formatCurrency(descuentoReservaProducto)}</span>
                    </div>
                  )}

                  {descuentoPromo > 0 && (
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-amber-500 text-xs flex items-center gap-1">
                        <Tag className="w-3 h-3" /> {promoActiva?.icono} {promoActiva?.nombre}
                      </span>
                      <span className="text-amber-400 font-semibold">-{formatCurrency(descuentoPromo)}</span>
                    </div>
                  )}

                  {totalBonoReferido > 0 && (
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-green-500 text-xs flex items-center gap-1">
                        <Gift className="w-3 h-3" /> Bono Referidos
                      </span>
                      <span className="text-green-400 font-semibold">-{formatCurrency(totalBonoReferido)}</span>
                    </div>
                  )}

                  {descuentoLealtad > 0 && (
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-pink-500 text-xs flex items-center gap-1">
                        <Star className="w-3 h-3" /> Recompensa: {metaAlcanzadaNombre}
                      </span>
                      <span className="text-pink-400 font-semibold">-{formatCurrency(descuentoLealtad)}</span>
                    </div>
                  )}

                  {anticipoPagado > 0 && (
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-blue-400 text-xs flex items-center gap-1">
                        💳 Anticipo ya pagado (QR)
                      </span>
                      <span className="text-blue-400 font-semibold">-{formatCurrency(anticipoPagado)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
                    <span className="text-lg font-bold">{anticipoPagado > 0 ? 'Resta Pagar' : 'Total a Cobrar'}</span>
                    <span className="text-2xl font-black text-amber-400">
                      {formatCurrency(totalACobrar)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-6">
                      <label className="text-sm text-zinc-400">Método de Pago</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['efectivo', 'qr', 'mixto'] as const).map((m) => (
                          <button
                            key={m}
                            className={`py-2 rounded-md text-xs font-semibold transition ${formData.metodo_pago === m ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-white'}`}
                            onClick={() => setFormData(p => ({...p, metodo_pago: m}))}
                          >
                            {m === 'efectivo' ? '💵 Efectivo' : m === 'qr' ? '📱 QR' : '🔄 Mixto'}
                          </button>
                        ))}
                      </div>

                      {formData.metodo_pago === 'efectivo' && (
                        <div className="p-3 bg-zinc-900/90 border border-emerald-500/30 rounded-xl space-y-2 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-400">💵 ¿Con cuánto paga? (Opcional)</span>
                            {montoRecibido && Number(montoRecibido) >= totalACobrar && (
                              <Badge variant="success" className="text-xs font-black">
                                Vuelto: {formatCurrency(Number(montoRecibido) - totalACobrar)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              placeholder="Ej. 100"
                              value={montoRecibido}
                              onChange={(e) => setMontoRecibido(e.target.value)}
                              className="w-full h-9 bg-zinc-950 border border-white/10 rounded-lg px-3 text-sm font-bold text-white outline-none focus:border-emerald-500"
                            />
                            {[20, 50, 100, 200].map(b => (
                              <button
                                key={b}
                                type="button"
                                onClick={() => setMontoRecibido(String(b))}
                                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300"
                              >
                                {b}
                              </button>
                            ))}
                          </div>
                          {montoRecibido && Number(montoRecibido) < totalACobrar && Number(montoRecibido) > 0 && (
                            <p className="text-[11px] text-red-400 font-bold">Falta: {formatCurrency(totalACobrar - Number(montoRecibido))}</p>
                          )}
                        </div>
                      )}

                      {formData.metodo_pago === 'mixto' && (
                        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2 mt-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">🔄 Desglose</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold uppercase text-zinc-500 block mb-0.5">Efectivo</label>
                              <input type="number" step="0.01" min="0" placeholder="0" id="mixto-efectivo"
                                className="w-full h-9 bg-zinc-950 border border-amber-500/30 rounded-lg px-2 text-sm text-white outline-none"
                                onChange={(e) => setFormData(p => ({...p, monto_efectivo: Number(e.target.value) || 0, notas: `Efectivo: Bs ${e.target.value} | QR: Bs ${p.monto_qr}`}))}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold uppercase text-zinc-500 block mb-0.5">QR</label>
                              <input type="number" step="0.01" min="0" placeholder="0" data-mixto-qr
                                className="w-full h-9 bg-zinc-950 border border-amber-500/30 rounded-lg px-2 text-sm text-white outline-none"
                                onChange={(e) => setFormData(p => ({...p, monto_qr: Number(e.target.value) || 0, notas: `Efectivo: Bs ${p.monto_efectivo} | QR: Bs ${e.target.value}`}))}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {(formData.metodo_pago === 'qr' || formData.metodo_pago === 'mixto') && (() => {
                        const barberoSeleccionado = barberos.find(b => b.id === formData.barbero_id)
                        const activeQr = barberoSeleccionado?.qr_code_url || qrPagoUrl

                        return (
                          <div className="mt-4 p-3 bg-zinc-900 border border-white/5 rounded-xl space-y-4">
                            <div className="flex flex-col items-center justify-center p-4 bg-black/40 rounded-lg border border-white/5">
                              <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full mb-3 text-center">
                                {barberoSeleccionado?.qr_code_url 
                                  ? `QR Personal de ${toTitleCase(barberoSeleccionado.full_name)}`
                                  : 'QR General de la Barbería'}
                              </span>
                              <p className="text-xs text-zinc-400 mb-3 text-center">Escanea este código para pagar</p>
                              {activeQr ? (
                                <div className="space-y-3 flex flex-col items-center">
                                  <img src={activeQr} alt="QR de Pago" className="w-48 h-48 object-contain rounded-md bg-white p-2" />
                                  <a 
                                    href={activeQr} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-xs flex items-center gap-1 text-amber-500 hover:text-amber-400 transition font-bold"
                                  >
                                    <QrCode className="w-4 h-4" /> Ampliar / Descargar
                                  </a>
                                </div>
                              ) : (
                                <p className="text-xs text-zinc-500 italic text-center">QR no configurado por el barbero ni en la barbería</p>
                              )}
                            </div>

                            <ImageUpload
                              label="Comprobante de Pago QR (Captura)"
                              defaultImage={formData.comprobante_url || undefined}
                              onUploadSuccess={(url) => setFormData({ ...formData, comprobante_url: url })}
                              onUploadError={(err) => toastError(err)}
                            />
                          </div>
                        )
                      })()}
                </div>

                <div className="pt-6 space-y-3">
                  {(!formData.nombre || (!formData.servicio_id && carrito.length === 0) || !formData.barbero_id) && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                      <p className="text-[11px] text-red-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Completar para cobrar:
                      </p>
                      <ul className="text-[11px] text-red-300/80 list-disc list-inside space-y-0.5 ml-1">
                        {!formData.nombre && <li>Falta seleccionar el Cliente</li>}
                        {(!formData.servicio_id && carrito.length === 0) && <li>Falta seleccionar Servicio o Producto</li>}
                        {!formData.barbero_id && <li>Falta asignar un Barbero</li>}
                      </ul>
                    </div>
                  )}

                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
                    disabled={submitting || !formData.nombre || (!formData.servicio_id && carrito.length === 0) || !formData.barbero_id || (modoReserva && (!reservaFecha || !reservaHora))}
                    onClick={() => handleFinalizar('completado')}
                  >
                    <CheckCircle className="w-5 h-5 mr-2" /> {modoReserva ? 'Agendar y Cobrar' : 'Cobrar y Completar'}
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="w-full border-amber-500/50 text-amber-500 hover:bg-amber-500/10 h-10 disabled:opacity-50"
                    disabled={submitting || !formData.nombre || (!formData.servicio_id && carrito.length === 0) || !formData.barbero_id || (modoReserva && (!reservaFecha || !reservaHora))}
                    onClick={() => handleFinalizar(modoReserva ? 'pendiente' : 'en_proceso')}
                  >
                    <Clock className="w-4 h-4 mr-2" /> {modoReserva ? 'Reprogramar / Agendar (Paga después)' : 'Iniciar Servicio (Paga después)'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </div>
  )
}
