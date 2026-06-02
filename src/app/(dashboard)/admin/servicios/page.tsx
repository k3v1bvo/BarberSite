'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, Scissors, ArrowLeft, X, Save, Clock, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'

import type { ComisionTipo } from '@/types'

interface Servicio {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  duracion_minutos: number
  color: string
  is_active: boolean
  comision_activa?: boolean
  comision_tipo?: ComisionTipo
  comision_valor?: number
  comision_acumulable?: boolean
}

export default function ServiciosPage() {
  const { error: toastError } = useToast()
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingServicio, setEditingServicio] = useState<Servicio | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: 0,
    duracion_minutos: 30,
    color: '#f59e0b',
    comision_activa: true,
    comision_tipo: 'porcentaje' as ComisionTipo,
    comision_valor: 30,
    comision_acumulable: false,
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadServicios()
  }, [])

  const loadServicios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: serviciosData } = await supabase
        .from('servicios')
        .select('*')
        .order('nombre')

      setServicios(serviciosData as Servicio[] || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingServicio) {
        const { error } = await supabase
          .from('servicios')
          .update({
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            precio: formData.precio,
            duracion_minutos: formData.duracion_minutos,
            color: formData.color,
            comision_activa: formData.comision_activa,
            comision_tipo: formData.comision_tipo,
            comision_valor: formData.comision_valor,
            comision_acumulable: formData.comision_acumulable,
          })
          .eq('id', editingServicio.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('servicios')
          .insert({
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            precio: formData.precio,
            duracion_minutos: formData.duracion_minutos,
            color: formData.color,
            is_active: true,
            comision_activa: formData.comision_activa,
            comision_tipo: formData.comision_tipo,
            comision_valor: formData.comision_valor,
            comision_acumulable: formData.comision_acumulable,
          })

        if (error) throw error
      }

      setShowModal(false)
      setEditingServicio(null)
      setFormData({
        nombre: '',
        descripcion: '',
        precio: 0,
        duracion_minutos: 30,
        color: '#f59e0b',
        comision_activa: true,
        comision_tipo: 'porcentaje',
        comision_valor: 30,
        comision_acumulable: false,
      })
      loadServicios()
    } catch (error: any) {
      toastError('Error: ' + error.message)
    }
  }

  const toggleActivo = async (servicio: Servicio) => {
    try {
      const { error } = await supabase
        .from('servicios')
        .update({ is_active: !servicio.is_active })
        .eq('id', servicio.id)

      if (error) throw error
      loadServicios()
    } catch (error: any) {
      toastError('Error: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Organizando Catálogo...</p>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-8">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/admin')} className="p-4 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl transition-all btn-press group">
            <ArrowLeft className="w-5 h-5 text-zinc-500 group-hover:text-amber-500" />
          </button>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">
              Service <span className="text-amber-500">Menu</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-2 text-lg">Define los servicios, precios y tiempos de ejecución</p>
          </div>
        </div>
        <Button variant="primary" size="lg" className="shadow-lg shadow-amber-500/20 font-black uppercase tracking-widest h-14 px-8" onClick={() => setShowModal(true)}>
          <Plus className="w-5 h-5 mr-2 stroke-[3px]" />
          Añadir Servicio
        </Button>
      </div>

      {/* Servicios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {servicios.map((servicio) => (
          <Card key={servicio.id} className={cn(
            "group relative border-white/5 bg-zinc-900 overflow-hidden transition-all card-hover",
            !servicio.is_active && "grayscale opacity-50"
          )}>
            {/* Color Accent Bar */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ backgroundColor: servicio.color }}
            />

            <CardContent className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-black font-black text-xl shadow-lg"
                  style={{ backgroundColor: servicio.color }}
                >
                  {servicio.nombre.charAt(0)}
                </div>
                <Badge variant={servicio.is_active ? 'success' : 'danger'} className="uppercase font-black text-[10px] tracking-widest">
                  {servicio.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>

              <h3 className="text-2xl font-black text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-2">{servicio.nombre}</h3>
              <p className="text-zinc-500 text-sm font-medium line-clamp-2 h-10 mb-6 leading-relaxed">
                {servicio.descripcion || 'Servicio profesional de peluquería y barbería de alta gama.'}
              </p>

              <div className="flex justify-between items-end pt-6 border-t border-white/5">
                <div>
                  <p className="text-3xl font-black text-white leading-none mb-2">{formatCurrency(servicio.precio)}</p>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Clock size={12} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{servicio.duracion_minutos} MINUTOS</span>
                  </div>
                  <p className="text-[10px] font-black uppercase text-zinc-600 mt-2">
                    Comisión:{' '}
                    {!servicio.comision_activa || servicio.comision_tipo === 'ninguna'
                      ? 'Sin comisión'
                      : servicio.comision_tipo === 'fija'
                        ? `Bs. ${servicio.comision_valor ?? 0}`
                        : `${servicio.comision_valor ?? 30}%`}
                    {servicio.comision_acumulable ? ' · acumulable' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-10 h-10 p-0 border-white/5 bg-zinc-950 hover:bg-amber-500 hover:text-black transition-all"
                    onClick={() => {
                      setEditingServicio(servicio)
                      setFormData({
                        nombre: servicio.nombre,
                        descripcion: servicio.descripcion || '',
                        precio: servicio.precio,
                        duracion_minutos: servicio.duracion_minutos,
                        color: servicio.color,
                        comision_activa: servicio.comision_activa ?? true,
                        comision_tipo: servicio.comision_tipo ?? 'porcentaje',
                        comision_valor: servicio.comision_valor ?? 30,
                        comision_acumulable: servicio.comision_acumulable ?? false,
                      })
                      setShowModal(true)
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={servicio.is_active ? 'danger' : 'success'}
                    size="sm"
                    className="w-10 h-10 p-0"
                    onClick={() => toggleActivo(servicio)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {servicios.length === 0 && (
          <div className="col-span-full py-32 text-center border-2 border-dashed border-white/5 rounded-3xl">
            <Scissors size={64} className="mx-auto text-zinc-800 mb-4 opacity-30" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No hay servicios registrados en el catálogo</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <Card className="w-full max-w-xl border-white/10 shadow-2xl bg-zinc-950 my-auto">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 p-8 bg-zinc-900/50">
              <div>
                <CardTitle className="text-2xl font-black uppercase text-white leading-none">
                  {editingServicio ? 'Editar' : 'Nuevo'} <span className="text-amber-500">Servicio</span>
                </CardTitle>
                <p className="text-zinc-500 text-xs mt-2 font-medium">Configura los detalles comerciales del servicio</p>
              </div>
              <button
                onClick={() => { setShowModal(false); setEditingServicio(null); }}
                className="p-3 hover:bg-white/5 rounded-2xl transition-colors border border-white/5"
              >
                <X className="w-6 h-6 text-zinc-500" />
              </button>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="p-8 space-y-6">
                <Input
                  label="Nombre del Servicio"
                  placeholder="Ej. Corte Pro + Barba"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  className="bg-zinc-900"
                />
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Descripción Detallada</label>
                  <textarea
                    className="w-full p-4 border border-white/10 bg-zinc-900 rounded-xl text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                    rows={3}
                    placeholder="Describe qué incluye este servicio..."
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <Input
                    label="Precio de Venta"
                    type="number"
                    placeholder="0.00"
                    value={formData.precio}
                    onChange={(e) => setFormData({ ...formData, precio: parseFloat(e.target.value) })}
                    required
                    className="bg-zinc-900"
                  />
                  <Input
                    label="Duración Estimada (min)"
                    type="number"
                    placeholder="30"
                    value={formData.duracion_minutos}
                    onChange={(e) => setFormData({ ...formData, duracion_minutos: parseInt(e.target.value) })}
                    required
                    className="bg-zinc-900"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Color de Identificación</label>
                  <div className="flex gap-3">
                    <div className="relative group">
                      <input
                        type="color"
                        className="w-14 h-14 rounded-2xl cursor-pointer border-none p-0 overflow-hidden"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-black/50 group-hover:scale-125 transition-transform">
                        <Palette size={20} />
                      </div>
                    </div>
                    <input
                      type="text"
                      className="flex-1 h-14 border border-white/10 bg-zinc-900 rounded-2xl px-4 text-sm font-black text-zinc-300 focus:border-amber-500/50 outline-none uppercase tracking-widest"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    />
                  </div>
                </div>
                <div className="border-t border-white/5 pt-6 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Comisión del barbero</p>
                  <label className="flex items-center gap-2 text-sm text-zinc-400">
                    <input
                      type="checkbox"
                      checked={formData.comision_activa}
                      onChange={(e) => setFormData({ ...formData, comision_activa: e.target.checked })}
                    />
                    Genera comisión
                  </label>
                  <select
                    className="w-full h-12 bg-zinc-900 border border-white/10 rounded-xl px-4 text-white text-sm"
                    value={formData.comision_tipo}
                    onChange={(e) => setFormData({ ...formData, comision_tipo: e.target.value as ComisionTipo })}
                    disabled={!formData.comision_activa}
                  >
                    <option value="porcentaje">Porcentaje</option>
                    <option value="fija">Comisión fija</option>
                    <option value="ninguna">Sin comisión</option>
                  </select>
                  {formData.comision_activa && formData.comision_tipo !== 'ninguna' && (
                    <Input
                      label={formData.comision_tipo === 'fija' ? 'Monto fijo (Bs.)' : 'Porcentaje (%)'}
                      type="number"
                      value={formData.comision_valor}
                      onChange={(e) => setFormData({ ...formData, comision_valor: parseFloat(e.target.value) })}
                      className="bg-zinc-900"
                    />
                  )}
                  <label className="flex items-center gap-2 text-sm text-zinc-400">
                    <input
                      type="checkbox"
                      checked={formData.comision_acumulable}
                      onChange={(e) => setFormData({ ...formData, comision_acumulable: e.target.checked })}
                    />
                    Comisión acumulable (incluye propinas)
                  </label>
                </div>
              </CardContent>
              <div className="p-8 bg-zinc-900/30 border-t border-white/5 flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-14 border-white/5 text-zinc-500 hover:text-white uppercase font-black tracking-widest text-[10px]"
                  onClick={() => { setShowModal(false); setEditingServicio(null); }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1 h-14 shadow-lg shadow-amber-500/20 uppercase font-black tracking-widest"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingServicio ? 'Guardar Cambios' : 'Lanzar Servicio'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}