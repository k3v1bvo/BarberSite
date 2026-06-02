'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, Filter, Mail, Settings, Loader2 } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { NotificationPreferences } from '@/lib/notifications/types'
import { DEFAULT_PREFERENCES } from '@/lib/notifications/types'

interface Notificacion {
  id: string
  titulo: string
  mensaje: string
  tipo: string
  categoria?: string
  leido: boolean
  link: string | null
  created_at: string
}

const CATEGORIA_LABELS: Record<string, string> = {
  reserva_nueva: 'Reserva',
  reserva_cancelada: 'Cancelación',
  reserva_reprogramada: 'Reprogramación',
  venta_nueva: 'Venta',
  cita_completada: 'Cobro',
  horario_cambio: 'Horario',
  asistencia: 'Asistencia',
  recordatorio: 'Recordatorio',
  sistema: 'Sistema',
}

export default function NotificacionesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todas' | 'no_leidas'>('todas')
  const [categoria, setCategoria] = useState<string>('')
  const [tab, setTab] = useState<'historial' | 'preferencias'>('historial')
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [savingPrefs, setSavingPrefs] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '80' })
      if (filtro === 'no_leidas') params.set('unread', '1')
      if (categoria) params.set('categoria', categoria)

      const res = await fetch(`/api/notificaciones?${params}`)
      const json = await res.json()
      if (res.ok) setItems(json.notificaciones || [])
    } finally {
      setLoading(false)
    }
  }, [filtro, categoria])

  const loadPrefs = useCallback(async () => {
    const res = await fetch('/api/notificaciones/preferencias')
    const json = await res.json()
    if (res.ok) setPrefs(json.preferencias)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (tab === 'preferencias') loadPrefs()
  }, [tab, loadPrefs])

  const markRead = async (id: string) => {
    await fetch(`/api/notificaciones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leido: true }),
    })
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, leido: true } : n)))
  }

  const markAll = async () => {
    await fetch('/api/notificaciones/mark-all', { method: 'POST' })
    setItems((prev) => prev.map((n) => ({ ...n, leido: true })))
  }

  const openNotif = (n: Notificacion) => {
    if (!n.leido) markRead(n.id)
    if (n.link) router.push(n.link)
  }

  const savePrefs = async () => {
    if (!prefs) return
    setSavingPrefs(true)
    try {
      const res = await fetch('/api/notificaciones/preferencias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      const json = await res.json()
      if (res.ok) setPrefs(json.preferencias)
    } finally {
      setSavingPrefs(false)
    }
  }

  const tipoBadge = (tipo: string) => {
    const v: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      success: 'success',
      warning: 'warning',
      danger: 'danger',
      info: 'info',
    }
    return v[tipo] || 'default'
  }

  const prefRow = (
    key: keyof Omit<NotificationPreferences, 'user_id'>,
    label: string,
    desc: string
  ) => (
    <label
      key={key}
      className="flex items-start justify-between gap-4 p-4 rounded-xl border border-white/5 bg-black/20 cursor-pointer hover:border-amber-500/20 transition-colors"
    >
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        <p className="text-xs text-zinc-500 mt-1">{desc}</p>
      </div>
      <input
        type="checkbox"
        checked={prefs?.[key] ?? DEFAULT_PREFERENCES[key]}
        onChange={(e) => setPrefs((p) => (p ? { ...p, [key]: e.target.checked } : p))}
        className="w-5 h-5 accent-amber-500 mt-1"
      />
    </label>
  )

  return (
    <div className="space-y-8 pb-24 lg:pb-8 animate-in fade-in duration-500">
      <AdminPageHeader
        title="Centro de"
        highlight="Notificaciones"
        description="Historial en tiempo real, alertas del negocio y preferencias de correo."
        actions={
          tab === 'historial' && items.some((n) => !n.leido) ? (
            <Button variant="secondary" size="md" onClick={markAll}>
              <Check className="w-4 h-4 mr-2" />
              Marcar todas leídas
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === 'historial' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setTab('historial')}
        >
          <Bell className="w-4 h-4 mr-2" />
          Historial
        </Button>
        <Button
          variant={tab === 'preferencias' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setTab('preferencias')}
        >
          <Settings className="w-4 h-4 mr-2" />
          Preferencias
        </Button>
      </div>

      {tab === 'historial' ? (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-4 h-4 text-zinc-500" />
            <button
              type="button"
              onClick={() => setFiltro('todas')}
              className={cn(
                'px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors',
                filtro === 'todas'
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'border-white/10 text-zinc-500 hover:text-white'
              )}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFiltro('no_leidas')}
              className={cn(
                'px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors',
                filtro === 'no_leidas'
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'border-white/10 text-zinc-500 hover:text-white'
              )}
            >
              No leídas
            </button>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="ml-auto bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300"
            >
              <option value="">Todas las categorías</option>
              {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <Card className="border-white/5">
            <CardContent className="p-0 divide-y divide-white/5">
              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="py-20 text-center text-zinc-500">
                  <Bell className="w-12 h-12 mx-auto opacity-20 mb-3" />
                  <p className="font-bold uppercase tracking-widest text-xs">Sin notificaciones</p>
                </div>
              ) : (
                items.map((n, i) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openNotif(n)}
                    className={cn(
                      'w-full text-left p-5 flex gap-4 hover:bg-white/5 transition-all animate-in fade-in slide-in-from-bottom-1 fill-mode-both',
                      !n.leido && 'bg-amber-500/5'
                    )}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <div className="shrink-0 mt-1">
                      {!n.leido && <span className="block w-2 h-2 rounded-full bg-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-bold text-white text-sm">{n.titulo}</p>
                        <Badge variant={tipoBadge(n.tipo)} className="text-[9px] uppercase">
                          {n.tipo}
                        </Badge>
                        {n.categoria && (
                          <span className="text-[9px] uppercase font-black text-zinc-600 tracking-widest">
                            {CATEGORIA_LABELS[n.categoria] || n.categoria}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 line-clamp-2">{n.mensaje}</p>
                      <p className="text-[10px] text-zinc-600 mt-2 uppercase tracking-wider">
                        {new Date(n.created_at).toLocaleString('es-BO')}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-white/5">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                En la aplicación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {prefRow('push_reservas', 'Reservas y citas', 'Nuevas reservas, cancelaciones y cambios')}
              {prefRow('push_ventas', 'Ventas y pedidos', 'Pedidos de la tienda')}
              {prefRow('push_recordatorios', 'Recordatorios', 'Avisos previos a citas')}
              {prefRow('push_alertas', 'Alertas', 'Asistencia, horarios y sistema')}
            </CardContent>
          </Card>

          <Card className="border-white/5">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-500" />
                Por correo electrónico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {prefRow('email_reservas', 'Reservas', 'Confirmaciones y cambios de cita')}
              {prefRow('email_ventas', 'Ventas', 'Pedidos de tienda')}
              {prefRow('email_recordatorios', 'Recordatorios', '24 h antes de tu cita')}
              {prefRow('email_alertas', 'Alertas', 'Avisos importantes del negocio')}
              <p className="text-[10px] text-zinc-600 pt-2">
                Requiere RESEND_API_KEY y dominio verificado en producción.
              </p>
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <Button
              variant="primary"
              className="w-full sm:w-auto font-black uppercase tracking-widest"
              onClick={savePrefs}
              disabled={savingPrefs || !prefs}
            >
              {savingPrefs ? 'Guardando…' : 'Guardar preferencias'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
