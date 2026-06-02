'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { ArrowLeft, Clock, Plus, Save, Trash2, User, Edit } from 'lucide-react'
import type { PlantillaHorario, TipoHorario } from '@/types'

const TIPOS: { value: TipoHorario; label: string }[] = [
  { value: 'manana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'todo_dia', label: 'Todo el día' },
  { value: 'medio_turno', label: 'Medio turno' },
  { value: 'especial', label: 'Horario especial' },
  { value: 'personalizado', label: 'Personalizado' },
]

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const emptyForm = {
  nombre: '',
  tipo: 'todo_dia' as TipoHorario,
  hora_inicio: '09:00',
  hora_fin: '20:00',
  descripcion: '',
  is_active: true,
}

export default function AdminHorariosPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  const [plantillas, setPlantillas] = useState<PlantillaHorario[]>([])
  const [barberos, setBarberos] = useState<{ id: string; full_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PlantillaHorario | null>(null)
  const [asignBarbero, setAsignBarbero] = useState('')
  const [asignPlantilla, setAsignPlantilla] = useState('')
  const [diasSel, setDiasSel] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const [form, setForm] = useState(emptyForm)

  const load = async () => {
    const res = await fetch('/api/horarios/plantillas')
    const json = await res.json()
    setPlantillas(json.plantillas ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().from('profiles').select('id, full_name').eq('role', 'barbero').eq('is_active', true).then(({ data }) => {
        if (data) setBarberos(data)
      })
    })
  }, [])

  const savePlantilla = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/horarios/plantillas', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { id: editing.id, ...form } : form),
    })
    if (!res.ok) {
      toastError((await res.json()).error)
      return
    }
    success(editing ? 'Plantilla actualizada' : 'Plantilla creada')
    setShowModal(false)
    setEditing(null)
    setForm(emptyForm)
    load()
  }

  const deletePlantilla = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return
    const res = await fetch(`/api/horarios/plantillas?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toastError((await res.json()).error)
      return
    }
    success('Plantilla eliminada')
    load()
  }

  const openEdit = (p: PlantillaHorario) => {
    setEditing(p)
    setForm({
      nombre: p.nombre,
      tipo: p.tipo,
      hora_inicio: p.hora_inicio?.slice(0, 5) || '09:00',
      hora_fin: p.hora_fin?.slice(0, 5) || '20:00',
      descripcion: p.descripcion || '',
      is_active: p.is_active,
    })
    setShowModal(true)
  }

  const asignar = async () => {
    if (!asignBarbero || !asignPlantilla) {
      toastError('Selecciona barbero y plantilla')
      return
    }
    const res = await fetch('/api/horarios/asignar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barbero_id: asignBarbero, plantilla_id: asignPlantilla, dias: diasSel }),
    })
    if (!res.ok) {
      toastError((await res.json()).error)
      return
    }
    success('Horario asignado al barbero')
  }

  const toggleDia = (d: number) => {
    setDiasSel((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
  }

  if (loading) {
    return <div className="flex justify-center h-96 items-center"><div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-end border-b border-white/5 pb-8">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/admin')} className="p-4 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl">
            <ArrowLeft className="w-5 h-5 text-zinc-500" />
          </button>
          <div>
            <h1 className="text-4xl font-black text-white uppercase">Gestión de <span className="text-amber-500">Horarios</span></h1>
            <p className="text-zinc-500 mt-2">Plantillas reutilizables y asignación a barberos</p>
          </div>
        </div>
        <Button variant="primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true) }}>
          <Plus className="w-4 h-4 mr-2" /> Nueva plantilla
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2"><Clock size={16} /> Plantillas</h2>
          {plantillas.map((p) => (
            <Card key={p.id} className="bg-zinc-900 border-white/5">
              <CardContent className="p-6 flex justify-between items-center gap-4">
                <div>
                  <Badge variant="warning" className="mb-2 uppercase text-[10px]">{TIPOS.find((t) => t.value === p.tipo)?.label || p.tipo}</Badge>
                  <h3 className="text-lg font-black text-white uppercase">{p.nombre}</h3>
                  <p className="text-zinc-500 text-sm">{p.hora_inicio?.slice(0, 5)} — {p.hora_fin?.slice(0, 5)}</p>
                  {p.descripcion && <p className="text-zinc-600 text-xs mt-1">{p.descripcion}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => deletePlantilla(p.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-zinc-900 border-white/5 h-fit">
          <CardHeader><CardTitle className="text-white uppercase text-sm flex items-center gap-2"><User size={16} /> Asignar a barbero</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <select className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white" value={asignBarbero} onChange={(e) => setAsignBarbero(e.target.value)}>
              <option value="">Seleccionar barbero...</option>
              {barberos.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
            </select>
            <select className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white" value={asignPlantilla} onChange={(e) => setAsignPlantilla(e.target.value)}>
              <option value="">Seleccionar plantilla...</option>
              {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <div>
              <p className="text-[10px] font-black uppercase text-zinc-500 mb-2">Días de la semana</p>
              <div className="flex flex-wrap gap-2">
                {DIAS.map((d, i) => (
                  <button key={d} type="button" onClick={() => toggleDia(i)} className={`px-3 py-2 rounded-lg text-xs font-black uppercase ${diasSel.includes(i) ? 'bg-amber-500 text-black' : 'bg-zinc-950 text-zinc-500 border border-white/10'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="primary" className="w-full" onClick={asignar}><Save className="w-4 h-4 mr-2" /> Aplicar horario</Button>
            <p className="text-xs text-zinc-600">Días libres y excepciones se configuran en la agenda de cada barbero (bloqueos). La asistencia detecta retrasos y horas extras según el horario asignado.</p>
          </CardContent>
        </Card>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
          <Card className="w-full max-w-md bg-zinc-950 border-white/10">
            <CardHeader><CardTitle className="text-white uppercase">{editing ? 'Editar plantilla' : 'Nueva plantilla'}</CardTitle></CardHeader>
            <form onSubmit={savePlantilla}>
              <CardContent className="space-y-4 p-6">
                <Input label="Nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                <select className="w-full h-12 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoHorario })}>
                  {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Inicio" type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
                  <Input label="Fin" type="time" value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} />
                </div>
                <Input label="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </CardContent>
              <div className="p-6 border-t border-white/5 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowModal(false); setEditing(null) }}>Cancelar</Button>
                <Button type="submit" variant="primary" className="flex-1">Guardar</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
