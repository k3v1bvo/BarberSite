'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import {
  Scissors, Calendar, Clock, CheckCircle, XCircle,
  ChevronRight, MessageSquare, Star, Sparkles, Gift,
  Trophy, Zap, Shield, Crown, Flame
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface CardData {
  profile: { full_name: string; email: string; phone: string | null }
  cliente: {
    id: string; nombre: string; cumpleanos: string | null
    total_visitas: number; total_gastado: number; nivel_fidelidad: string
    ultima_visita: string | null; ci: string | null
  } | null
  esCumpleanos: boolean
  cumpleVerificado: boolean
  diasParaCumple: number | null
  proximaMeta: any | null
  metasAlcanzadas: any[]
  canjes: any[]
  promosHoy: any[]
  ultimasCitas: any[]
}

interface Cita {
  id: string; estado: string; precio: number; fecha_hora: string; notas: string | null
  servicios?: { nombre: string; descripcion: string | null }
  barberos?: { full_name: string }
}

const NIVEL_CONFIG: Record<string, any> = {
  BRONCE: { gradient: 'from-[#7c5c36] via-[#b5845a] to-[#6b4423]', border: 'border-amber-700/50', icon: Shield, label: 'Bronce', next: 'PLATA', nextVisitas: 15, textColor: 'text-amber-200' },
  PLATA: { gradient: 'from-[#4a5568] via-[#718096] to-[#2d3748]', border: 'border-zinc-400/50', icon: Star, label: 'Plata', next: 'ORO', nextVisitas: 30, textColor: 'text-zinc-200' },
  ORO: { gradient: 'from-[#b7791f] via-[#f6ad55] to-[#c05621]', border: 'border-amber-400/50', icon: Crown, label: 'Oro', next: 'PLATINO', nextVisitas: 45, textColor: 'text-amber-100' },
  PLATINO: { gradient: 'from-[#94a3b8] via-[#e2e8f0] to-[#64748b]', border: 'border-slate-300/50', icon: Sparkles, label: 'Platino', next: 'DIAMANTE', nextVisitas: 60, textColor: 'text-slate-800' },
  DIAMANTE: { gradient: 'from-[#1e3a8a] via-[#3b82f6] to-[#0f172a]', border: 'border-blue-400/50', icon: Zap, label: 'Diamante', next: null, nextVisitas: 60, textColor: 'text-blue-100' },
}

