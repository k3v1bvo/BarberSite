'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from './Button'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List } from 'lucide-react'

export function FiltroAgenda() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const todayStr = new Date().toISOString().split('T')[0]
  const currentDate = searchParams.get('date') || todayStr
  const currentView = searchParams.get('view') || 'day'

  const updateFilters = (newDate: string, newView: string) => {
    const params = new URLSearchParams()
    if (newDate) params.set('date', newDate)
    if (newView) params.set('view', newView)
    router.push(`?${params.toString()}`)
  }

  const moveDate = (days: number) => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + days)
    updateFilters(d.toISOString().split('T')[0], currentView)
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-900/50 p-2 rounded-2xl border border-white/5 backdrop-blur-md">
      {/* Botones de Navegación de Fecha */}
      <div className="flex items-center gap-2 bg-black/40 rounded-xl p-1">
        <button 
          onClick={() => moveDate(-1)}
          className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
          title="Día Anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="relative flex items-center">
          <CalendarIcon className="w-4 h-4 text-amber-500 absolute left-3 pointer-events-none" />
          <input 
            type="date" 
            value={currentDate}
            onChange={(e) => updateFilters(e.target.value, currentView)}
            className="bg-transparent border-none text-sm font-bold text-white focus:ring-0 pl-10 pr-4 py-2 cursor-pointer outline-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>

        <button 
          onClick={() => moveDate(1)}
          className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
          title="Día Siguiente"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="h-8 w-px bg-white/10 hidden sm:block"></div>

      {/* Botón Hoy */}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => updateFilters(todayStr, currentView)}
        className={`border-white/5 uppercase tracking-widest text-[10px] font-black ${currentDate === todayStr ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-400 hover:text-white'}`}
      >
        Hoy
      </Button>

      <div className="h-8 w-px bg-white/10 hidden sm:block"></div>

      {/* Selector de Vista (Día / Semana / Mes) */}
      <div className="flex bg-black/40 rounded-xl p-1">
        {[
          { id: 'day', label: 'Día' },
          { id: 'week', label: 'Semana' },
          { id: 'month', label: 'Mes' }
        ].map(view => (
          <button
            key={view.id}
            onClick={() => updateFilters(currentDate, view.id)}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              currentView === view.id 
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>
    </div>
  )
}
