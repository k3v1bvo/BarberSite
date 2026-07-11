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
        <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setImagenZoom(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {/* Close */}
            <button
              onClick={() => setImagenZoom(null)}
              className="absolute -top-12 right-0 w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Imagen grande */}
            <div className="bg-zinc-900 rounded-3xl overflow-hidden border border-white/10">
              <img
                src={imagenZoom.url}
                alt={imagenZoom.label}
                className="w-full max-h-[70vh] object-contain"
              />
              {/* Info */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl">{imagenZoom.icono}</span>
                    <div>
                      <p className="font-black text-white uppercase">{imagenZoom.label}</p>
                      {imagenZoom.meta && <p className="text-zinc-400 text-sm">{imagenZoom.meta}</p>}
                    </div>
                    <Badge variant={BADGE_VARIANT[imagenZoom.categoria] ?? 'default'} className="text-[9px] uppercase">{imagenZoom.categoria}</Badge>
                  </div>
                  {imagenZoom.fecha && (
                    <p className="text-zinc-600 text-xs font-mono">{new Date(imagenZoom.fecha).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  )}
                </div>
                <a
                  href={imagenZoom.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm font-bold transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink size={14} /> Abrir original
                </a>
              </div>
            </div>

            {/* URL pequeña */}
            <div className="mt-3 px-3 py-2 bg-zinc-900/80 rounded-xl border border-white/5">
              <p className="text-zinc-500 text-[10px] font-mono break-all">{imagenZoom.url}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
