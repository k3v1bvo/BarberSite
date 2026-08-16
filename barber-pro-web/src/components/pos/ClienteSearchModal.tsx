'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { Search, User, Star, Crown, X, Phone, Mail, IdCard, Calendar, Check, Plus, Sparkles, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'

interface Cliente {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  ci: string | null
  nivel_fidelidad?: string | null
  total_visitas?: number
  total_gastado?: number
  codigo_tarjeta?: string | null
  referido_por?: string | null
  cumpleanos?: string | null
  ultima_visita?: string | null
}

interface ClienteSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectCliente: (cliente: Cliente) => void
  initialQuery?: string
}

const NIVEL_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  BRONCE:   { label: 'Bronce',   color: 'text-amber-600 bg-amber-600/10 border-amber-600/30',   icon: Star  },
  PLATA:    { label: 'Plata',    color: 'text-zinc-300 bg-zinc-300/10 border-zinc-300/30',       icon: Star  },
  ORO:      { label: 'Oro',      color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', icon: Crown },
  PLATINO:  { label: 'Platino',  color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',       icon: Crown },
  DIAMANTE: { label: 'Diamante', color: 'text-violet-400 bg-violet-400/10 border-violet-400/30', icon: Crown },
  bronce:   { label: 'Bronce',   color: 'text-amber-600 bg-amber-600/10 border-amber-600/30',   icon: Star  },
  plata:    { label: 'Plata',    color: 'text-zinc-300 bg-zinc-300/10 border-zinc-300/30',       icon: Star  },
  oro:      { label: 'Oro',      color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', icon: Crown },
  platino:  { label: 'Platino',  color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',       icon: Crown },
  diamante: { label: 'Diamante', color: 'text-violet-400 bg-violet-400/10 border-violet-400/30', icon: Crown },
}

export function ClienteSearchModal({
  isOpen,
  onClose,
  onSelectCliente,
  initialQuery = '',
}: ClienteSearchModalProps) {
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState(initialQuery)
  const [nivelFilter, setNivelFilter] = useState<string>('todos')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery)
      fetchClientes(initialQuery)
    }
  }, [isOpen, initialQuery])

  const fetchClientes = async (search: string) => {
    setLoading(true)
    try {
      const q = search.trim()
      let req = supabase
        .from('clientes')
        .select('id, nombre, email, telefono, ci, nivel_fidelidad, total_visitas, total_gastado, codigo_tarjeta, cumpleanos, ultima_visita')

      if (q.length >= 2) {
        req = req.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%,ci.ilike.%${q}%,codigo_tarjeta.ilike.%${q}%`)
          .limit(100)
      } else {
        // Si no hay búsqueda, traer los clientes más frecuentes / recientes
        req = req.order('total_visitas', { ascending: false }).limit(40)
      }

      const { data, error } = await req
      if (!error && data) {
        setClientes(data)
      } else {
        setClientes([])
      }
    } catch (err) {
      console.error('Error buscando clientes:', err)
      setClientes([])
    } finally {
      setLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    if (!isOpen) return
    const timeout = setTimeout(() => {
      fetchClientes(query)
    }, 250)
    return () => clearTimeout(timeout)
  }, [query, isOpen])

  const clientesFiltrados = useMemo(() => {
    if (nivelFilter === 'todos') return clientes
    return clientes.filter(c => (c.nivel_fidelidad || 'BRONCE').toUpperCase() === nivelFilter.toUpperCase())
  }, [clientes, nivelFilter])

  if (!isOpen || !mounted) return null

  const nivelBadge = (nivel: string | null | undefined) => {
    const config = NIVEL_CONFIG[nivel || ''] || NIVEL_CONFIG['BRONCE']
    const Icon = config.icon
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* HEADER */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 rounded-xl transition"
            title="Cerrar buscador"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Buscador Inteligente de Clientes</h3>
              <p className="text-xs text-zinc-400">Busca por nombre, carnet/CI, teléfono, correo o código de tarjeta para cobrar en POS.</p>
            </div>
          </div>

          {/* INPUT DE BÚSQUEDA */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe el nombre, carnet, teléfono, código o correo del cliente..."
              className="w-full h-12 pl-12 pr-10 bg-zinc-950 border border-amber-500/30 rounded-2xl text-white font-medium focus:border-amber-500 outline-none text-sm shadow-inner"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* FILTROS POR NIVEL DE FIDELIDAD */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-zinc-800/60">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Nivel:
            </span>
            <button
              type="button"
              onClick={() => setNivelFilter('todos')}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                nivelFilter === 'todos' ? 'bg-amber-500 text-black shadow-md' : 'bg-zinc-800/70 text-zinc-400 hover:text-white'
              }`}
            >
              Todos ({clientes.length})
            </button>
            <button
              type="button"
              onClick={() => setNivelFilter('ORO')}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                nivelFilter === 'ORO' ? 'bg-yellow-400 text-black shadow-md' : 'bg-zinc-800/70 text-yellow-400/70 hover:text-yellow-400'
              }`}
            >
              👑 Oro
            </button>
            <button
              type="button"
              onClick={() => setNivelFilter('PLATA')}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                nivelFilter === 'PLATA' ? 'bg-zinc-300 text-black shadow-md' : 'bg-zinc-800/70 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              ⭐ Plata
            </button>
            <button
              type="button"
              onClick={() => setNivelFilter('BRONCE')}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                nivelFilter === 'BRONCE' ? 'bg-amber-600 text-black shadow-md' : 'bg-zinc-800/70 text-amber-500/70 hover:text-amber-400'
              }`}
            >
              ⭐ Bronce
            </button>
            <button
              type="button"
              onClick={() => setNivelFilter('PLATINO')}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                nivelFilter === 'PLATINO' ? 'bg-cyan-400 text-black shadow-md' : 'bg-zinc-800/70 text-cyan-400/70 hover:text-cyan-300'
              }`}
            >
              💎 Platino
            </button>
            <button
              type="button"
              onClick={() => setNivelFilter('DIAMANTE')}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                nivelFilter === 'DIAMANTE' ? 'bg-violet-400 text-black shadow-md' : 'bg-zinc-800/70 text-violet-400/70 hover:text-violet-300'
              }`}
            >
              💎 Diamante
            </button>
          </div>
        </div>

        {/* LISTADO DE RESULTADOS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {loading ? (
            <div className="py-16 text-center text-zinc-500 text-sm">
              <span className="inline-block w-7 h-7 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-2"></span>
              <p>Buscando en la base de datos de clientes...</p>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="py-14 text-center text-zinc-500">
              <User className="w-10 h-10 mx-auto text-zinc-700 mb-2" />
              <p className="font-bold text-white text-base">No se encontraron clientes</p>
              <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                No hay coincidencias con "{query}". Puedes cerrar esta ventana e ingresar los datos del nuevo cliente en el formulario.
              </p>
              {query && (
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-4 font-black uppercase text-xs"
                  onClick={() => {
                    onSelectCliente({
                      id: '',
                      nombre: query,
                      email: null,
                      telefono: null,
                      ci: null,
                    })
                    onClose()
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Usar "{query}" como Nuevo Cliente
                </Button>
              )}
            </div>
          ) : (
            clientesFiltrados.map((cliente) => {
              return (
                <div
                  key={cliente.id}
                  onClick={() => {
                    onSelectCliente(cliente)
                    onClose()
                  }}
                  className="p-3.5 sm:p-4 bg-zinc-950/70 border border-zinc-800/80 hover:border-amber-500/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group transition-all hover:bg-zinc-900 shadow-md"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-lg shrink-0 group-hover:scale-105 transition-transform">
                      {cliente.nombre ? cliente.nombre.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-black text-white text-sm group-hover:text-amber-400 transition-colors truncate">
                          {cliente.nombre}
                        </h4>
                        {nivelBadge(cliente.nivel_fidelidad)}
                        {cliente.codigo_tarjeta && (
                          <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-700">
                            Cód: {cliente.codigo_tarjeta}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-zinc-400">
                        {cliente.ci && (
                          <span className="flex items-center gap-1">
                            <IdCard className="w-3.5 h-3.5 text-zinc-500" /> CI: {cliente.ci}
                          </span>
                        )}
                        {cliente.telefono && (
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <Phone className="w-3.5 h-3.5" /> {cliente.telefono}
                          </span>
                        )}
                        {cliente.email && (
                          <span className="flex items-center gap-1 text-zinc-400 truncate max-w-[180px]">
                            <Mail className="w-3.5 h-3.5 text-zinc-500" /> {cliente.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-800 shrink-0">
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-black text-white">
                        {cliente.total_visitas || 0} visitas
                      </p>
                      <p className="text-[11px] text-amber-400 font-bold">
                        {formatCurrency(cliente.total_gastado || 0)} gastado
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="primary"
                      className="font-black uppercase text-[11px] tracking-wider shrink-0 gap-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectCliente(cliente)
                        onClose()
                      }}
                    >
                      <Check className="w-3.5 h-3.5" /> Seleccionar
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Mostrando <strong className="text-white">{clientesFiltrados.length}</strong> clientes disponibles
          </p>
          <Button variant="outline" size="sm" onClick={onClose} className="font-bold text-xs uppercase tracking-wider">
            Cerrar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
