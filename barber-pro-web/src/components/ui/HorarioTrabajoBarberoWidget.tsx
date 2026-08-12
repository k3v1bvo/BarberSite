'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Clock, Coffee } from 'lucide-react'

interface HorarioDia {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  activo: boolean
}

const NOMBRES_DIAS = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
]

export function HorarioTrabajoBarberoWidget({ userId }: { userId: string }) {
  const [horarios, setHorarios] = useState<HorarioDia[]>([])
  const [loading, setLoading] = useState(true)

  const hoyIndex = new Date().getDay() // 0 = Dom, 1 = Lun...

  useEffect(() => {
    if (!userId) return
    const fetchHorario = async () => {
      try {
        const res = await fetch(`/api/barberos/${userId}/horario-laboral`)
        const data = await res.json()
        if (data.horario) {
          setHorarios(data.horario)
        }
      } catch (err) {
        console.error('Error cargando horario barbero:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchHorario()
  }, [userId])

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-white/5 animate-pulse">
        <CardContent className="p-6 h-28 flex items-center justify-center">
          <p className="text-xs text-zinc-500 font-bold uppercase">Cargando tu horario...</p>
        </CardContent>
      </Card>
    )
  }

  const hoyHorario = horarios.find(h => Number(h.dia_semana) === hoyIndex)

  return (
    <Card className="bg-zinc-900 border-white/5 hover:border-amber-500/20 transition-all">
      <CardHeader className="border-b border-white/5 p-4 sm:p-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-black uppercase text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          Mi Horario de Trabajo
        </CardTitle>

        {hoyHorario ? (
          hoyHorario.activo ? (
            <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Hoy: {hoyHorario.hora_inicio?.slice(0, 5)} - {hoyHorario.hora_fin?.slice(0, 5)}
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest bg-zinc-800 text-zinc-400 border border-white/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Coffee size={12} />
              Hoy: Libre
            </span>
          )
        ) : null}
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map(diaNum => {
            const h = horarios.find(item => Number(item.dia_semana) === diaNum)
            const isToday = diaNum === hoyIndex
            const activo = h ? Boolean(h.activo) : false

            return (
              <div
                key={diaNum}
                className={`p-3 rounded-xl border text-center transition-all ${
                  isToday
                    ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20'
                    : 'bg-zinc-950/60 border-white/5'
                }`}
              >
                <p className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-amber-400' : 'text-zinc-500'}`}>
                  {NOMBRES_DIAS[diaNum]}
                </p>
                {activo ? (
                  <div className="mt-1.5">
                    <p className="text-xs font-mono font-bold text-white leading-tight">
                      {h?.hora_inicio?.slice(0, 5) || '08:30'}
                    </p>
                    <p className="text-[10px] font-mono text-zinc-400">
                      {h?.hora_fin?.slice(0, 5) || '20:30'}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mt-2">
                    Libre
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
