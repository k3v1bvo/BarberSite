'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { ArrowLeft, Plus, Save, Trash2, Gift, Users, Search, Edit, Flame, Cake, ToggleLeft, ToggleRight, X, UserPlus, CheckCircle2 } from 'lucide-react'
import { labelTipoRecompensa } from '@/lib/lealtad/helpers'
import type { LealtadMeta, TipoRecompensa } from '@/types'

const TIPOS: TipoRecompensa[] = ['porcentaje', 'monto_fijo', 'servicio_gratis', 'producto_gratis']
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const TIPOS_PROMO = [
  { value: '2x1', label: '✂️ 2×1' },
  { value: 'cumpleanos', label: '🎂 Cumpleañero' },
  { value: 'referido', label: '🤝 Referido' },
  { value: 'tarjeta_sello_5', label: '🔥 Tarjeta Sello #5 (50% Desc)' },
  { value: 'tarjeta_sello_10', label: '🎁 Tarjeta Sello #10 (Corte Gratis)' },
  { value: 'compra_producto_reserva', label: '🛍️ Desc 10 Bs por Producto + Reserva' },
  { value: 'descuento_porcentaje', label: '💸 Descuento %' },
  { value: 'descuento_fijo', label: '💰 Descuento Fijo' },
  { value: 'servicio_gratis', label: '🎁 Servicio Gratis' },
  { value: 'nivel_lealtad', label: '👑 Nivel de Lealtad' },
]
const NIVELES = ['BRONCE', 'PLATA', 'ORO', 'PLATINO', 'DIAMANTE']
const ICONOS = ['🎁', '✂️', '💸', '💰', '🎂', '👑', '🔥', '⭐', '🎉', '🎯']

const emptyMeta = {
  nombre: '', descripcion: '', visitas_requeridas: 5,
  tipo_recompensa: 'porcentaje' as TipoRecompensa, valor_recompensa: 20,
  servicio_id: '' as string, producto_id: '' as string, is_active: true, orden: 0,
}

const emptyPromo = {
  nombre: '', descripcion: '', tipo: '2x1', valor: 0,
  dias_semana: [] as number[], servicio_id: '', nivel_requerido: '',
  activa: true, icono: '🎁', color: 'amber', fecha_inicio: '', fecha_fin: '',
}

