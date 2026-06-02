const BARBER_COLORS = [
  'bg-amber-500/25 border-amber-500/60 text-amber-100',
  'bg-blue-500/25 border-blue-500/60 text-blue-100',
  'bg-emerald-500/25 border-emerald-500/60 text-emerald-100',
  'bg-violet-500/25 border-violet-500/60 text-violet-100',
  'bg-rose-500/25 border-rose-500/60 text-rose-100',
  'bg-cyan-500/25 border-cyan-500/60 text-cyan-100',
  'bg-orange-500/25 border-orange-500/60 text-orange-100',
  'bg-pink-500/25 border-pink-500/60 text-pink-100',
]

export function getBarberColorClass(barberoId: string): string {
  let hash = 0
  for (let i = 0; i < barberoId.length; i++) {
    hash = barberoId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % BARBER_COLORS.length
  return BARBER_COLORS[index]
}
