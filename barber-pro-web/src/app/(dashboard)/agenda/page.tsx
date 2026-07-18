'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CalendarView } from '@/components/ui/CalendarView'
import { CitaDetailModal } from '@/components/ui/CitaDetailModal'
import { useAgendaCitas } from '@/hooks/useAgendaCitas'
import type { AgendaCita } from '@/lib/agenda/types'
import type { AgendaView } from '@/lib/agenda/date-range'
import { AlertCircle, CalendarDays, Users } from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

interface BarberoOption {
  id: string
  full_name: string
  avatar_url: string | null
}

export default function AgendaGeneralPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [authLoading, setAuthLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [barberos, setBarberos] = useState<BarberoOption[]>([])
  const [selectedBarbero, setSelectedBarbero] = useState('todos')
  const [view, setView] = useState<AgendaView>('semana')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedCita, setSelectedCita] = useState<AgendaCita | null>(null)

  const { citas, loading, error, reload } = useAgendaCitas(
    view,
    selectedDate,
    selectedBarbero === 'todos' ? null : selectedBarbero,
    authorized
  )

  // Count citas per barbero for the badge
  const citasCountByBarbero = useMemo(() => {
    const counts: Record<string, number> = {}
    citas.forEach((c) => {
      if (c.barbero_id) {
        counts[c.barbero_id] = (counts[c.barbero_id] || 0) + 1
      }
    })
    return counts
  }, [citas])

  useEffect(() => {
    const citaId = searchParams.get('cita_id')
    if (citaId && !selectedCita) {
      const fetchCita = async () => {
        const { data: cita } = await supabase
          .from('citas')
          .select(`
            id, fecha_hora, duracion_real_minutos, estado, anticipo_monto, precio, notas,
            clientes (nombre),
            servicios (nombre),
            barberos:profiles!barbero_id (id, full_name)
          `)
          .eq('id', citaId)
          .single()

        if (cita) {
          const cliente = Array.isArray(cita.clientes) ? cita.clientes[0] : cita.clientes
          const servicio = Array.isArray(cita.servicios) ? cita.servicios[0] : cita.servicios
          const barbero = Array.isArray(cita.barberos) ? cita.barberos[0] : cita.barberos
          const comprobanteMatch = cita.notas?.match(/\[Comprobante\]:\s*(https?:\/\/[^\s]+)/)

          setSelectedCita({
            id: cita.id,
            fecha_hora: cita.fecha_hora,
            duracion_minutos: cita.duracion_real_minutos || 30,
            estado: cita.estado as any,
            anticipo_monto: cita.anticipo_monto,
            precio: cita.precio,
            cliente_nombre: cliente?.nombre || 'Desconocido',
            servicio_nombre: servicio?.nombre || 'Desconocido',
            barbero_id: barbero?.id || '',
            barbero_nombre: barbero?.full_name || 'Sin asignar',
            comprobante_url: comprobanteMatch ? comprobanteMatch[1] : undefined
          })
        }
      }
      fetchCita()
    }
  }, [searchParams, supabase])

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

        if (role === 'barbero') {
          router.replace(`/agenda/${user.id}`)
          return
        }

        if (role !== 'admin' && role !== 'coordinador') {
          setAuthorized(false)
          return
        }

        setAuthorized(true)

        const { data: barberosList } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('role', 'barbero')
          .eq('is_active', true)

        if (barberosList?.length) {
          setBarberos(barberosList)
          setSelectedBarbero('todos')
        }
      } catch {
        setAuthorized(false)
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()
  }, [router, supabase])

  const handleBarberoChipClick = (barberoId: string) => {
    if (selectedBarbero === barberoId) {
      // Deselect → back to general
      setSelectedBarbero('todos')
    } else {
      setSelectedBarbero(barberoId)
    }
  }

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando agenda...</p>
      </div>
    )
  }

  if (!authorized) {
    return (
      <Card className="border-red-500/50 bg-red-500/5">
        <CardContent className="p-6 flex gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
          <div>
            <h3 className="font-bold text-red-200 mb-2">Acceso denegado</h3>
            <p className="text-red-200/70">No tienes permiso para ver la agenda general.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const selectedBarberoData = barberos.find((b) => b.id === selectedBarbero)

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 border-b border-white/5 pb-5">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white uppercase">
            Agenda{' '}
            <span className="text-amber-500">
              {selectedBarbero !== 'todos' && selectedBarberoData
                ? selectedBarberoData.full_name
                : 'General'}
            </span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1 text-sm">
            {citas.length} cita{citas.length !== 1 ? 's' : ''} en este período
          </p>
        </div>

        <Link href="/recepcion">
          <Button variant="secondary" size="md" className="w-full sm:w-auto font-black uppercase text-xs">
            <CalendarDays className="w-4 h-4 mr-2" />
            Recepción
          </Button>
        </Link>
      </div>

      {/* Barbero avatar chips - horizontal scroll on mobile */}
      {barberos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-500 tracking-widest">
            <Users className="w-3.5 h-3.5" />
            <span>Filtrar por barbero</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {/* "Todos" chip */}
            <button
              type="button"
              onClick={() => setSelectedBarbero('todos')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 border-2 shrink-0',
                selectedBarbero === 'todos'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.3)] scale-[1.02]'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-amber-500/30 hover:text-amber-400'
              )}
            >
              <span className="text-base">💈</span>
              <span>Todos</span>
              <span className={clsx(
                'text-[10px] px-1.5 py-0.5 rounded-full font-black min-w-[20px] text-center',
                selectedBarbero === 'todos'
                  ? 'bg-black/20 text-black'
                  : 'bg-white/10 text-zinc-400'
              )}>
                {citas.length}
              </span>
            </button>

            {barberos.map((b) => {
              const count = citasCountByBarbero[b.id] || 0
              const isActive = selectedBarbero === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleBarberoChipClick(b.id)}
                  className={clsx(
                    'flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 border-2 shrink-0',
                    isActive
                      ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.3)] scale-[1.02]'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-amber-500/30 hover:text-amber-400'
                  )}
                >
                  {b.avatar_url ? (
                    <img
                      src={b.avatar_url}
                      alt={b.full_name}
                      className={clsx(
                        'w-7 h-7 rounded-full object-cover shrink-0 border-2 shadow-sm',
                        isActive ? 'border-black/30' : 'border-amber-500/50'
                      )}
                    />
                  ) : (
                    <div className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 border-2 shadow-sm',
                      isActive
                        ? 'bg-black/20 text-black border-black/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                    )}>
                      {b.full_name?.charAt(0)?.toUpperCase() || 'B'}
                    </div>
                  )}
                  <span className="truncate max-w-[120px]">{b.full_name}</span>
                  {count > 0 && (
                    <span className={clsx(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-black min-w-[20px] text-center',
                      isActive ? 'bg-black/20 text-black' : 'bg-amber-500/20 text-amber-400'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="p-4 text-red-200 text-sm">{error}</CardContent>
        </Card>
      )}

      {/* Calendar */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : citas.length === 0 && !error ? (
        <Card className="border-white/5 bg-zinc-900/30">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
              <CalendarDays className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-zinc-400 font-bold text-lg">Sin citas programadas</p>
            <p className="text-zinc-600 text-sm mt-2">
              No hay citas {selectedBarbero !== 'todos' ? 'para este barbero ' : ''}en este período.
              <br />Usa los controles del calendario para navegar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <CalendarView
          citas={citas}
          view={view}
          onViewChange={setView}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          mode={selectedBarbero === 'todos' ? 'general' : 'individual'}
          onCitaClick={setSelectedCita}
          barberoNombre={selectedBarberoData?.full_name}
        />
      )}

      <CitaDetailModal
        cita={selectedCita}
        onClose={() => {
          setSelectedCita(null)
          if (searchParams.get('cita_id')) {
            router.replace('/agenda', { scroll: false })
          }
        }}
        showBarbero
        onUpdate={reload}
      />
    </div>
  )
}
