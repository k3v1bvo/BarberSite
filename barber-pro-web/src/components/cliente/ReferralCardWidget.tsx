'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Gift, Share2, Copy, Check, Users, DollarSign, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props {
  clienteId: string
  clienteNombre: string
  ci?: string | null
}

export function ReferralCardWidget({ clienteId, clienteNombre, ci }: Props) {
  const { success, error: toastError } = useToast()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const loadSaldo = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/referidos/saldo?cliente_id=${clienteId}`)
      const json = await res.json()
      if (res.ok) {
        setData(json)
      }
    } catch (e) {
      console.error('Error cargando saldo de referidos:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (clienteId) {
      loadSaldo()
    }
  }, [clienteId])

  const referralLink = `https://barber-site-livid.vercel.app/reservar?ref=${clienteId}`
  const referralCode = ci || clienteId.slice(0, 8).toUpperCase()
  const montoBono = data?.monto_bono_default || 10

  const shareText = `💈 ¡Hola! Te recomiendo cortarte en BarberSite. Agenda tu cita en línea desde este enlace y te atenderán con la mejor calidad: ${referralLink}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      success('¡Enlace de referido copiado al portapapeles!')
      setTimeout(() => setCopied(false), 3000)
    } catch (_) {
      toastError('No se pudo copiar el enlace')
    }
  }

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'BarberSite - Recomendación',
          text: shareText,
          url: referralLink,
        })
      } catch (_) {
        // Fallback to whatsapp url
        window.open(whatsappUrl, '_blank')
      }
    } else {
      window.open(whatsappUrl, '_blank')
    }
  }

  const saldoDisponible = data?.saldo_disponible || 0
  const amigosAtendidos = data?.amigos_atendidos || 0
  const totalReferidos = data?.total_referidos || 0
  const historial = data?.historial || []

  return (
    <div className="bg-gradient-to-br from-emerald-950/80 via-zinc-900 to-zinc-950 border-2 border-emerald-500/30 rounded-3xl p-6 sm:p-8 mt-8 shadow-2xl relative overflow-hidden print:hidden">
      <div className="absolute top-0 right-0 p-8 text-7xl opacity-10 pointer-events-none font-black text-emerald-400">
        🎁
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-400 shadow-lg shadow-emerald-500/10">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Programa de Referidos
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mt-1">
              Gana <span className="text-emerald-400">Bs {montoBono}</span> por cada amigo
            </h2>
          </div>
        </div>

        {/* Saldo Badge */}
        <div className="bg-zinc-950/90 border border-emerald-500/40 rounded-2xl p-3.5 sm:px-5 flex items-center gap-3 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400 block">Tu Saldo Acumulado</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400">
              Bs {formatCurrency(saldoDisponible)}
            </span>
          </div>
        </div>
      </div>

      <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed max-w-2xl mb-6 font-medium">
        Comparte tu enlace con tus amigos. Cuando ellos agenden y completen su primer corte, recibirás automáticamente <strong className="text-emerald-400 font-bold">Bs {montoBono} de saldo</strong> para descontar en tu próxima visita a la barbería.
      </p>

      {/* Grid de Métricas y Enlace */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Métrica 1 */}
        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-black">
            <Users size={18} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-zinc-400 block">Amigos que vinieron</span>
            <span className="text-lg font-black text-white">{amigosAtendidos} completados</span>
          </div>
        </div>

        {/* Métrica 2 */}
        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-black">
            <Sparkles size={18} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-zinc-400 block">Tu Código Personal</span>
            <span className="text-lg font-black text-emerald-400 tracking-wider">{referralCode}</span>
          </div>
        </div>

        {/* Métrica 3 */}
        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-black">
            <Gift size={18} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-zinc-400 block">Uso en Caja POS</span>
            <span className="text-xs font-bold text-zinc-300">Descuento directo</span>
          </div>
        </div>
      </div>

      {/* Botones de Acción Viral */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-13 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-wider text-xs rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-all cursor-pointer no-underline text-center"
        >
          <Share2 className="w-4 h-4" />
          <span>📲 Compartir mi Enlace por WhatsApp</span>
        </a>

        <Button
          onClick={copyLink}
          variant="outline"
          className="h-13 px-6 bg-zinc-950/80 hover:bg-zinc-800 border-white/15 text-zinc-200 hover:text-white font-black uppercase tracking-wider text-xs rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
          <span>{copied ? '¡Copiado!' : 'Copiar Link'}</span>
        </Button>

        {historial.length > 0 && (
          <Button
            onClick={() => setShowHistory(!showHistory)}
            variant="ghost"
            className="h-13 px-4 text-zinc-400 hover:text-white text-xs font-bold flex items-center gap-1.5"
          >
            <span>Ver amigos ({historial.length})</span>
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
        )}
      </div>

      {/* Historial Desplegable */}
      {showHistory && historial.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/10 space-y-2 animate-in fade-in duration-300">
          <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-3">
            Historial de amigos invitados:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {historial.map((item: any) => (
              <div key={item.id} className="p-3 bg-zinc-950/60 border border-white/5 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-white">{item.amigo_nombre}</p>
                  <p className="text-[10px] text-zinc-500">
                    {new Date(item.fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
                <div className="text-right">
                  {item.bono_otorgado ? (
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      +Bs {item.monto_bono} Acreditado
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md">
                      ⏳ Pendiente de visita
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
