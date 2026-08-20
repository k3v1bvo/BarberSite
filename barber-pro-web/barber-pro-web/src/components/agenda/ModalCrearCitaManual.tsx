'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import {
  X,
  User,
  Phone,
  CreditCard,
  Mail,
  Scissors,
  Calendar,
  Clock,
  Plus,
  Search,
  UserCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

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

  useEffect(() => {
    if (!isOpen) return
    const loadResources = async () => {
      setLoadingData(true)
      try {
        const [clRes, servRes, barbRes] = await Promise.all([
          supabase.from('clientes').select('id, nombre, telefono, ci, email').order('nombre').limit(200),
          supabase.from('servicios').select('id, nombre, precio, duracion_minutos').eq('is_active', true).order('nombre'),
          supabase.from('profiles').select('id, full_name, avatar_url').in('role', ['barbero', 'admin', 'coordinador']).eq('is_active', true).order('full_name')
        ])

        if (clRes.data) setClientes(clRes.data)
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
  }, [isOpen, defaultBarberoId, defaultDate, supabase])

  if (!isOpen) return null

  const clientesFiltrados = clientes.filter(c => {
    if (!searchCliente) return true
    const q = searchCliente.toLowerCase()
    return (c.nombre || '').toLowerCase().includes(q) ||
           (c.telefono || '').includes(q) ||
           (c.ci || '').includes(q)
  })

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
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
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
              <p className="text-xs text-zinc-400">Para clientes presenciales o que no usan correo electrónico.</p>
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
                <UserCheck className="w-4 h-4" /> Buscar Cliente Existente
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

            {/* SELECCIÓN CLIENTE EXISTENTE */}
            {modoCliente === 'existente' && (
              <div className="p-4 bg-zinc-950 border border-white/5 rounded-xl space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                  <Input
                    placeholder="Buscar por nombre, teléfono o CI..."
                    value={searchCliente}
                    onChange={e => setSearchCliente(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 text-xs text-white pl-9"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {clientesFiltrados.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-3 text-center">No se encontraron clientes.</p>
                  ) : (
                    clientesFiltrados.map(c => {
                      const isSel = clienteId === c.id
                      return (
                        <div
                          key={c.id}
                          onClick={() => setClienteId(c.id)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                            isSel
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 font-bold'
                              : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                          }`}
                        >
                          <div>
                            <p className="font-bold">{c.nombre}</p>
                            <p className="text-[10px] text-zinc-500">
                              {c.telefono ? `Tel: ${c.telefono}` : ''} {c.ci ? `· CI: ${c.ci}` : ''} {c.email ? `· ${c.email}` : '(Sin correo)'}
                            </p>
                          </div>
                          {isSel && <CheckCircle2 className="w-4 h-4 text-amber-500" />}
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

            {/* Fecha y Hora */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">
                  Fecha de la Cita <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  value={fechaCita}
                  onChange={e => setFechaCita(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs font-bold text-white"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">
                  Hora de Atenciones <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="time"
                  value={horaCita}
                  onChange={e => setHoraCita(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs font-bold text-white"
                  required
                />
              </div>
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
