'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useRouter } from 'next/navigation'
import { Package, ArrowLeft, Store, Calendar, Truck, CheckCircle, Clock, Phone, Hash, XCircle, ChevronRight } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface Pedido {
  id: string
  estado: string
  metodo_entrega: string
  total: number
  created_at: string
  clientes: { nombre: string, telefono: string }
  pedido_items: { 
    cantidad: number, 
    precio_unitario: number, 
    productos: { nombre: string } 
  }[]
}

export default function AdminPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          *,
          clientes(nombre, telefono),
          pedido_items(cantidad, precio_unitario, productos(nombre))
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setPedidos(data as unknown as Pedido[])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const actEstado = async (id: string, nuevoEstado: string) => {
    await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', id)
    loadData()
  }

  const getMetodoIcon = (metodo: string) => {
    if (metodo === 'con_reserva') return <Calendar className="w-5 h-5 text-amber-500" />
    if (metodo === 'envio') return <Truck className="w-5 h-5 text-amber-500" />
    return <Store className="w-5 h-5 text-amber-500" />
  }

  const getMetodoLabel = (metodo: string) => {
    if (metodo === 'con_reserva') return 'CON CITA PREVIA'
    if (metodo === 'envio') return 'DELIVERY A DOMICILIO'
    return 'RECOJO EN LOCAL'
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Sincronizando Despacho...</p>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-8">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/admin')} className="p-4 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl transition-all btn-press group">
             <ArrowLeft className="w-5 h-5 text-zinc-500 group-hover:text-amber-500" />
          </button>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">
              Order <span className="text-amber-500">Flow</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-2 text-lg">Monitorea y gestiona los pedidos de tus clientes</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 bg-zinc-900 px-6 py-4 rounded-2xl border border-white/5">
           <div className="text-right border-r border-white/10 pr-6">
              <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest leading-none mb-1">Pendientes</p>
              <p className="text-2xl font-black text-amber-500 leading-none">{pedidos.filter(p => p.estado === 'pendiente').length}</p>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest leading-none mb-1">Entregados</p>
              <p className="text-2xl font-black text-white leading-none">{pedidos.filter(p => p.estado === 'entregado').length}</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         
         {/* Pendientes */}
         <div className="space-y-6">
           <div className="flex items-center justify-between border-l-4 border-amber-500 pl-4 h-10">
             <h2 className="text-xl font-black uppercase text-white tracking-widest">En <span className="text-amber-500">Proceso</span></h2>
             <Badge variant="warning" className="uppercase font-black text-[10px] px-3">{pedidos.filter(p => p.estado === 'pendiente').length} TOTAL</Badge>
           </div>
           
           <div className="grid gap-6">
             {pedidos.filter(p => p.estado === 'pendiente').map(p => (
               <Card key={p.id} className="bg-zinc-900 border-white/5 shadow-2xl overflow-hidden card-hover group">
                 <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 group-hover:bg-amber-400 transition-all opacity-30 group-hover:opacity-100"></div>
                 
                 <CardHeader className="p-8 pb-0">
                    <div className="flex justify-between items-start">
                       <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
                             <Hash size={10} className="text-amber-500" /> PEDIDO #{p.id.substring(0,8).toUpperCase()}
                          </p>
                          <h3 className="text-2xl font-black text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors leading-none">{p.clientes?.nombre}</h3>
                          <div className="flex items-center gap-2 mt-3 text-zinc-400">
                             <Phone size={12} className="text-amber-500" />
                             <span className="text-xs font-bold leading-none">{p.clientes?.telefono}</span>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-3xl font-black text-white tracking-tighter leading-none mb-2">{formatCurrency(p.total)}</p>
                          <div className="flex items-center justify-end gap-2 text-zinc-500 font-black text-[10px] tracking-widest uppercase">
                             <Clock size={10} /> {new Date(p.created_at).toLocaleDateString()}
                          </div>
                       </div>
                    </div>
                 </CardHeader>
                 
                 <CardContent className="p-8">
                    <div className="flex items-center gap-4 bg-zinc-950 px-5 py-4 rounded-xl border border-white/5 mb-6">
                       <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          {getMetodoIcon(p.metodo_entrega)} 
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Método de Entrega</p>
                          <p className="text-sm font-black text-white tracking-tight uppercase">{getMetodoLabel(p.metodo_entrega)}</p>
                       </div>
                       {p.metodo_entrega === 'envio' && (
                         <Badge variant="info" className="ml-auto bg-amber-500/20 text-amber-500 border-amber-500/30 font-black text-[10px] tracking-widest px-3">COD</Badge>
                       )}
                    </div>

                    <div className="space-y-3 mb-8">
                       <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-4">Detalle de Productos</p>
                       <div className="space-y-2">
                         {p.pedido_items.map((item, idx) => (
                           <div key={idx} className="flex justify-between items-center group/item hover:bg-white/[0.02] p-2 rounded-lg transition-all">
                             <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-6 h-6 rounded bg-zinc-800 text-[10px] font-black text-amber-500">{item.cantidad}</span>
                                <span className="text-sm font-bold text-zinc-300 uppercase tracking-tight">{item.productos?.nombre}</span>
                             </div>
                             <span className="text-sm font-black text-zinc-500">{formatCurrency(item.precio_unitario * item.cantidad)}</span>
                           </div>
                         ))}
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <Button 
                         variant="primary" 
                         className="h-14 font-black uppercase tracking-widest shadow-lg shadow-amber-500/20"
                         onClick={() => actEstado(p.id, 'entregado')}
                       >
                         <CheckCircle className="w-4 h-4 mr-2" />
                         Entregar
                       </Button>
                       <Button 
                         variant="outline" 
                         className="h-14 border-white/5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 font-black uppercase tracking-widest"
                         onClick={() => actEstado(p.id, 'cancelado')}
                       >
                         <XCircle className="w-4 h-4 mr-2" />
                         Anular
                       </Button>
                    </div>
                 </CardContent>
               </Card>
             ))}
             {pedidos.filter(p => p.estado === 'pendiente').length === 0 && (
               <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl">
                  <Package size={64} className="mx-auto text-zinc-800 mb-4 opacity-30" />
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Sin pedidos pendientes en cola</p>
               </div>
             )}
           </div>
         </div>

         {/* Entregados */}
         <div className="space-y-6">
           <div className="flex items-center justify-between border-l-4 border-zinc-700 pl-4 h-10">
             <h2 className="text-xl font-black uppercase text-zinc-500 tracking-widest">Historial <span className="text-zinc-700">Reciente</span></h2>
           </div>
           
           <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity">
             {pedidos.filter(p => p.estado === 'entregado').slice(0, 10).map(p => (
               <Card key={p.id} className="bg-zinc-900/50 border-white/5 p-6 border hover:bg-zinc-900 transition-all card-hover group">
                  <div className="flex justify-between items-center">
                     <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-950 flex items-center justify-center text-zinc-700 border border-white/5">
                           <CheckCircle size={20} />
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none mb-1">Completado</p>
                           <h3 className="text-lg font-black text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors leading-none">{p.clientes?.nombre}</h3>
                           <p className="text-xs text-zinc-500 font-bold mt-2 uppercase">{p.pedido_items.length} ITEMS • {getMetodoLabel(p.metodo_entrega).split(' ')[0]}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-xl font-black text-zinc-400 group-hover:text-green-500 transition-colors leading-none mb-2">{formatCurrency(p.total)}</p>
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{new Date(p.created_at).toLocaleDateString()}</p>
                     </div>
                     <div className="ml-6 flex items-center justify-center w-8 h-8 rounded-full bg-white/5 group-hover:bg-amber-500 group-hover:text-black transition-all">
                        <ChevronRight size={16} />
                     </div>
                  </div>
               </Card>
             ))}
             {pedidos.filter(p => p.estado === 'entregado').length === 0 && (
                <p className="text-zinc-700 font-black text-xs uppercase tracking-widest text-center mt-32">Historial de despacho vacío</p>
             )}
           </div>
         </div>

      </div>
    </div>
  )
}

