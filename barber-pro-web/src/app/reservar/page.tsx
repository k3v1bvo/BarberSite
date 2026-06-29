'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, User, Scissors, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { ImageUpload } from '@/components/ui/ImageUpload'

interface Servicio {
  id: string
  nombre: string
  precio: number
  duracion_minutos: number
  descripcion: string | null
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
  const { error: toastError } = useToast()
  const [step, setStep] = useState(1)
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [barberos, setBarberos] = useState<Barbero[]>([])
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

  // Cargar disponibilidad cuando cambian el barbero o la fecha
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
      // Verificar si hay usuario logueado
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name, phone')
          .eq('id', authUser.id)
          .single()

        if (profile) {
          setUser(profile as UserProfile)
          // Pre-llenar datos del usuario
          setFormData(prev => ({
            ...prev,
            nombre: profile.full_name || '',
            telefono: profile.phone || '',
            email: profile.email || '',
          }))

          // Consultar lealtad (visitas completadas)
          const { data: clienteData } = await supabase
            .from('clientes')
            .select('total_visitas')
            .eq('id', authUser.id)
            .single()

          if (clienteData) {
            const visitasActuales = clienteData.total_visitas || 0
            const enCiclo = visitasActuales % 10
            
            if (enCiclo === 4) {
              setLealtadInfo({ descuento: 0.5, mensaje: '¡5to Corte! Tienes 50% de descuento.' })
            } else if (enCiclo === 9) {
              setLealtadInfo({ descuento: 1, mensaje: '¡10mo Corte! Es totalmente GRATIS.' })
            }
          }
        }
      }

      // Cargar servicios
      const { data: serviciosData } = await supabase
        .from('servicios')
        .select('*')
        .eq('is_active', true)

      // Cargar barberos
      const { data: barberosData } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('role', 'barbero')
        .eq('is_active', true)

      // Cargar configuracion de QR
      const { data: configData } = await supabase
        .from('configuraciones')
        .select('valor')
        .eq('llave', 'qr_pago')
        .maybeSingle()
      
      if (configData?.valor) {
        setQrPago(configData.valor)
      }

      setServicios(serviciosData || [])
      setBarberos(barberosData || [])
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

    // ✅ CORREGIDO: Si hay usuario logueado, usar su ID directamente
    if (user) {
      clienteId = user.id
    } else {
      // Si no está logueado, buscar por email
      const { data: clienteExistente } = await supabase
        .from('clientes')
        .select('id')
        .eq('email', formData.email)
        .single()

      if (clienteExistente) {
        clienteId = clienteExistente.id
      } else {
        // Crear nuevo cliente SIN teléfono (para evitar duplicados)
        const { data: nuevoCliente, error: clienteError } = await supabase
          .from('clientes')
          .insert({
            nombre: formData.nombre,
            email: formData.email,
            telefono: formData.telefono,  // ✅ Guardar WhatsApp real del cliente
          })
          .select('id')
          .single()

        if (clienteError) {
          console.error('Error creando cliente:', clienteError)
          throw new Error('No se pudo crear el cliente')
        }

        clienteId = nuevoCliente?.id
      }
    }

    // Verificar que tenemos clienteId
    if (!clienteId) {
      throw new Error('No se encontró el ID del cliente')
    }

    const fechaHora = `${formData.fecha}T${formData.hora}:00`

    // ✅ ÚLTIMA VERIFICACIÓN: Evitar colisiones de último segundo
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

    // Aplicar descuento de lealtad
    let precioFinal = servicio?.precio || 0
    let notasFinales = formData.notas

    if (lealtadInfo) {
      precioFinal = precioFinal * (1 - lealtadInfo.descuento)
      const promoNota = `[PROMO: ${lealtadInfo.mensaje}]`
      notasFinales = formData.notas ? `${formData.notas}\n${promoNota}` : promoNota
    }

    const anticipoCalculado = Math.max(20, precioFinal * 0.5)
    const barbero = barberos.find((b) => b.id === formData.barbero_id)

    const { data: citaNueva, error: citaError } = await supabase
      .from('citas')
      .insert({
        cliente_id: clienteId,
        barbero_id: formData.barbero_id,
        servicio_id: formData.servicio_id,
        fecha_hora: fechaHora,
        precio: precioFinal,
        duracion_real_minutos: servicio?.duracion_minutos || 30,
        estado: 'pendiente_pago',
        notas: notasFinales,
        anticipo_monto: anticipoCalculado,
        comprobante_url: formData.comprobante_url || null,
      })
      .select('id')
      .single()

    if (citaError) {
      console.error('Error insertando cita:', citaError)
      throw new Error(citaError.message)
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
            servicioNombre: servicio?.nombre,
            fecha: formData.fecha,
            hora: formData.hora,
            monto: anticipoCalculado,
            comprobante_url: formData.comprobante_url || null,
          },
        }),
      })
    } catch (e) {
      console.error('Error al enviar notificaciones:', e)
    }

    setSuccess(true)
  } catch (error: any) {
    console.error('Error completo:', error)
    toastError('Error al reservar: ' + error.message)
  } finally {
    setSubmitting(false)
  }
}

  const servicioSeleccionado = servicios.find(s => s.id === formData.servicio_id)
  const barberoSeleccionado = barberos.find(b => b.id === formData.barbero_id)

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

  // Usar hora local para evitar problemas con UTC a fin de día
  const hoyLocal = new Date()
  const hoy = new Date(hoyLocal.getTime() - (hoyLocal.getTimezoneOffset() * 60000)).toISOString().split('T')[0]

  const checkDisponibilidad = (hora: string) => {
    if (!servicioSeleccionado) return false

    const [hrs, mins] = hora.split(':').map(Number)
    
    // Restricción de 3 horas mínimo si es hoy
    if (formData.fecha === hoy) {
      const ahora = new Date()
      const horaCita = new Date()
      horaCita.setHours(hrs, mins, 0, 0)
      
      const diffHoras = (horaCita.getTime() - ahora.getTime()) / (1000 * 60 * 60)
      if (diffHoras < 3) {
        return true // Bloqueado por anticipación
      }
    }

    // Convertir horas a minutos desde las 00:00 para facilitar comparación
    const getMinutos = (h: string) => {
      const [hs, ms] = h.split(':').map(Number)
      return hs * 60 + ms
    }

    const slotInicio = getMinutos(hora)
    const slotFin = slotInicio + servicioSeleccionado.duracion_minutos

    return horasOcupadas.some(cita => {
      const citaInicio = getMinutos(cita.hora)
      const citaFin = citaInicio + cita.duracion
      
      // Hay traslape si:
      // (Inicio1 < Fin2) Y (Inicio2 < Fin1)
      return (slotInicio < citaFin) && (citaInicio < slotFin)
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-zinc-400">
        Cargando...
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-4">
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-md text-center p-8">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-amber-400" />
          </div>

          <h2 className="text-3xl font-bold mb-3 text-amber-400">
            ¡Pago Pendiente de Verificación!
          </h2>

          <p className="text-zinc-400 mb-8">
            Hemos registrado tu reserva. Quedará confirmada una vez verifiquemos tu pago QR.
          </p>

          <Button
            onClick={() => router.push('/cliente')}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            Ver mis citas
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black py-16 px-4 text-white">
      <div className="max-w-3xl mx-auto">

        <div className="relative mb-12 flex flex-col md:flex-row items-center justify-center">
          <Button
            variant="outline"
            className="md:absolute left-0 mb-6 md:mb-0 border-white/10 text-zinc-400 hover:text-white bg-zinc-900/50"
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Cancelar
          </Button>
          <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
            Reservar Cita
          </h1>
        </div>

        {/* Usuario logueado */}
        {user && (
          <div className="text-center mb-6">
            <p className="text-zinc-400">
              👋 Hola, <span className="text-amber-400 font-bold">{user.full_name}</span>
            </p>
          </div>
        )}

        {/* Stepper */}
        <div className="flex justify-center mb-12">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step >= s
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/10 text-zinc-500'
                }`}
              >
                {s}
              </div>
              {s < 5 && (
                <div
                  className={`w-16 h-1 ${
                    step > s ? 'bg-amber-500' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* STEP 1: SERVICIO */}
        {step === 1 && (
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Scissors className="w-5 h-5 text-amber-400" />
                Selecciona un Servicio
              </h2>

              <div className="space-y-4">
                {servicios.map((servicio) => (
                  <div
                    key={servicio.id}
                    onClick={() => setFormData({ ...formData, servicio_id: servicio.id })}
                    className={`p-4 border rounded-xl cursor-pointer transition ${
                      formData.servicio_id === servicio.id
                        ? 'border-amber-400 bg-amber-500/10'
                        : 'border-white/10 hover:border-amber-400/40'
                    }`}
                  >
                    <div className="flex justify-between">
                      <div>
                        <h3 className="font-semibold">{servicio.nombre}</h3>
                        <p className="text-sm text-zinc-400">
                          ⏱ {servicio.duracion_minutos} min
                        </p>
                      </div>
                      <p className="text-xl font-bold text-amber-400">
                        {formatCurrency(servicio.precio)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-end">
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!formData.servicio_id}
                  className="bg-amber-500 hover:bg-amber-400 text-black"
                >
                  Siguiente <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: BARBERO */}
        {step === 2 && (
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-400" />
                Selecciona un Barbero
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {barberos.map((barbero) => (
                  <div
                    key={barbero.id}
                    onClick={() => setFormData({ ...formData, barbero_id: barbero.id })}
                    className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                      formData.barbero_id === barbero.id
                        ? 'border-amber-400 bg-amber-500/10 scale-[1.02]'
                        : 'border-white/10 hover:border-amber-400/40 hover:bg-white/5'
                    }`}
                  >
                    <div className="relative w-16 h-16 rounded-full overflow-hidden bg-zinc-800 border border-white/20 shrink-0 flex items-center justify-center">
                      {barbero.avatar_url ? (
                        <img 
                          src={barbero.avatar_url} 
                          alt={barbero.full_name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                             (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(barbero.full_name)}&background=f59e0b&color=000`;
                          }}
                        />
                      ) : (
                        <img 
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(barbero.full_name)}&background=f59e0b&color=000&size=128`} 
                          alt={barbero.full_name} 
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-white text-base md:text-lg">{barbero.full_name}</h3>
                      <p className="text-amber-500/80 text-xs md:text-sm font-medium">Especialista</p>
                    </div>
                    {formData.barbero_id === barbero.id && (
                      <div className="ml-auto">
                        <CheckCircle className="w-6 h-6 text-amber-500" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-between">
                <Button
                  type="button"
                  onClick={() => setStep(1)}
                  variant="outline"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
                </Button>

                <Button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!formData.barbero_id}
                  className="bg-amber-500 hover:bg-amber-400 text-black"
                >
                  Siguiente <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: FECHA Y HORA */}
        {step === 3 && (
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                Selecciona Fecha y Hora
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Fecha</label>
                  <input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    min={hoy}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white"
                  />
                </div>

                {formData.fecha && (
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Hora {loadingDisponibilidad && <span className="text-xs animate-pulse">(Cargando disponibilidad...)</span>}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {generarHorarios().map((hora) => {
                        const estaOcupado = checkDisponibilidad(hora)
                        return (
                          <button
                            key={hora}
                            type="button"
                            disabled={estaOcupado}
                            onClick={() => setFormData({ ...formData, hora })}
                            className={`p-3 rounded-lg text-sm font-medium transition ${
                              formData.hora === hora
                                ? 'bg-amber-500 text-black'
                                : estaOcupado
                                  ? 'bg-red-500/20 text-red-400 cursor-not-allowed border border-red-500/30 opacity-50'
                                  : 'bg-white/5 hover:bg-white/10 text-white'
                            }`}
                          >
                            {hora}
                            {estaOcupado && <span className="block text-[8px] uppercase">No disponible</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-between">
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  variant="outline"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
                </Button>

                <Button
                  type="button"
                  onClick={() => setStep(4)}
                  disabled={!formData.fecha || !formData.hora}
                  className="bg-amber-500 hover:bg-amber-400 text-black"
                >
                  Siguiente <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: DATOS PERSONALES */}
               {/* STEP 4: DATOS PERSONALES */}
        {step === 4 && (
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-400" />
                {user ? 'Confirma tus datos' : 'Tus datos'}
              </h2>

              <form onSubmit={(e) => { e.preventDefault(); setStep(5); }} className="space-y-4">
                <Input
                  label="Nombre completo"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  disabled={!!user}
                />

                <Input
                  label="Teléfono"
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  required
                  disabled={!!user}
                />

                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!user}
                />

                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Notas (opcional)</label>
                  <textarea
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white"
                    rows={3}
                  />
                </div>

                {/* Resumen de la reserva */}
                <div className="bg-white/5 rounded-xl p-4 mt-4">
                  <h3 className="font-bold text-amber-400 mb-2">Resumen</h3>
                  <p className="text-sm text-zinc-300">📅 {formData.fecha} a las {formData.hora}</p>
                  <p className="text-sm text-zinc-300">👨‍🎨 {barberoSeleccionado?.full_name}</p>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10">
                    <span className="text-sm text-zinc-300">✂️ {servicioSeleccionado?.nombre}</span>
                    <div className="text-right">
                       {lealtadInfo ? (
                         <>
                           <span className="text-xs text-red-400 line-through mr-2">{formatCurrency(servicioSeleccionado?.precio || 0)}</span>
                           <span className="font-bold text-green-400">{formatCurrency((servicioSeleccionado?.precio || 0) * (1 - lealtadInfo.descuento))}</span>
                           <p className="text-[10px] text-amber-400 mt-1">{lealtadInfo.mensaje}</p>
                         </>
                       ) : (
                         <span className="font-bold text-amber-400">{formatCurrency(servicioSeleccionado?.precio || 0)}</span>
                       )}
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-between">
                  <Button
                    type="button"
                    onClick={() => setStep(3)}
                    variant="outline"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
                  </Button>

                  <Button
                    type="submit"
                    disabled={submitting || !formData.nombre || !formData.telefono || !formData.email}
                    className="bg-amber-500 hover:bg-amber-400 text-black"
                  >
                    Siguiente (Pago QR)
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* STEP 5: PAGO QR */}
        {step === 5 && (
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
            <CardContent className="pt-6 text-center">
              <h2 className="text-xl font-bold mb-6 flex items-center justify-center gap-2">
                💰 Pago de Anticipo
              </h2>

              <p className="text-zinc-400 mb-6">
                Para confirmar tu cita, debes realizar un pago anticipado vía QR.
              </p>

              {qrPago ? (
                <div className="bg-white p-4 rounded-xl inline-block mb-6">
                  <img src={qrPago} alt="QR de Pago" className="w-48 h-48 object-contain" />
                </div>
              ) : (
                <div className="w-48 h-48 bg-zinc-800 rounded-xl mx-auto flex items-center justify-center mb-6">
                  <p className="text-sm text-zinc-500">QR no configurado</p>
                </div>
              )}

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-8">
                <p className="text-sm text-amber-400 mb-1">Monto a depositar:</p>
                <p className="text-3xl font-bold text-amber-500">
                  {(() => {
                    const precioOriginal = servicioSeleccionado?.precio || 0
                    const precioDesc = lealtadInfo ? precioOriginal * (1 - lealtadInfo.descuento) : precioOriginal
                    const anticipo = Math.max(20, precioDesc * 0.5)
                    return formatCurrency(anticipo)
                  })()}
                </p>
                <p className="text-xs text-zinc-400 mt-2">Mínimo 20 Bs o el 50% del servicio.</p>
              </div>

              <div className="mb-8">
                <ImageUpload
                  label="Captura del Comprobante (Requerido para confirmar)"
                  defaultImage={formData.comprobante_url || undefined}
                  onUploadSuccess={(url) => setFormData({ ...formData, comprobante_url: url })}
                  onUploadError={(err) => toastError(err)}
                />
              </div>

              <div className="flex justify-between">
                <Button
                  type="button"
                  onClick={() => setStep(4)}
                  variant="outline"
                  disabled={submitting}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
                </Button>

                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !formData.comprobante_url}
                  className="bg-amber-500 hover:bg-amber-400 text-black px-8 font-bold"
                >
                  {submitting ? 'Enviando...' : 'Enviar Reserva'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}