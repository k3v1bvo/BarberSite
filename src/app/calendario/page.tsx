'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/ui/Navbar'
import { CalendarView } from '@/components/ui/CalendarView'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAgendaCitas } from '@/hooks/useAgendaCitas'
import type { AgendaView } from '@/lib/agenda/date-range'
import Link from 'next/link'
import { Scissors, Calendar, Users, RefreshCw } from 'lucide-react'
import { getBarberColorClass } from '@/lib/agenda/barber-colors'

interface Barbero {
  id: string
  full_name: string
}

export default function CalendarioPublicoPage() {
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [filtroBarbero, setFiltroBarbero] = useState<string | null>(null)
  const [view, setView] = useState<AgendaView>('semana')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()

  const { citas, loading, error, reload } = useAgendaCitas(
    view,
    selectedDate,
    filtroBarbero,
    mounted
  )

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login?redirect=/calendario'
        return
      }
      setMounted(true)
    }
    init()
  }, [supabase])

  useEffect(() => {
    if (!mounted) return
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'barbero')
        .eq('is_active', true)
      setBarberos(data || [])
    }
    load()
  }, [mounted, supabase])

  const citasHoy = citas.filter((c) => {
    const d = new Date(c.fecha_hora).toDateString()
    return d === new Date().toDateString()
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 lg:py-12 space-y-8 pb-28 lg:pb-12">
        <div className="text-center space-y-4 animate-in fade-in duration-500">
          <div className="inline-flex items-center gap-2 text-amber-500 font-black uppercase tracking-[0.3em] text-xs">
            <Scissors className="w-4 h-4" />
            Barber Pro
          </div>
          <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tight">
            Calendario de <span className="text-amber-500">disponibilidad</span>
          </h1>
          <p className="text-zinc-500 max-w-2xl mx-auto">
            Consulta citas programadas y barberos activos. Para reservar tu cita, usa el flujo de reservas en línea.
          </p>
          <Link href="/reservar">
            <Button variant="primary" size="lg" className="font-black uppercase tracking-wider shadow-lg shadow-amber-500/20">
              Reservar cita
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setFiltroBarbero(null)}
            className={`px-4 py-2 rounded-full text-xs font-black uppercase transition-all ${
              !filtroBarbero ? 'bg-amber-500 text-black' : 'bg-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            Todos los barberos
          </button>
          {barberos.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setFiltroBarbero(b.id)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase transition-all border ${
                filtroBarbero === b.id
                  ? 'bg-amber-500 text-black border-amber-500'
                  : `border-white/10 ${getBarberColorClass(b.id)}`
              }`}
            >
              {b.full_name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-white/5 bg-zinc-900/50">
            <CardContent className="p-5 flex items-center gap-4">
              <Users className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500">Barberos activos</p>
                <p className="text-2xl font-black">{barberos.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/5 bg-zinc-900/50">
            <CardContent className="p-5 flex items-center gap-4">
              <Calendar className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500">Citas en período</p>
                <p className="text-2xl font-black">{citas.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/5 bg-zinc-900/50">
            <CardContent className="p-5 flex items-center gap-4">
              <RefreshCw className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500">Hoy</p>
                <p className="text-2xl font-black">{citasHoy.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-[10px] text-zinc-600 uppercase tracking-widest">
          Actualización automática cada 30 segundos
        </p>

        {error && (
          <Card className="border-red-500/30 bg-red-500/10">
            <CardContent className="p-4 text-red-200 text-sm text-center">{error}</CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : (
          <CalendarView
            citas={citas}
            view={view}
            onViewChange={setView}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            mode="general"
          />
        )}

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => reload()} className="text-zinc-500">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar ahora
          </Button>
        </div>
      </main>
    </div>
  )
}
