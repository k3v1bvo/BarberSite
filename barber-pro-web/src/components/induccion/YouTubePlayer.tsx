'use client'

import { useState, useEffect } from 'react'
import { getYouTubeEmbedUrl, parseYouTubeVideoId } from '@/lib/youtube'
import { Play, AlertCircle } from 'lucide-react'

interface YouTubePlayerProps {
  url: string
  title?: string
  currentSeconds?: number
  onReady?: () => void
}

export function YouTubePlayer({ url, title = 'Video de Inducción', currentSeconds = 0 }: YouTubePlayerProps) {
  const videoId = parseYouTubeVideoId(url)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (url) {
      const formattedUrl = getYouTubeEmbedUrl(url, currentSeconds, currentSeconds > 0)
      setEmbedUrl(formattedUrl)
    }
  }, [url, currentSeconds])

  if (!videoId || !embedUrl) {
    return (
      <div className="w-full aspect-video bg-zinc-900 border border-white/10 rounded-2xl flex flex-col items-center justify-center p-6 text-center shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-zinc-300">URL de YouTube no válida</p>
        <p className="text-xs text-zinc-500 max-w-xs mt-1">
          Por favor ingresa un enlace estándar de YouTube (ej. https://www.youtube.com/watch?v=...)
        </p>
      </div>
    )
  }

  return (
    <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative group">
      <iframe
        key={`${videoId}-${currentSeconds}`}
        src={embedUrl}
        title={title}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  )
}