const PROMO_ICONS: Record<string, string> = {
  '2x1': '✂️', descuento_porcentaje: '💸', descuento_fijo: '💰',
  servicio_gratis: '🎁', cumpleanos: '🎂', nivel_lealtad: '👑'
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function ClientePage() {
  const { success, error: toastError } = useToast()
  const [cardData, setCardData] = useState<CardData | null>(null)
  const [citasProximas, setCitasProximas] = useState<Cita[]>([])
  const [citasPasadas, setCitasPasadas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [birthdayGlow, setBirthdayGlow] = useState(false)
  
  // Reseñas
  const [reviewModal, setReviewModal] = useState<{ open: boolean; citaId: string | null; barberoId: string | null }>({ open: false, citaId: null, barberoId: null })
  const [reviewData, setReviewData] = useState({ estrellas: 5, comentario: '' })
  const [submittingReview, setSubmittingReview] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  // Animación de birthday glow
  useEffect(() => {
    if (cardData?.esCumpleanos) {
      const interval = setInterval(() => setBirthdayGlow(g => !g), 1000)
      return () => clearInterval(interval)
    }
  }, [cardData?.esCumpleanos])

  const loadData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return router.push('/login')

      const [cardRes, citasRes] = await Promise.all([
        fetch('/api/lealtad/cliente-card'),
        supabase.from('citas')
          .select('*, servicios(nombre, descripcion), profiles!barbero_id(full_name)')
          .eq('cliente_id', authUser.id)
          .order('fecha_hora', { ascending: true })
      ])

      if (cardRes.ok) setCardData(await cardRes.json())

      const ahora = new Date().toISOString()
      const citas = (citasRes.data as unknown as Cita[]) ?? []
      setCitasProximas(citas.filter(c => c.fecha_hora >= ahora && c.estado !== 'cancelado'))
      setCitasPasadas(citas.filter(c => c.fecha_hora < ahora || c.estado === 'cancelado').reverse().slice(0, 8))
    } finally {
      setLoading(false)
    }
  }

  const cancelarCita = async (citaId: string) => {
    if (!confirm('¿Estás seguro de que deseas cancelar esta cita?')) return
    try {
      const { error } = await supabase.from('citas').update({ estado: 'cancelado' }).eq('id', citaId)
      if (error) throw error
      success('Cita cancelada exitosamente')
      loadData()
    } catch (e: any) {
      toastError('Error al cancelar cita')
    }
  }

  const submitReview = async () => {
    setSubmittingReview(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('reviews').insert({
        cliente_id: user?.id,
        cita_id: reviewModal.citaId,
        barbero_id: reviewModal.barberoId,
        estrellas: reviewData.estrellas,
        comentario: reviewData.comentario
      })
      if (error) throw error
      success('¡Gracias por tu reseña! ⭐')
      setReviewModal({ open: false, citaId: null, barberoId: null })
      setReviewData({ estrellas: 5, comentario: '' })
    } catch (e: any) {
      toastError('Error enviando reseña')
    } finally {
      setSubmittingReview(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const v: Record<string, any> = { pendiente: 'warning', confirmado: 'info', en_proceso: 'info', completado: 'success', cancelado: 'danger' }
    return v[estado] || 'default'
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="w-14 h-14 border-4 border-zinc-800 border-t-amber-500 rounded-full animate-spin mb-6" />
        <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-xs">Cargando tu tarjeta...</p>
      </div>
    )
  }

  const cliente = cardData?.cliente
  const nivel = cliente?.nivel_fidelidad ?? 'BRONCE'
  const config = NIVEL_CONFIG[nivel] ?? NIVEL_CONFIG.BRONCE
  const NivelIcon = config.icon
  const visitas = cliente?.total_visitas ?? 0
  const proximaMeta = cardData?.proximaMeta
  const progreso = proximaMeta ? Math.min((visitas / proximaMeta.visitas_requeridas) * 100, 100) : 100
  const nombre = cardData?.profile?.full_name ?? cliente?.nombre ?? 'Cliente'
  const nombreCorto = nombre.split(' ').slice(0, 2).join(' ').toUpperCase()
  const memberNum = cliente?.ci ? cliente.ci.replace(/\D/g, '').slice(-8).padStart(8, '0') : '00000001'

  return (
    <div className="min-h-screen space-y-8 animate-in fade-in duration-700 pb-24 lg:pb-8">

      {/* ══════════ BANNER DE CUMPLEAÑOS ══════════ */}
      {cardData?.esCumpleanos && (
        <div className={cn(
          'relative overflow-hidden rounded-3xl p-6 transition-all duration-1000',
          birthdayGlow
            ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 shadow-[0_0_60px_rgba(245,158,11,0.6)]'
            : 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
        )}>
          <div className="absolute inset-0 overflow-hidden">
            {['🎂', '🎉', '✨', '🎈', '⭐', '🎁', '💫', '🎊'].map((emoji, i) => (
              <span key={i} className="absolute text-2xl animate-bounce opacity-40"
                style={{ left: `${10 + i * 12}%`, top: `${Math.sin(i) * 30 + 20}%`, animationDelay: `${i * 0.2}s`, animationDuration: `${1 + i * 0.1}s` }}>
                {emoji}
              </span>
            ))}
          </div>
          <div className="relative z-10 text-center">
            <p className="text-5xl mb-3">🎂</p>
            <h2 className="text-3xl font-black text-black uppercase tracking-tight">¡Feliz Cumpleaños, {nombre.split(' ')[0]}!</h2>
            <p className="text-black/70 font-bold mt-2">
              {cardData.cumpleVerificado
                ? '🎁 Tu regalo ya fue verificado. ¡Disfrútalo!'
                : '📋 Presenta tu documento en recepción para activar tu regalo especial'}
            </p>
            {cardData.cumpleVerificado && (
              <div className="mt-4 inline-flex items-center gap-2 bg-black/20 backdrop-blur rounded-2xl px-6 py-3 text-black font-black uppercase tracking-widest text-sm">
                <CheckCircle size={18} /> Regalo Activado
              </div>
            )}
          </div>
        </div>
      )}

      {/* Próximo cumpleaños */}
      {!cardData?.esCumpleanos && cardData?.diasParaCumple !== null && (cardData?.diasParaCumple ?? 999) <= 30 && (
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4">
          <span className="text-3xl">🎂</span>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Próximo cumpleaños</p>
            <p className="text-white font-black">En <span className="text-amber-500">{cardData?.diasParaCumple} días</span> — ¡Habrá sorpresa especial!</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">

        {/* ══════════ COLUMNA IZQUIERDA: TARJETA + PROMOS ══════════ */}
        <div className="xl:col-span-3 space-y-6">

          {/* ——— TARJETA DIGITAL PREMIUM ——— */}
          <div className="perspective-1000">
            <div className={cn(
              'relative rounded-3xl overflow-hidden shadow-2xl',
              `bg-gradient-to-br ${config.gradient}`,
              'transform transition-transform duration-300 hover:scale-[1.02]',
            )} style={{ aspectRatio: '1.586 / 1', minHeight: '260px' }}>

              {/* Ruido de fondo */}
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundSize: '200px' }} />

              {/* Círculos decorativos */}
              <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5" />
              <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-black/10" />

              {/* Logo de tijeras grande */}
              <div className="absolute top-6 right-8 opacity-15">
                <Scissors size={100} className="text-white transform rotate-45" />
              </div>

              {/* Contenido principal */}
              <div className="absolute inset-0 p-7 flex flex-col justify-between">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                      <Scissors size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.3em] leading-none">BARBER PRO</p>
                      <p className="text-white text-[11px] font-black uppercase tracking-widest">Loyalty Card</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-black/20 backdrop-blur rounded-xl px-3 py-1.5">
                    <NivelIcon size={14} className="text-white" />
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">{config.label}</span>
                  </div>
                </div>

                {/* Número de miembro tipo chip */}
                <div>
                  <p className="text-white/40 text-[9px] font-mono mb-1 tracking-widest">MEMBER</p>
                  <p className="text-white/80 font-mono text-sm tracking-[0.3em]">
                    {memberNum.replace(/(\d{4})/g, '$1 ').trim()}
                  </p>
                </div>

                {/* Nombre y stats */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold mb-1">Titular</p>
                    <p className={cn('font-black text-xl tracking-tight', config.textColor)}>{nombreCorto}</p>
                    {cliente?.cumpleanos && (
                      <p className="text-white/40 text-[9px] font-mono mt-0.5">
                        🎂 {new Date(cliente.cumpleanos + 'T12:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold">Visitas</p>
                        <p className={cn('font-black text-2xl', config.textColor)}>{visitas}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra holográfica decorativa */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </div>
          </div>

          {/* ——— PROGRESO DE LEALTAD (CICLO DE 10 VISITAS) ——— */}
          <Card className="bg-zinc-900 border-white/5 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tu Tarjeta de Sellos</p>
                  <p className="text-white font-black text-xl">Recompensas Frecuentes</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-white">{visitas}</p>
                  <p className="text-xs text-zinc-500 uppercase font-black tracking-widest">visitas totales</p>
                </div>
              </div>

              {/* Tira de 10 Sellos */}
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-6">
                {Array.from({ length: 10 }).map((_, idx) => {
                  const visitNum = idx + 1;
                  const currentCycle = visitas % 10;
                  const isCompleted = visitNum <= currentCycle || (currentCycle === 0 && visitas > 0 && visitNum <= 10 && visitas !== 0);
                  // Fix for when visits is exactly a multiple of 10
                  const isActuallyCompleted = visitas > 0 && (currentCycle === 0 ? true : visitNum <= currentCycle);
                  const isCurrent = visitNum === currentCycle + 1;
                  
                  const isHalfReward = visitNum === 5;
                  const isFullReward = visitNum === 10;

                  return (
                    <div 
                      key={idx} 
                      className={cn(
                        "relative aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all",
                        isActuallyCompleted 
                          ? "bg-amber-500/20 border-amber-500 text-amber-500"
                          : isCurrent
                            ? "bg-zinc-800 border-amber-500/50 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                            : "bg-black/40 border-zinc-800 text-zinc-600",
                        isHalfReward && !isActuallyCompleted ? "border-dashed border-amber-500/30" : "",
                        isFullReward && !isActuallyCompleted ? "border-dashed border-amber-500/50" : ""
                      )}
                    >
                      {/* Icon */}
                      {isActuallyCompleted ? (
                        <CheckCircle className="w-5 h-5 mb-1 text-amber-500" />
                      ) : isHalfReward ? (
                        <span className="text-lg mb-1">✂️</span>
                      ) : isFullReward ? (
                        <span className="text-xl mb-1">🎁</span>
                      ) : (
                        <span className="text-xs font-bold mb-1 opacity-50">{visitNum}</span>
                      )}
                      
                      {/* Text */}
                      {isHalfReward && <span className="text-[8px] font-black uppercase text-center leading-tight">50%<br/>OFF</span>}
                      {isFullReward && <span className="text-[8px] font-black uppercase text-center leading-tight text-amber-400">CORTE<br/>GRATIS</span>}
                    </div>
                  );
                })}
              </div>

              {/* Alerta de Próxima Recompensa */}
              <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-amber-500 text-xs font-black uppercase tracking-widest mb-0.5 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" /> Próxima Recompensa
                  </p>
                  <p className="text-white font-bold text-sm">
                    {visitas % 10 < 5 
                      ? `En ${5 - (visitas % 10)} visitas obtienes 50% de descuento.` 
                      : `En ${10 - (visitas % 10)} visitas obtienes un corte GRATIS.`
                    }
                  </p>
                </div>
              </div>

              {/* Mantener metas adicionales de la DB si existen */}
              {proximaMeta && proximaMeta.nombre && proximaMeta.visitas_requeridas > 10 && (
                 <div className="mt-6 pt-6 border-t border-white/5">
                   <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Meta Global: {proximaMeta.nombre}</p>
                   <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
                     <div
                       className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                       style={{ width: `${Math.min((visitas / proximaMeta.visitas_requeridas) * 100, 100)}%` }}
                     />
                   </div>
                   <p className="text-xs text-zinc-400 font-bold">
                     Faltan {proximaMeta.visitas_requeridas - visitas} visitas para desbloquear: {proximaMeta.tipo_recompensa}
                   </p>
                 </div>
              )}

              {cardData?.metasAlcanzadas && cardData.metasAlcanzadas.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {cardData.metasAlcanzadas.map(m => (
                    <div key={m.id} className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-1.5">
                      <Trophy size={12} className="text-green-500" />
                      <span className="text-green-400 text-[10px] font-black uppercase tracking-wide">{m.nombre}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ——— PROMOS DE HOY ——— */}
          {cardData?.promosHoy && cardData.promosHoy.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Flame size={18} className="text-amber-500" />
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Promos de Hoy — {DIAS[new Date().getDay()]}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cardData.promosHoy.map((promo: any) => (
                  <div key={promo.id} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-amber-500/20 p-4 hover:border-amber-500/50 transition-all">
                    <div className="absolute top-0 right-0 p-3 text-4xl opacity-20">{promo.icono ?? PROMO_ICONS[promo.tipo] ?? '🎁'}</div>
                    <p className="text-amber-500 text-xs font-black uppercase tracking-widest mb-1">{promo.tipo.replace(/_/g, ' ')}</p>
                    <p className="text-white font-black text-base">{promo.nombre}</p>
                    {promo.descripcion && <p className="text-zinc-400 text-xs mt-1">{promo.descripcion}</p>}
                    {promo.valor > 0 && (
                      <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500 rounded-xl px-3 py-1">
                        <Zap size={12} className="text-black" />
                        <span className="text-black font-black text-sm">
                          {promo.tipo === 'descuento_porcentaje' && `${promo.valor}% OFF`}
                          {promo.tipo === 'descuento_fijo' && `Bs ${promo.valor} OFF`}
                          {promo.tipo === '2x1' && '2 x 1'}
                        </span>
                      </div>
                    )}
                    {promo.valor === 0 && promo.tipo === '2x1' && (
                      <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500 rounded-xl px-3 py-1">
                        <Scissors size={12} className="text-black" />
                        <span className="text-black font-black text-sm">2 × 1</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sin promos hoy */}
          {cardData?.promosHoy && cardData.promosHoy.length === 0 && (
            <div className="text-center py-6 rounded-2xl border border-dashed border-white/10 bg-zinc-900/30">
              <Gift size={32} className="mx-auto text-zinc-700 mb-2" />
              <p className="text-zinc-500 text-sm font-bold">Sin promociones especiales hoy</p>
              <p className="text-zinc-600 text-xs mt-1">Los martes hay 2x1 ✂️</p>
            </div>
          )}
        </div>

        {/* ══════════ COLUMNA DERECHA: CITAS ══════════ */}
        <div className="xl:col-span-2 space-y-6">

          {/* Botón reservar */}
          <Button
            variant="primary"
            onClick={() => router.push('/reservar')}
            className="w-full h-14 font-black uppercase tracking-widest text-base shadow-xl shadow-amber-500/20"
          >
            <Scissors size={20} className="mr-3" /> Agendar Nuevo Corte
          </Button>

          {/* Citas próximas */}
          <div>
            <div className="flex items-center justify-between mb-3 border-l-4 border-amber-500 pl-3 h-8">
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Próximas</h2>
              <Badge variant="warning" className="text-[9px] font-black uppercase px-2">{citasProximas.length}</Badge>
            </div>

            {citasProximas.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-2xl">
                <Calendar size={40} className="mx-auto text-zinc-800 mb-3 opacity-30" />
                <p className="text-zinc-600 text-sm font-bold uppercase tracking-widest">Sin citas programadas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {citasProximas.map(cita => (
                  <Card key={cita.id} className="bg-zinc-900 border-white/5 group hover:border-amber-500/20 transition-all">
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                            <Calendar size={18} className="text-amber-500" />
                          </div>
                          <div>
                            <p className="font-black text-white text-sm uppercase leading-tight">{(cita as any).servicios?.nombre}</p>
                            <p className="text-zinc-500 text-xs mt-0.5">
                              {new Date(cita.fecha_hora).toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric', month: 'short' })}
                              {' · '}
                              {new Date(cita.fecha_hora).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-amber-500/80 text-[10px] font-black uppercase tracking-widest mt-1">
                              Con: {(cita as any).profiles?.full_name || 'Barbero'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant={getEstadoBadge(cita.estado)} className="text-[9px] uppercase font-black mb-1">{cita.estado}</Badge>
                          <p className="text-amber-500 font-black text-sm">{formatCurrency(cita.precio)}</p>
                        </div>
                      </div>
                      {(cita.estado === 'pendiente' || cita.estado === 'confirmado') && (
                        <button
                          className="mt-3 w-full text-[11px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white transition-all py-2.5 rounded-xl border border-red-500/20 active:scale-95 shadow-sm shadow-red-500/5"
                          onClick={() => cancelarCita(cita.id)}
                        >
                          Cancelar cita
                        </button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Historial */}
          <div>
            <div className="flex items-center gap-3 mb-3 border-l-4 border-zinc-700 pl-3 h-8">
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Historial</h2>
            </div>
            <div className="space-y-2">
              {citasPasadas.map(cita => (
                <div key={cita.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-900 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center border',
                      cita.estado === 'completado'
                        ? 'bg-green-500/10 border-green-500/20 text-green-500'
                        : 'bg-red-500/10 border-red-500/20 text-red-500'
                    )}>
                      {cita.estado === 'completado' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    </div>
                    <div>
                      <p className="text-white text-xs font-black uppercase leading-none">{(cita as any).servicios?.nombre}</p>
                      <p className="text-zinc-600 text-[10px] mt-0.5 font-mono">
                        {new Date(cita.fecha_hora).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-zinc-400 text-xs font-black">{formatCurrency(cita.precio)}</p>
                    {cita.estado === 'completado' && (
                      <button
                        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-600 hover:bg-amber-500 hover:text-black transition-all opacity-0 group-hover:opacity-100"
                        onClick={() => {
                          setReviewModal({ open: true, citaId: cita.id, barberoId: (cita as any).barbero_id || null })
                        }}
                      >
                        <MessageSquare size={12} />
                      </button>
                    )}
                    <ChevronRight size={12} className="text-zinc-700" />
                  </div>
                </div>
              ))}
              {citasPasadas.length === 0 && (
                <p className="text-center text-zinc-700 py-6 text-sm font-bold uppercase tracking-widest">Sin historial aún</p>
              )}
            </div>
          </div>

          {/* Últimos canjes */}
          {cardData?.canjes && cardData.canjes.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3 border-l-4 border-green-700 pl-3 h-8">
                <h2 className="text-sm font-black uppercase tracking-widest text-green-500">Recompensas</h2>
              </div>
              <div className="space-y-2">
                {cardData.canjes.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                    <Gift size={16} className="text-green-500 shrink-0" />
                    <div>
                      <p className="text-green-300 text-xs font-black uppercase">{c.descripcion}</p>
                      <p className="text-green-600 text-[10px] font-mono">{new Date(c.canjeado_at).toLocaleDateString('es-BO')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Review */}
      {reviewModal.open && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="w-full max-w-sm border-white/10 shadow-2xl bg-zinc-950">
            <div className="p-6">
              <h3 className="text-xl font-black uppercase text-white mb-4">Califica el Servicio</h3>
              
              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setReviewData({ ...reviewData, estrellas: star })}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      size={32}
                      className={cn(
                        star <= reviewData.estrellas ? "fill-amber-500 text-amber-500" : "text-zinc-700"
                      )}
                    />
                  </button>
                ))}
              </div>

              <textarea
                className="w-full p-4 border border-white/10 bg-zinc-900 rounded-2xl text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all mb-4"
                rows={4}
                placeholder="Opcional: ¿Qué te pareció el corte, el ambiente y el barbero?"
                value={reviewData.comentario}
                onChange={(e) => setReviewData({ ...reviewData, comentario: e.target.value })}
              />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-white/10 text-zinc-400"
                  onClick={() => setReviewModal({ open: false, citaId: null, barberoId: null })}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 font-black uppercase tracking-widest text-xs"
                  onClick={submitReview}
                  disabled={submittingReview}
                >
                  {submittingReview ? 'Enviando...' : 'Enviar Reseña'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

    </div>
  )
}
