'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Images, ExternalLink, RefreshCw, ZoomIn, X, Search, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface ImagenSistema {
  id: string; url: string; label: string; categoria: string
  icono: string; meta: string | null; fecha: string | null
  barberoNombre?: string
  clienteNombre?: string
  monto?: number | string
  tipoMovimiento?: string
}

const CATEGORIA_COLORES: Record<string, string> = {
  'Sistema': 'border-amber-500/30 bg-amber-500/5',
  'Portafolio': 'border-blue-500/30 bg-blue-500/5',
  'Equipo': 'border-purple-500/30 bg-purple-500/5',
  'Productos': 'border-green-500/30 bg-green-500/5',
  'Avatares': 'border-zinc-400/30 bg-zinc-800/50',
  'Documentos Cumpleaños': 'border-orange-500/30 bg-orange-500/5',
  'Comprobantes Financieros': 'border-emerald-500/30 bg-emerald-500/5',
  'Comprobantes Servicios': 'border-cyan-500/30 bg-cyan-500/5',
}

const BADGE_VARIANT: Record<string, any> = {
  'Sistema': 'warning', 'Portafolio': 'info', 'Equipo': 'default',
  'Productos': 'success', 'Avatares': 'default', 'Documentos Cumpleaños': 'danger',
  'Comprobantes Financieros': 'success', 'Comprobantes Servicios': 'info',
}

