'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { HorariosBarberosWidget } from '@/components/cliente/HorariosBarberosWidget'
import { Clock, ArrowLeft, Scissors, Calendar, Sparkles, Users } from 'lucide-react'

export default function ClienteHorariosPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen space-y-6 animate-in fade-in duration-500 pb-24 lg:pb-12">
      {/* ══════════ ENCABEZADO Y ACCIONES RÁPIDAS ══════════ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/80 border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-md">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/cliente')}
              className="h-8 px-2.5 text-xs font-bold gap-1.5 border-white/10 hover:bg-white/5 text-zinc-300 rounded-xl"
            >
              <ArrowLeft size={14} /> Volver a Mis Citas
            </Button>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Sparkles size={11} /> Turnos en Vivo
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 tracking-tight pt-1">
            <Clock className="w-6 h-6 text-amber-500 shrink-0" />
            Horarios y Turnos de Barberos
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Revisa la disponibilidad de nuestro equipo, quiénes atienden hoy en turno mañana o tarde, y sus días libres antes de agendar.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
          <Button
            variant="primary"
            onClick={() => router.push('/reservar')}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider text-xs px-5 py-3 rounded-xl shadow-lg shadow-amber-500/20 gap-2"
          >
            <Scissors size={15} /> Reservar Cita
          </Button>
        </div>
      </div>

      {/* ══════════ CONTENEDOR EXCLUSIVO DE HORARIOS ══════════ */}
      <div className="bg-zinc-950/60 border border-white/5 rounded-3xl p-1 sm:p-2">
        <HorariosBarberosWidget
          onSelectBarbero={(barberoId) => {
            router.push(`/reservar?barbero=${barberoId}`)
          }}
        />
      </div>
    </div>
  )
}
