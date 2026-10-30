'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Card, CardContent } from '@/components/ui/Card'
import { formatCurrency, toTitleCase, toSentenceCase } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, User, Scissors, CheckCircle, Package, Plus, Minus, X, Info, AlertTriangle, Clock, UserPlus, Gift, Shield, Smartphone, Mail, IdCard, ArrowLeft, Home, Sparkles, Zap, Users, Check } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { CATEGORIAS_SERVICIOS } from '@/types'
import { ServicioGalleryBanner } from '@/components/ui/ServicioGalleryBanner'
import { ServicioDetailModal } from '@/components/ui/ServicioDetailModal'
import { ModalDetallePromocion, PromocionDetalle } from '@/components/cliente/ModalDetallePromocion'
import Link from 'next/link'
import { useBrand } from '@/components/providers/BrandProvider'
import { generateSmartSlots, isTimeSlotAvailable, minutesToTimeString, timeStringToMinutes, formatTime12h } from '@/lib/booking/booking-slots'
import { InlineCalendarPicker } from '@/components/ui/InlineCalendarPicker'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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

// Servicios válidos para el 2x1 (Corte, Barba y Combos que contengan corte o barba)
function esServicio2x1ValidoPorNombre(servicio: Servicio | undefined): boolean {
  if (!servicio) return false
  const nombre = servicio.nombre.toLowerCase().trim()
  return (
    nombre.includes('corte') ||
    nombre.includes('barba')
  )
}

// Cálculo del 2x1: Si es combo, NO va a mitad de precio todo el combo, SOLO la mitad del corte (o barba).
function calcularDescuentoYPrecio2x1(
  servicio: Servicio | undefined,
  todosLosServicios: Servicio[]
): {
  precioOriginal: number
  precioFinal: number
  descuento: number
  esCombo: boolean
  tieneCorte: boolean
  tieneBarba: boolean
  etiquetaPromo: string
} {
  if (!servicio) {
    return {
      precioOriginal: 0,
      precioFinal: 0,
      descuento: 0,
      esCombo: false,
      tieneCorte: false,
      tieneBarba: false,
      etiquetaPromo: ''
    }
  }

  const precioOriginal = Number(servicio.precio) || 0
  const nombreLower = servicio.nombre.toLowerCase().trim()
  const esCombo = (servicio.categoria || '').toLowerCase() === 'combos' ||
                  nombreLower.includes('combo') ||
                  nombreLower.includes('+')
  const tieneCorte = nombreLower.includes('corte')
  const tieneBarba = nombreLower.includes('barba')

  // Obtener el precio base del Corte de Cabello del catálogo (o fallback 50 Bs)
  const servicioCorteBase = todosLosServicios.find(s => {
    const n = s.nombre.toLowerCase().trim()
    return (n.includes('corte de cabello') || n.includes('corte cabello') || n === 'corte') &&
           !n.includes('combo') && !n.includes('+')
  })
  const precioCorteBase = servicioCorteBase ? Number(servicioCorteBase.precio) : 50
  const mitadCorte = Math.round(precioCorteBase * 0.5) // Bs. 25

  // Obtener el precio base del Arreglo de Barba del catálogo (o fallback 50 Bs)
  const servicioBarbaBase = todosLosServicios.find(s => {
    const n = s.nombre.toLowerCase().trim()
    return (n.includes('arreglo de barba') || n.includes('arreglo barba') || n === 'barba') &&
           !n.includes('combo') && !n.includes('+')
  })
  const precioBarbaBase = servicioBarbaBase ? Number(servicioBarbaBase.precio) : 50
  const mitadBarba = Math.round(precioBarbaBase * 0.5) // Bs. 25

  let descuento = 0
  let etiquetaPromo = ''

  if (esCombo) {
    // REGLA CRÍTICA: En combos NO se aplica mitad de precio a todo el combo, SOLO al corte (o barba)
    if (tieneCorte) {
      descuento = mitadCorte
      etiquetaPromo = `Corte a mitad de precio (-Bs ${descuento})`
    } else if (tieneBarba) {
      descuento = mitadBarba
      etiquetaPromo = `Barba a mitad de precio (-Bs ${descuento})`
    } else {
      descuento = 0
      etiquetaPromo = ''
    }
  } else {
    // Servicio individual (Corte o Barba): se aplica la mitad de su precio
    if (tieneCorte || tieneBarba) {
      descuento = Math.round(precioOriginal * 0.5)
      etiquetaPromo = `2×1 Mitad de precio (-Bs ${descuento})`
    } else {
      descuento = 0
      etiquetaPromo = ''
    }
  }

  const precioFinal = Math.max(0, precioOriginal - descuento)

  return {
    precioOriginal,
    precioFinal,
    descuento,
    esCombo,
    tieneCorte,
    tieneBarba,
    etiquetaPromo
  }
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
  phone?: string | null
  telefono?: string | null
  avatar_url: string | null
  qr_code_url?: string | null
}
interface BarberoHorarioItem {
  barbero_id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  activo: boolean
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
  const { brand } = useBrand()
  const { error: toastError, success: toastSuccess } = useToast()
  
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [selectedServicioForDetail, setSelectedServicioForDetail] = useState<Servicio | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<ProductoCarrito[]>([])
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [barberoHorarios, setBarberoHorarios] = useState<BarberoHorarioItem[]>([])
  const [barberoServicios, setBarberoServicios] = useState<{ barbero_id: string; servicio_id: string }[]>([])
  const [referidoInfo, setReferidoInfo] = useState<{ id: string; nombre: string } | null>(null)
  const [promociones, setPromociones] = useState<any[]>([])
  const [promoSeleccionada, setPromoSeleccionada] = useState<string>('')
  const [selectedPromoForModal, setSelectedPromoForModal] = useState<PromocionDetalle | null>(null)
  const [acompanante, setAcompanante] = useState({ nombre: '', email: '' })
  const [modo2x1, setModo2x1] = useState<'acompanante' | 'servicio_extra'>('acompanante')
  const [servicioExtra2x1, setServicioExtra2x1] = useState('')
  const [config2x1, setConfig2x1] = useState({
    activa: true,
    dia_semana: 2,
    solo_reserva_lunes: true,
    dia_reserva_permitido: 1,
    hora_inicio: '08:00',
    hora_fin: '17:30',
    servicios_acompanante: [] as string[],
    servicios_extra: [] as string[],
  })

  // Estados para agendamiento del acompañante en 2x1 (consecutivo, simultáneo u otra hora)
  const [acompModo, setAcompModo] = useState<'consecutivo' | 'simultaneo' | 'personalizado'>('consecutivo')
  const [acompBarberoId, setAcompBarberoId] = useState<string>('')
  const [acompHora, setAcompHora] = useState<string>('')
  const [disponibilidadBarberos, setDisponibilidadBarberos] = useState<Record<string, {
    ocupados: { hora: string; duracion: number }[]
    disponible: boolean
    motivo?: string
    hora_inicio: string
    hora_fin: string
    turnos?: Array<{ inicio: string; fin: string }>
  }>>({})
  const [loadingDisponibilidadBarberos, setLoadingDisponibilidadBarberos] = useState(false)
  const [createdCitaAcomp, setCreatedCitaAcomp] = useState<any | null>(null)

