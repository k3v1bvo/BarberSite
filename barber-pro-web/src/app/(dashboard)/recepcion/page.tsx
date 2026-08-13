import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Scissors, User, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { AsistenciaWidget } from '@/components/ui/AsistenciaWidget'
import { FiltroAgenda } from '@/components/ui/FiltroAgenda'

export default async function RecepcionPage(props: { searchParams: Promise<{ date?: string, view?: string }> }) {
  const searchParams = await props.searchParams
  const supabase = await createServerSupabaseClient()

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const dateStr = searchParams?.date || today
  const view = searchParams?.view || 'day'

  let start = `${dateStr}T00:00:00`
  let end = `${dateStr}T23:59:59`

  if (view === 'week') {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + 6) // Añadir 6 días (7 días en total)
    end = `${d.toISOString().split('T')[0]}T23:59:59`
  } else if (view === 'month') {
    const d = new Date(dateStr)
    const y = d.getFullYear()
    const m = d.getMonth()
    const lastDay = new Date(y, m + 1, 0).getDate()
    const mStr = String(m + 1).padStart(2, '0')
    // El inicio será el primer día del mes, y el final el último día del mes
    start = `${y}-${mStr}-01T00:00:00`
    end = `${y}-${mStr}-${String(lastDay).padStart(2, '0')}T23:59:59`
  }

  const { data: citas } = await supabase
    .from('citas')
    .select(`
      *,
      cliente:clientes(*),
      barbero:profiles!barbero_id(full_name),
      servicio:servicios(*)
    `)
    .gte('fecha_hora', start)
    .lte('fecha_hora', end)
    .order('fecha_hora', { ascending: true })

  const { data: servicios } = await supabase
    .from('servicios')
    .select('*')
    .eq('is_active', true)

  const { data: barberos } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'barbero')
    .eq('is_active', true)

  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .order('nombre')

  const citasCompletadas = citas?.filter(c => c.estado === 'completado').length || 0
  const citasPendientes = citas?.filter(c => c.estado === 'pendiente').length || 0
  const citasEnProceso = citas?.filter(c => c.estado === 'en_proceso').length || 0
  const totalVentas = citasCompletadas > 0
    ? citas?.filter(c => c.estado === 'completado').reduce((acc, c) => acc + (c.precio || 0), 0)
    : 0

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            Gestión de <span className="text-amber-500">Recepción</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">
            Visualizando {view === 'day' ? 'Día' : view === 'week' ? 'Semana' : 'Mes'}: {new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-4">
           <FiltroAgenda />
           <div className="flex items-center gap-3">
             <Link href="/agenda">
               <Button variant="outline" size="md">
                 <CalendarDays className="w-4 h-4 mr-2" /> Ver Agendas
               </Button>
             </Link>
             <Button variant="secondary" size="md" onClick={() => typeof window !== 'undefined' && window.print()}>
               Imprimir Reporte
             </Button>
             <Link href="/agenda">
               <Button variant="primary" size="md" className="shadow-lg shadow-amber-500/20">
                 Agenda general
               </Button>
             </Link>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Panel de Citas */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-amber-500/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>📅 Citas Programadas</CardTitle>
              <Badge variant="outline" className="border-zinc-800 text-zinc-500 uppercase font-black text-[10px] tracking-widest">{citas?.length || 0} Total</Badge>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {citas && citas.length > 0 ? (
                citas.map((cita) => (
                  <div key={cita.id} className="group bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-amber-500/30 transition-all card-hover">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <p className="font-black text-2xl text-white tracking-tighter leading-none">
                              {new Date(cita.fecha_hora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {(view === 'week' || view === 'month') && (
                               <p className="text-[10px] text-amber-500 font-bold uppercase mt-1">
                                 {new Date(cita.fecha_hora).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                               </p>
                            )}
                          </div>
                          <Badge variant={
                            cita.estado === 'completado' ? 'success' :
                              cita.estado === 'en_proceso' ? 'info' :
                                cita.estado === 'pendiente' ? 'warning' :
                                  'default'
                          } className="uppercase font-black text-[10px] tracking-widest px-2">
                            {cita.estado}
                          </Badge>
                        </div>
                        <p className="text-zinc-200 text-lg font-bold">{cita.cliente?.nombre}</p>
                        <p className="text-sm text-zinc-500 font-medium">{cita.cliente?.telefono}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-amber-500">{formatCurrency(cita.precio)}</p>
                        <div className="mt-2 flex flex-col items-end gap-1">
                           <span className="text-[10px] uppercase font-black text-zinc-600 flex items-center gap-1">
                             <Scissors size={10}/> {cita.servicio?.nombre}
                           </span>
                           <span className="text-[10px] uppercase font-black text-zinc-600 flex items-center gap-1">
                             <User size={10}/> {cita.barbero?.full_name}
                           </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex gap-3">
                      {cita.estado === 'pendiente' && (
                        <>
                          <form action="/api/citas/iniciar" method="POST" className="flex-1">
                            <input type="hidden" name="cita_id" value={cita.id} />
                            <Button type="submit" size="md" variant="primary" className="w-full">
                              Iniciar
                            </Button>
                          </form>
                          <form action="/api/citas/cancelar" method="POST" className="flex-1">
                            <input type="hidden" name="cita_id" value={cita.id} />
                            <Button type="submit" size="md" variant="outline" className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10">
                              Cancelar
                            </Button>
                          </form>
                        </>
                      )}
                      {cita.estado === 'en_proceso' && (
                        <form action="/api/citas/finalizar" method="POST" className="w-full">
                          <input type="hidden" name="cita_id" value={cita.id} />
                          <Button type="submit" size="lg" variant="success" className="w-full shadow-lg shadow-green-500/10">
                            Finalizar & Cobrar
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/5">
                  <p className="text-zinc-500 font-medium italic">No hay citas programadas para este periodo</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panel de Acciones y Stats */}
        <div className="space-y-6">
          <AsistenciaWidget />
          {/* Stats Rápidos */}
          <div className="grid grid-cols-1 gap-4">
             <Card className="bg-amber-500 text-black border-none glow-amber">
                <CardContent className="p-6">
                   <p className="text-[10px] uppercase font-black tracking-widest opacity-70">Ventas del Día</p>
                   <p className="text-4xl font-black mt-1 leading-none">{formatCurrency(totalVentas || 0)}</p>
                </CardContent>
             </Card>
             <div className="grid grid-cols-2 gap-4">
               <Card className="bg-zinc-900 border-white/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-zinc-500 text-[10px] font-black uppercase">Finalizadas</p>
                    <p className="text-2xl font-black text-green-500 mt-1">{citasCompletadas}</p>
                  </CardContent>
               </Card>
               <Card className="bg-zinc-900 border-white/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-zinc-500 text-[10px] font-black uppercase">En Cola</p>
                    <p className="text-2xl font-black text-amber-500 mt-1">{citasPendientes}</p>
                  </CardContent>
               </Card>
             </div>
          </div>

          {/* Nueva Cita Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">➕ Reservar Nueva Cita</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form action="/api/citas/crear" method="POST" className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-zinc-500 ml-1">Cliente</label>
                  <select name="cliente_id" className="w-full h-12 rounded-xl bg-zinc-950 border border-white/10 px-4 text-sm text-white focus:border-amber-500/50 outline-none transition-all" required>
                    <option value="">Seleccionar...</option>
                    {clientes?.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-zinc-500 ml-1">Servicio</label>
                    <select name="servicio_id" className="w-full h-12 rounded-xl bg-zinc-950 border border-white/10 px-4 text-sm text-white" required>
                      <option value="">Seleccionar...</option>
                      {servicios?.map((s) => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-zinc-500 ml-1">Barbero</label>
                    <select name="barbero_id" className="w-full h-12 rounded-xl bg-zinc-950 border border-white/10 px-4 text-sm text-white" required>
                      <option value="">Seleccionar...</option>
                      {barberos?.map((b) => (
                        <option key={b.id} value={b.id}>{b.full_name.split(' ')[0]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-zinc-500 ml-1">Fecha y Hora</label>
                  <input type="datetime-local" name="fecha_hora" className="w-full h-12 rounded-xl bg-zinc-950 border border-white/10 px-4 text-sm text-white" required />
                </div>
                
                <Button type="submit" className="w-full py-6 uppercase tracking-wider" variant="primary">
                  Confirmar Reserva
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

