'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { ArrowLeft, Plus, Save, Trash2, Gift, Users, Search, Edit } from 'lucide-react'
import { labelTipoRecompensa } from '@/lib/lealtad/helpers'
import type { LealtadMeta, TipoRecompensa } from '@/types'

const TIPOS: TipoRecompensa[] = ['porcentaje', 'monto_fijo', 'servicio_gratis', 'producto_gratis']

const emptyMeta = {
  nombre: '',
  descripcion: '',
  visitas_requeridas: 5,
  tipo_recompensa: 'porcentaje' as TipoRecompensa,
  valor_recompensa: 20,
  servicio_id: '' as string,
  producto_id: '' as string,
  is_active: true,
  orden: 0,
}

export default function AdminLealtadPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  const supabase = createClient()
  const [metas, setMetas] = useState<LealtadMeta[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [canjes, setCanjes] = useState<any[]>([])
  const [servicios, setServicios] = useState<{ id: string; nombre: string }[]>([])
  const [productos, setProductos] = useState<{ id: string; nombre: string }[]>([])
  const [filtro, setFiltro] = useState('')
  const [metaFiltro, setMetaFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<LealtadMeta | null>(null)
  const [form, setForm] = useState(emptyMeta)
  const [tab, setTab] = useState<'metas' | 'clientes'>('metas')

  const loadAll = async () => {
    try {
      const params = new URLSearchParams({ filtro })
      if (metaFiltro) params.set('meta_id', metaFiltro)
      const [mRes, aRes] = await Promise.all([
        fetch('/api/lealtad/metas'),
        fetch(`/api/lealtad/admin?${params}`),
      ])
      const mJson = await mRes.json()
      const aJson = await aRes.json()
      setMetas(mJson.metas ?? [])
      setClientes(aJson.clientes ?? [])
      setCanjes(aJson.canjes ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    supabase.from('servicios').select('id, nombre').eq('is_active', true).then(({ data }) => {
      if (data) setServicios(data)
    })
    supabase.from('productos').select('id, nombre').eq('is_active', true).then(({ data }) => {
      if (data) setProductos(data)
    })
  }, [])

  const saveMeta = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...form,
        servicio_id: form.servicio_id || null,
        producto_id: form.producto_id || null,
      }
      const res = await fetch('/api/lealtad/metas', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success(editing ? 'Meta actualizada' : 'Meta creada')
      setShowModal(false)
      setEditing(null)
      setForm(emptyMeta)
      loadAll()
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Error')
    }
  }

  const deleteMeta = async (id: string) => {
    if (!confirm('¿Eliminar esta meta?')) return
    await fetch(`/api/lealtad/metas?id=${id}`, { method: 'DELETE' })
    loadAll()
  }

  const ajustarVisitas = async (clienteId: string, delta?: number, total?: number) => {
    await fetch('/api/lealtad/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'ajustar_visitas',
        cliente_id: clienteId,
        visitas_delta: delta,
        visitas_total: total,
      }),
    })
    loadAll()
  }

  const fijarVisitas = async (clienteId: string, actual: number) => {
    const val = prompt('Número exacto de visitas:', String(actual))
    if (val === null) return
    const n = parseInt(val, 10)
    if (Number.isNaN(n) || n < 0) {
      toastError('Número inválido')
      return
    }
    await ajustarVisitas(clienteId, undefined, n)
    success('Visitas actualizadas')
  }

  const otorgarRecompensa = async (clienteId: string) => {
    const desc = prompt('Descripción de la recompensa:')
    if (!desc) return
    await fetch('/api/lealtad/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'otorgar_recompensa', cliente_id: clienteId, descripcion: desc }),
    })
    success('Recompensa otorgada')
    loadAll()
  }

  const openEdit = (m: LealtadMeta) => {
    setEditing(m)
    setForm({
      nombre: m.nombre,
      descripcion: m.descripcion || '',
      visitas_requeridas: m.visitas_requeridas,
      tipo_recompensa: m.tipo_recompensa,
      valor_recompensa: m.valor_recompensa,
      servicio_id: m.servicio_id || '',
      producto_id: m.producto_id || '',
      is_active: m.is_active,
      orden: m.orden,
    })
    setShowModal(true)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
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
            <p className="text-zinc-500 mt-2">Configura metas, recompensas y progreso de clientes</p>
          </div>
        </div>
        <Button variant="primary" onClick={() => { setEditing(null); setForm(emptyMeta); setShowModal(true) }}>
          <Plus className="w-4 h-4 mr-2" /> Nueva meta
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === 'metas' ? 'primary' : 'outline'} onClick={() => setTab('metas')}>
          <Gift className="w-4 h-4 mr-2" /> Metas
        </Button>
        <Button variant={tab === 'clientes' ? 'primary' : 'outline'} onClick={() => setTab('clientes')}>
          <Users className="w-4 h-4 mr-2" /> Clientes
        </Button>
      </div>

      {tab === 'metas' && (
        <div className="grid gap-4">
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
                  <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteMeta(m.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === 'clientes' && (
        <>
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Buscar cliente..." value={filtro} onChange={(e) => setFiltro(e.target.value)} className="max-w-md" />
            <select
              className="h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white text-sm"
              value={metaFiltro}
              onChange={(e) => setMetaFiltro(e.target.value)}
            >
              <option value="">Todas las metas</option>
              {metas.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre} ({m.visitas_requeridas}+ visitas)</option>
              ))}
            </select>
            <Button variant="outline" onClick={loadAll}><Search className="w-4 h-4" /></Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 uppercase text-[10px] tracking-widest border-b border-white/5">
                  <th className="text-left py-3 px-4">Cliente</th>
                  <th className="text-left py-3 px-4">Visitas</th>
                  <th className="text-left py-3 px-4">Gastado</th>
                  <th className="text-right py-3 px-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-4 px-4 font-bold text-white">{c.nombre}</td>
                    <td className="py-4 px-4 text-amber-500 font-black text-lg">{c.total_visitas ?? 0}</td>
                    <td className="py-4 px-4 text-zinc-400">Bs. {c.total_gastado ?? 0}</td>
                    <td className="py-4 px-4 text-right space-x-1">
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
              <CardHeader><CardTitle className="text-white uppercase text-sm">Historial completo reciente</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
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

      {showModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <Card className="w-full max-w-lg bg-zinc-950 border-white/10 my-auto">
            <CardHeader><CardTitle className="text-white uppercase">{editing ? 'Editar meta' : 'Nueva meta'}</CardTitle></CardHeader>
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
                    <label className="text-[10px] font-black uppercase text-zinc-500">Servicio gratis</label>
                    <select className="w-full h-12 mt-1 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white" value={form.servicio_id} onChange={(e) => setForm({ ...form, servicio_id: e.target.value })}>
                      <option value="">Cualquier servicio</option>
                      {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
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
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  Meta activa
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
    </div>
  )
}
