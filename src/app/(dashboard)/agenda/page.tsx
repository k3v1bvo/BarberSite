'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CalendarView } from '@/components/ui/CalendarView'
import { CitaDetailModal } from '@/components/ui/CitaDetailModal'
import { useAgendaCitas } from '@/hooks/useAgendaCitas'
import type { AgendaCita } from '@/lib/agenda/types'
import type { AgendaView } from '@/lib/agenda/date-range'
import { AlertCircle, CalendarDays, User } from 'lucide-react'
import Link from 'next/link'

interface BarberoOption {
  id: string
  full_name: string
}

export default function AgendaGeneralPage() {
  const router = useRouter()
  const supabase = createClient()
  const [authLoading, setAuthLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [barberos, setBarberos] = useState<BarberoOption[]>([])
  const [selectedBarbero, setSelectedBarbero] = useState('')
  const [view, setView] = useState<AgendaView>('mes')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedCita, setSelectedCita] = useState<AgendaCita | null>(null)

  const { citas, loading, error } = useAgendaCitas(view, selectedDate, null, authorized)

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

        if (role !== 'admin' && role !== 'recepcionista') {
          setAuthorized(false)
          return
        }

        setAuthorized(true)

        const { data: barberosList } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'barbero')
          .eq('is_active', true)

        if (barberosList?.length) {
          setBarberos(barberosList)
          setSelectedBarbero(barberosList[0].id)
        }
      } catch {
        setAuthorized(false)
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()
  }, [router, supabase])

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            Agenda <span className="text-amber-500">General</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">
            Todas las reservas del salón · {citas.length} en este período
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {barberos.length > 0 && (
            <div className="flex gap-2 items-center">
              <User className="w-4 h-4 text-amber-500 shrink-0" />
              <select
                value={selectedBarbero}
                onChange={(e) => setSelectedBarbero(e.target.value)}
                className="h-11 flex-1 min-w-[180px] bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none"
              >
                {barberos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.full_name}
                  </option>
                ))}
              </select>
              <Link href={`/agenda/${selectedBarbero}`}>
                <Button variant="outline" size="md" className="whitespace-nowrap font-black uppercase text-xs">
                  Individual
                </Button>
              </Link>
            </div>
          )}
          <Link href="/recepcion">
            <Button variant="secondary" size="md" className="w-full sm:w-auto font-black uppercase text-xs">
              <CalendarDays className="w-4 h-4 mr-2" />
              Recepción
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="p-4 text-red-200 text-sm">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : citas.length === 0 && !error ? (
        <Card className="border-white/5 bg-zinc-900/30">
          <CardContent className="p-12 text-center">
            <p className="text-zinc-400 font-medium">No hay citas en este período</p>
            <p className="text-zinc-600 text-sm mt-2">Prueba otro mes o semana con los controles del calendario</p>
          </CardContent>
        </Card>
      ) : (
        <CalendarView
          citas={citas}
          view={view}
          onViewChange={setView}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          mode="general"
          onCitaClick={setSelectedCita}
        />
      )}

      <CitaDetailModal cita={selectedCita} onClose={() => setSelectedCita(null)} showBarbero />
    </div>
  )
}