export default function GaleriaPage() {
  const [imagenes, setImagenes] = useState<ImagenSistema[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all')
  const [busqueda, setBusqueda] = useState('')
  const [imagenZoom, setImagenZoom] = useState<ImagenSistema | null>(null)
  const [errores, setErrores] = useState<Set<string>>(new Set())

  const [rolPermitido, setRolPermitido] = useState<boolean | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile && ['admin', 'coordinador'].includes(profile.role)) {
          setRolPermitido(true)
        } else {
          setRolPermitido(false)
          setLoading(false)
          return
        }
      } else {
        setRolPermitido(false)
        setLoading(false)
        return
      }

      const res = await fetch('/api/galeria-sistema')
      if (res.ok) {
        const data = await res.json()
        setImagenes(data.galeria ?? [])
        setCategorias(data.categorias ?? [])
        setTotal(data.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  const filtradas = imagenes.filter(img => {
    const matchCat = filtroCategoria === 'all' || img.categoria === filtroCategoria
    const matchBusq = !busqueda || img.label.toLowerCase().includes(busqueda.toLowerCase()) || img.meta?.toLowerCase().includes(busqueda.toLowerCase())
    return matchCat && matchBusq && !errores.has(img.id)
  })

  const handleError = (id: string) => setErrores(prev => new Set([...prev, id]))

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Cargando galería...</p>
      </div>
    )
  }

  if (rolPermitido === false) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center p-6">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Acceso Restringido</h2>
        <p className="text-zinc-400 text-sm mt-2 max-w-md">
          La Galería Completa de Comprobantes y Sistema es confidencial y está restringida únicamente para los roles <span className="text-amber-400 font-bold">Administrador</span> y <span className="text-amber-400 font-bold">Coordinador</span>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tight">
            <span className="text-amber-500">Galería</span> del Sistema
          </h1>
          <p className="text-zinc-500 mt-1">Todas las imágenes subidas al sistema en un solo lugar</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-2xl px-4 py-3">
            <Images size={16} className="text-amber-500" />
            <div>
              <p className="text-[10px] font-black uppercase text-zinc-600">Total Imágenes</p>
              <p className="text-lg font-black text-white">{total}</p>
            </div>
          </div>
          <Button variant="outline" onClick={load} className="h-14 aspect-square p-0 flex items-center justify-center">
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-4">
        {/* Búsqueda */}
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full h-11 pl-10 pr-4 bg-zinc-900 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-amber-500/50"
          />
        </div>

        {/* Tabs de categoría */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroCategoria('all')}
            className={cn('px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border',
              filtroCategoria === 'all' ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-zinc-500 hover:border-white/10')}
          >
            Todas ({total})
          </button>
          {categorias.map(cat => {
            const count = imagenes.filter(i => i.categoria === cat && !errores.has(i.id)).length
            return (
              <button key={cat}
                onClick={() => setFiltroCategoria(cat)}
                className={cn('px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2',
                  filtroCategoria === cat ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-zinc-500 hover:border-white/10')}
              >
                {cat} <span className="text-zinc-600 font-mono text-[10px]">({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid de imágenes */}
      {filtradas.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
          <Images size={48} className="mx-auto text-zinc-800 mb-4" />
          <p className="text-zinc-600 font-black uppercase tracking-widest">No hay imágenes en esta categoría</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtradas.map(img => (
            <div key={img.id}
              className={cn('group relative rounded-2xl overflow-hidden border cursor-pointer transition-all hover:scale-105 hover:shadow-2xl',
                CATEGORIA_COLORES[img.categoria] ?? 'border-white/5 bg-zinc-900')}
              onClick={() => setImagenZoom(img)}
            >
              {/* Imagen */}
              <div className="aspect-square relative bg-zinc-900">
                <img
                  src={img.url}
                  alt={img.label}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={() => handleError(img.id)}
                  loading="lazy"
                />
                {/* Overlay en hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn size={24} className="text-white" />
                </div>
              </div>

              {/* Info debajo */}
              <div className="p-2">
                <p className="text-white text-[10px] font-black uppercase truncate">{img.label}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px]">{img.icono}</span>
                  <p className="text-zinc-500 text-[9px] truncate">{img.categoria}</p>
                </div>
                {img.meta && <p className="text-zinc-600 text-[9px] truncate mt-0.5">{img.meta}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox / Zoom */}
      {imagenZoom && (
        <div
          className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-3 sm:p-6 backdrop-blur-md overflow-y-auto"
          onClick={() => setImagenZoom(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-zinc-900/90 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl shrink-0">{imagenZoom.icono}</span>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white uppercase truncate">
                    {imagenZoom.label}
                  </h3>
                  <p className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">
                    {imagenZoom.tipoMovimiento || imagenZoom.categoria}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={imagenZoom.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-white text-xs font-bold transition-colors"
                >
                  <ExternalLink size={13} /> Original
                </a>
                <button
                  onClick={() => setImagenZoom(null)}
                  className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Contenedor de Imagen adaptado para que NUNCA se desborde */}
            <div className="flex-1 min-h-0 bg-black/60 flex items-center justify-center p-3 overflow-hidden">
              <img
                src={imagenZoom.url}
                alt={imagenZoom.label}
                className="max-w-full max-h-[48vh] object-contain rounded-xl"
              />
            </div>

            {/* Detalles del Movimiento (Barbero, Cliente, Monto, Fecha) */}
            <div className="p-4 bg-zinc-900/95 border-t border-white/10 shrink-0 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {imagenZoom.barberoNombre && (
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <p className="text-[10px] uppercase font-black text-zinc-400">✂️ Barbero</p>
                    <p className="text-xs font-bold text-white truncate mt-0.5">
                      {imagenZoom.barberoNombre}
                    </p>
                  </div>
                )}

                {imagenZoom.clienteNombre && (
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <p className="text-[10px] uppercase font-black text-zinc-400">👤 Cliente</p>
                    <p className="text-xs font-bold text-white truncate mt-0.5">
                      {imagenZoom.clienteNombre}
                    </p>
                  </div>
                )}

                {imagenZoom.monto !== undefined && (
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <p className="text-[10px] uppercase font-black text-zinc-400">💰 Monto</p>
                    <p className="text-xs font-black text-emerald-400 mt-0.5">
                      Bs {imagenZoom.monto}
                    </p>
                  </div>
                )}

                {imagenZoom.fecha && (
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <p className="text-[10px] uppercase font-black text-zinc-400">📅 Fecha</p>
                    <p className="text-xs font-mono text-zinc-300 truncate mt-0.5">
                      {new Date(imagenZoom.fecha).toLocaleDateString('es-BO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {imagenZoom.meta && (
                <p className="text-xs text-zinc-400 font-medium break-words bg-black/30 p-2 rounded-lg border border-white/5">
                  📋 {imagenZoom.meta}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
