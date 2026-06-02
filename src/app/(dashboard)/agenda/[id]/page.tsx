'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CalendarView } from '@/components/ui/CalendarView'
import { DisponibilidadGrid } from '@/components/ui/DisponibilidadGrid'
import { CitaDetailModal } from '@/components/ui/CitaDetailModal'
import { BarberoHorarioPanel } from '@/components/ui/BarberoHorarioPanel'
import { useAgendaCitas } from '@/hooks/useAgendaCitas'
import type { AgendaCita } from '@/lib/agenda/types'
import type { AgendaView } from '@/lib/agenda/date-range'
import { startOfWeek, endOfWeek } from 'date-fns'
import { AlertCircle, ArrowLeft, Clock } from 'lucide-react'
import Link from 'next/link'

interface BarberInfo {
  id: string
  nombre: string
}

export default function AgendaIndividualPage() {
  const params = useParams()
  const router = useRouter()
  const barberoId = params.id as string
  const supabase = createClient()

  const [authLoading, setAuthLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [barberos, setBarberos] = useState<BarberInfo[]>([])
  const [barberoNombre, setBarberoNombre] = useState('')
  const [selectedBarberoId, setSelectedBarberoId] = useState(barberoId)
  const [view, setView] = useState<AgendaView>('mes')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentTab, setCurrentTab] = useState<'calendario' | 'disponibilidad' | 'horarios'>('calendario')
  const [authError, setAuthError] = useState<string | null>(null)
  const [selectedCita, setSelectedCita] = useState<AgendaCita | null>(null)
  const [slotsDisponibles, setSlotsDisponibles] = useState<string[]>([])

  const { citas, loading, error, reload } = useAgendaCitas(
    view,
    selectedDate,
    selectedBarberoId,
    authorized
  )

  useEffect(() => {
    const checkAuth = async () => {
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

        const role = profile?.role
        setUserRole(role)

        const isAdmin = role === 'admin'
        const isRecepcionista = role === 'recepcionista'
        const isOwnBarber = role === 'barbero' && user.id === barberoId

        if (!isAdmin && !isRecepcionista && !isOwnBarber) {
          setAuthError('No tienes permisos para acceder a esta agenda')
          setAuthorized(false)
          return
        }

        setAuthorized(true)
        setSelectedBarberoId(barberoId)

        if (isAdmin || isRecepcionista) {
          const { data: barberosList } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'barbero')
            .eq('is_active', true)

          if (barberosList) {
            setBarberos(
              barberosList.map((b) => ({
                id: b.id,
                nombre: b.full_name,
              }))
            )
          }
        }

        const { data: barberInfo } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', barberoId)
          .single()

        setBarberoNombre(barberInfo?.full_name || 'Barbero')
      } catch {
        setAuthError('Error al cargar la página')
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()
  }, [barberoId, router, supabase])

  useEffect(() => {
    if (!authorized || !selectedBarberoId) return

    const loadSlots = async () => {
      const fechaInicio = new Date().toISOString().split('T')[0]
      const fechaFin = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const response = await fetch(
        `/api/barberos/${selectedBarberoId}/horarios?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`
      )
      if (response.ok) {
        const data = await response.json()
        setSlotsDisponibles(data.slotsDisponibles || [])
        if (data.barbero?.nombre) setBarberoNombre(data.barbero.nombre)
      }
    }

    loadSlots()
  }, [authorized, selectedBarberoId])

  const handleBarberoChange = (id: string) => {
    setSelectedBarberoId(id)
    router.push(`/agenda/${id}`)
  }

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando agenda...</p>
      </div>
    )
  }

  if (authError) {
    return (
      <Card className="border-red-500/50 bg-red-500/5">
        <CardContent className="p-6 flex gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
          <div>
            <h3 className="font-bold text-red-200 mb-2">Error de acceso</h3>
            <p className="text-red-200/70">{authError}</p>
            <Button variant="outline" onClick={() => router.back()} className="mt-4">
              Volver
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!authorized) return null

  const showGeneralLink = userRole === 'admin' || userRole === 'recepcionista'

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          {showGeneralLink && (
            <Link
              href="/agenda"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-amber-500 mb-3 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Agenda general
            </Link>
          )}
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            Agenda <span className="text-amber-500">Individual</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">{barberoNombre}</p>
        </div>
      </div>

      {(userRole === 'admin' || userRole === 'recepcionista') && barberos.length > 0 && (
        <Card className="border-white/5 bg-zinc-900/30">
          <CardContent className="p-6">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-3">
              Barbero
            </label>
            <select
              value={selectedBarberoId}
              onChange={(e) => handleBarberoChange(e.target.value)}
              className="w-full md:w-64 h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none"
            >
              {barberos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-white/5 bg-zinc-900 shadow-xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Barbero</p>
              <p className="text-2xl font-black text-white mt-1">{barberoNombre}</p>
            </div>
            <Clock className="text-amber-500 w-6 h-6" />
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900 shadow-xl">
          <CardContent className="p-6">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Citas en período</p>
            <p className="text-4xl font-black text-blue-500 mt-1">{citas.length}</p>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900 shadow-xl">
          <CardContent className="p-6">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Slots libres (14d)</p>
            <p className="text-4xl font-black text-green-500 mt-1">{slotsDisponibles.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 border-b border-white/10">
        <button
          type="button"
          onClick={() => setCurrentTab('calendario')}
          className={`px-6 py-3 text-sm font-bold uppercase transition-all ${
            currentTab === 'calendario'
              ? 'text-amber-500 border-b-2 border-amber-500'
              : 'text-zinc-500 hover:text-white'
          }`}
        >
          Calendario
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('disponibilidad')}
          className={`px-6 py-3 text-sm font-bold uppercase transition-all ${
            currentTab === 'disponibilidad'
              ? 'text-amber-500 border-b-2 border-amber-500'
              : 'text-zinc-500 hover:text-white'
          }`}
        >
          Disponibilidad
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('horarios')}
          className={`px-6 py-3 text-sm font-bold uppercase transition-all ${
            currentTab === 'horarios'
              ? 'text-amber-500 border-b-2 border-amber-500'
              : 'text-zinc-500 hover:text-white'
          }`}
        >
          Horarios y bloqueos
        </button>
      </div>

      {(error || loading) && currentTab === 'calendario' && (
        <div>
          {error && (
            <Card className="border-red-500/50 bg-red-500/5 mb-4">
              <CardContent className="p-4 text-red-200 text-sm flex justify-between items-center gap-4">
                {error}
                <Button variant="outline" size="sm" onClick={() => reload()}>
                  Reintentar
                </Button>
              </CardContent>
            </Card>
          )}
          {loading && (
            <div className="flex justify-center h-48">
              <div className="w-10 h-10 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {currentTab === 'calendario' && !loading && (
        <CalendarView
          citas={citas}
          view={view}
          onViewChange={setView}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          barberoNombre={barberoNombre}
          mode="individual"
          onCitaClick={setSelectedCita}
        />
      )}

      {currentTab === 'horarios' && (
        <BarberoHorarioPanel
          barberoId={selectedBarberoId}
          canEdit={
            userRole === 'admin' ||
            userRole === 'recepcionista' ||
            userRole === 'barbero'
          }
        />
      )}

      {currentTab === 'disponibilidad' && (
        <DisponibilidadGrid
          slots={slotsDisponibles.map((hora) => ({ hora, disponible: true }))}
          citas={citas.map((c) => ({
            id: c.id,
            fecha_hora: c.fecha_hora,
            duracion_minutos: c.duracion_minutos,
            estado: c.estado as 'pendiente' | 'confirmado' | 'en_proceso' | 'completado' | 'cancelado',
            cliente_nombre: c.cliente_nombre,
            servicio_nombre: c.servicio_nombre,
            precio: c.precio,
          }))}
          startDate={weekStart}
          endDate={weekEnd}
          barberoNombre={barberoNombre}
        />
      )}

      <CitaDetailModal
        cita={selectedCita}
        onClose={() => setSelectedCita(null)}
        showBarbero={false}
      />
    </div>
  )
}
