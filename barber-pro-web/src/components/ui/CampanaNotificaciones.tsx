'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, Check, Clock, Info, AlertCircle, CheckCircle2, ExternalLink, X, Volume2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// Variable global para reutilizar AudioContext ya desbloqueado por interacción del usuario
let sharedAudioCtx: AudioContext | null = null

const getAudioContext = () => {
  if (typeof window === 'undefined') return null
  if (!sharedAudioCtx) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioCtxClass) {
      sharedAudioCtx = new AudioCtxClass()
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {})
  }
  return sharedAudioCtx
}

// Reproduce el timbre sonoro cristalino y activa la vibración en móviles
export const playNotificationSound = () => {
  try {
    // 1. Vibración háptica en celulares
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([120, 70, 150])
      } catch {}
    }

    // 2. Timbre acústico de alta definición mediante Web Audio API
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    
    // Campanada armónica 1 (Nota Mi6 / E6: 1318.5 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(1318.5, now)
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.6)

    // Campanada armónica 2 (Nota Sol6 / G6: 1567.98 Hz - tono de confirmación)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1567.98, now + 0.1)
    gain2.gain.setValueAtTime(0, now + 0.1)
    gain2.gain.linearRampToValueAtTime(0.28, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.1)
    osc2.stop(now + 0.75)
  } catch (e) {
    // Ignorar si el navegador bloquea autoplay antes de cualquier toque
  }
}

interface Notificacion {
  id: string
  titulo: string
  mensaje: string
  tipo: string
  categoria?: string
  leido: boolean
  link: string | null
  created_at: string
  user_id?: string | null
  rol_destino?: string | null
}

interface Props {
  userId: string
  userRole: string
}

