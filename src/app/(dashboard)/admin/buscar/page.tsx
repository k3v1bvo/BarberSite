'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { Search, User, Calendar, ArrowLeft } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export default function BuscarPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string; telefono: string | null; email: string | null }>>([])
  const [citas, setCitas] = useState<Array<{
    id: string
    fecha_hora: string
    precio: number
    estado: string
    clientes?: { nombre: string }
    servicios?: { nombre: string }
  }>>([])
  const router = useRouter()
  const supabase = createClient()

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
        .select('id, nombre, telefono, email')
        .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(15)

      const { data: citasData } = await supabase
        .from('citas')
        .select(`
          id, fecha_hora, precio, estado,
          clientes (nombre),
          servicios (nombre)
        `)
        .order('fecha_hora', { ascending: false })
        .limit(20)

      const citasFiltradas = (citasData || []).filter((c) => {
        const cliente = Array.isArray(c.clientes) ? c.clientes[0] : c.clientes
        const servicio = Array.isArray(c.servicios) ? c.servicios[0] : c.servicios
        const texto = `${cliente?.nombre || ''} ${servicio?.nombre || ''} ${c.id}`.toLowerCase()
        return texto.includes(q.toLowerCase())
      })

      setClientes(clientesData || [])
      setCitas(citasFiltradas as unknown as typeof citas)
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
                placeholder="Nombre, teléfono, email o ID de cita..."
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
            {clientes.map((c) => (
              <div key={c.id} className="p-4 hover:bg-white/5 transition-colors">
                <p className="font-bold text-white">{c.nombre}</p>
                <p className="text-sm text-zinc-500">
                  {[c.telefono, c.email].filter(Boolean).join(' · ') || 'Sin contacto'}
                </p>
              </div>
            ))}
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
              return (
                <div key={c.id} className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors">
                  <div>
                    <p className="font-bold text-white">{cliente?.nombre || 'Cliente'}</p>
                    <p className="text-sm text-zinc-500">
                      {servicio?.nombre} · {formatDateTime(c.fecha_hora)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-amber-500">{formatCurrency(c.precio)}</p>
                    <p className="text-[10px] uppercase text-zinc-600 font-bold">{c.estado}</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {!loading && query.length >= 2 && clientes.length === 0 && citas.length === 0 && (
        <p className="text-center text-zinc-500 py-12">No se encontraron resultados</p>
      )}
    </div>
  )
}
