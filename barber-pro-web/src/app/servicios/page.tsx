'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/ui/Navbar'
import { ServicioGalleryBanner } from '@/components/ui/ServicioGalleryBanner'
import { ServicioDetailModal } from '@/components/ui/ServicioDetailModal'
import { CATEGORIAS_SERVICIOS } from '@/types'
import { formatCurrency, toSentenceCase } from '@/lib/utils'
import {
  Scissors,
  Clock,
  Search,
  Sparkles,
  Calendar,
  ArrowUpDown,
  Filter,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'

interface Servicio {
  id: string
  nombre: string
  precio: number
  duracion_minutos: number
  descripcion: string | null
  categoria?: string
  imagen_url?: string | null
  imagenes?: string[] | null
}

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriaActiva, setCategoriaActiva] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState<string>('')
  const [orden, setOrden] = useState<'populares' | 'precio-asc' | 'precio-desc' | 'duracion-asc'>('populares')
  const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function loadServicios() {
      try {
        const { data, error } = await supabase
          .from('servicios')
          .select('id, nombre, precio, duracion_minutos, descripcion, categoria, imagen_url, imagenes')
          .eq('is_active', true)
          .order('nombre', { ascending: true })

        if (error) throw error
        if (data) {
          setServicios(data as Servicio[])
        }
      } catch (e) {
        console.error('Error al cargar servicios:', e)
      } finally {
        setLoading(false)
      }
    }
    loadServicios()
  }, [])

  // Filtrado y ordenamiento en memoria
  const serviciosFiltrados = useMemo(() => {
    return servicios
      .filter((s) => {
        const catMatch =
          categoriaActiva === 'todos' || (s.categoria || 'Cortes') === categoriaActiva
        const textMatch =
          !busqueda.trim() ||
          s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          (s.descripcion && s.descripcion.toLowerCase().includes(busqueda.toLowerCase()))
        return catMatch && textMatch
      })
      .sort((a, b) => {
        if (orden === 'precio-asc') return a.precio - b.precio
        if (orden === 'precio-desc') return b.precio - a.precio
        if (orden === 'duracion-asc') return a.duracion_minutos - b.duracion_minutos
        return 0 // por defecto orden 'populares' (orden inicial de BD)
      })
  }, [servicios, categoriaActiva, busqueda, orden])

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-32">
      <Navbar />

      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-b from-amber-500/10 via-zinc-950 to-zinc-950 pt-12 pb-10 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-black uppercase tracking-widest mb-6">
            <Scissors className="w-3.5 h-3.5" /> Catálogo Oficial de Barbería
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-4 uppercase">
            Nuestros <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">Servicios</span> & Especialidades
          </h1>
          <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Descubre todos los cortes, rituales de barba, combos exclusivos y tratamientos capilares diseñados para destacar tu estilo personal.
          </p>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="max-w-7xl mx-auto px-4 pt-8">
        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          {/* Input Búsqueda */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar servicio (corte, barba, tinte...)"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-white/10 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Selector de Orden */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <span className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" /> Ordenar por:
            </span>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as any)}
              className="bg-zinc-900 border border-white/10 rounded-xl text-xs font-bold text-white px-3 py-2.5 focus:outline-none focus:border-amber-400 transition-colors cursor-pointer"
            >
              <option value="populares">Más Populares</option>
              <option value="precio-asc">Precio: Menor a Mayor</option>
              <option value="precio-desc">Precio: Mayor a Menor</option>
              <option value="duracion-asc">Duración: Más Corto</option>
            </select>
          </div>
        </div>

        {/* Categorías Pills */}
        <div className="flex flex-wrap items-center gap-2.5 mb-10 pb-2 border-b border-white/5">
          <button
            type="button"
            onClick={() => setCategoriaActiva('todos')}
            className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              categoriaActiva === 'todos'
                ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20 scale-105'
                : 'bg-zinc-900 border border-white/10 text-zinc-400 hover:border-amber-400/50 hover:text-white'
            }`}
          >
            <span>Todos</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20 font-mono">
              {servicios.length}
            </span>
          </button>

          {CATEGORIAS_SERVICIOS.map((cat) => {
            const count = servicios.filter((s) => (s.categoria || 'Cortes') === cat.id).length
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoriaActiva(cat.id)}
                className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  categoriaActiva === cat.id
                    ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20 scale-105'
                    : 'bg-zinc-900 border border-white/10 text-zinc-400 hover:border-amber-400/50 hover:text-white'
                }`}
              >
                <span>{cat.label}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20 font-mono">
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Lista de Servicios / Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-10 h-10 border-4 border-zinc-800 border-t-amber-400 rounded-full animate-spin" />
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Cargando servicios...</p>
          </div>
        ) : serviciosFiltrados.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/50 rounded-3xl border border-white/5 max-w-xl mx-auto p-8">
            <Filter className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-xl font-black text-white mb-2 uppercase">No encontramos servicios</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Prueba cambiando la categoría seleccionada o buscando con otros términos.
            </p>
            <button
              onClick={() => {
                setCategoriaActiva('todos')
                setBusqueda('')
              }}
              className="px-6 py-2.5 bg-amber-400 text-black font-black text-xs uppercase tracking-widest rounded-full hover:bg-amber-300 transition-colors"
            >
              Restablecer Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviciosFiltrados.map((servicio) => {
              const allImgs =
                servicio.imagenes && servicio.imagenes.length > 0
                  ? servicio.imagenes
                  : servicio.imagen_url
                  ? [servicio.imagen_url]
                  : []

              return (
                <div
                  key={servicio.id}
                  className="group bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden hover:border-amber-400/50 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <ServicioGalleryBanner
                      imagenes={allImgs}
                      categoria={servicio.categoria || 'Cortes'}
                    />
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xl font-extrabold text-white group-hover:text-amber-400 transition-colors">
                          {toSentenceCase(servicio.nombre)}
                        </h4>
                        {allImgs.length === 0 && (
                          <span className="text-[9px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                            {servicio.categoria || 'Cortes'}
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-400 text-sm mb-4 line-clamp-3 leading-relaxed">
                        {servicio.descripcion
                          ? toSentenceCase(servicio.descripcion)
                          : 'Servicio profesional realizado por barberos expertos.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 pt-0 mt-auto">
                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <div>
                        <p className="text-2xl font-black text-amber-400 leading-none mb-1">
                          {formatCurrency(servicio.precio)}
                        </p>
                        <p className="text-xs text-zinc-500 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" /> {servicio.duracion_minutos} min
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedServicio(servicio)}
                          className="px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-amber-400 border border-amber-400/30 rounded-full text-xs font-black transition-all uppercase tracking-wider hover:scale-105"
                        >
                          Detalles
                        </button>
                        <Link
                          href={`/reservar?servicio=${servicio.id}`}
                          className="px-4 py-2.5 bg-amber-400 text-black rounded-full text-xs font-black hover:bg-amber-300 hover:scale-105 transition-all uppercase tracking-widest shadow-lg shadow-amber-400/20 flex items-center gap-1"
                        >
                          Reservar <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Detalles de Servicio */}
      <ServicioDetailModal
        servicio={selectedServicio}
        isOpen={Boolean(selectedServicio)}
        onClose={() => setSelectedServicio(null)}
      />
    </div>
  )
}
