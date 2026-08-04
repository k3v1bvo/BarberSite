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
import { AUTO_CLOSE_HOUR } from '@/lib/asistencia/constants'
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

  // Selfie & Foto
  const [showSelfiePrompt, setShowSelfiePrompt] = useState(false)
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)
  const [selfieLinkInput, setSelfieLinkInput] = useState('')
  const [requiereFotoConfig, setRequiereFotoConfig] = useState(true)
  const [uploadingSelfie, setUploadingSelfie] = useState(false)
  const selfieInputRef = useRef<HTMLInputElement>(null)

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

      const { data } = await supabase
        .from('asistencias')
        .select('*')
        .eq('profile_id', user.id)
        .eq('fecha', hoy)
        .maybeSingle()

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
        const { data: bloqueo } = await supabase
          .from('barbero_bloqueos')
          .select('fecha_fin')
          .eq('barbero_id', user.id)
          .eq('tipo', 'almuerzo')
          .gte('fecha_inicio', inicioDia)
          .lte('fecha_inicio', finDia)
          .maybeSingle()

        if (bloqueo) {
          const fin = new Date(bloqueo.fecha_fin)
          if (fin > new Date() && data.en_almuerzo) {
            setFinAlmuerzo(bloqueo.fecha_fin)
            setAlmuerzoCompletadoHoy(false)
          } else {
            // Ya almorzó hoy
            setEnAlmuerzo(false)
            setFinAlmuerzo(null)
            setAlmuerzoCompletadoHoy(true)
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

  // Cuenta regresiva de almuerzo
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (enAlmuerzo && finAlmuerzo) {
      const updateCountdown = () => {
        const fin = new Date(finAlmuerzo).getTime()
        const diff = fin - Date.now()
        if (diff <= 0) {
          // Almuerzo terminó
          setTiempoAlmuerzo('00:00')
          fetch('/api/asistencias/almuerzo', { method: 'DELETE' })
            .then(() => {
              setEnAlmuerzo(false)
              setFinAlmuerzo(null)
              success('¡Tu almuerzo terminó! Ya estás de vuelta.')
              checkStatus()
            })
          return
        }
        const min = Math.floor(diff / 60000)
        const sec = Math.floor((diff % 60000) / 1000)
        setTiempoAlmuerzo(`${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`)
      }
      updateCountdown()
      interval = setInterval(updateCountdown, 1000)
    }
    return () => clearInterval(interval)
  }, [enAlmuerzo, finAlmuerzo, success, checkStatus])

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

    // 1. Obtener ubicación
    const loc = await getLocation()
    setCoords(loc)

    // 2. Si requiere foto, mostrar modal. Si no, registrar directamente.
    if (requiereFotoConfig) {
      setShowSelfiePrompt(true)
    } else {
      await submitEntrada(null)
    }
  }

  const handleSelfieCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingSelfie(true)
    try {
      const url = await uploadImageToImgBB(file)
      setSelfieUrl(url)
      await submitEntrada(url)
    } catch (err) {
      console.error('Error subiendo selfie:', err)
      if (!requiereFotoConfig) {
        await submitEntrada(null)
      } else {
        toastError('Error al subir la imagen. Intenta pegando un enlace directo.')
      }
    } finally {
      setUploadingSelfie(false)
      setShowSelfiePrompt(false)
    }
  }

  const handleLinkSubmit = async () => {
    if (!selfieLinkInput.trim()) {
      toastError('Ingresa una URL o enlace de imagen válido.')
      return
    }
    setShowSelfiePrompt(false)
    await submitEntrada(selfieLinkInput.trim())
  }

  const skipSelfie = async () => {
    if (requiereFotoConfig) {
      toastError('La foto es obligatoria para marcar entrada según la configuración de la barbería.')
      return
    }
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
      const res = await fetch('/api/asistencias/almuerzo', { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al regresar del almuerzo')

      setEnAlmuerzo(false)
      setFinAlmuerzo(null)
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
          enAlmuerzo
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
              <Clock className={`w-5 h-5 ${enAlmuerzo ? 'text-orange-500' : enTurno ? 'text-amber-500 animate-pulse' : 'text-zinc-500'}`} />
              <h3 className="font-black uppercase tracking-widest text-sm text-white">Mi asistencia</h3>
            </div>
            {enAlmuerzo ? (
              <Badge variant="warning" className="uppercase text-[10px] font-black">
                🍽️ Almorzando
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
              <div className="text-center py-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <UtensilsCrossed className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="text-white font-black text-sm">En pausa de almuerzo</p>
                <p className="text-orange-400 font-mono font-bold text-2xl mt-2 tracking-wider">{tiempoAlmuerzo}</p>
                <p className="text-zinc-500 text-[10px] mt-1 uppercase tracking-widest">Tiempo restante</p>
              </div>
              <Button
                onClick={handleVolverAlmuerzo}
                disabled={submittingAlmuerzo}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20"
              >
                {submittingAlmuerzo ? '...' : (
                  <><Coffee className="w-4 h-4 mr-2" /> Volver del almuerzo</>
                )}
              </Button>
              <p className="text-zinc-600 text-[10px] text-center">
                No apareces disponible para reservas durante tu almuerzo.
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

      {/* ── MODAL: Captura de Selfie ── */}
      {showSelfiePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-500" /> Selfie de entrada
              </h3>
              <button onClick={skipSelfie} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-zinc-400 text-xs leading-relaxed">
              Tómate una selfie como comprobante de asistencia. Tu administrador podrá verificarla.
            </p>

            {uploadingSelfie ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-3" />
                <p className="text-zinc-400 text-sm">Subiendo foto...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handleSelfieCapture}
                />
                <Button
                  onClick={() => selfieInputRef.current?.click()}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest shadow-lg shadow-amber-500/20"
                >
                  <Camera className="w-4 h-4 mr-2" /> 📸 Tomar foto / Galería
                </Button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink mx-2 text-[10px] text-zinc-500 uppercase font-black">O pegar enlace</span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={selfieLinkInput}
                    onChange={(e) => setSelfieLinkInput(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50"
                  />
                  <Button
                    onClick={handleLinkSubmit}
                    variant="outline"
                    className="border-amber-500/30 text-amber-400 text-xs font-bold"
                  >
                    Usar Link
                  </Button>
                </div>

                {!requiereFotoConfig ? (
                  <button
                    onClick={skipSelfie}
                    className="w-full text-center text-zinc-500 hover:text-zinc-300 text-xs font-bold uppercase tracking-widest transition-colors py-2"
                  >
                    Omitir y marcar sin foto
                  </button>
                ) : (
                  <p className="text-[10px] text-amber-500/80 text-center font-semibold pt-1">
                    * La foto es obligatoria por regla del local.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
