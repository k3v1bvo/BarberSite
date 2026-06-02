'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Clock, Users, ArrowRight, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { computeEstadoFromRecord } from '@/lib/asistencia/helpers'

interface AdminAsistenciaSummaryProps {
  onTurnosAbiertos?: (count: number) => void
}

export function AdminAsistenciaSummary({ onTurnosAbiertos }: AdminAsistenciaSummaryProps) {
  const [loading, setLoading] = useState(true)
  const [presentes, setPresentes] = useState(0)
  const [abiertos, setAbiertos] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      try {
        await fetch('/api/asistencias/auto-cerrar', { method: 'POST' })
        const hoy = new Date().toISOString().split('T')[0]
        const { data } = await supabase
          .from('asistencias')
          .select('id, hora_entrada, hora_salida, estado, profiles(full_name, role)')
          .eq('fecha', hoy)

        const staff = (data || []).filter((r) => {
          const raw = r.profiles as { role?: string } | { role?: string }[] | null
          const p = Array.isArray(raw) ? raw[0] : raw
          return p?.role && p.role !== 'admin' && p.role !== 'cliente'
        })

        let abiertosCount = 0
        let presentesCount = 0
        for (const row of staff) {
          const estado = computeEstadoFromRecord(row)
          if (estado === 'presente' || estado === 'atrasado') {
            presentesCount++
            if (!row.hora_salida) abiertosCount++
          }
        }

        setPresentes(presentesCount)
        setAbiertos(abiertosCount)
        onTurnosAbiertos?.(abiertosCount)
      } catch {
        /* silencioso */
      } finally {
        setLoading(false)
      }
    }
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [onTurnosAbiertos, supabase])

  return (
    <Card className="border-amber-500/20 bg-gradient-to-br from-zinc-900 to-zinc-950 overflow-hidden group">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h3 className="font-black uppercase tracking-widest text-sm text-white">Personal hoy</h3>
          </div>
          <Users className="w-5 h-5 text-zinc-700 group-hover:text-amber-500/50 transition-colors" />
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-black/30 border border-white/5 p-4 text-center">
              <p className="text-3xl font-black text-amber-500">{presentes}</p>
              <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mt-1">En turno</p>
            </div>
            <div className="rounded-xl bg-black/30 border border-white/5 p-4 text-center">
              <p className={`text-3xl font-black ${abiertos > 0 ? 'text-yellow-400' : 'text-white'}`}>
                {abiertos}
              </p>
              <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mt-1">Sin salida</p>
            </div>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full border-amber-500/30 text-amber-500 hover:bg-amber-500/10 uppercase font-black text-[10px] tracking-widest"
          onClick={() => router.push('/admin/asistencia')}
        >
          Panel de asistencia
          <ArrowRight className="w-3 h-3 ml-2" />
        </Button>
      </CardContent>
    </Card>
  )
}
