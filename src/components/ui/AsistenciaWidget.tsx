'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Clock, Play, Square, Loader2, Info, AlertTriangle, UtensilsCrossed, Coffee, MapPin, Camera, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import {
  computeEstadoFromRecord,
  estadoBadgeVariant,
  estadoLabel,
  isAfterAutoCloseHour,
  getBusinessDateString,
  type AsistenciaEstado,
} from '@/lib/asistencia/helpers'
import { AUTO_CLOSE_HOUR, LUNCH_REMINDER_MINUTES } from '@/lib/asistencia/constants'
import { uploadImageToImgBB } from '@/lib/utils/uploadImage'
import Link from 'next/link'

interface AsistenciaRecord {
  id: string
  hora_entrada: string
  hora_salida: string | null
  horas_trabajadas: number | null
  cierre_automatico?: boolean
  editado_admin?: boolean
  estado?: string
  en_almuerzo?: boolean
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

  // Almuerzo
  const [enAlmuerzo, setEnAlmuerzo] = useState(false)
  const [finAlmuerzo, setFinAlmuerzo] = useState<string | null>(null)
  const [tiempoAlmuerzo, setTiempoAlmuerzo] = useState('')
  const [almuerzoCompletadoHoy, setAlmuerzoCompletadoHoy] = useState(false)
  const [submittingAlmuerzo, setSubmittingAlmuerzo] = useState(false)
  const [almuerzoExcedido, setAlmuerzoExcedido] = useState(false)
  const [excedidoNotificado, setExcedidoNotificado] = useState(false)

