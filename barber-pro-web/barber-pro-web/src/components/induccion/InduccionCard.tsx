'use client'

import { parseYouTubeVideoId } from '@/lib/youtube'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Play, CheckCircle2, Clock, Wrench, ChevronRight, Layers, FileText } from 'lucide-react'

interface InduccionCardProps {
  induccion: {
    id: string
    titulo: string
    descripcion?: string
    categoria?: string
    youtube_url?: string
    pdf_url?: string
    pdf_urls?: string[]
    nivel?: string
    dirigido_a?: string[]
    duracion_minutos?: number
    herramientas_requeridas?: string[]
    is_published?: boolean
    servicios?: { nombre: string }
    induccion_pasos?: any[]
  }
  isCompletado?: boolean
  onClick?: () => void
  onToggleComplete?: (e: React.MouseEvent) => void
  showAdminActions?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export function InduccionCard({
  induccion,
  isCompletado = false,
  onClick,
  onToggleComplete,
  showAdminActions = false,
  onEdit,
  onDelete
}: InduccionCardProps) {
  const videoId = induccion.youtube_url ? parseYouTubeVideoId(induccion.youtube_url) : null
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null

  const hasPdfs = (induccion.pdf_urls && induccion.pdf_urls.length > 0) || Boolean(induccion.pdf_url)
  const pdfCount = induccion.pdf_urls?.length || (induccion.pdf_url ? 1 : 0)

  const getNivelBadge = (nivel?: string) => {
    switch (nivel) {
      case 'avanzado': return { label: '🔴 Avanzado', color: 'border-red-500/30 text-red-400' }
      case 'intermedio': return { label: '🟡 Intermedio', color: 'border-amber-500/30 text-amber-400' }
      default: return { label: '🟢 Básico', color: 'border-emerald-500/30 text-emerald-400' }
    }
  }

  const nivelBadge = getNivelBadge(induccion.nivel)

  return (
    <Card 
      onClick={onClick}
      className={`group relative overflow-hidden transition-all duration-300 cursor-pointer border hover:border-amber-500/50 bg-zinc-900/80 hover:bg-zinc-900 shadow-xl ${
        isCompletado ? 'border-emerald-500/30' : 'border-white/10'
      }`}
    >
      {/* Thumbnail Header */}
      <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={thumbnailUrl} 
            alt={induccion.titulo} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-600 p-4 text-center">
            <FileText className="w-12 h-12 stroke-[1.2] text-amber-500/50 mb-1" />
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Documentación & Guía</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-black/30" />

        {/* Status Badge Top Right */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {isCompletado ? (
            <Badge variant="success" className="bg-emerald-500/90 text-white font-black px-2.5 py-1 text-[10px] shadow-lg flex items-center gap-1 backdrop-blur-md">
              <CheckCircle2 className="w-3 h-3" /> Visto
            </Badge>
          ) : (
            <Badge variant="warning" className="bg-amber-500/90 text-black font-black px-2.5 py-1 text-[10px] shadow-lg backdrop-blur-md">
              ⏳ Pendiente
            </Badge>
          )}
        </div>

        {/* Play Icon Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
          <div className="w-12 h-12 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform font-black">
            {thumbnailUrl ? <Play className="w-6 h-6 fill-current ml-0.5" /> : <FileText className="w-6 h-6" />}
          </div>
        </div>

        {/* Servicio / Categoria tag bottom left */}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1">
          {induccion.categoria && (
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-black/80 border border-amber-500/30 px-2 py-0.5 rounded-md backdrop-blur-md">
              🏷️ {induccion.categoria}
            </span>
          )}
          {induccion.servicios?.nombre && (
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-black/80 border border-emerald-500/30 px-2 py-0.5 rounded-md backdrop-blur-md">
              ✂️ {induccion.servicios.nombre}
            </span>
          )}
          {hasPdfs && (
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 bg-black/80 border border-blue-500/30 px-2 py-0.5 rounded-md backdrop-blur-md flex items-center gap-1">
              📄 {pdfCount} {pdfCount === 1 ? 'PDF' : 'PDFs'}
            </span>
          )}
          <span className={`text-[9px] font-black uppercase tracking-widest bg-black/80 border px-2 py-0.5 rounded-md backdrop-blur-md ${nivelBadge.color}`}>
            {nivelBadge.label}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors line-clamp-1">
            {induccion.titulo}
          </h3>
          {induccion.descripcion && (
            <p className="text-xs text-zinc-400 line-clamp-2 mt-1 font-normal">
              {induccion.descripcion}
            </p>
          )}
        </div>

        {/* Metadata items */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-white/5 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-zinc-300">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              {induccion.duracion_minutos || 15} min
            </span>
            <span className="flex items-center gap-1 text-zinc-300">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              {induccion.induccion_pasos?.length || 0} pasos
            </span>
          </div>

          <span className="text-amber-400 font-bold flex items-center gap-0.5 text-xs group-hover:translate-x-1 transition-transform">
            Ver Clase <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Tools tag list */}
        {induccion.herramientas_requeridas && induccion.herramientas_requeridas.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {induccion.herramientas_requeridas.slice(0, 3).map((h, i) => (
              <span key={i} className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-white/5">
                {h}
              </span>
            ))}
            {induccion.herramientas_requeridas.length > 3 && (
              <span className="text-[9px] bg-zinc-800 text-amber-500 px-1.5 py-0.5 rounded font-bold">
                +{induccion.herramientas_requeridas.length - 3} más
              </span>
            )}
          </div>
        )}

        {/* Admin actions if enabled */}
        {showAdminActions && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onEdit}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 transition"
            >
              ✏️ Editar
            </button>
            <button
              onClick={onDelete}
              className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-400 transition border border-red-500/20"
            >
              🗑️ Eliminar
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