export default function AdminLealtadPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  const supabase = createClient()

  // Metas state
  const [metas, setMetas] = useState<LealtadMeta[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [canjes, setCanjes] = useState<any[]>([])
  const [servicios, setServicios] = useState<{ id: string; nombre: string }[]>([])
  const [productos, setProductos] = useState<{ id: string; nombre: string }[]>([])
  const [filtro, setFiltro] = useState('')
  const [nivelFiltro, setNivelFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<LealtadMeta | null>(null)
  const [form, setForm] = useState(emptyMeta)

  // Promociones state
  const [promociones, setPromociones] = useState<any[]>([])
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [editingPromo, setEditingPromo] = useState<any | null>(null)
  const [promoForm, setPromoForm] = useState(emptyPromo)
  const [savingPromo, setSavingPromo] = useState(false)

  // Cliente Edit State
  const [showClienteModal, setShowClienteModal] = useState(false)
  const [editingCliente, setEditingCliente] = useState<any | null>(null)
  const [clienteForm, setClienteForm] = useState({ nombre: '', telefono: '', ci: '', fecha_nacimiento: '' })
  const [savingCliente, setSavingCliente] = useState(false)
  const [resettingPwd, setResettingPwd] = useState(false)

  // Cumpleaños verificados hoy
  const [verifs, setVerifs] = useState<any[]>([])

  // Referidos
  const [referidos, setReferidos] = useState<any[]>([])

  const [tab, setTab] = useState<'metas' | 'clientes' | 'promociones' | 'cumpleanos' | 'referidos'>('metas')

  const loadAll = useCallback(async () => {
    try {
      const [mRes, aRes, pRes, vRes, rRes] = await Promise.all([
        fetch('/api/lealtad/metas'),
        fetch(`/api/lealtad/admin`),
        fetch('/api/promociones?activas=false'),
        fetch('/api/cumpleanos'),
        fetch('/api/referidos'),
      ])
      const mJson = await mRes.json()
      const aJson = await aRes.json()
      const pJson = await pRes.json()
      const vJson = await vRes.json()
      const rJson = await rRes.json()
      setMetas(mJson.metas ?? [])
      setClientes(aJson.clientes ?? [])
      setCanjes(aJson.canjes ?? [])
      setPromociones(pJson.promociones ?? [])
      setVerifs(vJson.verificaciones ?? [])
      setReferidos(rJson ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
    supabase.from('servicios').select('id, nombre').eq('is_active', true).then(({ data }) => { if (data) setServicios(data) })
    supabase.from('productos').select('id, nombre').eq('is_active', true).then(({ data }) => { if (data) setProductos(data) })
  }, [])

  // ── Meta CRUD ──
  const saveMeta = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = { ...form, servicio_id: form.servicio_id || null, producto_id: form.producto_id || null }
      const res = await fetch('/api/lealtad/metas', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success(editing ? 'Meta actualizada' : 'Meta creada')
      setShowModal(false); setEditing(null); setForm(emptyMeta); loadAll()
    } catch (e) { toastError(e instanceof Error ? e.message : 'Error') }
  }

  const deleteMeta = async (id: string) => {
    if (!confirm('¿Eliminar esta meta?')) return
    await fetch(`/api/lealtad/metas?id=${id}`, { method: 'DELETE' })
    loadAll()
  }

  const openEditMeta = (m: LealtadMeta) => {
    setEditing(m)
    setForm({ nombre: m.nombre, descripcion: m.descripcion || '', visitas_requeridas: m.visitas_requeridas, tipo_recompensa: m.tipo_recompensa, valor_recompensa: m.valor_recompensa, servicio_id: m.servicio_id || '', producto_id: m.producto_id || '', is_active: m.is_active, orden: m.orden })
    setShowModal(true)
  }

  // ── Cliente CRUD ──
  const ajustarVisitas = async (clienteId: string, delta?: number, total?: number) => {
    await fetch('/api/lealtad/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'ajustar_visitas', cliente_id: clienteId, visitas_delta: delta, visitas_total: total }) })
    loadAll()
  }
  const fijarVisitas = async (clienteId: string, actual: number) => {
    const val = prompt('Número exacto de visitas:', String(actual))
    if (val === null) return
    const n = parseInt(val, 10)
    if (Number.isNaN(n) || n < 0) { toastError('Número inválido'); return }
    await ajustarVisitas(clienteId, undefined, n); success('Visitas actualizadas')
  }
  const otorgarRecompensa = async (clienteId: string) => {
    const desc = prompt('Descripción de la recompensa:')
    if (!desc) return
    await fetch('/api/lealtad/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'otorgar_recompensa', cliente_id: clienteId, descripcion: desc }) })
    success('Recompensa otorgada'); loadAll()
  }

  const openEditCliente = (c: any) => {
    setEditingCliente(c)
    setClienteForm({
      nombre: c.nombre || '',
      telefono: c.telefono || '',
      ci: c.ci || '',
      fecha_nacimiento: c.fecha_nacimiento || ''
    })
    setShowClienteModal(true)
  }

  const saveCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingCliente(true)
    try {
      const payload: any = { ...clienteForm, updated_at: new Date().toISOString() }
      if (!payload.fecha_nacimiento) payload.fecha_nacimiento = null
      
      const { error: err } = await supabase.from('clientes').update(payload).eq('id', editingCliente.id)
      if (err) throw err
      success('Cliente actualizado correctamente')
      setShowClienteModal(false)
      loadAll()
    } catch (err: any) {
      toastError(err.message || 'Error al actualizar el cliente')
    } finally {
      setSavingCliente(false)
    }
  }

  const resetPassword = async () => {
    setResettingPwd(true)
    try {
      const res = await fetch('/api/admin/clientes/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: editingCliente.id })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success('Se ha enviado un enlace de recuperación al correo del cliente.')
    } catch (err: any) {
      toastError(err.message || 'Error al enviar enlace de restablecimiento')
    } finally {
      setResettingPwd(false)
    }
  }

  // ── Referidos CRUD ──
  const otorgarDescuentoReferido = async (ref: any) => {
    if (!confirm(`¿Otorgar descuento/bono a ${ref.recomendante?.nombre}? Se marcará como entregado.`)) return
    try {
      const res = await fetch('/api/referidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ref.id, bono_otorgado: true })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success('Bono de referido otorgado (descuento aplicado)')
      loadAll()
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Error')
    }
  }

  // ── Promo CRUD ──
  const activarPromoBase = async (tipoBase: '2x1' | 'referido' | 'cumpleanos') => {
    setSavingPromo(true)
    try {
      let payload: any = {}
      if (tipoBase === '2x1') {
        payload = {
          nombre: '✂️ 2×1 Todos los Martes',
          descripcion: 'Ven con un amigo o familiar los martes y pagan solo por 1 corte. Al seleccionar esta promo al agendar, pedirá los datos del acompañante.',
          tipo: '2x1',
          valor: 0,
          dias_semana: [2],
          icono: '✂️',
          color: 'amber',
          activa: true
        }
      } else if (tipoBase === 'referido') {
        payload = {
          nombre: '🤝 Programa de Referidos',
          descripcion: 'Trae a un nuevo cliente a la barbería. Cuando tu referido asista a su primer corte, tú recibes tu bono/descuento especial.',
          tipo: 'referido',
          valor: 10,
          dias_semana: [],
          icono: '🤝',
          color: 'purple',
          activa: true
        }
      } else if (tipoBase === 'cumpleanos') {
        payload = {
          nombre: '🎂 Regalo de Cumpleañero',
          descripcion: '¡Celebra tu cumpleaños con nosotros! Presenta tu carnet de identidad en tu semana de cumpleaños para validar y obtener tu corte especial o regalo.',
          tipo: 'cumpleanos',
          valor: 0,
          dias_semana: [],
          icono: '🎂',
          color: 'amber',
          activa: true
        }
      }
      const res = await fetch('/api/promociones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success(`Promoción "${payload.nombre}" activada con éxito`)
      loadAll()
    } catch (e: any) {
      toastError(e.message || 'Error al crear promo base')
    } finally {
      setSavingPromo(false)
    }
  }

  const activarTodasPromosBase = async () => {
    setSavingPromo(true)
    try {
      const p2x1 = promociones.find(p => p.tipo === '2x1')
      const pRef = promociones.find(p => p.tipo === 'referido')
      const pCump = promociones.find(p => p.tipo === 'cumpleanos')
      
      const toCreate: ('2x1' | 'referido' | 'cumpleanos')[] = []
      if (!p2x1) toCreate.push('2x1')
      if (!pRef) toCreate.push('referido')
      if (!pCump) toCreate.push('cumpleanos')

      for (const t of toCreate) {
        await activarPromoBase(t)
      }
      success('Todas las promociones base han sido activadas e integradas en la plataforma.')
      loadAll()
    } catch (e: any) {
      toastError(e.message || 'Error al activar promociones')
    } finally {
      setSavingPromo(false)
    }
  }

  const toggleDia = (dia: number) => {
    setPromoForm(f => ({
      ...f,
      dias_semana: f.dias_semana.includes(dia) ? f.dias_semana.filter(d => d !== dia) : [...f.dias_semana, dia]
    }))
  }

  const savePromo = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPromo(true)
    try {
      const payload = {
        ...promoForm,
        servicio_id: promoForm.servicio_id || null,
        nivel_requerido: promoForm.nivel_requerido || null,
        fecha_inicio: promoForm.fecha_inicio || null,
        fecha_fin: promoForm.fecha_fin || null,
      }
      const res = await fetch('/api/promociones', {
        method: editingPromo ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPromo ? { id: editingPromo.id, ...payload } : payload),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success(editingPromo ? 'Promoción actualizada' : 'Promoción creada')
      setShowPromoModal(false); setEditingPromo(null); setPromoForm(emptyPromo); loadAll()
    } catch (e) { toastError(e instanceof Error ? e.message : 'Error') } finally { setSavingPromo(false) }
  }

  const deletePromo = async (id: string) => {
    if (!confirm('¿Eliminar esta promoción?')) return
    await fetch(`/api/promociones?id=${id}`, { method: 'DELETE' })
    loadAll()
  }

  const togglePromo = async (promo: any) => {
    await fetch('/api/promociones', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: promo.id, activa: !promo.activa }),
    })
    loadAll()
  }

  const openEditPromo = (p: any) => {
    setEditingPromo(p)
    setPromoForm({ nombre: p.nombre, descripcion: p.descripcion || '', tipo: p.tipo, valor: p.valor ?? 0, dias_semana: p.dias_semana ?? [], servicio_id: p.servicio_id || '', nivel_requerido: p.nivel_requerido || '', activa: p.activa, icono: p.icono || '🎁', color: p.color || 'amber', fecha_inicio: p.fecha_inicio || '', fecha_fin: p.fecha_fin || '' })
    setShowPromoModal(true)
  }

  if (loading) {
    return <div className="flex flex-col items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" /></div>
  }

  const clientesFiltrados = clientes.filter(c => {
    if (filtro) {
      const q = filtro.toLowerCase().trim()
      const match = (c.nombre || '').toLowerCase().includes(q) ||
        (c.ci || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.telefono || '').toLowerCase().includes(q) ||
        (c.codigo_tarjeta || '').toLowerCase().includes(q)
      if (!match) return false
    }
    if (nivelFiltro && calcularNivel(c.total_visitas ?? 0) !== nivelFiltro) return false;
    return true;
  });

  function calcularNivel(visitas: number) {
    const metasActivas = [...metas].filter(m => m.is_active).sort((a, b) => b.visitas_requeridas - a.visitas_requeridas)
    const meta = metasActivas.find(m => visitas >= m.visitas_requeridas)
    return meta ? meta.nombre.toUpperCase() : 'BRONCE'
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-8">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/admin')} className="p-4 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl">
            <ArrowLeft className="w-5 h-5 text-zinc-500" />
          </button>
          <div>
            <h1 className="text-4xl font-black text-white uppercase">Programa de <span className="text-amber-500">Lealtad</span></h1>
            <p className="text-zinc-500 mt-2">Metas, recompensas, promociones y cumpleaños</p>
          </div>
        </div>
        {tab === 'metas' && (
          <Button variant="primary" onClick={() => { setEditing(null); setForm(emptyMeta); setShowModal(true) }}>
            <Plus className="w-4 h-4 mr-2" /> Nueva Meta
          </Button>
        )}
        {tab === 'promociones' && (
          <Button variant="primary" onClick={() => { setEditingPromo(null); setPromoForm(emptyPromo); setShowPromoModal(true) }}>
            <Plus className="w-4 h-4 mr-2" /> Nueva Promo
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'metas', label: 'Metas', icon: Gift },
          { key: 'clientes', label: 'Clientes', icon: Users },
          { key: 'promociones', label: 'Promociones', icon: Flame },
          { key: 'cumpleanos', label: `Cumpleaños (${verifs.length})`, icon: Cake },
          { key: 'referidos', label: `Referidos (${referidos.filter(r => !r.bono_otorgado).length} pend.)`, icon: UserPlus },
        ].map(({ key, label, icon: Icon }) => (
          <Button key={key} variant={tab === key ? 'primary' : 'outline'} onClick={() => setTab(key as any)}>
            <Icon className="w-4 h-4 mr-2" /> {label}
          </Button>
        ))}
      </div>

      {/* ══ METAS ══ */}
      {tab === 'metas' && (
        <div className="grid gap-4">
          {metas.length === 0 && <p className="text-zinc-600 text-center py-12 font-black uppercase tracking-widest">No hay metas configuradas</p>}
          {metas.map((m) => (
            <Card key={m.id} className="bg-zinc-900 border-white/5">
              <CardContent className="p-6 flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant={m.is_active ? 'success' : 'default'}>{m.is_active ? 'Activa' : 'Inactiva'}</Badge>
                    <span className="text-amber-500 font-black text-2xl">{m.visitas_requeridas}</span>
                    <span className="text-zinc-500 text-sm uppercase font-bold">visitas</span>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase">{m.nombre}</h3>
                  <p className="text-zinc-400 text-sm mt-1">{m.descripcion}</p>
                  <p className="text-xs text-zinc-600 mt-2 uppercase font-bold">
                    {labelTipoRecompensa(m.tipo_recompensa)}
                    {m.tipo_recompensa === 'porcentaje' && ` — ${m.valor_recompensa}%`}
                    {m.tipo_recompensa === 'monto_fijo' && ` — Bs. ${m.valor_recompensa}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditMeta(m)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => deleteMeta(m.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ══ CLIENTES ══ */}
      {tab === 'clientes' && (
        <>
          <div className="flex flex-wrap gap-4 items-center bg-zinc-900/40 p-4 rounded-2xl border border-white/5 mb-4">
            <div className="flex-1 min-w-[250px] relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input placeholder="Buscar cliente por nombre o carnet..." value={filtro} onChange={(e) => setFiltro(e.target.value)} className="pl-10 max-w-none" />
            </div>
            <select className="h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-amber-500/50" value={nivelFiltro} onChange={(e) => setNivelFiltro(e.target.value)}>
              <option value="">Todos los niveles</option>
              <option value="BRONCE">Bronce</option>
              <option value="PLATA">Plata</option>
              <option value="ORO">Oro</option>
            </select>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-zinc-500 uppercase text-[10px] tracking-widest border-b border-white/5">
                  <th className="text-left py-3 px-4">Cliente</th>
                  <th className="text-left py-3 px-4">Nivel</th>
                  <th className="text-left py-3 px-4">Visitas</th>
                  <th className="text-left py-3 px-4">Gastado</th>
                  <th className="text-right py-3 px-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-zinc-600 font-black uppercase tracking-widest">No se encontraron clientes</td></tr>
                )}
                {clientesFiltrados.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-4 px-4 font-bold text-white">{c.nombre}</td>
                    <td className="py-4 px-4">
                      <Badge 
                        variant={
                          calcularNivel(c.total_visitas ?? 0) === 'ORO' ? 'warning' : 
                          calcularNivel(c.total_visitas ?? 0) === 'DIAMANTE' ? 'success' : 
                          calcularNivel(c.total_visitas ?? 0) === 'PLATINO' ? 'info' : 
                          calcularNivel(c.total_visitas ?? 0) === 'PLATA' ? 'outline' : 'default'
                        } 
                        className="text-[10px] uppercase font-black"
                      >
                        {calcularNivel(c.total_visitas ?? 0)}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-amber-500 font-black text-lg">{c.total_visitas ?? 0}</td>
                    <td className="py-4 px-4 text-zinc-400">Bs. {c.total_gastado ?? 0}</td>
                    <td className="py-4 px-4 text-right space-x-1 whitespace-nowrap">
                      <Button variant="outline" size="sm" onClick={() => openEditCliente(c)} title="Editar información del cliente"><Edit className="w-4 h-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => ajustarVisitas(c.id, 1)}>+1</Button>
                      <Button variant="outline" size="sm" onClick={() => ajustarVisitas(c.id, -1)}>-1</Button>
                      <Button variant="outline" size="sm" onClick={() => fijarVisitas(c.id, c.total_visitas ?? 0)}>Fijar</Button>
                      <Button variant="primary" size="sm" onClick={() => otorgarRecompensa(c.id)}>Premio</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canjes.length > 0 && (
            <Card className="bg-zinc-900 border-white/5 mt-8">
              <CardHeader><CardTitle className="text-white uppercase text-sm">Historial de Canjes</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                {canjes.map((c: any) => (
                  <div key={c.id} className="flex justify-between text-sm border-b border-white/5 py-2">
                    <span className="text-zinc-300">{c.clientes?.nombre} — {c.descripcion}</span>
                    <span className="text-zinc-600 text-xs">{new Date(c.canjeado_at).toLocaleDateString('es-BO')}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ══ PROMOCIONES ══ */}
      {tab === 'promociones' && (
        <div className="space-y-8">
          {/* BANNER PROMOCIONES BASE DEL LOCAL */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-purple-500/10 border border-amber-500/30 rounded-3xl p-6 relative overflow-hidden shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Badge variant="warning" className="uppercase font-black text-[10px] tracking-wider px-2.5 py-0.5">Sistema Integrado</Badge>
                  <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Barber Pro Core</span>
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Promociones Base del Local</h2>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  Estas 3 promociones están vinculadas al motor de reservas y verificación de la barbería: 
                  <strong className="text-amber-400"> 2×1 de los Martes</strong> (solicita datos de acompañante en reservas), 
                  <strong className="text-purple-400"> Programa de Referidos</strong> (gestión de bonos por recomendación) y 
                  <strong className="text-amber-400"> Cumpleañero</strong> (verificación de carnet de identidad).
                </p>
              </div>
              {(!promociones.some(p => p.tipo === '2x1') || !promociones.some(p => p.tipo === 'referido') || !promociones.some(p => p.tipo === 'cumpleanos')) && (
                <Button 
                  variant="primary" 
                  onClick={activarTodasPromosBase} 
                  disabled={savingPromo}
                  className="shrink-0 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black uppercase text-xs tracking-wider px-6 py-4 shadow-lg shadow-amber-500/20 hover:scale-105 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Activar las 3 Promos Base
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
              {/* TARJETA 2X1 */}
              {(() => {
                const p = promociones.find(promo => promo.tipo === '2x1')
                return (
                  <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${p ? (p.activa ? 'bg-black/60 border-amber-500/40 shadow-md' : 'bg-black/40 border-white/10 opacity-75') : 'bg-black/30 border-dashed border-white/20'}`}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">✂️</span>
                        {p ? (
                          <Badge variant={p.activa ? 'success' : 'default'} className="text-[9px] uppercase font-black">{p.activa ? 'Activa' : 'Pausada'}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-zinc-500 uppercase font-black">No activada</Badge>
                        )}
                      </div>
                      <h4 className="font-black text-white text-base uppercase">2×1 de los Martes</h4>
                      <p className="text-zinc-400 text-xs mt-1 leading-relaxed">Pagan 1 y entran 2. Al seleccionar al agendar en la web, pide al cliente el nombre y carnet de su acompañante.</p>
                      {p && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 font-bold">
                          <span>⚡ Conectado a /reservar</span>
                        </div>
                      )}
                    </div>
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                      {p ? (
                        <>
                          <button onClick={() => togglePromo(p)} className="text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                            {p.activa ? <ToggleRight className="text-green-500 w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            <span>{p.activa ? 'Pausar' : 'Reanudar'}</span>
                          </button>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => openEditPromo(p)}><Edit className="w-3.5 h-3.5" /></Button>
                            <Button variant="outline" size="sm" onClick={() => deletePromo(p.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                          </div>
                        </>
                      ) : (
                        <Button variant="primary" size="sm" className="w-full text-xs font-black" onClick={() => activarPromoBase('2x1')} disabled={savingPromo}>
                          + Activar 2×1
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* TARJETA REFERIDOS */}
              {(() => {
                const p = promociones.find(promo => promo.tipo === 'referido')
                const pendCount = referidos.filter(r => !r.bono_otorgado).length
                return (
                  <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${p ? (p.activa ? 'bg-black/60 border-purple-500/40 shadow-md' : 'bg-black/40 border-white/10 opacity-75') : 'bg-black/30 border-dashed border-white/20'}`}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">🤝</span>
                        {p ? (
                          <Badge variant={p.activa ? 'success' : 'default'} className="text-[9px] uppercase font-black">{p.activa ? 'Activa' : 'Pausada'}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-zinc-500 uppercase font-black">No activada</Badge>
                        )}
                      </div>
                      <h4 className="font-black text-white text-base uppercase">Referidos</h4>
                      <p className="text-zinc-400 text-xs mt-1 leading-relaxed">Trae un nuevo cliente y gana bono/descuento en tu próxima cita. Gestiona los premios cuando el referido asista.</p>
                      {p && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300 font-bold">
                            ⚡ {pendCount} bonos pendientes
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
                      {p ? (
                        <div className="flex items-center justify-between gap-2">
                          <button onClick={() => setTab('referidos')} className="text-xs font-black text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-500/10 px-3 py-1.5 rounded-xl border border-purple-500/20 flex-1 justify-center">
                            <span>Ver Referidos ➔</span>
                          </button>
                          <button onClick={() => togglePromo(p)} className="p-1.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white" title={p.activa ? 'Pausar' : 'Activar'}>
                            {p.activa ? <ToggleRight className="text-green-500 w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                          <Button variant="outline" size="sm" onClick={() => openEditPromo(p)}><Edit className="w-3.5 h-3.5" /></Button>
                        </div>
                      ) : (
                        <Button variant="primary" size="sm" className="w-full text-xs font-black bg-purple-600 hover:bg-purple-500" onClick={() => activarPromoBase('referido')} disabled={savingPromo}>
                          + Activar Referidos
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* TARJETA CUMPLEAÑERO */}
              {(() => {
                const p = promociones.find(promo => promo.tipo === 'cumpleanos')
                return (
                  <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${p ? (p.activa ? 'bg-black/60 border-amber-500/40 shadow-md' : 'bg-black/40 border-white/10 opacity-75') : 'bg-black/30 border-dashed border-white/20'}`}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">🎂</span>
                        {p ? (
                          <Badge variant={p.activa ? 'success' : 'default'} className="text-[9px] uppercase font-black">{p.activa ? 'Activa' : 'Pausada'}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-zinc-500 uppercase font-black">No activada</Badge>
                        )}
                      </div>
                      <h4 className="font-black text-white text-base uppercase">Cumpleañero</h4>
                      <p className="text-zinc-400 text-xs mt-1 leading-relaxed">Ven en tu semana de cumpleaños con carnet en mano para validar tu beneficio en recepción y recibir tu regalo.</p>
                      {p && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 font-bold">
                          <span>⚡ {verifs.length} verificados hoy</span>
                        </div>
                      )}
                    </div>
                    <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
                      {p ? (
                        <div className="flex items-center justify-between gap-2">
                          <button onClick={() => setTab('cumpleanos')} className="text-xs font-black text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 flex-1 justify-center">
                            <span>Ver Cumpleaños ➔</span>
                          </button>
                          <button onClick={() => togglePromo(p)} className="p-1.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white" title={p.activa ? 'Pausar' : 'Activar'}>
                            {p.activa ? <ToggleRight className="text-green-500 w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                          <Button variant="outline" size="sm" onClick={() => openEditPromo(p)}><Edit className="w-3.5 h-3.5" /></Button>
                        </div>
                      ) : (
                        <Button variant="primary" size="sm" className="w-full text-xs font-black" onClick={() => activarPromoBase('cumpleanos')} disabled={savingPromo}>
                          + Activar Cumpleañero
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* OTRAS PROMOCIONES PERSONALIZADAS */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Otras Promociones Personalizadas</h3>
                <p className="text-zinc-500 text-xs">Descuentos especiales, promociones por temporada o por nivel de lealtad</p>
              </div>
            </div>

            {promociones.filter(p => !['2x1', 'referido', 'cumpleanos'].includes(p.tipo)).length === 0 ? (
              <div className="text-center py-12 bg-zinc-900/40 border border-white/5 rounded-2xl">
                <p className="text-zinc-600 font-black uppercase text-xs tracking-widest">No tienes otras promociones adicionales creadas</p>
              </div>
            ) : (
              promociones.filter(p => !['2x1', 'referido', 'cumpleanos'].includes(p.tipo)).map((p) => (
                <Card key={p.id} className={`border transition-all ${p.activa ? 'border-amber-500/20 bg-zinc-900' : 'border-white/5 bg-zinc-900/40 opacity-60'}`}>
                  <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="flex items-start gap-4">
                      <span className="text-3xl">{p.icono}</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-black text-white uppercase">{p.nombre}</h3>
                          <Badge variant={p.activa ? 'success' : 'default'} className="text-[9px] uppercase">{p.activa ? 'Activa' : 'Pausada'}</Badge>
                          <Badge variant="info" className="text-[9px] uppercase">{TIPOS_PROMO.find(t => t.value === p.tipo)?.label ?? p.tipo}</Badge>
                        </div>
                        {p.descripcion && <p className="text-zinc-400 text-sm">{p.descripcion}</p>}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.dias_semana?.length > 0
                            ? p.dias_semana.map((d: number) => <span key={d} className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-0.5 uppercase">{DIAS_SEMANA[d]}</span>)
                            : <span className="text-[10px] text-zinc-600 uppercase font-black">Todos los días</span>
                          }
                          {p.nivel_requerido && <span className="text-[10px] font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-lg px-2 py-0.5 uppercase">Nivel {p.nivel_requerido}+</span>}
                          {p.valor > 0 && <span className="text-[10px] font-black text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-0.5">{p.tipo === 'descuento_porcentaje' ? `${p.valor}%` : `Bs ${p.valor}`} OFF</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => togglePromo(p)} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-400 hover:text-white" title={p.activa ? 'Pausar' : 'Activar'}>
                        {p.activa ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} />}
                      </button>
                      <Button variant="outline" size="sm" onClick={() => openEditPromo(p)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => deletePromo(p.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══ CUMPLEAÑOS HOY ══ */}
      {tab === 'cumpleanos' && (
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">🎂</span>
            <div>
              <p className="text-amber-400 font-black uppercase text-sm">Verificados Hoy</p>
              <p className="text-zinc-400 text-xs">Clientes que presentaron documento para recibir su regalo de cumpleaños</p>
            </div>
          </div>
          {verifs.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-3xl">
              <span className="text-5xl">🎂</span>
              <p className="text-zinc-600 font-black uppercase tracking-widest mt-4">Sin cumpleaños verificados hoy</p>
            </div>
          ) : (
            verifs.map((v: any) => (
              <Card key={v.id} className="border-amber-500/20 bg-zinc-900">
                <CardContent className="p-5 flex items-center gap-5">
                  {v.foto_documento_url && (
                    <img src={v.foto_documento_url} alt="Documento" className="w-16 h-12 object-cover rounded-xl border border-white/10" />
                  )}
                  <div className="flex-1">
                    <p className="font-black text-white">{v.cliente?.nombre}</p>
                    <p className="text-zinc-500 text-xs uppercase font-bold mt-0.5">
                      {v.tipo_documento} · Verificado a las {new Date(v.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {v.promo?.nombre && <p className="text-amber-400 text-xs mt-1">🎁 Promo: {v.promo.nombre}</p>}
                    {v.notas && <p className="text-zinc-600 text-xs mt-1">{v.notas}</p>}
                  </div>
                  <span className="text-2xl">🎂</span>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ══ REFERIDOS ══ */}
      {tab === 'referidos' && (
        <div className="space-y-4">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 flex items-center gap-3">
            <UserPlus className="text-purple-400 w-6 h-6" />
            <div>
              <p className="text-purple-400 font-black uppercase text-sm">Programa de Referidos</p>
              <p className="text-zinc-400 text-xs">Clientes que trajeron nuevos clientes. Otorga descuentos en su próxima visita.</p>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left min-w-[800px]">
              <thead>
                <tr className="text-zinc-500 uppercase text-[10px] tracking-widest border-b border-white/5">
                  <th className="py-3 px-4">Recomendante (Premio)</th>
                  <th className="py-3 px-4">Nuevo Cliente</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Monto Bono</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {referidos.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-zinc-600 font-black uppercase tracking-widest">Sin referidos</td></tr>
                )}
                {referidos.map((ref) => (
                  <tr key={ref.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-4 px-4 font-bold text-white">
                      {ref.recomendante?.nombre}
                      <p className="text-xs text-zinc-500 font-normal">{ref.recomendante?.telefono}</p>
                    </td>
                    <td className="py-4 px-4 text-zinc-300">
                      {ref.recomendado?.nombre}
                      <p className="text-xs text-zinc-500">{ref.recomendado?.telefono}</p>
                    </td>
                    <td className="py-4 px-4 text-zinc-500 text-xs">{new Date(ref.fecha).toLocaleDateString('es-BO')}</td>
                    <td className="py-4 px-4 text-amber-500 font-black">Bs. {ref.monto_bono}</td>
                    <td className="py-4 px-4 text-center">
                      {ref.bono_otorgado 
                        ? <Badge variant="success" className="text-[9px]"><CheckCircle2 size={10} className="inline mr-1" />Entregado</Badge>
                        : <Badge variant="warning" className="text-[9px]">Pendiente</Badge>
                      }
                    </td>
                    <td className="py-4 px-4 text-right">
                      {!ref.bono_otorgado && (
                        <Button size="sm" variant="primary" onClick={() => otorgarDescuentoReferido(ref)}>
                          Otorgar Descuento
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ MODAL META ══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 flex items-start justify-center z-[100] p-4 pt-12 overflow-y-auto">
          <Card className="w-full max-w-lg bg-zinc-950 border-white/10 my-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white uppercase">{editing ? 'Editar Meta' : 'Nueva Meta'}</CardTitle>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={16} className="text-zinc-400" /></button>
              </div>
            </CardHeader>
            <form onSubmit={saveMeta}>
              <CardContent className="space-y-4 p-6">
                <Input label="Nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                <Input label="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
                <Input label="Visitas requeridas" type="number" min={1} value={form.visitas_requeridas} onChange={(e) => setForm({ ...form, visitas_requeridas: parseInt(e.target.value) })} />
                <Input label="Orden" type="number" value={form.orden} onChange={(e) => setForm({ ...form, orden: parseInt(e.target.value) || 0 })} />
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500">Tipo de recompensa</label>
                  <select className="w-full h-12 mt-1 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white" value={form.tipo_recompensa} onChange={(e) => setForm({ ...form, tipo_recompensa: e.target.value as TipoRecompensa })}>
                    {TIPOS.map((t) => <option key={t} value={t}>{labelTipoRecompensa(t)}</option>)}
                  </select>
                </div>
                {(form.tipo_recompensa === 'porcentaje' || form.tipo_recompensa === 'monto_fijo') && (
                  <Input label="Valor" type="number" value={form.valor_recompensa} onChange={(e) => setForm({ ...form, valor_recompensa: parseFloat(e.target.value) })} />
                )}
                {form.tipo_recompensa === 'servicio_gratis' && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 mb-1.5 block">
                      Servicios aplicables para beneficio gratis (vacío = cualquier servicio)
                    </label>
                    <div className="flex flex-wrap gap-2 p-3 bg-zinc-900 border border-white/10 rounded-xl max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                          !form.servicio_id ? 'bg-amber-500 text-black shadow-md' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                        onClick={() => setForm({ ...form, servicio_id: '' })}
                      >
                        ✨ Cualquier Servicio
                      </button>
                      {servicios.map((s) => {
                        const selectedList = form.servicio_id ? form.servicio_id.split(',').filter(Boolean) : []
                        const isSelected = selectedList.includes(s.id)
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              isSelected
                                ? 'bg-amber-500 text-black font-black shadow-md'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            }`}
                            onClick={() => {
                              let newSelected: string[]
                              if (isSelected) {
                                newSelected = selectedList.filter(id => id !== s.id)
                              } else {
                                newSelected = [...selectedList, s.id]
                              }
                              setForm({ ...form, servicio_id: newSelected.join(',') })
                            }}
                          >
                            {isSelected ? '✓ ' : ''}{s.nombre}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {form.servicio_id
                        ? `Seleccionados: ${form.servicio_id.split(',').filter(Boolean).length} servicio(s)`
                        : 'Aplica a cualquier servicio registrado.'}
                    </p>
                  </div>
                )}
                {form.tipo_recompensa === 'producto_gratis' && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500">Producto gratis</label>
                    <select className="w-full h-12 mt-1 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white" value={form.producto_id} onChange={(e) => setForm({ ...form, producto_id: e.target.value })}>
                      <option value="">Seleccionar producto</option>
                      {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Meta activa
                </label>
              </CardContent>
              <div className="p-6 border-t border-white/5 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" className="flex-1"><Save className="w-4 h-4 mr-2" />Guardar</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ══ MODAL PROMO ══ */}
      {showPromoModal && (
        <div className="fixed inset-0 bg-black/90 flex items-start justify-center z-[100] p-4 pt-12 overflow-y-auto">
          <Card className="w-full max-w-xl bg-zinc-950 border-white/10 my-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white uppercase">{editingPromo ? 'Editar Promoción' : 'Nueva Promoción'}</CardTitle>
                <button onClick={() => setShowPromoModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={16} className="text-zinc-400" /></button>
              </div>
            </CardHeader>
            <form onSubmit={savePromo}>
              <CardContent className="space-y-4 p-6">
                {/* Nombre + Ícono */}
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Ícono</label>
                    <select className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-white text-lg" value={promoForm.icono} onChange={e => setPromoForm({ ...promoForm, icono: e.target.value })}>
                      {ICONOS.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <Input label="Nombre" required value={promoForm.nombre} onChange={e => setPromoForm({ ...promoForm, nombre: e.target.value })} />
                  </div>
                </div>

                <Input label="Descripción" value={promoForm.descripcion} onChange={e => setPromoForm({ ...promoForm, descripcion: e.target.value })} />

                {/* Tipo */}
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Tipo de Promoción</label>
                  <div className="flex gap-2">
                    <select 
                      className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white" 
                      value={TIPOS_PROMO.some(t => t.value === promoForm.tipo) ? promoForm.tipo : 'otro'} 
                      onChange={e => setPromoForm({ ...promoForm, tipo: e.target.value === 'otro' ? '' : e.target.value })}
                    >
                      {TIPOS_PROMO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      <option value="otro">Otro (Personalizado...)</option>
                    </select>
                    {!TIPOS_PROMO.some(t => t.value === promoForm.tipo) && (
                      <Input 
                        placeholder="Ej. vip, verano_26" 
                        value={promoForm.tipo} 
                        onChange={e => setPromoForm({ ...promoForm, tipo: e.target.value.toLowerCase().replace(/\s+/g, '_') })} 
                      />
                    )}
                  </div>
                </div>

                {/* Valor (solo si aplica) */}
                {['descuento_porcentaje', 'descuento_fijo', 'cumpleanos', 'referido'].includes(promoForm.tipo) && (
                  <Input 
                    label={
                      promoForm.tipo === 'descuento_porcentaje' ? 'Descuento (%)' : 
                      promoForm.tipo === 'descuento_fijo' ? 'Descuento fijo (Bs)' :
                      promoForm.tipo === 'referido' ? 'Monto del Bono por referido (Bs)' :
                      'Valor de descuento (Bs o % si es <= 100)'
                    } 
                    type="number" 
                    min={0} 
                    value={promoForm.valor} 
                    onChange={e => setPromoForm({ ...promoForm, valor: parseFloat(e.target.value) || 0 })} 
                  />
                )}

                {/* Días de la semana */}
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-2 block">Días de la semana (vacío = todos)</label>
                  <div className="flex gap-2 flex-wrap">
                    {DIAS_SEMANA.map((dia, i) => (
                      <button key={i} type="button"
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${promoForm.dias_semana.includes(i) ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                        onClick={() => toggleDia(i)}
                      >{dia}</button>
                    ))}
                  </div>
                </div>

                {/* Nivel requerido */}
                {promoForm.tipo === 'nivel_lealtad' && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Nivel mínimo requerido</label>
                    <select className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white" value={promoForm.nivel_requerido} onChange={e => setPromoForm({ ...promoForm, nivel_requerido: e.target.value })}>
                      <option value="">Todos los niveles</option>
                      {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}

                {/* Servicios asociados */}
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 mb-1.5 block">
                    Servicios permitidos para esta promo (vacío = todos los servicios)
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-zinc-900 border border-white/10 rounded-xl max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                        !promoForm.servicio_id ? 'bg-amber-500 text-black shadow-md' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                      onClick={() => setPromoForm({ ...promoForm, servicio_id: '' })}
                    >
                      ✨ Todos los servicios
                    </button>
                    {servicios.map((s) => {
                      const selectedList = promoForm.servicio_id ? promoForm.servicio_id.split(',').filter(Boolean) : []
                      const isSelected = selectedList.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-amber-500 text-black font-black shadow-md'
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                          onClick={() => {
                            let newSelected: string[]
                            if (isSelected) {
                              newSelected = selectedList.filter(id => id !== s.id)
                            } else {
                              newSelected = [...selectedList, s.id]
                            }
                            setPromoForm({ ...promoForm, servicio_id: newSelected.join(',') })
                          }}
                        >
                          {isSelected ? '✓ ' : ''}{s.nombre}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {promoForm.servicio_id
                      ? `Permitidos: ${promoForm.servicio_id.split(',').filter(Boolean).length} servicio(s)`
                      : 'Esta promoción aplica a cualquier servicio del catálogo.'}
                  </p>
                </div>

                {/* Vigencia */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Desde (opcional)</label>
                    <input type="date" value={promoForm.fecha_inicio} onChange={e => setPromoForm({ ...promoForm, fecha_inicio: e.target.value })} className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-amber-500/50" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block">Hasta (opcional)</label>
                    <input type="date" value={promoForm.fecha_fin} onChange={e => setPromoForm({ ...promoForm, fecha_fin: e.target.value })} className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-amber-500/50" />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <input type="checkbox" checked={promoForm.activa} onChange={e => setPromoForm({ ...promoForm, activa: e.target.checked })} /> Promoción activa
                </label>
              </CardContent>
              <div className="p-6 border-t border-white/5 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowPromoModal(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" className="flex-1" disabled={savingPromo}><Save className="w-4 h-4 mr-2" />{savingPromo ? 'Guardando...' : 'Guardar'}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ══ MODAL EDITAR CLIENTE ══ */}
      {showClienteModal && editingCliente && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowClienteModal(false)}>
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase text-white">Editar Cliente</h3>
              <button onClick={() => setShowClienteModal(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={saveCliente} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Nombre Completo</label>
                <Input required value={clienteForm.nombre} onChange={e => setClienteForm({ ...clienteForm, nombre: e.target.value })} className="bg-zinc-950 border-white/10" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Teléfono</label>
                <Input value={clienteForm.telefono} onChange={e => setClienteForm({ ...clienteForm, telefono: e.target.value })} className="bg-zinc-950 border-white/10" placeholder="+591..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">CI / Documento</label>
                  <Input value={clienteForm.ci} onChange={e => setClienteForm({ ...clienteForm, ci: e.target.value })} className="bg-zinc-950 border-white/10" placeholder="Ej: 1234567" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">F. Nacimiento</label>
                  <Input type="date" value={clienteForm.fecha_nacimiento} onChange={e => setClienteForm({ ...clienteForm, fecha_nacimiento: e.target.value })} className="bg-zinc-950 border-white/10 [color-scheme:dark]" />
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full justify-start text-zinc-300 border-white/10 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-500 transition-colors"
                  onClick={resetPassword}
                  disabled={resettingPwd}
                >
                  {resettingPwd ? 'Enviando...' : '📧 Enviar Enlace de Cambio de Contraseña'}
                </Button>
                <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                  Si el cliente tiene una cuenta vinculada, recibirá un correo con un enlace para cambiar su contraseña.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowClienteModal(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" className="flex-1" disabled={savingCliente}>
                  {savingCliente ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
