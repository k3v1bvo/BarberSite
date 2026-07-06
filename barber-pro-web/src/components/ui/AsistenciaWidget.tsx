'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Clock, Play, Square, Loader2, Info, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import {
  computeEstadoFromRecord,
  estadoBadgeVariant,
  estadoLabel,
  isAfterAutoCloseHour,
  type AsistenciaEstado,
} from '@/lib/asistencia/helpers'
import { AUTO_CLOSE_HOUR } from '@/lib/asistencia/constants'
import Link from 'next/link'

interface AsistenciaRecord {
  id: string
  hora_entrada: string
  hora_salida: string | null
  horas_trabajadas: number | null
  cierre_automatico?: boolean
  editado_admin?: boolean
  estado?: string
}

export function AsistenciaWidget() {
  const { success, error: toastError } = useToast()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [asistencia, setAsistencia] = useState<AsistenciaRecord | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userName, setUserName] = useState('Colaborador')
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState('00:00:00')

  const supabase = createClient()

  const runAutoClose = useCallback(async () => {
    try {
      await fetch('/api/asistencias/auto-cerrar', { method: 'POST' })
    } catch {
      /* silencioso */
    }
  }, [])

  const checkStatus = useCallback(async () => {
    setLoading(true)
    try {
      await runAutoClose()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()

      if (profile?.full_name) setUserName(profile.full_name)
      setUserRole(profile?.role || null)

      if (profile?.role === 'admin' || profile?.role === 'cliente') {
        setAsistencia(null)
        return
      }

      const hoy = new Date().toISOString().split('T')[0]

      const { data } = await supabase
        .from('asistencias')
        .select('*')
        .eq('profile_id', user.id)
        .eq('fecha', hoy)
        .maybeSingle()

      if (data) setAsistencia(data)
      else setAsistencia(null)
    } catch (error) {
      console.error('Error fetching asistencia', error)
    } finally {
      setLoading(false)
    }
  }, [runAutoClose, supabase])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 60_000)
    return () => clearInterval(interval)
  }, [checkStatus])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (asistencia && !asistencia.hora_salida && asistencia.hora_entrada) {
      interval = setInterval(() => {
        const start = new Date(asistencia.hora_entrada).getTime()
        const diff = Date.now() - start
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        setTiempoTranscurrido(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        )
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [asistencia])

  const handleEntrada = async () => {
    if (!userId) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/asistencias/entrada', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al marcar entrada')

      const estadoInicial = json.estadoInicial
      setAsistencia(json.registro)
      success(estadoInicial === 'atrasado' ? 'Entrada registrada (marcada como atrasada, sanción aplicada)' : '¡Entrada registrada!')

      await fetch('/api/notificaciones/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'asistencia',
          payload: {
            clienteNombre: userName,
            motivo:
              estadoInicial === 'atrasado'
                ? `⚠️ ${userName} marcó entrada con retraso`
                : `⏰ ${userName} inició turno`,
          },
        }),
      })
    } catch (error: unknown) {
      toastError('Error registrando entrada: ' + (error instanceof Error ? error.message : ''))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSalida = async () => {
    if (!asistencia) return

    if (asistencia.cierre_automatico) {
      toastError('Turno cerrado automáticamente. El admin debe corregir el registro.')
      return
    }

    if (isAfterAutoCloseHour()) {
      toastError(`Después de las ${AUTO_CLOSE_HOUR}:00 solo el administrador puede modificar la asistencia.`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/asistencias/${asistencia.id}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al marcar salida')

      setAsistencia(json.registro)
      success('Turno finalizado correctamente')

      await fetch('/api/notificaciones/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'asistencia',
          payload: {
            clienteNombre: userName,
            motivo: `🏁 ${userName} finalizó turno (${json.registro?.horas_trabajadas || 0} h)`,
          },
        }),
      })
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Error al marcar salida')
    } finally {
      setSubmitting(false)
    }
  }

  if (userRole === 'admin') {
    return (
      <Card className="bg-zinc-900 border-amber-500/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-black uppercase tracking-widest text-sm text-white">Control de asistencia</h3>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Como administrador gestionas el personal desde el panel de asistencia.
              </p>
              <Link href="/admin/asistencia" className="inline-block mt-3 text-xs font-bold text-amber-500 hover:text-amber-400 uppercase tracking-widest">
                Ir al panel →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (userRole === 'cliente') return null

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-white/5 animate-pulse">
        <CardContent className="p-6 h-[180px] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  const estado: AsistenciaEstado = asistencia
    ? computeEstadoFromRecord(asistencia)
    : 'ausente'

  const enTurno = estado === 'presente' || estado === 'atrasado'

  return (
    <Card
      className={`border shadow-xl transition-all duration-300 ${
        enTurno
          ? 'bg-amber-500/10 border-amber-500/30'
          : estado === 'finalizado'
            ? 'bg-zinc-900 border-white/5'
            : 'bg-zinc-900 border-white/5'
      }`}
    >
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className={`w-5 h-5 ${enTurno ? 'text-amber-500 animate-pulse' : 'text-zinc-500'}`} />
            <h3 className="font-black uppercase tracking-widest text-sm text-white">Mi asistencia</h3>
          </div>
          <Badge variant={estadoBadgeVariant(estado)} className="uppercase text-[10px] font-black">
            {estadoLabel(estado)}
          </Badge>
        </div>

        <div className="rounded-xl bg-black/30 border border-white/5 p-3 text-[11px] text-zinc-400 leading-relaxed flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            Si no marcas salida antes de las <strong className="text-amber-400">{AUTO_CLOSE_HOUR}:00</strong>, el
            sistema cierra tu turno automáticamente. Después de esa hora, solo el administrador puede corregir el
            registro.
          </span>
        </div>

        {estado === 'ausente' && (
          <div>
            <p className="text-zinc-400 text-xs mb-4">Aún no has marcado tu entrada hoy.</p>
            <Button
              onClick={handleEntrada}
              disabled={submitting || isAfterAutoCloseHour()}
              className="w-full bg-green-500 hover:bg-green-400 text-black font-black uppercase tracking-widest shadow-lg shadow-green-500/20"
            >
              {submitting ? '...' : (
                <>
                  <Play className="w-4 h-4 mr-2" /> Marcar entrada
                </>
              )}
            </Button>
            {isAfterAutoCloseHour() && (
              <p className="text-red-400/80 text-[10px] mt-2 text-center font-bold uppercase">
                Horario de marcación cerrado por hoy
              </p>
            )}
          </div>
        )}

        {enTurno && asistencia && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-zinc-400 text-xs">
                Desde:{' '}
                <span className="text-white font-bold">
                  {new Date(asistencia.hora_entrada).toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </p>
              <span className="text-amber-500 font-mono font-bold tracking-wider">{tiempoTranscurrido}</span>
            </div>
            {estado === 'atrasado' && (
              <p className="text-yellow-400/90 text-xs mb-3 font-medium">
                Tu entrada se registró después del horario esperado.
              </p>
            )}
            <Button
              onClick={handleSalida}
              disabled={submitting || isAfterAutoCloseHour()}
              className="w-full bg-red-500 hover:bg-red-400 text-white font-black uppercase tracking-widest shadow-lg shadow-red-500/20"
            >
              {submitting ? '...' : (
                <>
                  <Square className="w-4 h-4 mr-2 fill-white" /> Marcar salida
                </>
              )}
            </Button>
          </div>
        )}

        {estado === 'finalizado' && asistencia && (
          <div className="space-y-2">
            {asistencia.cierre_automatico && (
              <p className="text-amber-400/90 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Cierre automático a las {AUTO_CLOSE_HOUR}:00
              </p>
            )}
            <div className="flex justify-between text-xs bg-black/20 p-3 rounded-lg">
              <span className="text-zinc-500 font-bold uppercase tracking-widest">Horas</span>
              <span className="text-amber-500 font-black">{asistencia.horas_trabajadas} h</span>
            </div>
            {asistencia.editado_admin && (
              <p className="text-[10px] text-zinc-500 text-center">Ajustado por administración</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
