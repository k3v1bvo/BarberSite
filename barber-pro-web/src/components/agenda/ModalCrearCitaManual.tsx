'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import {
  X,
  Scissors,
  Plus,
  Search,
  UserCheck,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { generateSmartSlots, isTimeSlotAvailable, minutesToTimeString, timeStringToMinutes } from '@/lib/booking/booking-slots'

interface Servicio {
  id: string
  nombre: string
  precio: number
  duracion_minutos: number
}

interface Barbero {
  id: string
  full_name: string
  avatar_url?: string | null
}

interface Cliente {
  id: string
  nombre: string
  telefono?: string | null
  ci?: string | null
  email?: string | null
}

interface TimeSlot {
  hora: string
  disponible: boolean
  motivo?: string
}

interface ModalCrearCitaManualProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  defaultBarberoId?: string
  defaultDate?: string
}

export function ModalCrearCitaManual({
  isOpen,
  onClose,
  onSuccess,
  defaultBarberoId,
  defaultDate
}: ModalCrearCitaManualProps) {
  const supabase = createClient()
  const { success: toastSuccess, error: toastError } = useToast()

  const [modoCliente, setModoCliente] = useState<'existente' | 'nuevo'>('nuevo')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [searchCliente, setSearchCliente] = useState('')
  const [searchingClientes, setSearchingClientes] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form State
  const [clienteId, setClienteId] = useState('')
  const [nombreCliente, setNombreCliente] = useState('')
  const [telefonoCliente, setTelefonoCliente] = useState('')
  const [ciCliente, setCiCliente] = useState('')
  const [emailCliente, setEmailCliente] = useState('')
  const [servicioId, setServicioId] = useState('')
  const [barberoId, setBarberoId] = useState(defaultBarberoId || '')
  const [fechaCita, setFechaCita] = useState(defaultDate || new Date().toISOString().split('T')[0])
  const [horaCita, setHoraCita] = useState('10:00')
  const [notas, setNotas] = useState('')

  // Disponibilidad de Horarios
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [barberoDisponibleDia, setBarberoDisponibleDia] = useState(true)
  const [motivoNoDisponible, setMotivoNoDisponible] = useState('')
  const [mostrarHoraPersonalizada, setMostrarHoraPersonalizada] = useState(false)

  // Carga inicial de Servicios y Barberos
  useEffect(() => {
    if (!isOpen) return
    const loadResources = async () => {
      setLoadingData(true)
      try {
        const [servRes, barbRes] = await Promise.all([
          supabase.from('servicios').select('id, nombre, precio, duracion_minutos').eq('is_active', true).order('nombre'),
          supabase.from('profiles').select('id, full_name, avatar_url').in('role', ['barbero', 'admin', 'coordinador']).eq('is_active', true).order('full_name')
        ])

        if (servRes.data) {
          setServicios(servRes.data)
          if (servRes.data.length > 0 && !servicioId) setServicioId(servRes.data[0].id)
        }
        if (barbRes.data) {
          setBarberos(barbRes.data)
          if (barbRes.data.length > 0 && !barberoId) {
            setBarberoId(defaultBarberoId || barbRes.data[0].id)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingData(false)
      }
    }
    loadResources()
  }, [isOpen, defaultBarberoId, supabase])

  // Buscador Global de Clientes en Vivo con Debounce
  useEffect(() => {
    if (!isOpen || modoCliente !== 'existente') return

    const timer = setTimeout(async () => {
      setSearchingClientes(true)
      try {
        let query = supabase.from('clientes').select('id, nombre, telefono, ci, email')
        const q = searchCliente.trim()
        if (q) {
          query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,ci.ilike.%${q}%,email.ilike.%${q}%`).order('nombre')
        } else {
          query = query.order('created_at', { ascending: false }).limit(20)
        }

        const { data } = await query.limit(50)
        setClientes(data || [])
      } catch (err) {
        console.error('Error buscando clientes:', err)
      } finally {
        setSearchingClientes(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchCliente, isOpen, modoCliente, supabase])

  // Cargar Horarios Disponibles según perfil del Barbero y Fecha
  const fetchDisponibilidad = useCallback(async () => {
    if (!barberoId || !fechaCita) return
    setLoadingSlots(true)
    try {
      const res = await fetch(`/api/citas/disponibilidad?barbero_id=${barberoId}&fecha=${fechaCita}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al obtener disponibilidad')

      if (!data.disponible) {
        setBarberoDisponibleDia(false)
        setMotivoNoDisponible(data.motivo || 'El barbero no atiende en esta fecha')
        setSlots([])
        return
      }

      setBarberoDisponibleDia(true)
      setMotivoNoDisponible('')

      const horaInicioStr = data.hora_inicio || '09:00'
      const horaFinStr = data.hora_fin || '20:00'
      const ocupados: Array<{ hora: string; duracion: number }> = data.ocupados || []

      const srvObj = servicios.find(s => s.id === servicioId)
      const duracionServicio = srvObj?.duracion_minutos || 30

      const smartSlots = generateSmartSlots({
        rangoInicio: horaInicioStr,
        rangoFin: horaFinStr,
        ocupados: ocupados,
        duracionServicio: duracionServicio,
        pasoMinutos: 15,
        fecha: fechaCita,
        tiempoMinimoReserva: 0
      })

      setSlots(smartSlots)

      // Si la hora seleccionada no está disponible o no existe, preseleccionar la primera libre
      const horaActualValida = smartSlots.some(s => s.hora === horaCita && s.disponible)
      if (!horaActualValida) {
        const primerLibre = smartSlots.find(s => s.disponible)
        if (primerLibre) {
          setHoraCita(primerLibre.hora)
        }
      }
    } catch (err) {
      console.error('Error calculando disponibilidad:', err)
    } finally {
      setLoadingSlots(false)
    }
  }, [barberoId, fechaCita, horaCita, servicioId, servicios])

  useEffect(() => {
    if (isOpen && barberoId && fechaCita) {
      fetchDisponibilidad()
    }
  }, [isOpen, barberoId, fechaCita, servicioId, fetchDisponibilidad])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!servicioId) return toastError('Selecciona un servicio')
    if (!barberoId) return toastError('Selecciona un barbero')
    if (modoCliente === 'existente' && !clienteId) return toastError('Selecciona un cliente de la lista')
    if (modoCliente === 'nuevo' && !nombreCliente.trim()) return toastError('Ingresa el nombre del cliente')

    setSaving(true)
    try {
      const fechaHoraIso = `${fechaCita}T${horaCita}:00`

      const res = await fetch('/api/citas/crear-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: modoCliente === 'existente' ? clienteId : undefined,
          nombre_cliente: modoCliente === 'nuevo' ? nombreCliente.trim() : undefined,
          telefono_cliente: modoCliente === 'nuevo' ? telefonoCliente.trim() : undefined,
          ci_cliente: modoCliente === 'nuevo' ? ciCliente.trim() : undefined,
          email_cliente: modoCliente === 'nuevo' && emailCliente.trim() ? emailCliente.trim() : undefined,
          servicio_id: servicioId,
          barbero_id: barberoId,
          fecha_hora: fechaHoraIso,
          notas: notas.trim() || undefined
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toastSuccess('¡Cita manual agendada con éxito! El coordinador podrá cobrarla en Caja POS.')
        onSuccess()
        onClose()
      } else {
        toastError(data.error || 'Error al agendar cita manual')
      }
    } catch (err: any) {
      toastError(err.message || 'Error al procesar la cita')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-500">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">
                Agendar Cita Manual <span className="text-amber-500">(Sin Correo Obligatorio)</span>
              </h2>
              <p className="text-xs text-zinc-400">Horarios en tiempo real según disponibilidad del barbero.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Selector Modo Cliente */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 block">
              1. Cliente de la Cita
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModoCliente('nuevo')}
                className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  modoCliente === 'nuevo'
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/10'
                    : 'bg-zinc-950 border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <Plus className="w-4 h-4" /> Cliente Nuevo (Sin Correo)
              </button>
              <button
                type="button"
                onClick={() => setModoCliente('existente')}
                className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  modoCliente === 'existente'
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/10'
                    : 'bg-zinc-950 border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4" /> Buscar Cliente Global
              </button>
            </div>

            {/* FORMULARIO CLIENTE NUEVO */}
            {modoCliente === 'nuevo' && (
              <div className="p-4 bg-zinc-950 border border-white/5 rounded-xl space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">
                    Nombre Completo del Cliente <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    required
                    placeholder="Ej. Juan Pérez"
                    value={nombreCliente}
                    onChange={e => setNombreCliente(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 font-bold text-white text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">
                      Teléfono / Celular (Opcional)
                    </label>
                    <Input
                      placeholder="Ej. 77123456"
                      value={telefonoCliente}
                      onChange={e => setTelefonoCliente(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">
                      Carnet CI (Opcional)
                    </label>
                    <Input
                      placeholder="Ej. 4567890"
                      value={ciCliente}
                      onChange={e => setCiCliente(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
                    Correo Electrónico (OPCIONAL — Dejar en blanco si no tiene)
                  </label>
                  <Input
                    type="email"
                    placeholder="Dejar vacío si no tiene correo"
                    value={emailCliente}
                    onChange={e => setEmailCliente(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 text-xs text-zinc-300 focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-emerald-400/80 mt-1 font-medium">
                    ✓ No es obligatorio. Si el cliente no usa correo, el sistema creará su perfil solo con su nombre y celular.
                  </p>
                </div>
              </div>
            )}

            {/* SELECCIÓN CLIENTE EXISTENTE CON BUSCADOR GLOBAL */}
            {modoCliente === 'existente' && (
              <div className="p-4 bg-zinc-950 border border-white/5 rounded-xl space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                  <Input
                    placeholder="Buscar cliente por Nombre, CI, Teléfono o Email..."
                    value={searchCliente}
                    onChange={e => setSearchCliente(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 text-xs text-white pl-9"
                    autoFocus
                  />
                  {searchingClientes && (
                    <div className="absolute right-3 top-3">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                    </div>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {searchingClientes ? (
                    <div className="py-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> Buscando en la base de datos de clientes...
                    </div>
                  ) : clientes.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-3 text-center">
                      {searchCliente ? `No se encontraron clientes para "${searchCliente}"` : 'No hay clientes recientes.'}
                    </p>
                  ) : (
                    clientes.map(c => {
                      const isSel = clienteId === c.id
                      return (
                        <div
                          key={c.id}
                          onClick={() => setClienteId(c.id)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                            isSel
                              ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                              : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                          }`}
                        >
                          <div>
                            <p className="font-bold text-white text-sm">{c.nombre}</p>
                            <div className="flex flex-wrap gap-2 text-[10px] text-zinc-400 mt-0.5">
                              {c.ci && <span className="bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-zinc-300">CI: {c.ci}</span>}
                              {c.telefono && <span>📞 {c.telefono}</span>}
                              {c.email && <span className="text-zinc-500">✉️ {c.email}</span>}
                            </div>
                          </div>
                          {isSel && <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0" />}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN SERVICIO Y BARBERO */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 block">
              2. Servicio y Barbero
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">
                  Servicio a Realizar <span className="text-rose-500">*</span>
                </label>
                <select
                  value={servicioId}
                  onChange={e => setServicioId(e.target.value)}
                  className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-xs font-bold text-white focus:border-amber-500 outline-none"
                  required
                >
                  <option value="">-- Seleccionar Servicio --</option>
                  {servicios.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} (Bs. {s.precio} · {s.duracion_minutos} min)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">
                  Barbero Asignado <span className="text-rose-500">*</span>
                </label>
                <select
                  value={barberoId}
                  onChange={e => setBarberoId(e.target.value)}
                  className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-xs font-bold text-white focus:border-amber-500 outline-none"
                  required
                >
                  <option value="">-- Seleccionar Barbero --</option>
                  {barberos.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fecha y Selector de Horarios Disponibles */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Fecha de la Cita <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setMostrarHoraPersonalizada(!mostrarHoraPersonalizada)}
                  className="text-[10px] font-bold text-amber-400 hover:underline"
                >
                  {mostrarHoraPersonalizada ? '← Ver Horarios Disponibles' : '✏️ Ingresar Hora Manual'}
                </button>
              </div>

              <Input
                type="date"
                value={fechaCita}
                onChange={e => setFechaCita(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-xs font-bold text-white"
                required
              />

              {/* CHIPS DE HORARIOS DISPONIBLES */}
              {!mostrarHoraPersonalizada && (
                <div className="p-4 bg-zinc-950 border border-white/5 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Horarios según Perfil y Turnos:
                    </span>
                    {loadingSlots && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
                  </div>

                  {!barberoDisponibleDia ? (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-400 font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{motivoNoDisponible || 'El barbero no tiene disponibilidad en esta fecha.'}</span>
                    </div>
                  ) : loadingSlots ? (
                    <div className="py-6 text-center text-xs text-zinc-500">Cargando disponibilidad...</div>
                  ) : slots.length === 0 ? (
                    <div className="py-4 text-center text-xs text-zinc-500">No hay horarios configurados para este día.</div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
                      {slots.map(slot => {
                        const isSelected = horaCita === slot.hora
                        return (
                          <button
                            key={slot.hora}
                            type="button"
                            disabled={!slot.disponible}
                            onClick={() => setHoraCita(slot.hora)}
                            className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center ${
                              isSelected
                                ? 'bg-amber-500 text-black font-black shadow-lg shadow-amber-500/30 scale-105 ring-2 ring-amber-300'
                                : slot.disponible
                                ? 'bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-amber-500/50 hover:bg-zinc-800'
                                : 'bg-zinc-950/40 border border-zinc-900 text-zinc-700 cursor-not-allowed line-through'
                            }`}
                            title={slot.disponible ? 'Disponible' : slot.motivo || 'Ocupado'}
                          >
                            <span>{slot.hora}</span>
                            {(slot as any).esContinuo && slot.disponible && (
                              <span className="text-[7px] text-emerald-400 font-black">⚡ Continuo</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-white/5">
                    <span>Hora seleccionada: <strong className="text-amber-400 font-mono text-xs">{horaCita}</strong></span>
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span> Libre
                      <span className="inline-block w-2 h-2 rounded-full bg-zinc-700"></span> Ocupado
                    </span>
                  </div>
                </div>
              )}

              {/* INPUT MANUAL DE HORA PERSONALIZADA */}
              {mostrarHoraPersonalizada && (
                <div className="p-4 bg-zinc-950 border border-white/5 rounded-xl space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                    Hora Exacta de Atención <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="time"
                    value={horaCita}
                    onChange={e => setHoraCita(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 text-xs font-bold text-white"
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">
                Notas u Observaciones (Opcional)
              </label>
              <Input
                placeholder="Ej. Cliente preferencial / Prefiere tijera / Viene con su nieto"
                value={notas}
                onChange={e => setNotas(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-xs text-white"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider px-6 shadow-lg shadow-amber-500/20"
            >
              {saving ? 'Guardando Cita...' : '✂️ Agendar Cita Manual'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