  // Selfie & Foto
  const [showSelfiePrompt, setShowSelfiePrompt] = useState(false)
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)
  const [selfieLinkInput, setSelfieLinkInput] = useState('')
  const [requiereFotoConfig, setRequiereFotoConfig] = useState(true)
  const [uploadingSelfie, setUploadingSelfie] = useState(false)
  const selfieInputRef = useRef<HTMLInputElement>(null)

  // Congelar scroll de fondo y enviar pantalla hasta arriba al abrir modal de selfie
  useEffect(() => {
    if (showSelfiePrompt) {
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
        document.body.style.overflow = 'hidden'
      }
    } else {
      if (typeof window !== 'undefined') {
        document.body.style.overflow = ''
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        document.body.style.overflow = ''
      }
    }
  }, [showSelfiePrompt])

  // Geolocalización
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

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

      const hoy = getBusinessDateString()

      const { data: asistenciasArr } = await supabase
        .from('asistencias')
        .select('*')
        .eq('profile_id', user.id)
        .eq('fecha', hoy)
        .is('hora_salida', null)
        .order('created_at', { ascending: false })
        .limit(1)

      const data = asistenciasArr?.[0] || null

      // Leer configuración de asistencia (requiere_foto)
      const { data: asisConfig } = await supabase
        .from('configuraciones')
        .select('valor')
        .eq('llave', 'asistencia_config')
        .maybeSingle()

      if (asisConfig?.valor?.requiere_foto !== undefined) {
        setRequiereFotoConfig(Boolean(asisConfig.valor.requiere_foto))
      }

      if (data) {
        setAsistencia(data)
        setEnAlmuerzo(data.en_almuerzo ?? false)
      } else {
        setAsistencia(null)
        setEnAlmuerzo(false)
      }

      // Verificar bloqueos de almuerzo de hoy
      if (data) {
        const inicioDia = `${hoy}T00:00:00-04:00`
        const finDia = `${hoy}T23:59:59-04:00`
        const { data: bloqueosArr } = await supabase
          .from('barbero_bloqueos')
          .select('fecha_fin')
          .eq('barbero_id', user.id)
          .gte('fecha_inicio', inicioDia)
          .lte('fecha_inicio', finDia)
          .ilike('motivo', '%almuerzo%')
          .order('created_at', { ascending: false })
          .limit(1)

        const bloqueo = bloqueosArr?.[0]

        if (bloqueo) {
          const fin = new Date(bloqueo.fecha_fin)
          if (data.en_almuerzo) {
            // Actualmente en almuerzo
            setFinAlmuerzo(bloqueo.fecha_fin)
            setAlmuerzoCompletadoHoy(false)
          } else if (fin < new Date()) {
            // Ya almorzó hoy (bloque expiró y no está en almuerzo, o no lo inició)
            setEnAlmuerzo(false)
            setFinAlmuerzo(null)
            setAlmuerzoCompletadoHoy(true)
          } else {
            // Bloque pre-programado existe en el futuro y aún no lo inicia
            setEnAlmuerzo(false)
            setFinAlmuerzo(null)
            setAlmuerzoCompletadoHoy(false)
          }
        } else {
          setAlmuerzoCompletadoHoy(false)
        }
      }
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

  // Cronómetro de turno
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (asistencia && !asistencia.hora_salida && asistencia.hora_entrada && !enAlmuerzo) {
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
  }, [asistencia, enAlmuerzo])

  // Cuenta regresiva de almuerzo & Notificación 5 minutos — SIN auto-cierre
  const [notificadoRecordatorio, setNotificadoRecordatorio] = useState(false)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (enAlmuerzo && finAlmuerzo) {
      const updateCountdown = () => {
        const fin = new Date(finAlmuerzo).getTime()
        const diff = fin - Date.now()

        if (diff <= 0) {
          // Almuerzo excedido — NO auto-cerrar, mostrar tiempo excedido
          setAlmuerzoExcedido(true)
          const absDiff = Math.abs(diff)
          const min = Math.floor(absDiff / 60000)
          const sec = Math.floor((absDiff % 60000) / 1000)
          setTiempoAlmuerzo(`-${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`)

          // Notificar a admins UNA sola vez que el barbero excedió
          if (!excedidoNotificado) {
            setExcedidoNotificado(true)
            fetch('/api/asistencias/almuerzo/excedido', { method: 'POST' })
              .catch(err => console.error('Error notificando almuerzo excedido:', err))
          }
          return
        }

        setAlmuerzoExcedido(false)

        // Notificar por sistema y email si quedan LUNCH_REMINDER_MINUTES minutos o menos
        if (diff <= LUNCH_REMINDER_MINUTES * 60 * 1000 && !notificadoRecordatorio) {
          setNotificadoRecordatorio(true)
          fetch('/api/asistencias/almuerzo/recordatorio', { method: 'POST' })
            .catch(err => console.error('Error enviando recordatorio almuerzo:', err))
          
          success(`⏰ Te quedan ${LUNCH_REMINDER_MINUTES} minutos de almuerzo. ¡Prepárate para volver!`)
        }

        const min = Math.floor(diff / 60000)
        const sec = Math.floor((diff % 60000) / 1000)
        setTiempoAlmuerzo(`${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`)
      }
      updateCountdown()
      interval = setInterval(updateCountdown, 1000)
    } else {
      setNotificadoRecordatorio(false)
      setAlmuerzoExcedido(false)
      setExcedidoNotificado(false)
    }
    return () => clearInterval(interval)
  }, [enAlmuerzo, finAlmuerzo, success, notificadoRecordatorio, excedidoNotificado])

  // ─── Obtener geolocalización ─────────────────────────────────────────
  const getLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null)
        return
      }
      setGeoStatus('loading')
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCoords(c)
          setGeoStatus('done')
          resolve(c)
        },
        () => {
          setGeoStatus('error')
          resolve(null) // Permitir marcar sin ubicación
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  }

  // ─── Flujo de marcar entrada: GPS → Selfie/Foto (si aplica) → Submit ─
  const iniciarEntrada = async () => {
    if (!userId) return

    // Auto-scroll a la parte superior de la pantalla en móviles
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // 1. Obtener ubicación
    const loc = await getLocation()
    setCoords(loc)

    // 2. Si requiere foto, mostrar modal e iniciar cámara en vivo. Si no, registrar.
    if (requiereFotoConfig) {
      setShowSelfiePrompt(true)
      setTimeout(() => {
        startCamera()
      }, 200)
    } else {
      await submitEntrada(null)
    }
  }
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop())
      setCameraStream(null)
    }
    setCameraActive(false)
  }, [cameraStream])

  const startCamera = async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      })
      setCameraStream(stream)
      setCameraActive(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (e: any) {
      console.error('Error abriendo cámara en vivo:', e)
      setCameraError('No se pudo acceder a la cámara frontal. Habilita los permisos de cámara en tu celular/navegador.')
    }
  }

  const takeLiveSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 480
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(async (blob) => {
      if (!blob) return
      stopCamera()
      setUploadingSelfie(true)
      try {
        const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' })
        const url = await uploadImageToImgBB(file)
        setSelfieUrl(url)
        setShowSelfiePrompt(false)
        await submitEntrada(url)
      } catch (err: any) {
        toastError(err.message || 'Error al subir la selfie')
        startCamera()
      } finally {
        setUploadingSelfie(false)
      }
    }, 'image/jpeg', 0.85)
  }

  const skipSelfie = async () => {
    if (requiereFotoConfig) {
      toastError('La selfie en vivo es obligatoria para marcar entrada según la regla del local.')
      return
    }
    stopCamera()
    setShowSelfiePrompt(false)
    await submitEntrada(null)
  }

  const submitEntrada = async (selfie: string | null) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/asistencias/entrada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          selfie_url: selfie,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al marcar entrada')

      const estadoInicial = json.estadoInicial
      setAsistencia(json.registro)
      setSelfieUrl(null)
      setCoords(null)
      setGeoStatus('idle')
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

  // ─── Marcar salida ───────────────────────────────────────────────────
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

    if (enAlmuerzo) {
      toastError('Debes volver del almuerzo antes de marcar tu salida.')
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

  // ─── Almuerzo handlers ───────────────────────────────────────────────
  const handleIniciarAlmuerzo = async () => {
    setSubmittingAlmuerzo(true)
    try {
      const res = await fetch('/api/asistencias/almuerzo', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al iniciar almuerzo')

      setEnAlmuerzo(true)
      setFinAlmuerzo(json.fin_almuerzo)
      success(`¡Buen provecho! Tienes ${json.duracion_minutos} minutos.`)
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Error al iniciar almuerzo')
    } finally {
      setSubmittingAlmuerzo(false)
    }
  }

  const handleVolverAlmuerzo = async () => {
    setSubmittingAlmuerzo(true)
    try {
      // 1. Obtener ubicación GPS
      const loc = await getLocation()

      // 2. Enviar regreso con coordenadas al backend
      const res = await fetch('/api/asistencias/almuerzo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: loc?.lat ?? null,
          lng: loc?.lng ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al regresar del almuerzo')

      setEnAlmuerzo(false)
      setFinAlmuerzo(null)
      setAlmuerzoExcedido(false)
      setExcedidoNotificado(false)
      setCoords(null)
      setGeoStatus('idle')
      success(json.mensaje || '¡Bienvenido de vuelta!')
      checkStatus()
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Error al regresar del almuerzo')
    } finally {
      setSubmittingAlmuerzo(false)
    }
  }

  // ─── Admin view ──────────────────────────────────────────────────────
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
    <>
      <Card
        className={`border shadow-xl transition-all duration-300 ${
          almuerzoExcedido
            ? 'bg-red-500/10 border-red-500/30'
            : enAlmuerzo
              ? 'bg-orange-500/10 border-orange-500/30'
              : enTurno
                ? 'bg-amber-500/10 border-amber-500/30'
                : estado === 'finalizado'
                  ? 'bg-zinc-900 border-white/5'
                  : 'bg-zinc-900 border-white/5'
        }`}
      >
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${almuerzoExcedido ? 'text-red-500 animate-pulse' : enAlmuerzo ? 'text-orange-500' : enTurno ? 'text-amber-500 animate-pulse' : 'text-zinc-500'}`} />
              <h3 className="font-black uppercase tracking-widest text-sm text-white">Mi asistencia</h3>
            </div>
            {enAlmuerzo ? (
              <Badge variant={almuerzoExcedido ? 'danger' : 'warning'} className="uppercase text-[10px] font-black">
                {almuerzoExcedido ? '⚠️ Excedido' : '🍽️ Almorzando'}
              </Badge>
            ) : (
              <Badge variant={estadoBadgeVariant(estado)} className="uppercase text-[10px] font-black">
                {estadoLabel(estado)}
              </Badge>
            )}
          </div>

          <div className="rounded-xl bg-black/30 border border-white/5 p-3 text-[11px] text-zinc-400 leading-relaxed flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Si no marcas salida antes de las <strong className="text-amber-400">{AUTO_CLOSE_HOUR}:00</strong>, el
              sistema cierra tu turno automáticamente. Después de esa hora, solo el administrador puede corregir el
              registro.
            </span>
          </div>

          {/* ── ESTADO: AUSENTE (NO HA MARCADO ENTRADA) ── */}
          {estado === 'ausente' && (
            <div>
              <p className="text-zinc-400 text-xs mb-4">Aún no has marcado tu entrada hoy.</p>
              <Button
                onClick={iniciarEntrada}
                disabled={submitting || isAfterAutoCloseHour() || showSelfiePrompt}
                className="w-full bg-green-500 hover:bg-green-400 text-black font-black uppercase tracking-widest shadow-lg shadow-green-500/20"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</>
                ) : geoStatus === 'loading' ? (
                  <><MapPin className="w-4 h-4 mr-2 animate-pulse" /> Obteniendo ubicación...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Marcar entrada</>
                )}
              </Button>
              {geoStatus === 'error' && (
                <p className="text-yellow-400/80 text-[10px] mt-2 text-center font-medium">
                  ⚠️ No se pudo obtener tu ubicación. Se registrará sin GPS.
                </p>
              )}
              {isAfterAutoCloseHour() && (
                <p className="text-red-400/80 text-[10px] mt-2 text-center font-bold uppercase">
                  Horario de marcación cerrado por hoy
                </p>
              )}
            </div>
          )}

          {/* ── ESTADO: EN ALMUERZO ── */}
          {enTurno && enAlmuerzo && asistencia && (
            <div className="space-y-3">
              <div className={`text-center py-4 rounded-xl border ${
                almuerzoExcedido
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-orange-500/10 border-orange-500/20'
              }`}>
                <UtensilsCrossed className={`w-8 h-8 mx-auto mb-2 ${almuerzoExcedido ? 'text-red-500' : 'text-orange-500'}`} />
                <p className="text-white font-black text-sm">
                  {almuerzoExcedido ? '⚠️ Almuerzo excedido' : 'En pausa de almuerzo'}
                </p>
                <p className={`font-mono font-bold text-2xl mt-2 tracking-wider ${
                  almuerzoExcedido ? 'text-red-400 animate-pulse' : 'text-orange-400'
                }`}>{tiempoAlmuerzo}</p>
                <p className={`text-[10px] mt-1 uppercase tracking-widest ${
                  almuerzoExcedido ? 'text-red-400/70' : 'text-zinc-500'
                }`}>
                  {almuerzoExcedido ? 'Tiempo excedido — marca tu regreso' : 'Tiempo restante'}
                </p>
              </div>
              {almuerzoExcedido && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-[11px] text-red-300 leading-relaxed flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>
                    Tu tiempo de almuerzo se agotó. El sistema sigue contando como descanso y la administración fue notificada.
                    Debes marcar tu regreso <strong className="text-red-200">manualmente</strong> y estar cerca de la barbería.
                  </span>
                </div>
              )}
              <Button
                onClick={handleVolverAlmuerzo}
                disabled={submittingAlmuerzo || geoStatus === 'loading'}
                className={`w-full font-black uppercase tracking-widest shadow-lg ${
                  almuerzoExcedido
                    ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20 animate-pulse'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                }`}
              >
                {submittingAlmuerzo ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando ubicación...</>
                ) : geoStatus === 'loading' ? (
                  <><MapPin className="w-4 h-4 mr-2 animate-pulse" /> Obteniendo ubicación...</>
                ) : (
                  <><Coffee className="w-4 h-4 mr-2" /> {almuerzoExcedido ? 'Marcar regreso ahora' : 'Volver del almuerzo'}</>
                )}
              </Button>
              {geoStatus === 'error' && (
                <p className="text-yellow-400/80 text-[10px] text-center font-medium">
                  ⚠️ No se pudo obtener tu ubicación. Verifica los permisos de GPS.
                </p>
              )}
              <p className="text-zinc-600 text-[10px] text-center">
                {almuerzoExcedido
                  ? 'Tu ubicación será verificada al marcar regreso.'
                  : 'No apareces disponible para reservas durante tu almuerzo.'}
              </p>
            </div>
          )}

          {/* ── ESTADO: EN TURNO (NO ALMORZANDO) ── */}
          {enTurno && !enAlmuerzo && asistencia && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-zinc-400 text-xs">
                  Desde:{' '}
                  <span className="text-white font-bold">
                    {new Date(asistencia.hora_entrada).toLocaleTimeString('es-MX', {
                      timeZone: 'America/La_Paz',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
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

              <div className="grid grid-cols-2 gap-2 mb-2">
                <Button
                  onClick={handleIniciarAlmuerzo}
                  disabled={submittingAlmuerzo || isAfterAutoCloseHour() || almuerzoCompletadoHoy}
                  className={`font-black uppercase tracking-widest text-[10px] shadow-lg ${
                    almuerzoCompletadoHoy
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                      : 'bg-orange-500 hover:bg-orange-400 text-black shadow-orange-500/20'
                  }`}
                >
                  {submittingAlmuerzo ? (
                    '...'
                  ) : almuerzoCompletadoHoy ? (
                    <>✓ Almuerzo realizado</>
                  ) : (
                    <><UtensilsCrossed className="w-3.5 h-3.5 mr-1.5" /> Almorzar</>
                  )}
                </Button>
                <Button
                  onClick={handleSalida}
                  disabled={submitting || isAfterAutoCloseHour()}
                  className="bg-red-500 hover:bg-red-400 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20"
                >
                  {submitting ? '...' : (
                    <><Square className="w-3.5 h-3.5 mr-1.5 fill-white" /> Salida</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── ESTADO: TURNO FINALIZADO ── */}
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

      {/* ── MODAL: Captura de Selfie en Vivo (Fijado a la CIMA SUPERIOR de la pantalla) ── */}
      {showSelfiePrompt && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full min-h-screen z-[99999] flex flex-col items-center justify-start pt-2 sm:pt-6 pb-12 px-3 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-zinc-950 border-2 border-amber-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-sm w-full space-y-4 shadow-2xl mt-0 mb-12">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-500" /> Selfie en Vivo
              </h3>
              <button onClick={skipSelfie} className="p-1.5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-colors border border-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-zinc-400 text-xs leading-relaxed">
              Posiciona tu rostro frente a la cámara y presiona el botón para registrar tu entrada en vivo.
            </p>

            <canvas ref={canvasRef} className="hidden" />

            {uploadingSelfie ? (
              <div className="flex flex-col items-center py-10">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-3" />
                <p className="text-zinc-300 text-xs font-bold uppercase tracking-widest">Subiendo y registrando selfie...</p>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {cameraError ? (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center space-y-2">
                    <AlertTriangle className="w-6 h-6 text-red-400 mx-auto" />
                    <p className="text-xs text-red-300 font-bold">{cameraError}</p>
                    <Button onClick={startCamera} size="sm" variant="outline" className="text-xs border-red-500/30 text-red-400">
                      Reintentar Cámara
                    </Button>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black h-56 shadow-inner">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover -scale-x-100"
                    />
                    {!cameraActive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
                        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={takeLiveSnapshot}
                  disabled={!cameraActive || uploadingSelfie}
                  className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 text-xs"
                >
                  <Camera className="w-4 h-4 mr-2" /> 📸 Tomar Selfie Ahora
                </Button>

                {!requiereFotoConfig && (
                  <button
                    onClick={skipSelfie}
                    className="w-full text-center text-zinc-500 hover:text-zinc-300 text-xs font-bold uppercase tracking-widest transition-colors py-1"
                  >
                    Omitir y marcar sin foto
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
