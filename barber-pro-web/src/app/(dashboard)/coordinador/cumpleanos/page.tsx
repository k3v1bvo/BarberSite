'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { Search, CheckCircle, Camera, Cake, UserCheck, X } from 'lucide-react'
import { ImageUpload } from '@/components/ui/ImageUpload'

interface Cliente { id: string; nombre: string; cumpleanos: string | null; email: string | null; telefono: string | null }
interface Promo { id: string; nombre: string; tipo: string; descripcion: string | null }
interface Verif { id: string; cliente: { nombre: string }; tipo_documento: string; foto_documento_url: string | null; promo: { nombre: string } | null; created_at: string; notas: string | null }

const TIPOS_DOC = [
  { value: 'carnet', label: '🪪 Carnet de Identidad' },
  { value: 'pasaporte', label: '📘 Pasaporte' },
  { value: 'licencia', label: '🚗 Licencia de Conducir' },
  { value: 'universitario', label: '🎓 Carnet Universitario' },
  { value: 'otro', label: '📄 Otro documento' },
]

export default function CumpleanosPage() {
  const supabase = createClient()
  const { success, error: toastError } = useToast()
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Cliente[]>([])
  const [buscando, setBuscando] = useState(false)
  const [promos, setPromos] = useState<Promo[]>([])
  const [verifHoy, setVerifHoy] = useState<Verif[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ foto_documento_url: '', tipo_documento: 'carnet', promo_id: '', notas: '' })

  const loadData = useCallback(async () => {
    try {
      const [pRes, vRes] = await Promise.all([
        fetch('/api/promociones?activas=true'),
        fetch('/api/cumpleanos'),
      ])
      const pJson = await pRes.json()
      const vJson = await vRes.json()
      // Solo promos tipo cumpleaños
      setPromos((pJson.promociones ?? []).filter((p: Promo) => p.tipo === 'cumpleanos'))
      setVerifHoy(vJson.verificaciones ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const buscarCliente = async () => {
    if (busqueda.trim().length < 2) return
    setBuscando(true)
    try {
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, cumpleanos, email, telefono')
        .or(`nombre.ilike.%${busqueda}%,email.ilike.%${busqueda}%,ci.ilike.%${busqueda}%`)
        .limit(8)
      setResultados(data ?? [])
    } finally {
      setBuscando(false)
    }
  }

  const abrirVerificacion = (cliente: Cliente) => {
    setClienteSeleccionado(cliente)
    setForm({ foto_documento_url: '', tipo_documento: 'carnet', promo_id: '', notas: '' })
    setShowModal(true)
  }

  const guardarVerificacion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clienteSeleccionado) return
    setSaving(true)
    try {
      const res = await fetch('/api/cumpleanos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteSeleccionado.id,
          foto_documento_url: form.foto_documento_url || null,
          tipo_documento: form.tipo_documento,
          promo_id: form.promo_id || null,
          notas: form.notas || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      success(`✅ ¡Cumpleaños de ${clienteSeleccionado.nombre} verificado!`)
      setShowModal(false); loadData(); setResultados([])
    } catch (err: any) {
      toastError(err.message ?? 'Error al verificar')
    } finally {
      setSaving(false)
    }
  }

  // Detectar si el cumpleaños del cliente es hoy
  const esCumpleHoy = (cumpleanos: string | null) => {
    if (!cumpleanos) return false
    const hoy = new Date()
    const c = new Date(cumpleanos)
    return c.getMonth() === hoy.getMonth() && c.getDate() === hoy.getDate()
  }

  const formatFecha = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'long' })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            🎂 <span className="text-amber-500">Verificación</span> de Cumpleaños
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Registra cuando un cliente presenta documento para su regalo de cumpleaños</p>
        </div>
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
          <Cake className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Verificados Hoy</p>
            <p className="text-lg font-black text-amber-400">{verifHoy.length} cliente{verifHoy.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Panel de búsqueda */}
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4 border-l-4 border-amber-500 pl-3">Buscar Cliente</h2>
            <div className="flex gap-2">
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarCliente()}
                placeholder="Nombre o email del cliente..."
                className="flex-1 h-12 bg-zinc-900 border border-white/10 rounded-2xl px-4 text-white text-sm focus:border-amber-500/50 outline-none"
              />
              <Button variant="primary" onClick={buscarCliente} disabled={buscando}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Resultados de búsqueda */}
          {resultados.length > 0 && (
            <div className="space-y-2">
              {resultados.map(c => {
                const esHoy = esCumpleHoy(c.cumpleanos)
                const yaVerif = verifHoy.some((v: any) => v.cliente?.nombre === c.nombre)
                return (
                  <div key={c.id} className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${esHoy ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/5 bg-zinc-900'}`}>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-white">{c.nombre}</p>
                        {esHoy && <Badge variant="warning" className="text-[9px] uppercase font-black animate-pulse">🎂 Hoy es su cumple!</Badge>}
                        {yaVerif && <Badge variant="success" className="text-[9px] uppercase font-black">✅ Ya verificado</Badge>}
                      </div>
                      {c.cumpleanos && (
                        <p className="text-zinc-500 text-xs mt-0.5">
                          🎂 {formatFecha(c.cumpleanos)}
                          {c.email && ` · ${c.email}`}
                        </p>
                      )}
                      {!c.cumpleanos && <p className="text-zinc-600 text-xs">Sin fecha de cumpleaños registrada</p>}
                    </div>
                    {esHoy && !yaVerif ? (
                      <Button variant="primary" size="sm" className="shrink-0 font-black" onClick={() => abrirVerificacion(c)}>
                        <UserCheck className="w-4 h-4 mr-1" /> Verificar
                      </Button>
                    ) : esHoy && yaVerif ? (
                      <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}

          {resultados.length === 0 && busqueda.length >= 2 && !buscando && (
            <p className="text-center text-zinc-600 py-8 font-black uppercase tracking-widest text-sm">No se encontraron clientes</p>
          )}
        </div>

        {/* Verificados hoy */}
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4 border-l-4 border-green-500 pl-3">
            Verificados Hoy — {new Date().toLocaleDateString('es-BO', { day: 'numeric', month: 'long' })}
          </h2>
          {verifHoy.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-3xl">
              <span className="text-5xl">🎂</span>
              <p className="text-zinc-700 font-black uppercase tracking-widest mt-4 text-sm">Sin cumpleaños hoy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {verifHoy.map(v => (
                <Card key={v.id} className="border-green-500/20 bg-zinc-900">
                  <CardContent className="p-4 flex items-center gap-4">
                    {v.foto_documento_url ? (
                      <img src={v.foto_documento_url} alt="Doc" className="w-14 h-10 object-cover rounded-xl border border-white/10 shrink-0" />
                    ) : (
                      <div className="w-14 h-10 rounded-xl bg-zinc-800 border border-white/5 flex items-center justify-center shrink-0">
                        <Camera size={18} className="text-zinc-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white truncate">{v.cliente?.nombre}</p>
                      <p className="text-zinc-500 text-xs uppercase font-bold">
                        {TIPOS_DOC.find(t => t.value === v.tipo_documento)?.label?.split(' ').slice(1).join(' ') ?? v.tipo_documento}
                        {' · '}
                        {new Date(v.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {v.promo?.nombre && <p className="text-amber-400 text-[10px] mt-0.5">🎁 {v.promo.nombre}</p>}
                    </div>
                    <CheckCircle size={20} className="text-green-500 shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de verificación */}
      {showModal && clienteSeleccionado && (
        <div className="fixed inset-0 bg-black/90 flex items-start justify-center z-[100] p-4 pt-12 overflow-y-auto">
          <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            {/* Header del modal */}
            <div className="bg-gradient-to-r from-amber-600 to-orange-500 p-6 flex items-center justify-between">
              <div>
                <p className="text-black/70 text-xs font-black uppercase tracking-widest">Verificando Cumpleaños</p>
                <h3 className="text-xl font-black text-black">{clienteSeleccionado.nombre}</h3>
                {clienteSeleccionado.cumpleanos && (
                  <p className="text-black/60 text-sm font-bold mt-0.5">🎂 {formatFecha(clienteSeleccionado.cumpleanos)}</p>
                )}
              </div>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 bg-black/20 rounded-xl flex items-center justify-center hover:bg-black/40 transition-colors">
                <X size={18} className="text-black" />
              </button>
            </div>

            <form onSubmit={guardarVerificacion} className="p-6 space-y-5">
              {/* Tipo de documento */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">Tipo de documento presentado</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS_DOC.map(t => (
                    <button key={t.value} type="button"
                      className={`p-3 rounded-xl border text-left transition-all text-sm font-bold ${form.tipo_documento === t.value ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-white/5 bg-zinc-900 text-zinc-400 hover:border-white/20'}`}
                      onClick={() => setForm({ ...form, tipo_documento: t.value })}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Foto del documento */}
              <div>
                <ImageUpload
                  label="Foto del documento (opcional)"
                  defaultImage={form.foto_documento_url || undefined}
                  onUploadSuccess={(url) => setForm({ ...form, foto_documento_url: url })}
                  onUploadError={(err) => toastError(err)}
                />
              </div>

              {/* Promoción a aplicar */}
              {promos.length > 0 && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Regalo / Promoción a otorgar</label>
                  <select className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-amber-500/50" value={form.promo_id} onChange={e => setForm({ ...form, promo_id: e.target.value })}>
                    <option value="">Seleccionar promoción...</option>
                    {promos.map(p => <option key={p.id} value={p.id}>🎁 {p.nombre}</option>)}
                  </select>
                </div>
              )}

              {promos.length === 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-400 font-bold">
                  ⚠️ No hay promociones de cumpleaños configuradas. Ve a Admin → Lealtad → Promociones para crear una.
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Notas (opcional)</label>
                <textarea
                  value={form.notas}
                  onChange={e => setForm({ ...form, notas: e.target.value })}
                  placeholder="Ej: Trajo fotocopia de CI, verificado por Juan"
                  className="w-full h-20 bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500/50 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" className="flex-1 font-black" disabled={saving}>
                  {saving ? 'Verificando...' : '🎂 Confirmar Verificación'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
