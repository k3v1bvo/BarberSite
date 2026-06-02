'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Gift, Scissors, Sparkles, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LealtadMeta } from '@/lib/lealtad/helpers'

interface LoyaltyData {
  progreso: {
    visitas: number
    siguienteMeta: LealtadMeta | null
    progresoEnMeta: number
    metasDesbloqueadas: LealtadMeta[]
    slotsEnTarjeta: number
  }
  total_servicios: number
  canjes: Array<{ id: string; descripcion: string; canjeado_at: string }>
  metas: LealtadMeta[]
}

export function LoyaltyCard() {
  const [data, setData] = useState<LoyaltyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [unlockedAnim, setUnlockedAnim] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/lealtad/cliente')
      .then((r) => r.json())
      .then((json) => {
        setData(json)
        const ultima = json.progreso?.metasDesbloqueadas?.slice(-1)[0]
        if (ultima) setUnlockedAnim(ultima.id)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-white/5 animate-pulse h-80">
        <CardContent className="p-8" />
      </Card>
    )
  }

  if (!data) return null

  const { progreso, total_servicios, canjes, metas } = data
  const slots = progreso.slotsEnTarjeta || 10
  const visitasEnCiclo = progreso.siguienteMeta
    ? progreso.visitas % progreso.siguienteMeta.visitas_requeridas ||
      (progreso.visitas >= progreso.siguienteMeta.visitas_requeridas ? slots : progreso.visitas)
    : Math.min(progreso.visitas, slots)

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 border-none shadow-2xl shadow-amber-500/30 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
        <div className="absolute top-0 right-0 p-6 opacity-15">
          <Scissors size={100} className="text-white" />
        </div>

        <CardContent className="p-8 relative z-10 text-black">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-70">BarberSite Loyalty</p>
              <h3 className="text-3xl font-black uppercase tracking-tighter mt-1">
                Tarjeta <span className="text-white drop-shadow">Pro</span>
              </h3>
            </div>
            <Badge className="bg-black/20 text-black border-black/10 font-black uppercase text-[10px]">
              {progreso.metasDesbloqueadas.length} recompensas
            </Badge>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-6">
            {Array.from({ length: slots }).map((_, i) => {
              const filled = i < visitasEnCiclo
              const isReward = metas.some(
                (m) => m.is_active && m.visitas_requeridas === i + 1
              )
              return (
                <div
                  key={i}
                  className={cn(
                    'aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all duration-500 border-2',
                    filled
                      ? 'bg-white text-amber-600 border-white shadow-[0_0_20px_rgba(255,255,255,0.6)] scale-105'
                      : 'bg-black/10 border-black/10 text-black/40',
                    isReward && filled && 'ring-2 ring-white ring-offset-2 ring-offset-amber-500 animate-pulse'
                  )}
                >
                  {isReward && filled ? <Gift size={14} /> : i + 1}
                </div>
              )
            })}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-80">
              <span>{progreso.visitas} visitas totales</span>
              <span>{total_servicios} servicios</span>
            </div>
            <div className="w-full h-3 bg-black/15 rounded-full overflow-hidden border border-black/10">
              <div
                className="h-full bg-white rounded-full transition-all duration-700 shadow-[0_0_15px_rgba(255,255,255,0.8)]"
                style={{ width: `${progreso.progresoEnMeta}%` }}
              />
            </div>
            {progreso.siguienteMeta ? (
              <p className="text-[10px] font-black uppercase tracking-widest text-right opacity-70">
                Próximo: {progreso.siguienteMeta.nombre} — {progreso.siguienteMeta.visitas_requeridas - progreso.visitas} visitas
              </p>
            ) : (
              <p className="text-[10px] font-black uppercase tracking-widest text-right flex items-center justify-end gap-1">
                <Sparkles size={12} /> ¡Nivel máximo alcanzado!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {progreso.metasDesbloqueadas.length > 0 && (
        <Card className="bg-zinc-900 border-white/5">
          <CardContent className="p-6">
            <h4 className="text-sm font-black uppercase text-amber-500 tracking-widest mb-4 flex items-center gap-2">
              <Gift size={16} /> Beneficios desbloqueados
            </h4>
            <div className="flex flex-wrap gap-2">
              {progreso.metasDesbloqueadas.map((m) => (
                <Badge
                  key={m.id}
                  variant="warning"
                  className={cn(
                    'uppercase font-black text-[10px]',
                    unlockedAnim === m.id && 'animate-bounce'
                  )}
                >
                  {m.nombre}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {metas.filter((m) => m.is_active && !progreso.metasDesbloqueadas.some((d) => d.id === m.id)).length > 0 && (
        <Card className="bg-zinc-900/50 border-white/5">
          <CardContent className="p-6">
            <h4 className="text-sm font-black uppercase text-zinc-400 tracking-widest mb-4 flex items-center gap-2">
              <Sparkles size={16} /> Beneficios disponibles
            </h4>
            <div className="space-y-3">
              {metas
                .filter((m) => m.is_active && !progreso.metasDesbloqueadas.some((d) => d.id === m.id))
                .map((m) => (
                  <div key={m.id} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm font-bold text-white">{m.nombre}</p>
                      <p className="text-xs text-zinc-500">{m.descripcion}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-black uppercase">
                      {Math.max(0, m.visitas_requeridas - progreso.visitas)} visitas
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {canjes?.length > 0 && (
        <Card className="bg-zinc-900/50 border-white/5">
          <CardContent className="p-6">
            <h4 className="text-sm font-black uppercase text-zinc-500 tracking-widest mb-4 flex items-center gap-2">
              <History size={16} /> Historial de canjes
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {canjes.map((c) => (
                <div key={c.id} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                  <p className="text-xs font-bold text-zinc-300">{c.descripcion}</p>
                  <p className="text-[10px] text-zinc-600 font-bold uppercase">
                    {new Date(c.canjeado_at).toLocaleDateString('es-BO')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