  // Obtener día de la semana actual en zona horaria La Paz (0=Dom, 1=Lun, 2=Mar, etc.)
  const getDiaHoyLaPaz = (): number => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/La_Paz', weekday: 'short' })
      const dayStr = formatter.format(new Date()).toLowerCase()
      const map: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
      return map[dayStr] ?? new Date().getDay()
    } catch {
      return new Date().getDay()
    }
  }

  // Función dinámica que usa config para validar servicios 2x1
  const esServicio2x1Valido = (servicio: Servicio | undefined): boolean => {
    if (!servicio) return false
    // Si hay servicios configurados por el admin, verificar si está incluido
    if (modo2x1 === 'acompanante' && config2x1.servicios_acompanante.length > 0) {
      if (config2x1.servicios_acompanante.includes(servicio.id)) return true
    }
    if (modo2x1 === 'servicio_extra' && config2x1.servicios_extra.length > 0) {
      if (config2x1.servicios_extra.includes(servicio.id)) return true
    }
    // Si no está explícito en la lista o es fallback, validar por nombre (incluye cortes, barbas y combos con corte/barba)
    return esServicio2x1ValidoPorNombre(servicio)
  }
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [createdCita, setCreatedCita] = useState<any | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [qrPago, setQrPago] = useState<string | null>(null)
  const [step, setStep] = useState(0) // starts at 0 for guests, loadData sets to 1 if logged in

  // Step 0: Quick Registration state
  const [registerData, setRegisterData] = useState({ full_name: '', ci: '', phone: '', email: '', password: '' })
  const [manualRefInput, setManualRefInput] = useState('')
  const [validatingRef, setValidatingRef] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState('')
  const [filterCategoria, setFilterCategoria] = useState<string>('todos')
  const [tipoReserva, setTipoReserva] = useState<'adelanto_20' | 'pago_total' | 'sin_adelanto'>('adelanto_20')

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
  const [disponibleAgenda, setDisponibleAgenda] = useState(true)
  const [motivoAgenda, setMotivoAgenda] = useState('')
  const [rangoHorario, setRangoHorario] = useState({ inicio: '09:00', fin: '20:00' })
  const [turnosAgenda, setTurnosAgenda] = useState<Array<{ inicio: string; fin: string }> | undefined>(undefined)
  const [loadingDisponibilidad, setLoadingDisponibilidad] = useState(false)
  const [lealtadInfo, setLealtadInfo] = useState<{descuento: number, mensaje: string} | null>(null)
  const [tiempoMinimoReserva, setTiempoMinimoReserva] = useState(60) // minutos
  const [asistenciasHoy, setAsistenciasHoy] = useState<any[]>([])
  const [permisosHoy, setPermisosHoy] = useState<any[]>([])

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const wizardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (wizardRef.current) {
      const timer = setTimeout(() => {
        wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [step])

  useEffect(() => {
    loadData()
    const servicioId = searchParams.get('servicio')
    const barberoId = searchParams.get('barbero')

    if (servicioId || barberoId) {
      setFormData(prev => ({
        ...prev,
        ...(servicioId ? { servicio_id: servicioId } : {}),
        ...(barberoId ? { barbero_id: barberoId } : {}),
      }))
      // NO forzar setStep(2) aquí — loadData determinará el step correcto
      // basándose en si el usuario está logueado o no.
      // Si está logueado Y tiene servicio pre-seleccionado, loadData salta a step 2.
      // Si NO está logueado, loadData deja step 0 para que se registre primero.
    }
  }, [searchParams])

  // Forzar pago total cuando se selecciona la promo 2x1
  useEffect(() => {
    const promo = promociones.find(p => p.id === promoSeleccionada)
    if (promo?.tipo === '2x1') {
      setTipoReserva('pago_total')
    }
  }, [promoSeleccionada, promociones])

  // Auto-deseleccionar 2x1 si el servicio cambia a uno no válido
  useEffect(() => {
    const promo = promociones.find(p => p.id === promoSeleccionada)
    if (promo?.tipo === '2x1') {
      const serv = servicios.find(s => s.id === formData.servicio_id)
      if (serv && !esServicio2x1Valido(serv)) {
        setPromoSeleccionada('')
        setModo2x1('acompanante')
        setServicioExtra2x1('')
        setAcompanante({ nombre: '', email: '' })
      }
    }
  }, [formData.servicio_id, promoSeleccionada, promociones, servicios])

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
          if (typeof data.disponible !== 'undefined') {
            setDisponibleAgenda(data.disponible)
            setMotivoAgenda(data.motivo || '')
            setRangoHorario({
              inicio: data.hora_inicio || '09:00',
              fin: data.hora_fin || '20:00'
            })
            setTurnosAgenda(data.turnos || undefined)
          }
          if (typeof data.tiempo_minimo_reserva !== 'undefined') {
            setTiempoMinimoReserva(Number(data.tiempo_minimo_reserva))
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

  const servicioSeleccionadoObj = servicios.find(s => s.id === formData.servicio_id)
  const duracionServicioMin = servicioSeleccionadoObj?.duracion_minutos || 30

  // Cargar disponibilidad de todos los especialistas para la fecha seleccionada (necesario para el acompañante en 2x1)
  useEffect(() => {
    if (!formData.fecha || barberos.length === 0) return
    let isMounted = true

    const fetchAllBarbers = async () => {
      setLoadingDisponibilidadBarberos(true)
      try {
        const entries = await Promise.all(
          barberos.map(async (b) => {
            try {
              const res = await fetch(`/api/citas/disponibilidad?barbero_id=${b.id}&fecha=${formData.fecha}`)
              const data = await res.json()
              return [b.id, data] as const
            } catch {
              return [b.id, null] as const
            }
          })
        )
        if (isMounted) {
          const map: Record<string, any> = {}
          entries.forEach(([id, data]) => {
            if (data) map[id] = data
          })
          setDisponibilidadBarberos(map)
        }
      } finally {
        if (isMounted) setLoadingDisponibilidadBarberos(false)
      }
    }

    fetchAllBarbers()
    return () => { isMounted = false }
  }, [formData.fecha, barberos])

  // Validador de disponibilidad del slot del acompañante en 2x1
  const validarSlotAcompanante = (
    horaToCheck: string,
    barberoIdToCheck: string
  ): { disponible: boolean; motivo?: string } => {
    if (!horaToCheck || !barberoIdToCheck) {
      return { disponible: false, motivo: 'Selecciona hora y especialista del acompañante' }
    }

    // 1. Debe estar dentro del horario 2x1 configurado (ej: 08:00 a 17:30)
    const [hIni, mIni] = config2x1.hora_inicio.split(':').map(Number)
    const [hFin, mFin] = config2x1.hora_fin.split(':').map(Number)
    const [hCur, mCur] = horaToCheck.split(':').map(Number)
    const minCur = hCur * 60 + mCur
    const minIni = hIni * 60 + (mIni || 0)
    const minFin = hFin * 60 + (mFin || 0)
    if (minCur < minIni || minCur > minFin) {
      return {
        disponible: false,
        motivo: `Fuera del horario 2×1 (${config2x1.hora_inicio} a ${config2x1.hora_fin})`
      }
    }

    // 2. Si es el mismo barbero que el titular, no puede ser a la misma hora
    if (barberoIdToCheck === formData.barbero_id && horaToCheck === formData.hora) {
      return {
        disponible: false,
        motivo: 'El mismo especialista no puede atender dos citas a la misma hora'
      }
    }

    // 3. Obtener agenda del barbero seleccionado
    let ocupadosBase: { hora: string; duracion: number }[] = []
    let rInicio = '09:00'
    let rFin = '20:00'
    let dispAgenda = true
    let turnos: Array<{ inicio: string; fin: string }> | undefined = undefined

    if (barberoIdToCheck === formData.barbero_id) {
      ocupadosBase = [...horasOcupadas]
      if (formData.hora) {
        ocupadosBase.push({ hora: formData.hora, duracion: duracionServicioMin })
      }
      rInicio = rangoHorario.inicio
      rFin = rangoHorario.fin
      dispAgenda = disponibleAgenda
      turnos = turnosAgenda
    } else {
      const dataDisp = disponibilidadBarberos[barberoIdToCheck]
      if (dataDisp) {
        ocupadosBase = dataDisp.ocupados || []
        rInicio = dataDisp.hora_inicio || '09:00'
        rFin = dataDisp.hora_fin || '20:00'
        dispAgenda = dataDisp.disponible !== false
        turnos = dataDisp.turnos
      }
    }

    if (!dispAgenda) {
      return { disponible: false, motivo: 'El especialista no atiende en esta fecha' }
    }

    return isTimeSlotAvailable(
      horaToCheck,
      duracionServicioMin,
      ocupadosBase,
      rInicio,
      rFin,
      formData.fecha,
      tiempoMinimoReserva,
      turnos
    )
  }

  // Sincronizar automáticamente horario y barbero del acompañante según el modo
  useEffect(() => {
    const promoElegida = promociones.find(p => p.id === promoSeleccionada)
    if (promoElegida?.tipo !== '2x1' || modo2x1 !== 'acompanante' || !formData.hora || !formData.barbero_id) {
      return
    }

    if (acompModo === 'consecutivo') {
      const consecutivo = minutesToTimeString(timeStringToMinutes(formData.hora) + duracionServicioMin)
      setAcompBarberoId(formData.barbero_id)
      setAcompHora(consecutivo)
    } else if (acompModo === 'simultaneo') {
      setAcompHora(formData.hora)
      if (!acompBarberoId || acompBarberoId === formData.barbero_id) {
        const otros = barberos.filter(b => b.id !== formData.barbero_id)
        const otroDisponible = otros.find(b => {
          const val = validarSlotAcompanante(formData.hora, b.id)
          return val.disponible
        })
        if (otroDisponible) {
          setAcompBarberoId(otroDisponible.id)
        } else if (otros.length > 0) {
          setAcompBarberoId(otros[0].id)
        }
      }
    } else if (acompModo === 'personalizado') {
      if (!acompBarberoId) {
        setAcompBarberoId(formData.barbero_id)
      }
    }
  }, [formData.hora, formData.barbero_id, acompModo, promoSeleccionada, promociones, modo2x1, duracionServicioMin, disponibilidadBarberos, barberos, formData.fecha, tiempoMinimoReserva])

  const loadUserProfile = async (authUser: { id: string; email?: string }) => {
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
          setLealtadInfo({ descuento: 15, mensaje: '¡5to Corte! Tienes 15 Bs de descuento en el servicio.' })
        } else if (enCiclo === 9) {
          setLealtadInfo({ descuento: 1, mensaje: '¡10mo Corte! Tu servicio es GRATIS.' })
        }
      }
    }
  }

  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegistering(true)
    setRegisterError('')

    try {
      if (!registerData.full_name.trim()) throw new Error('Ingresa tu nombre completo')
      if (!registerData.ci.trim()) throw new Error('Ingresa tu CI / Carnet para vincular tu historial')
      if (!registerData.phone.trim()) throw new Error('Ingresa tu número de teléfono')
      if (!registerData.email.trim()) throw new Error('Ingresa tu correo electrónico')
      if (registerData.password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres')

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: registerData.email.trim(),
        password: registerData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: registerData.full_name.trim(),
            phone: registerData.phone.trim(),
            ci: registerData.ci.trim(),
          },
        },
      })

      if (authError) throw new Error(authError.message)
      if (!authData.user) throw new Error('Error al crear la cuenta')

      // Insert into clientes table
      const cleanCi = registerData.ci.trim()
      let skipInsert = false

      if (cleanCi) {
        const { data: existingByCi } = await supabase
          .from('clientes')
          .select('id')
          .eq('ci', cleanCi)
          .maybeSingle()
        if (existingByCi) skipInsert = true
      }

      if (!skipInsert) {
        await supabase.from('clientes').insert({
          id: authData.user.id,
          nombre: registerData.full_name.trim(),
          telefono: registerData.phone.trim() || null,
          ci: cleanCi || null,
          email: registerData.email.trim(),
          total_visitas: 0,
          total_gastado: 0,
          referido_por: referidoInfo?.id || null,
        })

        if (referidoInfo?.id) {
          try {
            const { data: confRef } = await supabase.from('configuraciones').select('valor').eq('llave', 'monto_bono_referido').maybeSingle()
            const montoBonoVal = confRef?.valor ? (typeof confRef.valor === 'object' ? Number((confRef.valor as any).monto) || 10 : Number(confRef.valor) || 10) : 10
            await supabase.from('referrals').insert({
              cliente_recomendante_id: referidoInfo.id,
              cliente_recomendado_id: authData.user.id,
              monto_bono: montoBonoVal,
              bono_otorgado: false,
            })
          } catch (_) {}
        }
      }

      // Auto-sync history
      try {
        await fetch('/api/auth/autosync-cliente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            new_user_id: authData.user.id,
            ci: registerData.ci.trim(),
            email: registerData.email.trim(),
            nombre: registerData.full_name.trim(),
          })
        })
      } catch (syncErr) {
        console.warn('Error al auto-sincronizar historial:', syncErr)
      }

      // Send welcome email
      fetch('/api/auth/bienvenida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerData.email.trim(),
          full_name: registerData.full_name.trim(),
          password: registerData.password
        })
      }).catch(err => console.error('Error enviando email de bienvenida:', err))

      // Auto-login: if session exists, load user profile and advance
      if (authData.session) {
        await loadUserProfile(authData.user)
        toastSuccess(`¡Bienvenido, ${registerData.full_name.split(' ')[0]}! Tu cuenta fue creada.`)
        setStep(1)
      } else {
        // Email confirmation required — redirect to login
        toastSuccess('¡Cuenta creada! Revisa tu correo para confirmar y luego inicia sesión.')
        router.push('/login')
      }
    } catch (err: any) {
      const msg = err?.message || 'Error inesperado al crear la cuenta'
      setRegisterError(msg)
      toastError(msg)
    } finally {
      setRegistering(false)
    }
  }

  const loadData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        await loadUserProfile(authUser)
        // If user arrived with a pre-selected service, jump to step 2 (Barbero)
        const preServicio = searchParams.get('servicio')
        setStep(preServicio ? 2 : 1)
      }

      const hoyLocal = new Date()
      const hoyStr = new Date(hoyLocal.getTime() - (hoyLocal.getTimezoneOffset() * 60000)).toISOString().split('T')[0]

      const [resServicios, resBarberos, resProductos, configQr, resPromos, configTiempo, resBarberoServicios, resAsistencias, resPermisos, config2x1Res, resHorarios] = await Promise.all([
        supabase.from('servicios').select('*').eq('is_active', true).order('orden', { ascending: true }),
        supabase.from('profiles').select('id, full_name, email, avatar_url, qr_code_url').eq('role', 'barbero').eq('is_active', true),
        supabase.from('productos').select('id, nombre, precio_venta, stock_actual, image_url').eq('is_active', true).gt('stock_actual', 0).order('orden', { ascending: true }),
        supabase.from('configuraciones').select('valor').eq('llave', 'qr_pago').maybeSingle(),
        supabase.from('promociones').select('*').eq('activa', true),
        supabase.from('configuraciones').select('valor').eq('llave', 'tiempo_minimo_reserva').maybeSingle(),
        supabase.from('comision_barbero_servicios').select('barbero_id, servicio_id'),
        supabase.from('asistencias').select('profile_id, estado, hora_entrada, hora_salida').eq('fecha', hoyStr),
        supabase.from('solicitudes_permisos').select('barbero_id, estado, fecha, fecha_fin, tipo_permiso').eq('estado', 'aprobado').lte('fecha', hoyStr),
        supabase.from('configuraciones').select('valor').eq('llave', 'promo_2x1_config').maybeSingle(),
        fetch('/api/barberos/horarios').then(r => r.json()).catch(() => ({ horarios: [] }))
      ])

      setServicios(resServicios.data || [])
      setBarberos(resBarberos.data || [])
      setProductos(resProductos.data || [])
      setAsistenciasHoy(resAsistencias.data || [])
      setPermisosHoy(resPermisos.data || [])
      if (resHorarios?.horarios && resHorarios.horarios.length > 0) {
        setBarberoHorarios(resHorarios.horarios)
      } else if (Array.isArray(resHorarios?.data) && resHorarios.data.length > 0) {
        setBarberoHorarios(resHorarios.data)
      }
      if (resBarberoServicios.data) {
        setBarberoServicios(resBarberoServicios.data)
      }
      const rawPromosData = resPromos.data || []
      const promosUnicas = Array.from(
        new Map(rawPromosData.map((p: any) => [(p.nombre || '').toLowerCase().trim(), p])).values()
      )
      setPromociones(promosUnicas)
      if (configTiempo.data?.valor?.minutos !== undefined) {
        setTiempoMinimoReserva(Number(configTiempo.data.valor.minutos))
      } else if (typeof configTiempo.data?.valor === 'number') {
        setTiempoMinimoReserva(Number(configTiempo.data.valor))
      } else if (typeof configTiempo.data?.valor === 'string') {
        setTiempoMinimoReserva(Number(configTiempo.data.valor) || 60)
      }
      if (configQr.data?.valor?.url) {
        setQrPago(configQr.data.valor.url)
      } else if (typeof configQr.data?.valor === 'string') {
        setQrPago(configQr.data.valor)
      }
      if (config2x1Res.data?.valor) {
        const parsed = typeof config2x1Res.data.valor === 'string' ? JSON.parse(config2x1Res.data.valor) : config2x1Res.data.valor
        setConfig2x1(prev => ({
          ...prev,
          ...parsed,
          solo_reserva_lunes: parsed.solo_reserva_lunes ?? true,
          dia_reserva_permitido: parsed.dia_reserva_permitido ?? 1,
          servicios_acompanante: parsed.servicios_acompanante || [],
          servicios_extra: parsed.servicios_extra || []
        }))
      }

      // Capturar recomendante desde ?ref=...
      const refParam = searchParams.get('ref')
      if (refParam) {
        const cleanRef = refParam.trim()
        const orList = [`id.eq.${cleanRef}`]
        if (!cleanRef.includes('-')) {
          orList.push(`ci.eq.${cleanRef}`)
        }
        const { data: refClient } = await supabase
          .from('clientes')
          .select('id, nombre')
          .or(orList.join(','))
          .maybeSingle()

        if (refClient) {
          setReferidoInfo({ id: refClient.id, nombre: refClient.nombre })
          setManualRefInput(cleanRef)
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Validar código de referido manual en tiempo real
  useEffect(() => {
    const val = manualRefInput.trim()
    if (!val) {
      if (!searchParams.get('ref')) setReferidoInfo(null)
      return
    }

    const timer = setTimeout(async () => {
      setValidatingRef(true)
      try {
        const orQueries = [`id.eq.${val}`]
        if (!val.includes('-')) {
          orQueries.push(`ci.eq.${val}`)
        }
        const { data: refClient } = await supabase
          .from('clientes')
          .select('id, nombre')
          .or(orQueries.join(','))
          .maybeSingle()

        if (refClient) {
          setReferidoInfo({ id: refClient.id, nombre: refClient.nombre })
        } else {
          setReferidoInfo(null)
        }
      } catch (_) {
        setReferidoInfo(null)
      } finally {
        setValidatingRef(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [manualRefInput, supabase, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.servicio_id && carrito.length === 0) {
      toastError('Debes seleccionar al menos un servicio o producto.')
      return
    }
    if (!formData.barbero_id) {
      toastError('Debes seleccionar a tu barbero de preferencia.')
      return
    }
    if (!formData.fecha || !formData.hora) {
      toastError('Debes seleccionar la fecha y hora de tu cita.')
      return
    }

    // Validar tiempo mínimo de anticipación (safety net)
    if (tiempoMinimoReserva > 0) {
      try {
        const nowBolivia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' }))
        const [yV, mV, dV] = formData.fecha.split('-').map(Number)
        const [hV, minV] = formData.hora.split(':').map(Number)
        const appointmentDate = new Date(yV, mV - 1, dV, hV, minV, 0)
        const diffMinutos = Math.floor((appointmentDate.getTime() - nowBolivia.getTime()) / 60000)
        if (diffMinutos < tiempoMinimoReserva) {
          const anticipacionTexto = tiempoMinimoReserva >= 1440
            ? `${Math.round(tiempoMinimoReserva / 1440)} día(s)`
            : `${Math.round(tiempoMinimoReserva / 60)} hora(s)`
          toastError(`⚠️ Las reservas online requieren al menos ${anticipacionTexto} de anticipación. Puedes acercarte a la barbería para atención del día.`)
          return
        }
      } catch (_) {}
    }
    if (!formData.nombre?.trim() || !formData.telefono?.trim() || !formData.email?.trim()) {
      toastError('Por favor completa todos tus datos personales.')
      return
    }

    // Validar reglas del 2x1 si está seleccionado
    const promoElegidaSubmit = promociones.find(p => p.id === promoSeleccionada)
    if (promoElegidaSubmit?.tipo === '2x1') {
      const diaHoy = getDiaHoyLaPaz()
      const diaPermitido = config2x1.dia_reserva_permitido ?? 1 // 1 = Lunes
      if (config2x1.solo_reserva_lunes && diaHoy !== diaPermitido) {
        toastError('⚠️ La promoción 2×1 se reserva online únicamente los días Lunes (1 día de anticipación). Los días Martes la atención es 100% presencial por orden de llegada en la barbería.')
        return
      }

      const [y, m, d] = formData.fecha.split('-').map(Number)
      const diaCitaSemana = new Date(y, m - 1, d).getDay()
      if (diaCitaSemana !== (config2x1.dia_semana ?? 2)) {
        toastError('⚠️ La promoción 2×1 es válida exclusivamente para días Martes. Por favor selecciona un Martes en el calendario.')
        return
      }

      if (modo2x1 === 'acompanante') {
        if (!acompanante.nombre.trim()) {
          toastError('Por favor ingresa el nombre de tu acompañante para el 2×1.')
          return
        }
        if (!acompBarberoId || !acompHora) {
          toastError('Por favor selecciona el especialista y horario de tu acompañante en el paso de Fecha y Hora.')
          return
        }
        const valAcomp = validarSlotAcompanante(acompHora, acompBarberoId)
        if (!valAcomp.disponible) {
          toastError(`⚠️ Horario del acompañante no disponible: ${valAcomp.motivo || 'Verifica la disponibilidad'}`)
          return
        }
      }
      if (modo2x1 === 'servicio_extra' && !servicioExtra2x1) {
        toastError('Por favor selecciona el servicio extra que deseas recibir en el 2×1.')
        return
      }
    }

    const esGratis = totalReserva === 0
    if (!esGratis && tipoReserva !== 'sin_adelanto' && !formData.comprobante_url) {
      toastError('⚠️ Para confirmar tu reserva con QR, es OBLIGATORIO adjuntar la captura de tu comprobante de pago.')
      return
    }

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
              referido_por: referidoInfo?.id || null,
            })
            .select('id')
            .single()

          if (clienteError) throw new Error('No se pudo crear el cliente')
          clienteId = nuevoCliente?.id

          if (referidoInfo?.id && clienteId) {
            try {
              const { data: confRef } = await supabase.from('configuraciones').select('valor').eq('llave', 'monto_bono_referido').maybeSingle()
              const montoBonoVal = confRef?.valor ? (typeof confRef.valor === 'object' ? Number((confRef.valor as any).monto) || 10 : Number(confRef.valor) || 10) : 10
              await supabase.from('referrals').insert({
                cliente_recomendante_id: referidoInfo.id,
                cliente_recomendado_id: clienteId,
                monto_bono: montoBonoVal,
                bono_otorgado: false,
              })
            } catch (_) {}
          }
        }
      }

      if (!clienteId) throw new Error('No se encontró el ID del cliente')

      // Validar si el barbero cuenta con un permiso aprobado para esa fecha
      const { data: permisoConflict } = await supabase
        .from('solicitudes_permisos')
        .select('id, motivo, tipo_permiso')
        .eq('barbero_id', formData.barbero_id)
        .eq('estado', 'aprobado')
        .lte('fecha', formData.fecha)
        .gte('fecha_fin', formData.fecha)
        .maybeSingle()

      if (permisoConflict) {
        throw new Error('El barbero seleccionado cuenta con un permiso aprobado en esta fecha. Por favor elige a otro especialista u otra fecha.')
      }

      // Si es reserva para hoy, validar que el barbero esté activo en el local
      const hoyLocalCheck = new Date()
      const hoyStrCheck = new Date(hoyLocalCheck.getTime() - (hoyLocalCheck.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
      if (formData.fecha === hoyStrCheck) {
        const { data: asisCheck } = await supabase
          .from('asistencias')
          .select('estado, hora_entrada, hora_salida')
          .eq('profile_id', formData.barbero_id)
          .eq('fecha', formData.fecha)
          .maybeSingle()

        if (asisCheck?.estado === 'permiso' || asisCheck?.estado === 'falta' || asisCheck?.hora_salida) {
          throw new Error('El barbero no se encuentra atendiendo en el local el día de hoy. Por favor selecciona a otro especialista disponible.')
        }
      }

      const fechaHora = `${formData.fecha}T${formData.hora}:00-04:00`

      const { data: citaExistente } = await supabase
        .from('citas')
        .select('id')
        .eq('barbero_id', formData.barbero_id)
        .eq('fecha_hora', fechaHora)
        .not('estado', 'in', '("cancelado","no_presento","comprobante_rechazado")')
        .maybeSingle()

      if (citaExistente) {
        throw new Error('Lo sentimos, este horario acaba de ser ocupado. Por favor selecciona otro.')
      }

      // Validar colisión en BD del horario del acompañante
      let acompFechaHora = ''
      if (promoElegidaSubmit?.tipo === '2x1' && modo2x1 === 'acompanante') {
        acompFechaHora = `${formData.fecha}T${acompHora}:00-04:00`
        if (acompBarberoId === formData.barbero_id && acompHora === formData.hora) {
          throw new Error('El especialista no puede atender a dos personas en el mismo horario. Selecciona otro horario o especialista para tu acompañante.')
        }

        const { data: citaAcompExistente } = await supabase
          .from('citas')
          .select('id')
          .eq('barbero_id', acompBarberoId)
          .eq('fecha_hora', acompFechaHora)
          .not('estado', 'in', '("cancelado","no_presento","comprobante_rechazado")')
          .maybeSingle()

        if (citaAcompExistente) {
          throw new Error('Lo sentimos, el horario elegido para tu acompañante acaba de ser ocupado. Por favor selecciona otro horario.')
        }
      }

      const servicio = servicios.find(s => s.id === formData.servicio_id)
      let precioServicioFinal = servicio?.precio || 0
      let notasFinales = formData.notas

      const promoElegida = promociones.find(p => p.id === promoSeleccionada)
      if (promoElegida?.tipo === '2x1') {
        if (modo2x1 === 'acompanante' && !acompanante.nombre.trim()) {
          setSubmitting(false)
          toastError('Debe ingresar el nombre del acompañante para la promoción 2x1.')
          return
        }
        if (modo2x1 === 'servicio_extra' && !servicioExtra2x1) {
          setSubmitting(false)
          toastError('Debe seleccionar un servicio extra para la promoción 2x1.')
          return
        }

        // Validar que la fecha seleccionada sea el día configurado para 2x1 (ej: martes)
        if (formData.fecha) {
          const [year, month, day] = formData.fecha.split('-').map(Number)
          const fechaObj = new Date(year, month - 1, day)
          if (fechaObj.getDay() !== config2x1.dia_semana) {
            const diasNombres = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']
            const diaNombre = diasNombres[config2x1.dia_semana] || 'martes'
            setSubmitting(false)
            toastError(`La promoción 2×1 solo es válida para citas los días ${diaNombre}.`)
            return
          }
        }

        // Validar que el horario esté dentro del rango configurado (ej: 08:00 a 17:30)
        if (formData.hora) {
          const [hIni, mIni] = config2x1.hora_inicio.split(':').map(Number)
          const [hFin, mFin] = config2x1.hora_fin.split(':').map(Number)
          const [hCur, mCur] = formData.hora.split(':').map(Number)
          const minCur = hCur * 60 + mCur
          const minIni = hIni * 60 + (mIni || 0)
          const minFin = hFin * 60 + (mFin || 0)

          if (minCur < minIni || minCur > minFin) {
            setSubmitting(false)
            toastError(`La promoción 2×1 solo aplica de ${config2x1.hora_inicio} a ${config2x1.hora_fin}. Fuera de este horario aplica tarifa regular sin 2×1.`)
            return
          }
        }

        // BUG 4: Regla temporal — Solo se puede reservar 2×1 desde el día anterior
        // Si es el mismo día del 2×1 y ya pasó la hora de inicio, no se permite reservar con 2×1
        if (formData.fecha) {
          const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' }))
          const diaActual = ahora.getDay()
          const [yearR, monthR, dayR] = formData.fecha.split('-').map(Number)
          const fechaReserva = new Date(yearR, monthR - 1, dayR)
          const esMismoDia = diaActual === config2x1.dia_semana && fechaReserva.getDay() === config2x1.dia_semana && fechaReserva.toDateString() === ahora.toDateString()

          if (esMismoDia) {
            const [hIniC, mIniC] = config2x1.hora_inicio.split(':').map(Number)
            const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()
            const minutosInicio = hIniC * 60 + (mIniC || 0)
            if (minutosAhora >= minutosInicio) {
              setSubmitting(false)
              toastError('Para reservar con 2×1 debes hacerlo desde el día anterior. El mismo día del 2×1, después de las ' + config2x1.hora_inicio + ', solo se puede reservar con tarifa regular.')
              return
            }
          }
        }

        // Validar que el servicio sea válido para 2x1 (Corte, Barba o Combos con corte/barba)
        if (!esServicio2x1Valido(servicio)) {
          setSubmitting(false)
          toastError('La promoción 2×1 aplica para Cortes, Barbas o Combos que incluyan corte.')
          return
        }
      }

      if (lealtadInfo && servicio) {
        precioServicioFinal = precioServicioFinal * (1 - lealtadInfo.descuento)
        const promoNota = `[PROMO: ${lealtadInfo.mensaje}]`
        notasFinales = formData.notas ? `${formData.notas}\n${promoNota}` : promoNota
      }

      if (promoElegida) {
        if (promoElegida.tipo === 'descuento_fijo') {
          precioServicioFinal = Math.max(0, precioServicioFinal - (promoElegida.valor || 10))
        } else if (promoElegida.tipo === '2x1') {
          // 2x1: En combo solo se descuenta la mitad del corte (-Bs 25). En servicio individual, la mitad de su precio.
          const res2x1 = calcularDescuentoYPrecio2x1(servicio, servicios)
          precioServicioFinal = Math.max(0, precioServicioFinal - res2x1.descuento)
        } else if (promoElegida.tipo === 'descuento_porcentaje') {
          precioServicioFinal = precioServicioFinal * (1 - ((promoElegida.valor || 50) / 100))
        } else if (promoElegida.tipo === 'cumpleanos' || promoElegida.tipo === 'servicio_gratis') {
          precioServicioFinal = 0
        }
        
        let infoPromo = `[PROMO: ${promoElegida.nombre}]`
        if (promoElegida.tipo === '2x1') {
          const res2x1 = calcularDescuentoYPrecio2x1(servicio, servicios)
          if (res2x1.esCombo) {
            infoPromo += ` Combo con corte a mitad de precio (-Bs ${res2x1.descuento})`
          } else {
            infoPromo += ` Corte a mitad de precio (-Bs ${res2x1.descuento})`
          }
          if (modo2x1 === 'acompanante' && acompanante.nombre) {
            infoPromo += ` | Acompañante: ${acompanante.nombre}${acompanante.email ? ` (${acompanante.email})` : ''}`
          } else if (modo2x1 === 'servicio_extra' && servicioExtra2x1) {
            const extraServ = servicios.find(s => s.id === servicioExtra2x1)
            infoPromo += ` | Servicio Extra 2×1: ${extraServ?.nombre || servicioExtra2x1}`
          }
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

      const esGratis = precioFinalTotal === 0
      let anticipoCalculado = 0
      let tipoReservaEfectivo = 'sin_adelanto'

      if (!esGratis) {
        if (tipoReserva === 'adelanto_20') anticipoCalculado = Math.min(20, precioFinalTotal)
        else if (tipoReserva === 'pago_total') anticipoCalculado = precioFinalTotal
        else if (tipoReserva === 'sin_adelanto') anticipoCalculado = 0
        tipoReservaEfectivo = tipoReserva
      }

      let notaReserva = ''
      if (esGratis) {
        notaReserva = '[Reserva]: Servicio Gratuito (10mo corte / beneficio 100% descuento)'
      } else if (tipoReservaEfectivo === 'sin_adelanto') {
        notaReserva = '[Reserva]: Sin adelanto (Pago en local. Debe estar 5 min antes)'
      } else if (tipoReservaEfectivo === 'pago_total') {
        notaReserva = `[Reserva QR]: Pago Completo por QR (Bs ${precioFinalTotal})`
      } else {
        notaReserva = `[Reserva QR]: Adelanto de Bs ${anticipoCalculado} por Reserva`
      }
      notasFinales = notasFinales ? `${notasFinales}\n${notaReserva}` : notaReserva

      const barbero = barberos.find((b) => b.id === formData.barbero_id)

      const insertPayload: any = {
        cliente_id: clienteId,
        barbero_id: formData.barbero_id,
        servicio_id: formData.servicio_id || null,
        fecha_hora: fechaHora,
        precio: precioFinalTotal,
        duracion_real_minutos: servicio?.duracion_minutos || 30,
        estado: (esGratis || tipoReservaEfectivo === 'sin_adelanto') ? 'confirmado' : 'pendiente_pago',
        notas: formData.comprobante_url ? `${notasFinales}\n[Comprobante]: ${formData.comprobante_url}` : notasFinales,
        anticipo_monto: anticipoCalculado,
      }
      if (formData.comprobante_url) {
        insertPayload.comprobante_url = formData.comprobante_url
      }

      let { data: citaNueva, error: citaError } = await supabase
        .from('citas')
        .insert(insertPayload)
        .select('id')
        .single()

      // Fallback si la columna comprobante_url no existiese
      if (citaError && citaError.message?.includes('comprobante_url')) {
        delete insertPayload.comprobante_url
        const retry = await supabase.from('citas').insert(insertPayload).select('id').single()
        citaNueva = retry.data
        citaError = retry.error
      }

      if (citaError || !citaNueva) throw new Error(citaError?.message || 'Error al crear la cita')

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

      const isSinAdelanto = tipoReserva === 'sin_adelanto'
      try {
        await fetch('/api/notificaciones/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: isSinAdelanto ? 'reserva_nueva' : 'pago_pendiente',
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
              monto: isSinAdelanto ? precioFinalTotal : anticipoCalculado,
              metodoPago: isSinAdelanto 
                ? 'Pago en el local' 
                : (tipoReserva === 'pago_total' ? 'Pago Total por QR' : 'Anticipo por QR'),
              comprobante_url: isSinAdelanto ? null : (formData.comprobante_url || null),
            },
          }),
        })
      } catch (e) {
        console.error('Error enviando notificación', e)
      }

      // Insertar 2da Cita en Supabase para el Acompañante 2x1 (Bloquea su horario en la agenda)
      let citaAcompCreada: any = null
      if (promoElegida?.tipo === '2x1' && modo2x1 === 'acompanante') {
        const barberoAcompObj = barberos.find(b => b.id === acompBarberoId)
        const acompNotas = `[Promo 2×1 Acompañante de: ${formData.nombre}]${acompanante.email ? ` | Email: ${acompanante.email}` : ''}\nVinculada a Cita Principal #${citaNueva.id}${formData.comprobante_url ? `\n[Comprobante]: ${formData.comprobante_url}` : ''}`

        const insertPayloadAcomp: any = {
          cliente_id: clienteId,
          barbero_id: acompBarberoId,
          servicio_id: formData.servicio_id || null,
          fecha_hora: acompFechaHora,
          precio: 0,
          duracion_real_minutos: servicio?.duracion_minutos || 30,
          estado: (esGratis || tipoReservaEfectivo === 'sin_adelanto') ? 'confirmado' : 'pendiente_pago',
          notas: acompNotas,
          anticipo_monto: 0,
        }
        if (formData.comprobante_url) {
          insertPayloadAcomp.comprobante_url = formData.comprobante_url
        }

        let { data: citaAcompData, error: citaAcompErr } = await supabase
          .from('citas')
          .insert(insertPayloadAcomp)
          .select('id')
          .single()

        if (citaAcompErr && citaAcompErr.message?.includes('comprobante_url')) {
          delete insertPayloadAcomp.comprobante_url
          const retryA = await supabase.from('citas').insert(insertPayloadAcomp).select('id').single()
          citaAcompData = retryA.data
          citaAcompErr = retryA.error
        }

        if (citaAcompErr) {
          console.error('Error insertando cita del acompañante 2x1:', citaAcompErr)
        } else if (citaAcompData) {
          citaAcompCreada = {
            id: citaAcompData.id,
            fecha_hora: acompFechaHora,
            precio: 0,
            hora: acompHora,
            barbero: barberoAcompObj,
            acompananteNombre: acompanante.nombre,
          }
          setCreatedCitaAcomp(citaAcompCreada)

          // Notificación al especialista del acompañante
          try {
            await fetch('/api/notificaciones/dispatch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: isSinAdelanto ? 'reserva_nueva' : 'pago_pendiente',
                allowPublic: true,
                payload: {
                  citaId: citaAcompData.id,
                  barberoId: acompBarberoId,
                  barberoNombre: barberoAcompObj?.full_name,
                  barberoEmail: barberoAcompObj?.email,
                  clienteNombre: `${acompanante.nombre} (Acomp. de ${formData.nombre})`,
                  clienteEmail: acompanante.email || formData.email,
                  servicioNombre: `${servicio?.nombre || 'Corte'} (Promo 2×1 - Acompañante)`,
                  fecha: formData.fecha,
                  hora: acompHora,
                  monto: 0,
                  metodoPago: 'Promo 2×1 (Cubierto por titular)',
                  comprobante_url: isSinAdelanto ? null : (formData.comprobante_url || null),
                },
              }),
            })
          } catch (e) {
            console.error('Error enviando notificación del acompañante', e)
          }
        }
      }

      if (promoElegida?.tipo === '2x1' && acompanante.email) {
        try {
          const barberoAcompObj = barberos.find(b => b.id === acompBarberoId)
          await fetch('/api/notificaciones/dispatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'invitacion_2x1',
              allowPublic: true,
              payload: {
                citaId: citaAcompCreada?.id || citaNueva.id,
                acompananteNombre: acompanante.nombre,
                acompananteEmail: acompanante.email,
                clienteNombre: formData.nombre,
                barberoNombre: barberoAcompObj?.full_name || barbero?.full_name,
                servicioNombre: `${servicio?.nombre || 'Corte'} (Promo 2×1)`,
                fecha: formData.fecha,
                hora: acompHora || formData.hora,
              },
            }),
          })
        } catch (e) {
          console.error('Error enviando invitación 2x1', e)
        }
      }

      setCreatedCita({
        id: citaNueva.id,
        fecha_hora: fechaHora,
        precio: precioFinalTotal,
        anticipo_pagado: anticipoCalculado,
        tipo_reserva: tipoReserva,
        servicios: servicio ? { nombre: servicio.nombre, duracion_minutos: servicio.duracion_minutos, precio: servicio.precio } : null,
        profiles: barbero ? { full_name: barbero.full_name, phone: barbero.phone } : null,
      })
      setSuccess(true)
    } catch (error: any) {
      console.error('Error completo:', error)
      toastError('Error al reservar: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const [modoHoraLibre, setModoHoraLibre] = useState(false)
  const [horaLibreCustom, setHoraLibreCustom] = useState('')

  const hoyLocal = new Date()
  const hoy = new Date(hoyLocal.getTime() - (hoyLocal.getTimezoneOffset() * 60000)).toISOString().split('T')[0]

  // --- Helpers for Availability & Products ---
  const getSmartSlotsDisponibles = () => {
    if (!disponibleAgenda) return []
    return generateSmartSlots({
      rangoInicio: rangoHorario.inicio || '09:00',
      rangoFin: rangoHorario.fin || '20:00',
      ocupados: horasOcupadas,
      duracionServicio: duracionServicioMin,
      pasoMinutos: 15,
      fecha: formData.fecha,
      tiempoMinimoReserva,
      turnos: turnosAgenda
    })
  }

  const validarHoraSeleccionada = (hora: string) => {
    return isTimeSlotAvailable(
      hora,
      duracionServicioMin,
      horasOcupadas,
      rangoHorario.inicio || '09:00',
      rangoHorario.fin || '20:00',
      formData.fecha,
      tiempoMinimoReserva,
      turnosAgenda
    )
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

  const servicioSeleccionado = servicios.find(s => s.id === formData.servicio_id)
  let precioServicioOriginal = servicioSeleccionado?.precio || 0
  let precioServicio = precioServicioOriginal

  if (lealtadInfo && servicioSeleccionado) {
    precioServicio = precioServicio * (1 - lealtadInfo.descuento)
  }

  const promoElegida = promociones.find(p => p.id === promoSeleccionada)
  let montoDescuentoPromo = 0
  if (promoElegida && servicioSeleccionado) {
    // El 2x1 aplica a Cortes, Barbas y Combos con corte/barba
    const promo2x1Valida = promoElegida.tipo !== '2x1' || esServicio2x1Valido(servicioSeleccionado)
    
    if (promoElegida.tipo === 'descuento_fijo') {
      montoDescuentoPromo = Math.min(precioServicio, Number(promoElegida.valor || 10))
      precioServicio = Math.max(0, precioServicio - montoDescuentoPromo)
    } else if (promoElegida.tipo === '2x1' && promo2x1Valida) {
      // 2x1: En combo NO se descuenta la mitad del combo completo, SOLO la mitad del corte (-Bs 25).
      // En servicio individual de corte/barba, se descuenta la mitad de su precio (-Bs 25).
      const res2x1 = calcularDescuentoYPrecio2x1(servicioSeleccionado, servicios)
      montoDescuentoPromo = res2x1.descuento
      precioServicio = Math.max(0, precioServicio - montoDescuentoPromo)
    } else if (promoElegida.tipo === 'descuento_porcentaje') {
      const pct = Number(promoElegida.valor || 50)
      montoDescuentoPromo = (precioServicio * pct) / 100
      precioServicio = Math.max(0, precioServicio - montoDescuentoPromo)
    } else if (promoElegida.tipo === 'cumpleanos' || promoElegida.tipo === 'servicio_gratis') {
      montoDescuentoPromo = precioServicio
      precioServicio = 0
    }
  }

  const totalProductos = carrito.reduce((s, i) => s + (i.producto.precio_venta * i.cantidad), 0)
  const descuentoCruzado = (formData.servicio_id && carrito.length > 0) ? 10 : 0
  const totalReserva = Math.max(0, precioServicio + totalProductos - descuentoCruzado)
  let anticipo = 20
  if (tipoReserva === 'adelanto_20') anticipo = Math.min(20, totalReserva)
  else if (tipoReserva === 'pago_total') anticipo = totalReserva
  else if (tipoReserva === 'sin_adelanto' || totalReserva === 0) anticipo = 0

  const missingFields = []
  if (!formData.servicio_id && carrito.length === 0) missingFields.push('Servicio o Producto')
  if (!formData.barbero_id) missingFields.push('Barbero')
  if (!formData.fecha || !formData.hora) missingFields.push('Fecha y Hora')
  if (!formData.nombre || !formData.telefono || !formData.email) missingFields.push('Tus Datos')
  if (tipoReserva !== 'sin_adelanto' && totalReserva > 0 && !formData.comprobante_url) missingFields.push('Comprobante de Pago QR')
  if (promoElegida?.tipo === '2x1' && modo2x1 === 'acompanante') {
    if (!acompanante.nombre?.trim()) missingFields.push('Nombre del Acompañante 2×1')
    if (!acompBarberoId || !acompHora) {
      missingFields.push('Horario y Especialista del Acompañante 2×1')
    } else {
      const valA = validarSlotAcompanante(acompHora, acompBarberoId)
      if (!valA.disponible) {
        missingFields.push(`Horario Acompañante (${valA.motivo || 'No disponible'})`)
      }
    }
  }

  const wizardSteps = [
    ...(!user ? [{ s: 0, label: 'Registro', icon: UserPlus }] : []),
    { s: 1, label: 'Servicio', icon: Scissors },
    { s: 2, label: 'Barbero', icon: User },
    { s: 3, label: 'Fecha', icon: Calendar },
    { s: 4, label: 'Tienda', icon: Package },
    { s: 5, label: 'Resumen', icon: CheckCircle }
  ]
  const totalSteps = wizardSteps.length
  const currentStepIndex = wizardSteps.findIndex(s => s.s === step)
  const progressWidth = totalSteps > 1 ? (currentStepIndex / (totalSteps - 1)) * 100 : 0

  if (success) {
    const barberoTitularObj = barberos.find(b => b.id === formData.barbero_id)
    const barberoAcompObj = createdCitaAcomp?.barbero || barberos.find(b => b.id === acompBarberoId)
    const servicioNombre = servicios.find(s => s.id === formData.servicio_id)?.nombre || 'Servicio BarberSite'

    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white py-12 px-4 flex items-center justify-center">
        <div className={`w-full ${createdCitaAcomp ? 'max-w-2xl' : 'max-w-lg'} bg-zinc-950 border border-amber-500/30 rounded-[2.5rem] shadow-[0_0_60px_rgba(245,158,11,0.2)] overflow-hidden animate-in zoom-in-95 duration-300`}>
          
          {/* Header Celebratorio */}
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-7 text-center text-black relative">
            <div className="w-16 h-16 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center mx-auto mb-3 shadow-lg">
              <CheckCircle size={36} className="text-black" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-black/70">BARBERSITE</p>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black mt-1">
              {createdCitaAcomp ? '¡Reserva 2×1 Confirmada!' : '¡Reserva Confirmada!'}
            </h2>
            <p className="text-black/80 font-bold text-xs mt-1">
              {createdCitaAcomp ? 'Ambos turnos han quedado asegurados en la agenda' : 'Tu turno ha quedado programado exitosamente'}
            </p>
          </div>

          {/* Tarjetas de Confirmación */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className={`grid grid-cols-1 ${createdCitaAcomp ? 'sm:grid-cols-2' : ''} gap-4`}>
              
              {/* Tarjeta Cita 1: Titular */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 relative overflow-hidden shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                    {createdCitaAcomp ? 'Cita 1 · Titular' : 'Comprobante de Cita'}
                  </span>
                  <span className="font-mono text-xs font-bold text-zinc-400">
                    #{createdCita?.id ? createdCita.id.slice(0, 8).toUpperCase() : 'VIP'}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-0.5">Cliente</span>
                  <p className="text-sm font-black text-white">{formData.nombre}</p>
                </div>

                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-0.5">Servicio</span>
                  <p className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <span>✂️</span> {servicioNombre}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-0.5">Fecha y Hora</span>
                    <p className="text-xs font-black text-white">{formData.fecha}</p>
                    <p className="text-amber-400 font-black text-sm">{formatTime12h(formData.hora)} hrs</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-0.5">Especialista</span>
                    <p className="text-xs font-black text-white truncate">{barberoTitularObj?.full_name || 'Especialista'}</p>
                  </div>
                </div>
              </div>

              {/* Tarjeta Cita 2: Acompañante 2x1 */}
              {createdCitaAcomp && (
                <div className="bg-zinc-900/90 border-2 border-amber-500/30 rounded-3xl p-5 relative overflow-hidden shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                      Cita 2 · Acompañante 2×1
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-black">
                      Bs 0 GRATIS
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-0.5">Acompañante</span>
                    <p className="text-sm font-black text-white">
                      {createdCitaAcomp.acompananteNombre || acompanante.nombre}
                    </p>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-0.5">Servicio</span>
                    <p className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <span>✂️</span> {servicioNombre} <span className="text-emerald-400 font-bold">(2×1)</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-0.5">Fecha y Hora</span>
                      <p className="text-xs font-black text-white">{formData.fecha}</p>
                      <p className="text-amber-400 font-black text-sm">{formatTime12h(createdCitaAcomp.hora || acompHora)} hrs</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-0.5">Especialista</span>
                      <p className="text-xs font-black text-white truncate">{barberoAcompObj?.full_name || 'Especialista'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Aviso de Llegada al Local */}
            <div className="p-4 bg-zinc-900/60 border border-white/5 rounded-2xl flex items-center gap-3">
              <span className="text-xl shrink-0">📍</span>
              <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                Solo deben presentarse en <strong>BarberSite</strong> <strong>5 minutos antes</strong> de su horario e indicar su nombre en recepción o al especialista asignado.
              </p>
            </div>

            {/* Acciones */}
            <div className="space-y-3 pt-2">
              <Link
                href="/cliente"
                className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition"
              >
                <span>Ver Mis Reservas en Mi Portal →</span>
              </Link>

              <Link
                href="/"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition"
              >
                <span>Volver a la Página Principal</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={wizardRef} className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white pb-24 font-sans selection:bg-amber-500/30">
      <div className="max-w-4xl mx-auto px-4 py-6 lg:py-10">
        {/* Barra superior de navegación / Regreso */}
        <div className="flex items-center justify-between gap-4 mb-8 pb-4 border-b border-white/5 animate-in fade-in duration-500">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back()
              } else {
                router.push('/')
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 text-xs font-black uppercase tracking-wider text-zinc-300 hover:text-white transition-all hover:scale-105 shadow-lg group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-amber-500 group-hover:-translate-x-1 transition-transform" />
            <span>Volver Atrás</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-white/5 text-xs font-bold text-zinc-400 hover:text-amber-400 transition-all shadow-md group"
          >
            <Home className="w-4 h-4 text-zinc-400 group-hover:text-amber-400 transition-colors" />
            <span className="hidden sm:inline">Página Principal</span>
          </Link>
        </div>

        <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-700">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white uppercase leading-none drop-shadow-lg">
            Agenda tu <span className="text-amber-500">Cita</span>
          </h1>
          {user && (
            <p className="text-zinc-400 mt-3 text-lg font-medium">
              👋 Hola, <span className="text-amber-400 font-bold">{user.full_name}</span>. Todo en un solo lugar.
            </p>
          )}
        </div>

        {/* Banner de Invitación de Referido */}
        {referidoInfo && (
          <div className="mb-8 max-w-2xl mx-auto p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/40 flex items-center gap-3.5 shadow-lg shadow-emerald-500/10 animate-in fade-in slide-in-from-top-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-black flex items-center justify-center font-black text-lg shrink-0 shadow-md">
              🎁
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                ¡Invitación Especial de Bienvenida!
              </p>
              <p className="text-xs text-zinc-200 mt-0.5 font-medium leading-relaxed">
                Llegaste por recomendación de <strong className="text-white font-black">{referidoInfo.nombre}</strong>. Tu cuenta recibirá beneficios exclusivos en tu primera visita.
              </p>
            </div>
          </div>
        )}

        {/* PROGRESS BAR */}
        <div className="mb-12 max-w-2xl mx-auto px-4 animate-in fade-in duration-1000 delay-150">
          <div className="flex justify-between items-center relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-zinc-800 rounded-full z-0 shadow-inner"></div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-amber-500 rounded-full z-0 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${progressWidth}%` }}></div>
            
            {wizardSteps.map((item) => (
              <div key={item.s} className="relative z-10 flex flex-col items-center gap-2">
                <button
                  onClick={() => {
                    if (item.s < step && item.s > 0) setStep(item.s)
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

          {/* PASO 0: REGISTRO RÁPIDO (solo visitantes sin cuenta) */}
          {step === 0 && !user && (
            <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-800/80 shadow-2xl rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-black py-5 px-4 md:py-7 md:px-8 text-center relative overflow-hidden border-b border-white/10">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30"></div>
                <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>

                <div className="relative z-10">
                  {brand.logo_url && brand.mostrar_modo !== 'texto' ? (
                    <div className="flex justify-center items-center mb-3 w-full px-2">
                      <img 
                        src={brand.logo_url} 
                        alt={brand.nombre} 
                        className="w-auto h-auto max-w-[180px] sm:max-w-[240px] md:max-w-[280px] max-h-12 sm:max-h-16 object-contain filter drop-shadow-[0_4px_20px_rgba(245,158,11,0.35)] transition-transform duration-300 hover:scale-105" 
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 mx-auto bg-amber-500/10 rounded-2xl flex items-center justify-center mb-3 backdrop-blur-sm border border-amber-500/20 shadow-lg shadow-amber-500/10">
                      <UserPlus className="w-6 h-6 text-amber-400" />
                    </div>
                  )}
                  <h2 className="text-2xl md:text-3xl font-black text-white drop-shadow-lg tracking-tight">
                    Crea tu Cuenta para <span className="text-amber-500">Reservar</span>
                  </h2>
                  <p className="text-zinc-400 font-medium text-xs md:text-sm mt-1.5 max-w-md mx-auto leading-relaxed">
                    Tu CI nos permite vincular automáticamente tu historial de visitas y beneficios de lealtad.
                  </p>
                </div>
              </div>

              <CardContent className="p-5 md:p-8">
                <form onSubmit={handleQuickRegister} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <Input
                        label="Nombre completo *"
                        value={registerData.full_name}
                        onChange={(e) => setRegisterData({ ...registerData, full_name: e.target.value })}
                        placeholder="Juan Pérez"
                        required
                        className="bg-zinc-950 border-zinc-800 h-12 text-sm pl-11"
                      />
                      <User className="absolute left-3.5 top-9 w-4 h-4 text-zinc-500" />
                    </div>

                    <div className="relative">
                      <Input
                        label="CI / Carnet / Pasaporte *"
                        value={registerData.ci}
                        onChange={(e) => setRegisterData({ ...registerData, ci: e.target.value })}
                        placeholder="Ej: 1234567"
                        required
                        className="bg-zinc-950 border-zinc-800 h-12 text-sm pl-11"
                      />
                      <IdCard className="absolute left-3.5 top-9 w-4 h-4 text-zinc-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <Input
                        label="Teléfono / WhatsApp *"
                        type="tel"
                        value={registerData.phone}
                        onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                        placeholder="71234567"
                        required
                        className="bg-zinc-950 border-zinc-800 h-12 text-sm pl-11"
                      />
                      <Smartphone className="absolute left-3.5 top-9 w-4 h-4 text-zinc-500" />
                    </div>

                    <div className="relative">
                      <Input
                        label="Email *"
                        type="email"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        placeholder="tu@email.com"
                        required
                        className="bg-zinc-950 border-zinc-800 h-12 text-sm pl-11"
                      />
                      <Mail className="absolute left-3.5 top-9 w-4 h-4 text-zinc-500" />
                    </div>
                  </div>

                  <div className="relative">
                    <PasswordInput
                      label="Contraseña *"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                      className="bg-zinc-950 border-zinc-800 h-12 text-sm"
                    />
                  </div>

                  {/* Campo de Código de Referido Manual / Automático */}
                  <div className="space-y-1.5 p-3.5 rounded-2xl bg-zinc-950/80 border border-white/10">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Gift size={13} /> ¿Alguien te recomendó BarberSite?
                      </label>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Opcional</span>
                    </div>
                    <Input
                      value={manualRefInput}
                      onChange={(e) => setManualRefInput(e.target.value)}
                      placeholder="Código, C.I. o ID de tu amigo..."
                      className="bg-zinc-900 border-white/10 text-xs h-11 text-white"
                    />
                    {validatingRef && (
                      <p className="text-[10px] text-zinc-400 animate-pulse">Buscando a tu amigo...</p>
                    )}
                    {referidoInfo && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                        <p className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                          ✓ Recomendado por: <span className="text-white font-black">{referidoInfo.nombre}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => { setManualRefInput(''); setReferidoInfo(null) }}
                          className="text-[10px] text-zinc-400 hover:text-red-400 font-bold"
                        >
                          Quitar
                        </button>
                      </div>
                    )}
                    {manualRefInput.trim() && !validatingRef && !referidoInfo && (
                      <p className="text-[10px] text-amber-400/80">
                        ⚠️ No encontramos cliente con ese código/CI (Puedes dejarlo en blanco si no tienes).
                      </p>
                    )}
                  </div>

                  {/* Info box */}
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-black text-amber-400 uppercase tracking-widest mb-0.5">¿Eres cliente antiguo?</p>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Si tu CI coincide con registros anteriores de caja, tu historial de visitas y nivel de lealtad se vincularán automáticamente.
                      </p>
                    </div>
                  </div>

                  {registerError && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <p className="text-xs text-red-400 font-bold">{registerError}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={registering}
                    className="w-full h-13 py-3.5 text-base font-black bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_25px_rgba(245,158,11,0.25)] rounded-xl uppercase tracking-wider transition-all duration-300 hover:scale-[1.01] active:scale-95 mt-2"
                  >
                    {registering ? (
                      <span className="flex items-center gap-2.5"><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span> Creando cuenta...</span>
                    ) : (
                      <span className="flex items-center gap-2.5"><UserPlus className="w-4 h-4" /> Crear Cuenta y Reservar</span>
                    )}
                  </Button>
                </form>

                <div className="mt-8 text-center space-y-3">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-800"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-zinc-900 px-4 text-xs text-zinc-500 font-bold uppercase tracking-widest">o</span>
                    </div>
                  </div>
                  <p className="text-zinc-400 text-sm">
                    ¿Ya tienes cuenta?{' '}
                    <Link href="/login" className="text-amber-400 hover:text-amber-300 font-bold transition-colors">
                      Iniciar Sesión
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* PASO 1: SERVICIO */}
          {step === 1 && (
            <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-800/80 shadow-2xl rounded-3xl overflow-hidden">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-3xl font-black mb-4 text-center tracking-tight">Selecciona tu <span className="text-amber-500">Servicio</span></h2>

                {/* PROMOCIONES — Compactas */}
                {promociones.filter(p => p.tipo === '2x1').length > 0 && (
                  <div className="mb-6 p-3 bg-gradient-to-b from-black/60 to-zinc-950/80 border border-amber-500/20 rounded-2xl">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-[10px] uppercase tracking-[0.15em] font-black text-amber-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" /> Promos Disponibles
                      </h3>
                      {promoSeleccionada && (
                        <button
                          type="button"
                          onClick={() => { setPromoSeleccionada(''); setModo2x1('acompanante'); setServicioExtra2x1(''); setAcompanante({ nombre: '', email: '' }) }}
                          className="text-[9px] font-bold text-zinc-500 hover:text-white uppercase tracking-wider"
                        >
                          ✕ Quitar
                        </button>
                      )}
                    </div>
                    
                    {(() => {
                      const diaHoy = getDiaHoyLaPaz()
                      const diaPermitido = config2x1.dia_reserva_permitido ?? 1 // 1 = Lunes
                      const is2x1BloqueadoPorDia = config2x1.solo_reserva_lunes && diaHoy !== diaPermitido

                      return (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {promociones.filter(p => p.tipo === '2x1').map(p => {
                              const cleanName = p.nombre.replace(new RegExp(`^${p.icono}\\s*`, 'u'), '').trim()
                              const isSelected = promoSeleccionada === p.id
                              const servActual = servicios.find(s => s.id === formData.servicio_id)
                              const is2x1DisabledServicio = servActual && !esServicio2x1Valido(servActual)

                              if (is2x1BloqueadoPorDia) {
                                return (
                                  <div
                                    key={p.id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-zinc-950/80 border border-amber-500/25 rounded-2xl w-full"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
                                        ✂️
                                      </div>
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-black text-xs text-white uppercase tracking-tight">{cleanName}</p>
                                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                            🏪 Atención Presencial en Tienda
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                                          Los días Martes el 2×1 se atiende por orden de llegada directo en la barbería. <em>(Reservas online solo habilitadas los Lunes)</em>.
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedPromoForModal({
                                          ...p,
                                          descripcion: '✂️ Promoción 2×1 de los Martes (Pagan 1 y entran 2):\n\n• Los días MARTES la atención es 100% presencial por orden de llegada directamente en la barbería debido a la alta concurrencia de clientes.\n\n• Las reservas online del 2×1 se habilitan de manera exclusiva los días LUNES (1 día de anticipación).\n\n• Si vienes solo un Martes, ¡también puedes elegir tu Servicio Extra gratis en caja!'
                                        })
                                      }}
                                      className="text-[10px] font-black text-amber-300 hover:text-black hover:bg-amber-400 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 transition flex items-center justify-center gap-1 shrink-0 self-start sm:self-center"
                                    >
                                      <span>ℹ️ ¿Cómo funciona?</span>
                                    </button>
                                  </div>
                                )
                              }

                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    if (is2x1DisabledServicio) return
                                    setPromoSeleccionada(isSelected ? '' : p.id)
                                    if (!isSelected) setModo2x1('acompanante')
                                  }}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left ${
                                    is2x1DisabledServicio
                                      ? 'opacity-40 cursor-not-allowed bg-black/20 border-zinc-800/50'
                                      : isSelected
                                        ? 'bg-amber-500/15 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)] cursor-pointer'
                                        : 'bg-black/40 border-zinc-800/80 hover:border-amber-500/40 cursor-pointer'
                                  }`}
                                >
                                  <span className="text-sm flex-shrink-0">{p.icono || '🎁'}</span>
                                  <div className="min-w-0">
                                    <p className="font-black text-[11px] text-white leading-tight truncate">{cleanName}</p>
                                    <p className="text-[9px] text-zinc-500 leading-tight">
                                      {is2x1DisabledServicio ? 'Solo Cortes / Combos' : '2×1 Martes'}
                                    </p>
                                  </div>
                                  {!isSelected && (
                                    <span className="text-[8px] font-black uppercase bg-amber-500 text-black px-2 py-0.5 rounded-md flex-shrink-0">Reservar</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      setSelectedPromoForModal(p)
                                    }}
                                    className="text-[8px] font-black text-amber-400 hover:text-white px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 transition flex-shrink-0"
                                  >
                                    Info
                                  </button>
                                </div>
                              )
                            })}
                          </div>

                          {/* Panel expandido del 2x1 (Solo cuando está permitido reservar online) */}
                          {promoElegida?.tipo === '2x1' && !is2x1BloqueadoPorDia && (
                            <div className="mt-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-in fade-in duration-300 space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{promoElegida.icono || '✂️'}</span>
                                <p className="text-[11px] font-black text-amber-400 uppercase tracking-wide">
                                  ¡2×1 Activado! — Elige una opción:
                                </p>
                              </div>

                        {/* Tabs de modo */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setModo2x1('acompanante')}
                            className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                              modo2x1 === 'acompanante'
                                ? 'bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20'
                                : 'bg-black/50 text-zinc-400 border-zinc-700 hover:border-amber-500/50 hover:text-white'
                            }`}
                          >
                            👤 Acompañante
                          </button>
                          <button
                            type="button"
                            onClick={() => setModo2x1('servicio_extra')}
                            className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                              modo2x1 === 'servicio_extra'
                                ? 'bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20'
                                : 'bg-black/50 text-zinc-400 border-zinc-700 hover:border-amber-500/50 hover:text-white'
                            }`}
                          >
                            ✂️ Servicio Extra
                          </button>
                        </div>

                        {/* Contenido según modo */}
                        {modo2x1 === 'acompanante' ? (
                          <div className="space-y-2 pt-1">
                            <p className="text-[10px] text-zinc-400">Ingresa el nombre de la persona que te acompañará. Ambos recibirán el servicio pagando solo 1.</p>
                            <label className="text-[9px] font-black uppercase text-amber-400 tracking-wider block">Nombre del Acompañante *</label>
                            <Input
                              placeholder="Nombre y Apellido"
                              value={acompanante.nombre}
                              onChange={(e) => setAcompanante({ ...acompanante, nombre: e.target.value })}
                              className="bg-black/70 border-amber-500/30 text-xs h-9"
                            />
                          </div>
                        ) : (
                          <div className="space-y-2 pt-1">
                            <p className="text-[10px] text-zinc-400">Selecciona un servicio adicional que quieras incluir en tu 2×1 (no combos).</p>
                            <label className="text-[9px] font-black uppercase text-amber-400 tracking-wider block">Servicio Extra *</label>
                            <select
                              value={servicioExtra2x1}
                              onChange={(e) => setServicioExtra2x1(e.target.value)}
                              className="w-full bg-black/70 border border-amber-500/30 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none focus:border-amber-500"
                            >
                              <option value="">— Seleccionar Servicio Extra —</option>
                              {servicios
                                .filter(s => {
                                  if (config2x1.servicios_extra && config2x1.servicios_extra.length > 0) {
                                    return config2x1.servicios_extra.includes(s.id)
                                  }
                                  return !(s as any).es_combo && !s.nombre?.toLowerCase().includes('combo')
                                })
                                .map(s => (
                                  <option key={s.id} value={s.id}>{s.nombre} · Bs. {Number(s.precio).toFixed(0)}</option>
                                ))}
                            </select>
                          </div>
                        )}

                        <div className="pt-2 border-t border-amber-500/20">
                          <p className="text-[9px] text-amber-300 font-bold flex items-center gap-1">
                            ⚠️ El 2×1 requiere pago completo del servicio por QR para confirmar la reserva.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}

                    {/* Banner para promos que NO son 2x1 */}
                    {promoElegida && promoElegida.tipo !== '2x1' && (
                      <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-in fade-in duration-300">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{promoElegida.icono || '🎉'}</span>
                          <div>
                            <p className="text-[11px] font-black text-amber-400 uppercase tracking-wide">
                              ¡{promoElegida.nombre} activada!
                            </p>
                            <p className="text-[10px] text-zinc-300">
                              {promoElegida.tipo === 'cumpleanos' || promoElegida.tipo === 'servicio_gratis'
                                ? 'Tu servicio tendrá 100% de descuento (presenta tu CI al llegar).'
                                : `Se descontarán Bs. ${promoElegida.valor || 10} automáticamente en tu total.`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
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

                {/* Renderizado de Servicios (Filtro Todos o por Categoría) */}
                {promoElegida?.tipo === '2x1' && (
                  <div className="mb-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3">
                    <span className="text-2xl">✂️</span>
                    <div className="text-xs">
                      <p className="font-black text-amber-400 uppercase tracking-wide">
                        Promo 2×1 de los Martes Activa
                      </p>
                      <p className="text-zinc-300 font-medium mt-0.5">
                        Cortes individuales a <strong>mitad de precio (Bs 25)</strong>. En combos, <strong>solo el corte recibe la mitad de precio (-Bs 25)</strong>, el resto del combo mantiene su tarifa normal.
                      </p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {(filterCategoria === 'todos'
                    ? servicios
                    : servicios.filter(s => (s.categoria || 'Cortes') === filterCategoria)
                  )
                  .filter(s => {
                    // Si el 2x1 está seleccionado, solo mostrar servicios válidos
                    if (promoElegida?.tipo === '2x1' && !esServicio2x1Valido(s)) return false
                    if (!formData.barbero_id) return true
                    if (s.barberos_excluidos?.length) {
                      return !s.barberos_excluidos.includes(formData.barbero_id)
                    }
                    return true
                  })
                  .map((s) => {
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
                        className={`rounded-2xl cursor-pointer overflow-hidden transition-all duration-300 border-2 group hover:-translate-y-1 ${
                          formData.servicio_id === s.id
                            ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.2)] scale-[1.01]'
                            : 'border-zinc-800 bg-zinc-900/80 hover:border-amber-500/50'
                        }`}
                      >
                        {/* Imagen banner compacta */}
                        <div className="relative w-full h-36 overflow-hidden bg-zinc-950">
                          {allImgs.length > 0 ? (
                            <img
                              src={allImgs[0]}
                              alt={s.nombre}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950">
                              <Scissors className="w-10 h-10 text-zinc-700" />
                            </div>
                          )}
                          <span className="absolute top-2 left-2 text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-amber-400 border border-amber-400/30">
                            {s.categoria || 'Cortes'}
                          </span>
                          {formData.servicio_id === s.id && (
                            <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
                                <CheckCircle className="w-6 h-6 text-black" />
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Contenido */}
                        <div className={`p-4 ${ formData.servicio_id === s.id ? 'bg-amber-500/5' : 'bg-zinc-900/80' }`}>
                          <h4 className="font-black text-base text-white group-hover:text-amber-400 transition-colors mb-1 leading-tight">
                            {toSentenceCase(s.nombre)}
                          </h4>
                          {s.descripcion && (
                            <p className="text-xs text-zinc-500 line-clamp-2 mb-3 leading-relaxed">
                              {toSentenceCase(s.descripcion)}
                            </p>
                          )}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/50">
                            <div className="flex items-center gap-2">
                              {promoElegida ? (() => {
                                let promoPrecio = s.precio
                                let promoTag = ''
                                if (promoElegida.tipo === 'cumpleanos' || promoElegida.tipo === 'servicio_gratis') {
                                  promoPrecio = 0
                                  promoTag = '100% OFF'
                                } else if (promoElegida.tipo === '2x1') {
                                  const res2x1 = calcularDescuentoYPrecio2x1(s, servicios)
                                  promoPrecio = res2x1.precioFinal
                                  promoTag = res2x1.etiquetaPromo
                                } else if (promoElegida.tipo === 'descuento_porcentaje') {
                                  const pct = Number(promoElegida.valor || 50)
                                  promoPrecio = Math.max(0, s.precio * (1 - pct / 100))
                                } else {
                                  promoPrecio = Math.max(0, s.precio - Number(promoElegida.valor || 10))
                                }

                                return (
                                  <div className="flex flex-col">
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-xs text-zinc-500 line-through font-bold">{formatCurrency(s.precio)}</span>
                                      <span className="text-emerald-400 font-black text-xl tracking-tight">
                                        {formatCurrency(promoPrecio)}
                                      </span>
                                    </div>
                                    {promoTag && (
                                      <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">
                                        {promoTag}
                                      </span>
                                    )}
                                  </div>
                                )
                              })() : (
                                <span className="text-amber-400 font-black text-xl tracking-tight">{formatCurrency(s.precio)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelectedServicioForDetail(s) }}
                                className="text-[10px] font-black uppercase text-amber-500 hover:text-amber-300 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 transition-all hover:scale-105"
                              >
                                🔍 Info
                              </button>
                              <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-amber-500"/> {s.duracion_minutos} min
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

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
                    .map((b) => {
                      const asisHoy = asistenciasHoy.find(a => a.profile_id === b.id)
                      const tienePermisoHoy = permisosHoy.some(p => p.barbero_id === b.id && p.fecha <= hoy && (p.fecha_fin ? p.fecha_fin >= hoy : p.fecha === hoy))
                      const estaPresenteHoy = asisHoy?.hora_entrada && !asisHoy?.hora_salida && asisHoy?.estado !== 'permiso' && asisHoy?.estado !== 'falta'

                      // Determinar el día de la semana correspondiente (hoy o la fecha elegida si ya fue seleccionada)
                      const targetDiaSemana = (() => {
                        if (formData.fecha) {
                          try {
                            const [y, m, d] = formData.fecha.split('-').map(Number)
                            return new Date(y, m - 1, d).getDay()
                          } catch {
                            return getDiaHoyLaPaz()
                          }
                        }
                        return getDiaHoyLaPaz()
                      })()

                      const esMismoDiaHoy = !formData.fecha || formData.fecha === hoy
                      const nombresDiasCortos = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
                      const diaPrefijo = esMismoDiaHoy ? 'Hoy' : nombresDiasCortos[targetDiaSemana]

                      const horarioConfig = barberoHorarios.find(
                        h => h.barbero_id === b.id && Number(h.dia_semana) === targetDiaSemana
                      )

                      let horarioTexto = ''
                      let horarioDisponible = true

                      if (tienePermisoHoy || asisHoy?.estado === 'permiso') {
                        horarioTexto = 'Permiso Justificado'
                        horarioDisponible = false
                      } else if (asisHoy?.estado === 'falta') {
                        horarioTexto = 'Ausente Hoy'
                        horarioDisponible = false
                      } else if (horarioConfig) {
                        if (!horarioConfig.activo) {
                          horarioTexto = `${diaPrefijo}: No atiende`
                          horarioDisponible = false
                        } else {
                          const ini = horarioConfig.hora_inicio ? horarioConfig.hora_inicio.slice(0, 5) : '08:30'
                          const fin = horarioConfig.hora_fin ? horarioConfig.hora_fin.slice(0, 5) : '20:30'
                          horarioTexto = `${diaPrefijo}: ${ini} - ${fin}`
                        }
                      } else {
                        // Horario por defecto si aún no está registrado
                        if (targetDiaSemana === 0) {
                          horarioTexto = `${diaPrefijo}: No atiende`
                          horarioDisponible = false
                        } else {
                          horarioTexto = `${diaPrefijo}: 08:30 - 20:30`
                        }
                      }

                      return (
                        <div
                          key={b.id}
                          onClick={() => {
                            setFormData({ ...formData, barbero_id: b.id, fecha: '', hora: '' })
                            setTimeout(() => setStep(3), 250)
                          }}
                          className={`flex flex-col items-center gap-3 p-4 sm:p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300 group hover:-translate-y-1 ${
                            formData.barbero_id === b.id
                              ? 'border-amber-500 bg-amber-500/10 scale-105 shadow-[0_0_25px_rgba(245,158,11,0.2)]'
                              : 'border-zinc-800 hover:border-amber-500/40 bg-black/50 hover:bg-zinc-800/80'
                          }`}
                        >
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-zinc-950 border-4 border-zinc-800 relative group-hover:border-amber-500/50 transition-colors">
                            {formData.barbero_id === b.id && <div className="absolute inset-0 border-4 border-amber-500 rounded-full z-10" />}
                            {b.avatar_url ? (
                              <img src={b.avatar_url} alt={b.full_name} className="w-full h-full object-cover relative z-0" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl font-black bg-zinc-900 text-zinc-600 relative z-0">{b.full_name.charAt(0)}</div>
                            )}
                          </div>
                          <div className="text-center w-full">
                            <h3 className="font-black text-sm sm:text-base text-white group-hover:text-amber-400 transition-colors truncate">{toTitleCase(b.full_name)}</h3>
                            
                            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                              {tienePermisoHoy || asisHoy?.estado === 'permiso' ? (
                                <span className="inline-block text-[9px] uppercase tracking-wider text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
                                  🟡 Permiso
                                </span>
                              ) : asisHoy?.estado === 'falta' ? (
                                <span className="inline-block text-[9px] uppercase tracking-wider text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
                                  🔴 Ausente
                                </span>
                              ) : estaPresenteHoy ? (
                                <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-400 font-black bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Atendiendo Hoy
                                </span>
                              ) : (
                                <span className="inline-block text-[9px] uppercase tracking-wider text-amber-500 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                                  Especialista
                                </span>
                              )}
                            </div>

                            {/* Horario disponible del día */}
                            <div className={`mt-2.5 flex items-center justify-center gap-1.5 py-1 px-2 rounded-xl border text-[10px] sm:text-[11px] font-bold transition-colors ${
                              !horarioDisponible
                                ? 'bg-zinc-900/60 text-zinc-500 border-zinc-800'
                                : 'bg-zinc-900/80 text-zinc-300 border-white/5 group-hover:border-amber-500/30 group-hover:text-amber-300 group-hover:bg-amber-500/10'
                            }`}>
                              <Clock className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${!horarioDisponible ? 'text-zinc-600' : 'text-amber-500'}`} />
                              <span className="truncate">{horarioTexto}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
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
          {/* PASO 3: FECHA Y HORA (DISEÑO EMBEBIDO TIPO CALENDLY / CAL.COM) */}
          {step === 3 && (
            <Card className="bg-zinc-900/90 backdrop-blur-xl border-zinc-800/80 shadow-2xl rounded-3xl overflow-hidden">
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h2 className="text-2xl sm:text-3xl font-black mb-6 text-center tracking-tight">Fecha y <span className="text-amber-500">Hora</span></h2>
                
                <div className="max-w-xl mx-auto space-y-8">
                  {/* 1. CALENDARIO EMBEBIDO (SIN POPUPS NATIVOS) */}
                  <div className="flex flex-col items-center">
                    <InlineCalendarPicker
                      selectedDate={formData.fecha}
                      onSelectDate={(f) => setFormData(p => ({ ...p, fecha: f, hora: '' }))}
                      minDate={hoy}
                    />
                  </div>

                  {/* 2. HORARIOS DISPONIBLES DE LA FECHA SELECCIONADA */}
                  {formData.fecha && (
                    <div className="animate-in fade-in slide-in-from-bottom-6 duration-400 space-y-5 pt-4 border-t border-zinc-800/80">
                      {/* Subheader con la fecha y duración */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                        <div>
                          <span className="text-base sm:text-lg font-black text-white capitalize block">
                            {(() => {
                              try {
                                const [y, m, d] = formData.fecha.split('-').map(Number)
                                return format(new Date(y, m - 1, d), 'EEEE d MMMM', { locale: es })
                              } catch (_) {
                                return formData.fecha
                              }
                            })()}
                          </span>
                          <span className="text-xs text-zinc-400">
                            🕒 {rangoHorario.inicio} a {rangoHorario.fin} · ⏱️ {duracionServicioMin} min
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {loadingDisponibilidad && (
                            <span className="text-amber-500 text-xs animate-pulse bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 font-bold">
                              Consultando agenda...
                            </span>
                          )}
                          {promoElegida?.tipo === '2x1' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-xs font-black text-amber-300 shadow-sm">
                              ✂️ 2×1: {config2x1.hora_inicio} - {config2x1.hora_fin}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Aviso si 2x1 está seleccionado y el día no es Martes */}
                      {promoElegida?.tipo === '2x1' && (() => {
                        try {
                          const [y, m, d] = formData.fecha.split('-').map(Number)
                          const diaSem = new Date(y, m - 1, d).getDay()
                          if (diaSem !== (config2x1.dia_semana ?? 2)) {
                            return (
                              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 font-bold flex items-center gap-2 animate-in fade-in">
                                <span>⚠️</span>
                                <span>Has activado la promoción 2×1. Recuerda que aplica exclusivamente los días <strong>Martes</strong>. Selecciona un Martes en el calendario para confirmar.</span>
                              </div>
                            )
                          }
                        } catch (_) {}
                        return null
                      })()}

                      {!disponibleAgenda ? (
                        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-center">
                          <p className="text-red-300 font-black text-base mb-1">⚠️ Barbero No Disponible</p>
                          <p className="text-red-200/80 text-sm">{motivoAgenda || 'El barbero no atiende en esta fecha o se encuentra en su día libre.'}</p>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {/* Selector de modo: Horarios Disponibles vs Reloj de Hora Exacta */}
                          <div className="flex p-1 bg-black/60 border border-zinc-800 rounded-2xl max-w-xs mx-auto shadow-inner">
                            <button
                              type="button"
                              onClick={() => setModoHoraLibre(false)}
                              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                                !modoHoraLibre
                                  ? 'bg-amber-500 text-black shadow-md'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span>Horarios</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setModoHoraLibre(true)
                                if (!formData.hora) {
                                  const primerLibre = getSmartSlotsDisponibles().find(s => s.disponible)
                                  if (primerLibre) setFormData(p => ({ ...p, hora: primerLibre.hora }))
                                }
                              }}
                              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                                modoHoraLibre
                                  ? 'bg-amber-500 text-black shadow-md'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Reloj Libre</span>
                            </button>
                          </div>

                          {modoHoraLibre ? (
                            /* MODO RELOJ PERSONALIZADO */
                            <div className="max-w-md mx-auto p-6 bg-black/40 border border-zinc-800 rounded-3xl space-y-6 animate-in fade-in">
                              <div className="text-center">
                                <span className="text-xs font-black uppercase text-amber-500 tracking-widest block mb-1">⏰ Reloj de Hora Exacta</span>
                                <p className="text-xs text-zinc-400">Elige el minuto exacto a la que deseas iniciar tu atención.</p>
                              </div>

                              <div className="flex flex-col items-center gap-4">
                                <input
                                  type="time"
                                  value={formData.hora}
                                  min={rangoHorario.inicio}
                                  max={rangoHorario.fin}
                                  onChange={(e) => {
                                    setFormData(p => ({ ...p, hora: e.target.value }))
                                  }}
                                  className="bg-zinc-900 border-2 border-amber-500/40 text-amber-400 text-3xl font-mono font-black px-6 py-3 rounded-2xl outline-none focus:border-amber-400 text-center shadow-inner"
                                />

                                {/* Botones de ajuste rápido +/- 5 min y 15 min */}
                                <div className="flex flex-wrap justify-center gap-2">
                                  {[-15, -5, +5, +15].map((delta) => (
                                    <button
                                      key={delta}
                                      type="button"
                                      onClick={() => {
                                        const base = formData.hora ? timeStringToMinutes(formData.hora) : timeStringToMinutes(rangoHorario.inicio)
                                        const nuevo = Math.max(timeStringToMinutes(rangoHorario.inicio), Math.min(timeStringToMinutes(rangoHorario.fin), base + delta))
                                        setFormData(p => ({ ...p, hora: minutesToTimeString(nuevo) }))
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition"
                                    >
                                      {delta > 0 ? `+${delta}m` : `${delta}m`}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Validación en vivo de la hora elegida */}
                              {formData.hora && (() => {
                                const val = validarHoraSeleccionada(formData.hora)
                                const [hIni, mIni] = config2x1.hora_inicio.split(':').map(Number)
                                const [hFin, mFin] = config2x1.hora_fin.split(':').map(Number)
                                const [hCur, mCur] = formData.hora.split(':').map(Number)
                                const minCur = hCur * 60 + mCur
                                const minIni = hIni * 60 + (mIni || 0)
                                const minFin = hFin * 60 + (mFin || 0)
                                const es2x1Val = minCur >= minIni && minCur <= minFin
                                const es2x1Inval = promoElegida?.tipo === '2x1' && !es2x1Val
                                const horaFinCalculada = minutesToTimeString(timeStringToMinutes(formData.hora) + duracionServicioMin)
                                const hora12 = formatTime12h(formData.hora)
                                const horaFin12 = formatTime12h(horaFinCalculada)

                                if (es2x1Inval) {
                                  return (
                                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center text-xs text-amber-300">
                                      ⚠️ La promo 2×1 solo aplica de {config2x1.hora_inicio} a {config2x1.hora_fin}. Puedes continuar sin 2×1 o ajustar la hora.
                                    </div>
                                  )
                                }

                                if (!val.disponible) {
                                  const esAnticipacion = val.motivo?.includes('anticipación')
                                  return (
                                    <div className={`p-4 rounded-2xl text-center text-xs space-y-2 ${esAnticipacion ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                                      <p className={`font-bold ${esAnticipacion ? 'text-amber-300' : 'text-red-300'}`}>
                                        {esAnticipacion ? '⏰' : '❌'} Horario no disponible
                                      </p>
                                      <p className={esAnticipacion ? 'text-amber-300/80' : 'text-red-300/80'}>{val.motivo}</p>
                                      {esAnticipacion && (
                                        <p className="text-amber-200/70 mt-1">
                                          💈 Puedes acercarte directamente a la barbería y consultar los horarios disponibles del día para atención presencial.
                                        </p>
                                      )}
                                    </div>
                                  )
                                }

                                return (
                                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center text-xs text-emerald-300 space-y-1">
                                    <p className="font-bold">✅ ¡Horario disponible y perfecto!</p>
                                    <p className="text-emerald-300/80">
                                      Tu cita iniciará a las <strong>{hora12}</strong> y terminará a las <strong>{horaFin12}</strong> ({duracionServicioMin} min).
                                    </p>
                                  </div>
                                )
                              })()}
                            </div>
                          ) : (
                            /* MODO CUADRÍCULA DE HORARIOS RÁPIDOS */
                            (() => {
                              const slotsTodos = getSmartSlotsDisponibles()
                              const slotsLibres = slotsTodos.filter(s => s.disponible)

                              if (slotsTodos.length === 0) {
                                return (
                                  <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-3xl text-center max-w-md mx-auto space-y-3 animate-in fade-in">
                                    <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-400">
                                      <Clock className="w-6 h-6" />
                                    </div>
                                    <div>
                                      <p className="text-amber-300 font-black text-sm uppercase tracking-wider mb-1">
                                        {tiempoMinimoReserva >= 1440
                                          ? '📅 Reservas online con 1 día de anticipación'
                                          : `⏰ Reservas online con anticipación de ${tiempoMinimoReserva >= 60 ? `${Math.round(tiempoMinimoReserva / 60)} hr(s)` : `${tiempoMinimoReserva} min`}`}
                                      </p>
                                      <p className="text-zinc-300 text-xs leading-relaxed">
                                        No hay cupos disponibles online para esta fecha debido a las reglas de anticipación mínima o agenda completa.
                                      </p>
                                    </div>
                                    <div className="pt-3 border-t border-amber-500/20 text-left bg-black/40 p-3.5 rounded-2xl">
                                      <p className="text-amber-400 font-bold text-xs flex items-center gap-1.5 mb-1">
                                        <span>💈</span> ¡Puedes acercarte directamente a la barbería!
                                      </p>
                                      <p className="text-zinc-400 text-[11px] leading-snug">
                                        Atendemos por orden de llegada según la disponibilidad de nuestros barberos en el local.
                                      </p>
                                    </div>
                                  </div>
                                )
                              }

                              return (
                                <div className="space-y-4">
                                  {/* Leyenda de Horarios */}
                                  <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-black uppercase tracking-wider text-zinc-400 bg-black/40 py-2 px-4 rounded-xl border border-zinc-800/60 max-w-xs sm:max-w-sm mx-auto">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                                      <span className="text-zinc-200">Libre</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                                      <span className="text-zinc-200">Ocupado</span>
                                    </div>
                                    {promoElegida?.tipo === '2x1' && (
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                        <span className="text-amber-400">2×1</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                    {slotsTodos.map((slot) => {
                                      const hora = slot.hora
                                      const hora12 = formatTime12h(hora)
                                      
                                      const [hIni, mIni] = config2x1.hora_inicio.split(':').map(Number)
                                      const [hFin, mFin] = config2x1.hora_fin.split(':').map(Number)
                                      const [hCur, mCur] = hora.split(':').map(Number)
                                      const minCur = hCur * 60 + mCur
                                      const minIni = hIni * 60 + (mIni || 0)
                                      const minFin = hFin * 60 + (mFin || 0)
                                      const es2x1HoraValida = minCur >= minIni && minCur <= minFin
                                      const is2x1DisabledSlot = promoElegida?.tipo === '2x1' && !es2x1HoraValida
                                      const esOcupado = !slot.disponible

                                      if (esOcupado) {
                                        return (
                                          <button
                                            key={hora}
                                            type="button"
                                            onClick={() => {
                                              toastError(`El horario de las ${hora12} no está disponible (${slot.motivo || 'ya se encuentra reservado u ocupado'}). Por favor selecciona un horario libre en verde.`)
                                            }}
                                            className="py-3.5 px-3 rounded-2xl text-xs font-black transition-all duration-200 flex flex-col items-center justify-center relative bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50 cursor-pointer active:scale-95 group"
                                          >
                                            <span className="text-sm tracking-wide line-through decoration-red-500/60 opacity-80">{hora12}</span>
                                            <span className="text-[8px] font-black text-red-400 uppercase tracking-tight mt-0.5 flex items-center gap-0.5">
                                              🔴 Ocupado
                                            </span>
                                          </button>
                                        )
                                      }

                                      return (
                                        <button
                                          key={hora}
                                          type="button"
                                          onClick={() => {
                                            if (is2x1DisabledSlot) {
                                              toastError(`La promo 2×1 solo aplica de ${config2x1.hora_inicio} a ${config2x1.hora_fin}. Para reservar a las ${hora12}, desactiva la promo 2×1 en el paso 1.`)
                                              return
                                            }
                                            setFormData({ ...formData, hora })
                                            if (promoElegida?.tipo !== '2x1' || modo2x1 !== 'acompanante') {
                                              setTimeout(() => setStep(4), 300)
                                            }
                                          }}
                                          className={`py-3.5 px-3 rounded-2xl text-xs font-black transition-all duration-200 flex flex-col items-center justify-center relative ${
                                            formData.hora === hora
                                              ? 'bg-amber-500 text-black scale-[1.03] shadow-[0_0_20px_rgba(245,158,11,0.4)] ring-2 ring-amber-400'
                                              : is2x1DisabledSlot
                                                ? 'bg-zinc-900/40 text-zinc-600 border border-zinc-800/40 hover:border-zinc-700 cursor-not-allowed opacity-60'
                                                : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-amber-500/40'
                                          }`}
                                        >
                                          <span className="text-sm tracking-wide">{hora12}</span>
                                          {slot.esContinuo && (
                                            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tight mt-0.5">⚡ Continuo</span>
                                          )}
                                          {promoElegida?.tipo === '2x1' && es2x1HoraValida && (
                                            <span className="text-[8px] font-black text-amber-400 uppercase tracking-wider mt-0.5">2×1</span>
                                          )}
                                          {promoElegida?.tipo === '2x1' && !es2x1HoraValida && (
                                            <span className="text-[8px] font-medium text-zinc-600 mt-0.5">Sin 2×1</span>
                                          )}
                                        </button>
                                      )
                                    })}
                                  </div>

                                  {slotsLibres.length === 0 && (
                                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center text-xs text-amber-300 space-y-1 mt-3">
                                      <p className="font-bold">💈 Toda la agenda online de esta fecha está ocupada</p>
                                      <p className="text-zinc-300 text-[11px]">
                                        Todos los turnos arriba figuran en rojo por estar ocupados o por regla de anticipación. Puedes acercarte directamente a la barbería para atención presencial por orden de llegada.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )
                            })()
                          )}
                        </div>
                      )}

                      {/* PANEL DE HORARIO DEL ACOMPAÑANTE EN 2x1 */}
                      {promoElegida?.tipo === '2x1' && modo2x1 === 'acompanante' && formData.hora && (
                        <div className="mt-8 p-5 sm:p-7 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black border-2 border-amber-500/50 rounded-3xl shadow-[0_0_40px_rgba(245,158,11,0.15)] space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
                                <Users className="w-6 h-6" />
                              </div>
                              <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 block">
                                  Promoción 2×1 · 2da Cita Gratis (Bs 0)
                                </span>
                                <h3 className="text-lg font-black text-white">
                                  Horario de {acompanante.nombre || 'tu Acompañante'}
                                </h3>
                              </div>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black self-start sm:self-center">
                              ✓ Horario bloqueado en agenda
                            </span>
                          </div>

                          {/* Selector de las 3 Opciones */}
                          <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-zinc-400 block">
                              ¿Cómo desean atenderse?
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              {/* Opción 1: Consecutivo */}
                              <button
                                type="button"
                                onClick={() => setAcompModo('consecutivo')}
                                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                                  acompModo === 'consecutivo'
                                    ? 'border-amber-500 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.2)] ring-1 ring-amber-400'
                                    : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 text-zinc-400 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                                    <span>⏰</span> Mismo Barbero
                                  </span>
                                  {acompModo === 'consecutivo' && <Check className="w-4 h-4 text-amber-400" />}
                                </div>
                                <p className="text-[11px] text-zinc-400 leading-tight">
                                  Uno tras otro. Tu acompañante espera al mismo barbero al terminar tu turno.
                                </p>
                              </button>

                              {/* Opción 2: Simultáneo */}
                              <button
                                type="button"
                                onClick={() => setAcompModo('simultaneo')}
                                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                                  acompModo === 'simultaneo'
                                    ? 'border-amber-500 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.2)] ring-1 ring-amber-400'
                                    : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 text-zinc-400 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                                    <span>✂️</span> Al Mismo Tiempo
                                  </span>
                                  {acompModo === 'simultaneo' && <Check className="w-4 h-4 text-amber-400" />}
                                </div>
                                <p className="text-[11px] text-zinc-400 leading-tight">
                                  Juntos a la misma hora con otro especialista disponible en el local.
                                </p>
                              </button>

                              {/* Opción 3: Personalizado */}
                              <button
                                type="button"
                                onClick={() => setAcompModo('personalizado')}
                                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                                  acompModo === 'personalizado'
                                    ? 'border-amber-500 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.2)] ring-1 ring-amber-400'
                                    : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 text-zinc-400 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                                    <span>🗓️</span> Otra Hora en 2×1
                                  </span>
                                  {acompModo === 'personalizado' && <Check className="w-4 h-4 text-amber-400" />}
                                </div>
                                <p className="text-[11px] text-zinc-400 leading-tight">
                                  Elige otra hora y especialista dentro del horario 2×1 ({config2x1.hora_inicio} - {config2x1.hora_fin}).
                                </p>
                              </button>
                            </div>
                          </div>

                          {/* Detalle según modo seleccionado */}
                          {acompModo === 'consecutivo' && (() => {
                            const barberoTitular = barberos.find(b => b.id === formData.barbero_id)
                            const consecutivo = minutesToTimeString(timeStringToMinutes(formData.hora) + duracionServicioMin)
                            const horaFinConsecutivo = minutesToTimeString(timeStringToMinutes(consecutivo) + duracionServicioMin)
                            const val = validarSlotAcompanante(consecutivo, formData.barbero_id)

                            return (
                              <div className="p-4 bg-zinc-950/80 rounded-2xl border border-white/5 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-0.5">
                                      Especialista Asignado:
                                    </span>
                                    <p className="text-sm font-black text-white flex items-center gap-2">
                                      <span>💈</span> {barberoTitular?.full_name || 'Mismo Especialista'}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-3 bg-black/60 px-4 py-2 rounded-xl border border-white/5">
                                    <div>
                                      <span className="text-[9px] font-black uppercase text-zinc-500 block">Tu Turno</span>
                                      <span className="text-xs font-black text-zinc-300">{formatTime12h(formData.hora)}</span>
                                    </div>
                                    <span className="text-amber-500 font-bold">➔</span>
                                    <div>
                                      <span className="text-[9px] font-black uppercase text-amber-400 block">Acompañante</span>
                                      <span className="text-sm font-black text-amber-400">{formatTime12h(consecutivo)}</span>
                                    </div>
                                  </div>
                                </div>

                                {val.disponible ? (
                                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-300">
                                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>
                                      ¡Excelente! {toTitleCase(barberoTitular?.full_name || 'El especialista')} tiene libre el turno de las {formatTime12h(consecutivo)} a {formatTime12h(horaFinConsecutivo)} para atender a {acompanante.nombre || 'tu acompañante'}.
                                    </span>
                                  </div>
                                ) : (
                                  <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2 text-xs">
                                    <p className="font-black text-red-400 flex items-center gap-2">
                                      <AlertTriangle className="w-4 h-4 shrink-0" />
                                      <span>Turno consecutivo ({formatTime12h(consecutivo)}) no disponible con este especialista</span>
                                    </p>
                                    <p className="text-zinc-300 text-[11px] leading-relaxed">
                                      {val.motivo || 'El especialista ya tiene otra reserva en ese horario o excede la ventana de la promoción 2×1'}.
                                      Te sugerimos cambiar a la opción <strong>"Al Mismo Tiempo"</strong> para cortarse juntos con otro barbero o elegir <strong>"Otra Hora en 2×1"</strong>.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {acompModo === 'simultaneo' && (() => {
                            const otrosBarberos = barberos.filter(b => b.id !== formData.barbero_id)

                            return (
                              <div className="p-4 bg-zinc-950/80 rounded-2xl border border-white/5 space-y-4">
                                <div>
                                  <p className="text-xs text-zinc-300 font-medium">
                                    Tú te atenderás a las <strong className="text-amber-400">{formatTime12h(formData.hora)}</strong> con {barberos.find(b => b.id === formData.barbero_id)?.full_name}.
                                    Elige qué especialista atenderá a <strong className="text-white">{acompanante.nombre || 'tu acompañante'}</strong> a la misma hora:
                                  </p>
                                </div>

                                {otrosBarberos.length === 0 ? (
                                  <p className="text-xs text-zinc-500 italic">No hay otros especialistas registrados en el local.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {otrosBarberos.map(b => {
                                      const val = validarSlotAcompanante(formData.hora, b.id)
                                      const isSelected = acompBarberoId === b.id

                                      return (
                                        <button
                                          key={b.id}
                                          type="button"
                                          disabled={!val.disponible}
                                          onClick={() => {
                                            setAcompBarberoId(b.id)
                                            setAcompHora(formData.hora)
                                          }}
                                          className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                                            isSelected
                                              ? 'border-amber-500 bg-amber-500/20 ring-2 ring-amber-400 shadow-lg'
                                              : val.disponible
                                                ? 'border-zinc-800 bg-zinc-900/90 hover:border-amber-500/50 hover:bg-zinc-800/80 cursor-pointer'
                                                : 'border-zinc-800/50 bg-zinc-950/40 opacity-50 cursor-not-allowed'
                                          }`}
                                        >
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-950 border-2 border-zinc-700 shrink-0">
                                              {b.avatar_url ? (
                                                <img src={b.avatar_url} alt={b.full_name} className="w-full h-full object-cover" />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center font-bold text-zinc-500 text-xs bg-zinc-900">
                                                  {b.full_name.charAt(0)}
                                                </div>
                                              )}
                                            </div>
                                            <div>
                                              <h4 className="font-black text-xs text-white truncate">{toTitleCase(b.full_name)}</h4>
                                              <span className={`text-[10px] font-bold block mt-0.5 ${val.disponible ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {val.disponible ? `✅ Libre a las ${formatTime12h(formData.hora)}` : '🔴 Ocupado a esta hora'}
                                              </span>
                                            </div>
                                          </div>
                                          {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {acompModo === 'personalizado' && (() => {
                            return (
                              <div className="p-4 bg-zinc-950/80 rounded-2xl border border-white/5 space-y-4">
                                <div>
                                  <label className="text-xs font-black uppercase tracking-wider text-zinc-400 block mb-2">
                                    1. Especialista para tu acompañante:
                                  </label>
                                  <div className="flex flex-wrap gap-2">
                                    {barberos.map(b => (
                                      <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => {
                                          setAcompBarberoId(b.id)
                                          setAcompHora('')
                                        }}
                                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all border ${
                                          acompBarberoId === b.id
                                            ? 'border-amber-500 bg-amber-500 text-black shadow-md'
                                            : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                                        }`}
                                      >
                                        {toTitleCase(b.full_name)}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {acompBarberoId && (() => {
                                  const disp = acompBarberoId === formData.barbero_id
                                    ? {
                                        ocupados: [...horasOcupadas, ...(formData.hora ? [{ hora: formData.hora, duracion: duracionServicioMin }] : [])],
                                        rangoInicio: rangoHorario.inicio,
                                        rangoFin: rangoHorario.fin,
                                        disponible: disponibleAgenda,
                                        turnos: turnosAgenda
                                      }
                                    : {
                                        ocupados: disponibilidadBarberos[acompBarberoId]?.ocupados || [],
                                        rangoInicio: disponibilidadBarberos[acompBarberoId]?.hora_inicio || '09:00',
                                        rangoFin: disponibilidadBarberos[acompBarberoId]?.hora_fin || '20:00',
                                        disponible: disponibilidadBarberos[acompBarberoId]?.disponible !== false,
                                        turnos: disponibilidadBarberos[acompBarberoId]?.turnos
                                      }

                                  const slots = generateSmartSlots({
                                    rangoInicio: disp.rangoInicio || '09:00',
                                    rangoFin: disp.rangoFin || '20:00',
                                    ocupados: disp.ocupados,
                                    duracionServicio: duracionServicioMin,
                                    pasoMinutos: 15,
                                    fecha: formData.fecha,
                                    tiempoMinimoReserva,
                                    turnos: disp.turnos
                                  })

                                  const [hIni, mIni] = config2x1.hora_inicio.split(':').map(Number)
                                  const [hFin, mFin] = config2x1.hora_fin.split(':').map(Number)
                                  const minIni = hIni * 60 + (mIni || 0)
                                  const minFin = hFin * 60 + (mFin || 0)

                                  const slots2x1 = slots.filter(s => {
                                    const min = timeStringToMinutes(s.hora)
                                    return min >= minIni && min <= minFin
                                  })

                                  return (
                                    <div className="space-y-3 pt-2 border-t border-zinc-800">
                                      <div className="flex items-center justify-between">
                                        <label className="text-xs font-black uppercase tracking-wider text-zinc-400 block">
                                          2. Horario disponible para {acompanante.nombre || 'el acompañante'}:
                                        </label>
                                        <span className="text-[10px] text-amber-400 font-bold">
                                          Horario 2×1: {config2x1.hora_inicio} - {config2x1.hora_fin}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {slots2x1.map(slot => {
                                          const hora12 = formatTime12h(slot.hora)
                                          const isSelected = acompHora === slot.hora
                                          const esOcupado = !slot.disponible || (acompBarberoId === formData.barbero_id && slot.hora === formData.hora)

                                          if (esOcupado) {
                                            return (
                                              <div
                                                key={slot.hora}
                                                className="py-2.5 px-2 rounded-xl text-xs font-bold text-center bg-red-500/10 text-red-400 border border-red-500/20 line-through opacity-60"
                                              >
                                                {hora12}
                                              </div>
                                            )
                                          }

                                          return (
                                            <button
                                              key={slot.hora}
                                              type="button"
                                              onClick={() => setAcompHora(slot.hora)}
                                              className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all ${
                                                isSelected
                                                  ? 'bg-amber-500 text-black shadow-md ring-2 ring-amber-400 font-black'
                                                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-amber-500/40'
                                              }`}
                                            >
                                              {hora12}
                                            </button>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>
                            )
                          })()}

                          {/* Pill de confirmación del acompañante */}
                          {acompHora && acompBarberoId && (() => {
                            const barberoAcomp = barberos.find(b => b.id === acompBarberoId)
                            const val = validarSlotAcompanante(acompHora, acompBarberoId)
                            if (!val.disponible) return null

                            return (
                              <div className="p-3.5 bg-gradient-to-r from-amber-500/20 via-emerald-500/10 to-transparent border border-amber-500/40 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-base">🎫</span>
                                  <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                                      Reserva lista para {acompanante.nombre || 'el Acompañante'}
                                    </span>
                                    <p className="text-xs font-black text-white">
                                      {formatTime12h(acompHora)} con {barberoAcomp?.full_name || 'Especialista'} <span className="text-emerald-400 font-bold ml-1.5">(Bs 0 Promo 2×1)</span>
                                    </p>
                                  </div>
                                </div>
                                <span className="text-xs font-black text-amber-400 uppercase tracking-widest bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/40">
                                  Asignado
                                </span>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-12 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-zinc-800/50 pt-6">
                  <Button variant="ghost" onClick={() => setStep(2)} className="text-zinc-400 hover:text-white uppercase tracking-widest font-bold text-xs order-2 sm:order-1">
                    ← Atrás
                  </Button>
                  <div className="flex flex-col items-center sm:items-end gap-1.5 order-1 sm:order-2 w-full sm:w-auto">
                    {promoElegida?.tipo === '2x1' && modo2x1 === 'acompanante' && formData.hora && !validarSlotAcompanante(acompHora, acompBarberoId).disponible && (
                      <span className="text-[11px] font-bold text-amber-400 text-center sm:text-right">
                        ⚠️ Selecciona un horario y especialista disponible para {acompanante.nombre || 'tu acompañante'}
                      </span>
                    )}
                    <Button
                      disabled={
                        !formData.fecha ||
                        !formData.hora ||
                        !validarHoraSeleccionada(formData.hora).disponible ||
                        (promoElegida?.tipo === '2x1' && modo2x1 === 'acompanante' && (!acompBarberoId || !acompHora || !validarSlotAcompanante(acompHora, acompBarberoId).disponible))
                      }
                      onClick={() => setStep(4)}
                      className="bg-amber-500 hover:bg-amber-400 text-black font-black px-10 py-6 text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto"
                    >
                      Siguiente
                    </Button>
                  </div>
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

                    {/* BENEFICIO SERVICIO GRATIS (totalReserva === 0) */}
                    {totalReserva === 0 && (
                      <div className="mt-8 p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl space-y-2">
                        <p className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                          🎉 ¡Servicio 100% Gratuito!
                        </p>
                        <p className="text-xs text-zinc-300">
                          Tu reserva tiene un beneficio especial o 10mo corte que cubre el 100% del servicio. No requieres realizar adelantos ni adjuntar comprobante QR. Tu cita quedará confirmada al instante.
                        </p>
                      </div>
                    )}

                    {/* SELECCIÓN DE OPCIÓN DE PAGO DE RESERVA */}
                    {totalReserva > 0 && (
                      <div className="mt-8 space-y-3">
                        <label className="text-xs font-black uppercase tracking-widest text-amber-500 block">
                          💳 Elige cómo confirmar tu reserva:
                        </label>
                        {promoElegida?.tipo === '2x1' && (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-2">
                            <p className="text-[10px] font-bold text-amber-300">⚠️ La promoción 2×1 requiere pago completo del servicio por QR. La opción "Pagar en Local" no está disponible.</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <button
                            type="button"
                            onClick={() => { if (promoElegida?.tipo !== '2x1') setTipoReserva('adelanto_20') }}
                            className={`p-4 rounded-2xl border text-left transition-all ${promoElegida?.tipo === '2x1' ? 'opacity-40 cursor-not-allowed border-zinc-800 bg-zinc-950' : tipoReserva === 'adelanto_20' ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'border-zinc-800 bg-zinc-950 hover:border-amber-500/30'}`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-black text-sm text-white">Adelanto Bs 20 (QR)</span>
                              {promoElegida?.tipo !== '2x1' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-black font-black">RECOMENDADO</span>}
                            </div>
                            <p className="text-xs text-zinc-400">Tolerancia de 5 min (ni más ni menos). Cita asegurada.</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setTipoReserva('pago_total')}
                            className={`p-4 rounded-2xl border text-left transition-all ${tipoReserva === 'pago_total' ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'border-zinc-800 bg-zinc-950 hover:border-emerald-500/30'}`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-black text-sm text-emerald-400">Pagar Total 100% (QR)</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-black font-black">{promoElegida?.tipo === '2x1' ? 'OBLIGATORIO 2×1' : 'COMPLETO'}</span>
                            </div>
                            <p className="text-xs text-zinc-400">Tolerancia de 10 min en total. Cita 100% pagada y asegurada.</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => { if (promoElegida?.tipo !== '2x1') setTipoReserva('sin_adelanto') }}
                            className={`p-4 rounded-2xl border text-left transition-all ${promoElegida?.tipo === '2x1' ? 'opacity-40 cursor-not-allowed border-zinc-800 bg-zinc-950' : tipoReserva === 'sin_adelanto' ? 'border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'border-zinc-800 bg-zinc-950 hover:border-red-500/30'}`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-black text-sm text-red-400">Pagar en Local (Bs 0 QR)</span>
                              {promoElegida?.tipo === '2x1' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/30 text-red-300 font-black">NO DISPONIBLE</span>}
                            </div>
                            <p className="text-xs text-zinc-400">Estar 5 minutos antes de tu cita o el turno se pasa a otro cliente.</p>
                          </button>
                        </div>
                      </div>
                    )}

                    {tipoReserva === 'sin_adelanto' && totalReserva > 0 && (
                      <div className="mt-6 p-5 bg-red-500/10 border border-red-500/30 rounded-2xl">
                        <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-1">⚠️ Regla para Pago en Local:</p>
                        <p className="text-xs text-zinc-300 font-medium">
                          Si deseas pagar en el local, debes estar <strong>5 minutos antes</strong> de tu cita. Si llegas tarde, el turno pasará a ser atendido por otro cliente.
                        </p>
                      </div>
                    )}

                    {tipoReserva === 'adelanto_20' && totalReserva > 0 && (
                      <div className="mt-6 p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                        <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-1">✅ Beneficio Adelanto Bs 20:</p>
                        <p className="text-xs text-zinc-300 font-medium">
                          Con tu adelanto de Bs 20 tienes una tolerancia de <strong>5 min (ni más ni menos)</strong>. Tu cita queda asegurada y puedes reprogramarla sin recargo.
                        </p>
                      </div>
                    )}

                    {tipoReserva === 'pago_total' && totalReserva > 0 && (
                      <div className="mt-6 p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                        <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1">✅ Beneficio Pago Total 100%:</p>
                        <p className="text-xs text-zinc-300 font-medium">
                          Con tu pago completo del 100% tienes una tolerancia de <strong>10 min en total</strong>. Evitas trámites en caja y tu cita queda asegurada.
                        </p>
                      </div>
                    )}

                    {tipoReserva !== 'sin_adelanto' && totalReserva > 0 && (
                      <div className="mt-10 space-y-5 p-6 md:p-8 bg-zinc-950 rounded-3xl border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.03)] relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500/0 via-amber-500 to-amber-500/0"></div>
                        <p className="text-sm font-black text-center text-amber-500 mb-4 uppercase tracking-[0.2em]">Escanea y Sube tu Comprobante</p>
                        {(() => {
                          const barberoSeleccionado = barberos.find(b => b.id === formData.barbero_id)
                          const activeQr = barberoSeleccionado?.qr_code_url || qrPago
                          
                          if (!activeQr) {
                            return (
                              <div className="w-48 h-48 bg-zinc-900 rounded-2xl mx-auto flex items-center justify-center border-2 border-dashed border-zinc-800 mb-6">
                                <span className="text-xs text-zinc-600 text-center px-4 font-bold uppercase tracking-widest">QR no configurado</span>
                              </div>
                            )
                          }

                          return (
                            <div className="flex flex-col items-center mb-6">
                              <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full mb-3">
                                {barberoSeleccionado?.qr_code_url 
                                  ? `QR Personal de ${toTitleCase(barberoSeleccionado.full_name)}`
                                  : 'QR General de la Barbería'}
                              </span>
                              <div className="p-3 bg-white rounded-2xl shadow-lg shadow-white/5 mb-3">
                                <img src={activeQr} alt="QR de Pago" className="w-56 h-56 object-contain rounded-xl" />
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const response = await fetch(activeQr)
                                    const blob = await response.blob()
                                    const blobUrl = URL.createObjectURL(blob)
                                    const link = document.createElement('a')
                                    link.href = blobUrl
                                    link.download = `QR_Pago_${barberoSeleccionado?.full_name ? barberoSeleccionado.full_name.replace(/\s+/g, '_') : 'Barberia'}.png`
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                    URL.revokeObjectURL(blobUrl)
                                  } catch {
                                    window.open(activeQr, '_blank')
                                  }
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg"
                              >
                                📥 Descargar QR para Pagar
                              </button>
                            </div>
                          )
                        })()}
                        <div className="space-y-3">
                          <ImageUpload
                            label="Captura del Comprobante (Obligatorio para Confirmar)"
                            defaultImage={formData.comprobante_url || undefined}
                            onUploadSuccess={(url) => setFormData({ ...formData, comprobante_url: url })}
                            onUploadError={(err) => toastError(err)}
                          />
                          {formData.comprobante_url ? (
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-400">
                              <CheckCircle className="w-4 h-4 shrink-0" />
                              <span>✓ Comprobante adjuntado correctamente</span>
                            </div>
                          ) : (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs font-bold text-amber-400">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>Sube la captura de tu pago QR para habilitar la confirmación</span>
                            </div>
                          )}
                        </div>
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

                      {/* Detalle Acompañante 2x1 */}
                      {promoElegida?.tipo === '2x1' && modo2x1 === 'acompanante' && (
                        <div className="p-4 bg-gradient-to-r from-amber-500/15 via-zinc-900 to-black rounded-2xl border-2 border-amber-500/30 space-y-2.5">
                          <div className="flex justify-between items-center text-xs font-black text-amber-400 uppercase tracking-wider border-b border-amber-500/20 pb-2">
                            <span className="flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-amber-400" /> Acompañante 2×1
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-[10px]">
                              GRATIS (Bs 0)
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-zinc-300">
                            <span className="text-zinc-400">Nombre:</span>
                            <strong className="text-white font-black">{acompanante.nombre || '—'}</strong>
                          </div>
                          <div className="flex justify-between items-center text-xs text-zinc-300">
                            <span className="text-zinc-400">Horario:</span>
                            <strong className="text-amber-400 font-black">{formatTime12h(acompHora)} hrs</strong>
                          </div>
                          <div className="flex justify-between items-center text-xs text-zinc-300">
                            <span className="text-zinc-400">Especialista:</span>
                            <strong className="text-white font-black">{barberos.find(b => b.id === acompBarberoId)?.full_name || '—'}</strong>
                          </div>
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

                      {/* Descuento Promoción Especial */}
                      {promoElegida && servicioSeleccionado && montoDescuentoPromo > 0 && (
                        <div className="flex justify-between items-center text-sm bg-gradient-to-r from-amber-500/20 to-orange-500/10 p-4 rounded-2xl border border-amber-500/40 mt-3 shadow-inner">
                          <div className="flex flex-col">
                            <span className="text-amber-400 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                              <span>{promoElegida.icono || '🎉'}</span> {promoElegida.nombre}
                            </span>
                            {promoElegida.tipo === '2x1' && (() => {
                              const res2x1 = calcularDescuentoYPrecio2x1(servicioSeleccionado, servicios)
                              return (
                                <span className="text-[10px] text-zinc-400 mt-0.5">
                                  {res2x1.esCombo ? 'En combo solo el corte a mitad de precio' : 'Corte a mitad de precio'}
                                  {acompanante.nombre ? ` · Acompañante: ${acompanante.nombre}` : ''}
                                </span>
                              )
                            })()}
                          </div>
                          <span className="font-black text-emerald-400 text-lg">-{formatCurrency(montoDescuentoPromo)}</span>
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
                          <span className="font-black text-2xl text-white leading-none">{formatCurrency(totalReserva)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-amber-500 font-black text-sm uppercase tracking-widest">
                            {tipoReserva === 'pago_total' ? 'A Pagar Hoy (100% QR)' : tipoReserva === 'sin_adelanto' ? 'A Pagar Hoy (QR)' : 'A Pagar Hoy (Adelanto)'}
                          </span>
                          <span className="font-black text-4xl text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">{formatCurrency(anticipo)}</span>
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
      
      {/* Servicio Detail Modal */}
      <ServicioDetailModal 
        servicio={selectedServicioForDetail} 
        isOpen={!!selectedServicioForDetail}
        onClose={() => setSelectedServicioForDetail(null)} 
        onSelect={(srv) => { 
          setFormData({ ...formData, servicio_id: srv.id, barbero_id: '' })
          setTimeout(() => setStep(2), 250)
        }} 
      />

      {/* Promocion Detail Modal */}
      {selectedPromoForModal && (() => {
        const is2x1 = selectedPromoForModal.tipo === '2x1' || selectedPromoForModal.nombre?.toLowerCase().includes('2x1') || selectedPromoForModal.nombre?.toLowerCase().includes('2×1')
        const diaHoy = getDiaHoyLaPaz()
        const diaPermitido = config2x1.dia_reserva_permitido ?? 1 // 1 = Lunes
        const is2x1Bloqueado = is2x1 && config2x1.solo_reserva_lunes && diaHoy !== diaPermitido

        return (
          <ModalDetallePromocion
            promo={selectedPromoForModal}
            onClose={() => setSelectedPromoForModal(null)}
            onAplicarEnReserva={is2x1Bloqueado ? undefined : (promoId) => {
              setPromoSeleccionada(promoId)
              if (is2x1) setModo2x1('acompanante')
            }}
          />
        )
      })()}
    </div>
  )
}