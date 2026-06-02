'use client'

import { Calendar, CalendarDays, ShoppingBag, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'

const actions = [
  {
    label: 'Agenda',
    sub: 'Ver citas del día',
    href: '/agenda',
    icon: Calendar,
    accent: 'hover:border-amber-500/50 hover:bg-amber-500/5',
  },
  {
    label: 'Recepción',
    sub: 'Llegadas y check-in',
    href: '/recepcion',
    icon: CalendarDays,
    accent: 'hover:border-blue-500/40 hover:bg-blue-500/5',
  },
  {
    label: 'Nueva venta',
    sub: 'POS / reservar',
    href: '/reservar',
    icon: ShoppingBag,
    accent: 'hover:border-green-500/40 hover:bg-green-500/5',
  },
  {
    label: 'Asistencia',
    sub: 'Turnos del equipo',
    href: '/admin/asistencia',
    icon: Clock,
    accent: 'hover:border-orange-500/40 hover:bg-orange-500/5',
  },
]

export function AdminQuickActions() {
  const router = useRouter()

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
      <p className="text-[10px] uppercase font-black text-zinc-600 tracking-[0.3em] mb-3 ml-1">
        Acciones rápidas
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map((item, i) => (
          <button
            key={item.href}
            type="button"
            onClick={() => router.push(item.href)}
            className={`flex items-start gap-3 p-4 rounded-2xl bg-zinc-900/80 border border-white/5 text-left transition-all duration-300 btn-press hover:scale-[1.02] ${item.accent} animate-in fade-in slide-in-from-bottom-2 fill-mode-both`}
            style={{ animationDelay: `${200 + i * 50}ms` }}
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-amber-500 shrink-0">
              <item.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-white">{item.label}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{item.sub}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
