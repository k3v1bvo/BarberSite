'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Calendar, Scissors, History, Clock, User, Star, ArrowRight, XCircle, CheckCircle, ChevronRight, MessageSquare } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { LoyaltyCard } from '@/components/ui/LoyaltyCard'

interface Cita {
  id: string
  estado: string
  precio: number
  fecha_hora: string
  notas: string | null
  servicios?: { nombre: string; descripcion: string | null }
  barberos?: { full_name: string }
}

interface UserProfile {
  full_name: string | null
  email: string
}

export default function ClientePage() {
  const { success, error: toastError } = useToast()
  const [citasProximas, setCitasProximas] = useState<Cita[]>([])
  const [citasPasadas, setCitasPasadas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return router.push('/login')

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', authUser.id)
        .single()

      if (profile) setUser(profile as UserProfile)

      const ahora = new Date().toISOString()

      const { data: todasCitas, error } = await supabase
        .from('citas')
        .select(`
          *,
          servicios (nombre, descripcion),
          profiles!barbero_id (full_name)
        `)
        .eq('cliente_id', authUser.id)
        .order('fecha_hora', { ascending: true })

      if (error) console.error('Error fetching citas:', error)

      const citas = (todasCitas as unknown as Cita[]) || []

      const proximas = citas.filter(c => 
        c.fecha_hora >= ahora && c.estado !== 'cancelado'
      )
      const pasadas = citas.filter(c => 
        c.fecha_hora < ahora || c.estado === 'cancelado'
      ).reverse().slice(0, 10)

      setCitasProximas(proximas)
      setCitasPasadas(pasadas)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const cancelarCita = async (citaId: string) => {
    if (!confirm('¿Estás seguro de cancelar esta cita?')) return

    try {
      const { error } = await supabase
        .from('citas')
        .update({ estado: 'cancelado' })
        .eq('id', citaId)

      if (error) throw error
      loadData()
    } catch (error) {
      toastError('Error al cancelar la cita')
    }
  }

  const enviarTestimonio = async (citaId: string, estrellas: number, comentario: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('testimonios')
        .insert({
          cliente_id: user?.id,
          estrellas,
          comentario,
        })
      if (error) throw error
      success('¡Gracias por tu reseña!')
      loadData()
    } catch (e: any) {
      toastError('Error enviando reseña: ' + (e instanceof Error ? e.message : ''))
    }
  }

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      pendiente: 'warning',
      confirmado: 'info',
      en_proceso: 'info',
      completado: 'success',
      cancelado: 'danger',
    }
    return variants[estado] || 'default'
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Sincronizando tus Citas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Bienvenida */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-10">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none mb-4">
            Bienvenido, <span className="text-amber-500">{user?.full_name?.split(' ')[0] || 'Cliente'}</span>
          </h1>
          <p className="text-zinc-500 font-medium text-lg">Gestiona tu agenda personal y reserva nuevas experiencias</p>
        </div>
        <div className="flex gap-4">
           <Button variant="primary" size="lg" className="h-14 px-8 font-black uppercase tracking-widest shadow-lg shadow-amber-500/20" onClick={() => router.push('/reservar')}>
              <Scissors className="w-5 h-5 mr-3" />
              Agendar Ahora
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Citas Próximas */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-l-4 border-amber-500 pl-4 h-10">
            <h2 className="text-xl font-black uppercase text-white tracking-widest">Próximos <span className="text-amber-500">Encuentros</span></h2>
            <Badge variant="warning" className="uppercase font-black text-[10px] px-3">{citasProximas.length} TOTAL</Badge>
          </div>

          <div className="grid gap-6">
            {citasProximas.map((cita) => (
              <Card key={cita.id} className="bg-zinc-900 border-white/5 shadow-2xl overflow-hidden card-hover group">
                 <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 transition-all opacity-30 group-hover:opacity-100"></div>
                 <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                       <div className="space-y-4 flex-1">
                          <div className="flex items-center gap-3">
                             <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                <Calendar size={24} />
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Fecha Programada</p>
                                <p className="text-lg font-black text-white uppercase tracking-tight">
                                   {new Date(cita.fecha_hora).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </p>
                             </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                             <div>
                                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Servicio</p>
                                <p className="text-sm font-bold text-zinc-200 uppercase">{cita.servicios?.nombre}</p>
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Especialista</p>
                                <p className="text-sm font-bold text-zinc-200 uppercase">{cita.barberos?.full_name}</p>
                             </div>
                          </div>
                       </div>

                       <div className="flex flex-col justify-between items-end gap-6 md:w-48">
                          <div className="text-right">
                             <Badge variant={getEstadoBadge(cita.estado)} className="mb-2 uppercase font-black text-[10px] tracking-widest px-4">
                                {cita.estado}
                             </Badge>
                             <p className="text-3xl font-black text-white tracking-tighter leading-none">{formatCurrency(cita.precio)}</p>
                          </div>
                          
                          {(cita.estado === 'pendiente' || cita.estado === 'confirmado') && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="w-full h-12 border-white/5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 font-bold uppercase text-[10px] tracking-widest"
                              onClick={() => cancelarCita(cita.id)}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Cancelar
                            </Button>
                          )}
                       </div>
                    </div>
                 </CardContent>
              </Card>
            ))}

            {citasProximas.length === 0 && (
              <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl bg-zinc-900/30">
                 <Calendar size={64} className="mx-auto text-zinc-800 mb-6 opacity-30" />
                 <h3 className="text-xl font-black text-zinc-600 uppercase tracking-widest mb-2">Tu agenda está despejada</h3>
                 <p className="text-zinc-500 text-sm mb-8">Es un buen momento para renovar tu estilo.</p>
                 <Button variant="primary" onClick={() => router.push('/reservar')} className="font-black uppercase tracking-widest">
                   Reservar ahora
                 </Button>
              </div>
            )}
          </div>
        </div>

        {/* Lealtad e historial */}
        <div className="space-y-10">
          <LoyaltyCard />

          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase text-zinc-500 tracking-widest border-l-4 border-zinc-700 pl-4 h-10 flex items-center">Historial <span className="text-zinc-700 ml-2">Reciente</span></h2>
            <div className="space-y-3">
              {citasPasadas.map((cita) => (
                <Card key={cita.id} className="bg-zinc-900/50 border-white/5 p-5 hover:bg-zinc-900 transition-all card-hover group">
                   <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center text-zinc-600 border border-white/5 group-hover:text-amber-500 group-hover:border-amber-500/20 transition-all">
                            {cita.estado === 'completado' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                         </div>
                         <div>
                            <p className="text-sm font-black text-white uppercase tracking-tight leading-none mb-1">{cita.servicios?.nombre}</p>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                               {new Date(cita.fecha_hora).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                            </p>
                         </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                         <div>
                            <p className="text-sm font-black text-zinc-400 leading-none mb-1">{formatCurrency(cita.precio)}</p>
                            <Badge variant={getEstadoBadge(cita.estado)} className="px-2 py-0 text-[8px] font-black uppercase">{cita.estado}</Badge>
                         </div>
                         {cita.estado === 'completado' && (
                            <button 
                              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:bg-amber-500 hover:text-black transition-all"
                              onClick={() => {
                                const comentario = prompt('Cuéntanos qué te pareció el servicio:')
                                if (comentario) enviarTestimonio(cita.id, 5, comentario)
                              }}
                            >
                              <MessageSquare size={16} />
                            </button>
                         )}
                         <ChevronRight size={14} className="text-zinc-700" />
                      </div>
                   </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

