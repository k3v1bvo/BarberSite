'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { Search, User, Calendar, ArrowLeft, Star, Crown, ChevronRight, Phone, Mail, CreditCard, Clock, Scissors } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import Link from 'next/link'

const NIVEL_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  bronce:   { label: 'Bronce',   color: 'text-amber-600 bg-amber-600/10 border-amber-600/30',   icon: Star  },
  plata:    { label: 'Plata',    color: 'text-zinc-300 bg-zinc-300/10 border-zinc-300/30',       icon: Star  },
  oro:      { label: 'Oro',      color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', icon: Crown },
  platino:  { label: 'Platino',  color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',       icon: Crown },
  diamante: { label: 'Diamante', color: 'text-violet-400 bg-violet-400/10 border-violet-400/30', icon: Crown },
}

export default function BuscarPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<Array<{ 
    id: string; nombre: string; telefono: string | null; email: string | null; ci: string | null;
    total_visitas: number; total_gastado: number; nivel_fidelidad: string | null;
    cumpleanos: string | null; ultima_visita: string | null; codigo_tarjeta: string | null;
  }>>([])
  const [citas, setCitas] = useState<Array<{
    id: string
    fecha_hora: string
    precio: number
    estado: string
    clientes?: { nombre: string }
    servicios?: { nombre: string }
    barberos?: { full_name: string }
  }>>([])
  const [transacciones, setTransacciones] = useState<Array<{
    id: string
    fecha: string
    nombre: string
    ci: string
    glosa: string
    costo: number
    tipo_movimiento: string
    libro: string
  }>>([])
  const router = useRouter()
  const supabase = createClient()

  const formatFecha = (iso: string) => {
    return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const nivelInfo = (nivel: string | null) => NIVEL_CONFIG[nivel || ''] || { label: nivel || 'Sin nivel', color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20', icon: Star }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q.length < 2) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nombre, telefono, email, ci, total_visitas, total_gastado, nivel_fidelidad, cumpleanos, ultima_visita, codigo_tarjeta')
        .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%,ci.ilike.%${q}%,codigo_tarjeta.ilike.%${q}%`)
        .limit(100)

      // Buscar citas para esos clientes, o si 'q' es un UUID, buscar la cita directamente
      let citasQuery = supabase
        .from('citas')
        .select(`
          id, fecha_hora, precio, estado,
          clientes (nombre),
          servicios (nombre),
          barberos:profiles (full_name)
        `)
        .order('fecha_hora', { ascending: false })
        .limit(20)

      if (q.length === 36 && q.includes('-')) {
        citasQuery = citasQuery.eq('id', q)
      } else if (clientesData && clientesData.length > 0) {
        citasQuery = citasQuery.in('cliente_id', clientesData.map(c => c.id))
      } else {
        // Truco para no traer nada si no hay clientes coincidentes y no es UUID
        citasQuery = citasQuery.eq('id', '00000000-0000-0000-0000-000000000000') 
      }

      const { data: citasData } = await citasQuery

      const { data: txData } = await supabase
        .from('transactions')
        .select('id, fecha, nombre, ci, glosa, costo, tipo_movimiento, libro')
        .or(`nombre.ilike.%${q}%,ci.ilike.%${q}%,glosa.ilike.%${q}%`)
        .order('creado_en', { ascending: false })
        .limit(15)

      setClientes(clientesData || [])
      setCitas((citasData as any) || [])
      setTransacciones(txData || [])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 border-b border-white/5 pb-6">
        <Link href="/admin" className="text-zinc-500 hover:text-amber-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tight">
            Búsqueda <span className="text-amber-500">Global</span>
          </h1>
          <p className="text-zinc-500 mt-1">Clientes, citas y referencias</p>
        </div>
      </div>

      <Card className="border-white/5">
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre, carnet, teléfono, email o ID de cita..."
                className="w-full h-12 pl-12 pr-4 bg-zinc-950 border border-white/10 rounded-xl text-white font-medium focus:border-amber-500/50 outline-none"
              />
            </div>
            <Button type="submit" variant="primary" size="lg" disabled={loading || query.trim().length < 2}>
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {clientes.length > 0 && (
        <Card className="border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-amber-500" />
              Clientes ({clientes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-white/5">
            {clientes.map((c) => {
              const niv = nivelInfo(c.nivel_fidelidad)
              const NivIcon = niv.icon
              return (
                <div 
                  key={c.id} 
                  onClick={() => router.push(`/admin/clientes?id=${c.id}`)}
                  className="p-4 hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-700/30 flex items-center justify-center shrink-0 text-amber-400 font-black text-base">
                    {c.nombre.charAt(0).toUpperCase()}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-sm truncate">{c.nombre}</p>
                      {c.nivel_fidelidad && (
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${niv.color} hidden sm:flex items-center gap-0.5`}>
                          <NivIcon className="w-2.5 h-2.5" /> {niv.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {c.ci && <span className="text-[11px] text-zinc-500 flex items-center gap-1"><CreditCard className="w-3 h-3" />{c.ci}</span>}
                      {c.codigo_tarjeta && <span className="text-[11px] text-zinc-500 flex items-center gap-1"><Star className="w-3 h-3" />{c.codigo_tarjeta}</span>}
                      {c.telefono && <span className="text-[11px] text-zinc-500 flex items-center gap-1"><Phone className="w-3 h-3" />{c.telefono}</span>}
                      {c.email && <span className="text-[11px] text-zinc-500 flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                      {c.cumpleanos && <span className="text-[11px] text-zinc-500 flex items-center gap-1"><Calendar className="w-3 h-3" />{formatFecha(c.cumpleanos)}</span>}
                      {c.ultima_visita && <span className="text-[11px] text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" />Última: {formatFecha(c.ultima_visita)}</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-sm font-black text-amber-400">{formatCurrency(c.total_gastado || 0)}</p>
                    <p className="text-[11px] text-zinc-500">{c.total_visitas || 0} visitas</p>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 text-zinc-700" />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {citas.length > 0 && (
        <Card className="border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-amber-500" />
              Citas ({citas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-white/5">
            {citas.map((c) => {
              const cliente = Array.isArray(c.clientes) ? c.clientes[0] : c.clientes
              const servicio = Array.isArray(c.servicios) ? c.servicios[0] : c.servicios
              const barbero = Array.isArray(c.barberos) ? c.barberos[0] : c.barberos
              return (
                <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/5 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center shrink-0">
                      <Scissors className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">{cliente?.nombre || 'Cliente'}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500 flex-wrap">
                        <span className="text-amber-500 font-medium">{servicio?.nombre}</span>
                        <span>·</span>
                        <span>{formatDateTime(c.fecha_hora)}</span>
                        {barbero?.full_name && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1"><User className="w-3 h-3" /> {barbero.full_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right sm:shrink-0 flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                    <p className="font-black text-amber-500">{formatCurrency(c.precio)}</p>
                    <Badge variant={
                      c.estado === 'completado' ? 'success' :
                      c.estado === 'cancelado' ? 'danger' :
                      c.estado === 'en_proceso' ? 'info' : 'warning'
                    } className="text-[9px] uppercase">{c.estado}</Badge>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {transacciones.length > 0 && (
        <Card className="border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="w-5 h-5 text-amber-500" />
              Transacciones de Caja ({transacciones.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-white/5">
            {transacciones.map((tx) => (
              <div key={tx.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => router.push(`/coordinador/caja-chica`)}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{tx.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500 flex-wrap">
                      <span className="text-amber-500 font-medium">{tx.libro}</span>
                      <span>·</span>
                      <span>{formatFecha(tx.fecha)}</span>
                      {tx.ci && (
                        <>
                          <span>·</span>
                          <span>C.I. {tx.ci}</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="truncate max-w-[200px]">{tx.glosa}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right sm:shrink-0 flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                  <p className="font-black text-white">{formatCurrency(tx.costo)}</p>
                  <Badge variant={
                    tx.tipo_movimiento === 'INGRESO' || tx.tipo_movimiento === 'VENTA' || tx.tipo_movimiento === 'SERVICIO' ? 'success' :
                    tx.tipo_movimiento === 'EGRESO' || tx.tipo_movimiento === 'SANCCION' ? 'danger' : 'default'
                  } className="text-[9px] uppercase">{tx.tipo_movimiento}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && query.length >= 2 && clientes.length === 0 && citas.length === 0 && transacciones.length === 0 && (
        <p className="text-center text-zinc-500 py-12">No se encontraron resultados</p>
      )}
    </div>
  )
}