export function CampanaNotificaciones({ userId, userRole }: Props) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [liveToast, setLiveToast] = useState<Notificacion | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notificaciones.filter((n) => !n.leido).length

  // Desbloqueo proactivo del AudioContext en el primer toque del usuario
  useEffect(() => {
    const handleUnlock = () => {
      getAudioContext()
    }
    window.addEventListener('click', handleUnlock, { once: true })
    window.addEventListener('touchstart', handleUnlock, { once: true })
    window.addEventListener('keydown', handleUnlock, { once: true })
    return () => {
      window.removeEventListener('click', handleUnlock)
      window.removeEventListener('touchstart', handleUnlock)
      window.removeEventListener('keydown', handleUnlock)
    }
  }, [])

  const belongsToUser = useCallback(
    (n: Notificacion) => n.user_id === userId || n.rol_destino === userRole,
    [userId, userRole]
  )

  const fetchNotificaciones = useCallback(async () => {
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .or(`user_id.eq.${userId},rol_destino.eq.${userRole}`)
      .order('created_at', { ascending: false })
      .limit(25)

    if (data) setNotificaciones(data)
  }, [supabase, userId, userRole])

  useEffect(() => {
    fetchNotificaciones()

    const channel = supabase
      .channel(`notifs_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones' },
        (payload) => {
          const n = payload.new as Notificacion
          if (belongsToUser(n)) {
            playNotificationSound()
            setLiveToast(n)
            setTimeout(() => {
              setLiveToast((current) => (current?.id === n.id ? null : current))
            }, 6000)

            setNotificaciones((prev) => {
              if (prev.some((x) => x.id === n.id)) return prev
              return [n, ...prev]
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notificaciones' },
        (payload) => {
          const n = payload.new as Notificacion
          if (belongsToUser(n)) {
            setNotificaciones((prev) => prev.map((x) => (x.id === n.id ? n : x)))
          }
        }
      )
      .subscribe()

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)

    // Nota: el setInterval(fetchNotificaciones, 60_000) fue eliminado.
    // El canal Realtime de arriba ya cubre INSERT y UPDATE en tiempo real.

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userId, userRole, belongsToUser, fetchNotificaciones, supabase])

  const markAsRead = async (id: string) => {
    await fetch(`/api/notificaciones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leido: true }),
    })
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leido: true } : n)))
  }

  const markAllAsRead = async () => {
    await fetch('/api/notificaciones/mark-all', { method: 'POST' })
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leido: true })))
  }

  const handleNotifClick = (notif: Notificacion) => {
    if (!notif.leido) markAsRead(notif.id)
    setIsOpen(false)
    if (notif.link) router.push(notif.link)
  }

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'success':
        return <CheckCircle2 className="text-green-500 w-5 h-5" />
      case 'warning':
        return <AlertCircle className="text-amber-500 w-5 h-5" />
      case 'danger':
        return <AlertCircle className="text-red-500 w-5 h-5" />
      default:
        return <Info className="text-blue-500 w-5 h-5" />
    }
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `Hace ${minutes} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Hace ${hours} h`
    return `Hace ${Math.floor(hours / 24)} d`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-zinc-400 hover:text-white relative transition-colors"
        aria-label="Notificaciones"
      >
        <Bell size={20} className={cn(unreadCount > 0 && 'text-amber-500 animate-pulse')} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-1 bg-red-500 text-white flex items-center justify-center rounded-full text-[9px] font-black shadow-sm shadow-red-500/50">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-12 right-[-60px] sm:right-0 w-[320px] sm:w-[380px] bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl animate-in slide-in-from-top-2 fade-in z-50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/40">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Bell size={16} className="text-amber-500" /> Notificaciones
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={playNotificationSound}
                title="Probar sonido de notificación"
                className="text-[10px] uppercase font-black tracking-wider text-amber-400/80 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-lg border border-amber-500/20 transition-all flex items-center gap-1"
              >
                <Volume2 size={11} /> Probar
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[10px] uppercase font-black tracking-widest text-zinc-500 hover:text-amber-500 transition-colors flex items-center gap-1"
                >
                  <Check size={12} /> Leídas
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notificaciones.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 flex flex-col items-center">
                <Bell size={32} className="opacity-20 mb-2" />
                <p className="text-sm font-medium">Sin notificaciones nuevas</p>
              </div>
            ) : (
              notificaciones.map((notif) => (
                <div
                  key={notif.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotifClick(notif)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNotifClick(notif)
                  }}
                  className={cn(
                    'p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 flex gap-3 group',
                    !notif.leido ? 'bg-amber-500/5 border-l-2 border-l-amber-500' : 'opacity-80'
                  )}
                >
                  <div className="mt-1 shrink-0 bg-black/50 p-2 rounded-full border border-white/5 group-hover:scale-110 transition-transform">
                    {getIcon(notif.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <p
                        className={cn(
                          'text-sm font-bold truncate',
                          !notif.leido ? 'text-white' : 'text-zinc-300'
                        )}
                      >
                        {notif.titulo}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">{notif.mensaje}</p>
                    <p className="text-[10px] text-zinc-600 mt-2 flex items-center gap-1 font-bold uppercase tracking-wider">
                      <Clock size={10} /> {timeAgo(notif.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-white/5 bg-black/40">
            <Link
              href="/notificaciones"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400"
            >
              Ver historial completo
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}

      {/* Banner flotante emergente en tiempo real */}
      {liveToast && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleNotifClick(liveToast)}
          onKeyDown={(e) => e.key === 'Enter' && handleNotifClick(liveToast)}
          className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm w-[90vw] p-4 bg-zinc-950/95 border border-amber-500/50 rounded-2xl shadow-[0_10px_30px_rgba(245,158,11,0.2)] backdrop-blur-xl flex items-start gap-3.5 cursor-pointer animate-in slide-in-from-top-4 duration-300 hover:scale-[1.02] transition-transform"
        >
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5 animate-pulse">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase text-amber-400 tracking-wider">
                Nueva Notificación
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setLiveToast(null)
                }}
                className="text-zinc-500 hover:text-white p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm font-bold text-white mt-0.5 truncate">{liveToast.titulo}</p>
            <p className="text-xs text-zinc-300 line-clamp-2 mt-0.5 leading-relaxed">{liveToast.mensaje}</p>
          </div>
        </div>
      )}
    </div>
  )
}
