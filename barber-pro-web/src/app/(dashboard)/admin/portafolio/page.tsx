'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Camera, ArrowLeft, X, Save, Image as ImageIcon, User, Layers, Edit, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { isValidImageUrl } from '@/lib/validators'
import { ImageUpload } from '@/components/ui/ImageUpload'

interface PortafolioItem {
  id: string
  image_url: string
  categoria: string
  descripcion: string
  barbero_id: string
  titulo?: string | null
  sort_order?: number
  is_active?: boolean
  deleted_at: string | null
}

type FilterType = 'todos' | 'activos' | 'eliminados'

export default function AdminPortafolioPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [items, setItems] = useState<PortafolioItem[]>([])
  const [barberos, setBarberos] = useState<{ id: string, full_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PortafolioItem | null>(null)
  const [filter, setFilter] = useState<FilterType>('activos')
  const [formData, setFormData] = useState({
    image_url: '', categoria: 'Fade', descripcion: '', barbero_id: '', titulo: '', sort_order: 0, is_active: true
  })

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [filter])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: bData } = await supabase.from('profiles').select('id, full_name').eq('role', 'barbero').eq('is_active', true)
      if (bData) setBarberos(bData)

      let query = supabase
        .from('portafolio')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (filter === 'activos') {
        query = query.is('deleted_at', null).eq('is_active', true)
      } else if (filter === 'eliminados') {
        query = query.not('deleted_at', 'is', null)
      } else {
        query = query.is('deleted_at', null)
      }

      const { data: pData } = await query
      if (pData) setItems(pData)
    } catch (e: any) {
      console.error(e)
      toastError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidImageUrl(formData.image_url)) {
      toastError('La URL de la imagen no es válida o no es segura.')
      return
    }

    try {
      if (editing) {
        const { error } = await supabase.from('portafolio').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', editing.id)
        if (error) throw error
        toastSuccess('Publicación actualizada')
      } else {
        const { error } = await supabase.from('portafolio').insert(formData)
        if (error) throw error
        toastSuccess('Imagen agregada a la galería')
      }
      setShowModal(false)
      setEditing(null)
      setFormData({ image_url: '', categoria: 'Fade', descripcion: '', barbero_id: '', titulo: '', sort_order: 0, is_active: true })
      loadData()
    } catch (e: unknown) {
      toastError('Error: ' + (e instanceof Error ? e.message : 'Error'))
    }
  }

  const toggleActive = async (item: PortafolioItem) => {
    await supabase.from('portafolio').update({ is_active: !item.is_active, updated_at: new Date().toISOString() }).eq('id', item.id)
    loadData()
  }

  const deleteItem = async (id: string) => {
    if (!confirm('¿Eliminar lógicamente esta imagen de la galería pública?')) return
    try {
      await supabase.from('portafolio').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', id)
      toastSuccess('Imagen eliminada')
      loadData()
    } catch (e: any) {
      toastError('Error al eliminar')
    }
  }

  const restoreItem = async (id: string) => {
    try {
      await supabase.from('portafolio').update({ deleted_at: null, is_active: true }).eq('id', id)
      toastSuccess('Imagen restaurada')
      loadData()
    } catch (e: any) {
      toastError('Error al restaurar')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Revelando Portafolio...</p>
      </div>
    )
  }

  const CATEGORIAS = ['Fade', 'Clásico', 'Barba', 'Diseños', 'Color', 'Otro']

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
              Pro <span className="text-amber-500">Showcase</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-2 text-lg">Curaduría visual de los mejores trabajos del equipo</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="h-14 bg-zinc-900 border border-white/10 rounded-2xl px-4 text-white font-bold uppercase text-xs"
          >
            <option value="activos">Solo Visibles</option>
            <option value="todos">Todos (Ocultos)</option>
            <option value="eliminados">Eliminados</option>
          </select>
          <Button variant="primary" size="lg" className="shadow-lg shadow-amber-500/20 font-black uppercase tracking-widest h-14 px-8" onClick={() => { setEditing(null); setShowModal(true) }}>
            <Plus className="w-5 h-5 mr-2 stroke-[3px]" />
            Nueva Exposición
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {items.map(item => (
          <Card key={item.id} className={cn(
            "group relative overflow-hidden bg-zinc-900 border-white/5 shadow-2xl transition-all card-hover rounded-3xl",
            (!item.is_active || item.deleted_at) && "opacity-50"
          )}>
            <div className="aspect-[4/5] bg-zinc-800 relative overflow-hidden">
              <img 
                src={item.image_url} 
                loading="lazy"
                onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&q=80' }}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                alt={item.descripcion} 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60"></div>

              <Badge variant="warning" className="absolute top-4 left-4 bg-amber-500 text-black border-none uppercase font-black text-[10px] tracking-widest px-3 py-1 shadow-xl">
                {item.categoria}
              </Badge>

              {item.deleted_at ? (
                <Badge variant="outline" className="absolute top-4 right-4 bg-red-500/80 text-white border-red-400 uppercase font-black text-[10px] tracking-widest px-3 py-1">
                  Eliminado
                </Badge>
              ) : !item.is_active ? (
                <Badge variant="outline" className="absolute top-4 right-4 bg-zinc-500/20 text-zinc-300 border-zinc-500/30 uppercase font-black text-[10px] tracking-widest px-3 py-1">
                  Oculto
                </Badge>
              ) : null}

              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm gap-3">
                {item.deleted_at ? (
                  <button
                    onClick={() => restoreItem(item.id)}
                    className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center shadow-2xl hover:bg-green-600 transition-colors"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditing(item); setFormData({ image_url: item.image_url, categoria: item.categoria, descripcion: item.descripcion, barbero_id: item.barbero_id, titulo: item.titulo || '', sort_order: item.sort_order ?? 0, is_active: item.is_active !== false }); setShowModal(true) }}
                      className="w-12 h-12 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-2xl"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => toggleActive(item)}
                      className="w-12 h-12 rounded-full bg-zinc-800 text-white flex items-center justify-center shadow-2xl"
                    >
                      {item.is_active === false ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center shadow-2xl hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <CardContent className="p-6">
              {item.titulo && <p className="text-xs font-black uppercase text-amber-500 mb-1">{item.titulo}</p>}
              <p className="text-sm font-bold text-zinc-300 mb-2 line-clamp-2 min-h-[40px] leading-relaxed italic">"{item.descripcion}"</p>
              <p className="text-[10px] text-zinc-600 font-bold uppercase">Orden: {item.sort_order ?? 0}</p>
              <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-black uppercase text-amber-500">
                  {barberos.find(b => b.id === item.barbero_id)?.full_name.charAt(0) || '?'}
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none mb-1">Autor</p>
                  <p className="text-xs font-black text-white uppercase tracking-tight">
                    {barberos.find(b => b.id === item.barbero_id)?.full_name || 'Staff Pro'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length === 0 && (
        <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-3xl">
          <Camera size={64} className="mx-auto text-zinc-800 mb-4 opacity-30" />
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mb-4">No hay publicaciones para este filtro</p>
          {filter !== 'eliminados' && (
            <Button variant="primary" onClick={() => { setEditing(null); setShowModal(true) }} className="font-bold uppercase tracking-widest">
              <Plus className="w-4 h-4 mr-2" />
              Inaugurar Portafolio
            </Button>
          )}
        </div>
      )}

      {/* Modal Nueva Publicación - Redesigned */}
      {showModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <Card className="w-full max-w-xl border-white/10 shadow-2xl bg-zinc-950 my-auto">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 p-8 bg-zinc-900/50">
              <div>
                <CardTitle className="text-2xl font-black uppercase text-white leading-none">
                  {editing ? 'Editar' : 'Subir a'} <span className="text-amber-500">Exposición</span>
                </CardTitle>
                <p className="text-zinc-500 text-xs mt-2 font-medium">Publica los resultados de tus mejores sesiones</p>
              </div>
              <button
                onClick={() => { setShowModal(false); }}
                className="p-3 hover:bg-white/5 rounded-2xl transition-colors border border-white/5"
              >
                <X className="w-6 h-6 text-zinc-500" />
              </button>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="p-8 space-y-6">
                <div>
                  <ImageUpload
                    label="Foto del Trabajo (Recomendado 1080x1080px)"
                    defaultImage={formData.image_url || undefined}
                    onUploadSuccess={(url) => setFormData({ ...formData, image_url: url })}
                    onUploadError={(err) => toastError(err)}
                  />
                </div>
                <Input
                  label="Título (opcional)"
                  placeholder="Fade premium con diseño"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className="bg-zinc-900"
                />
                <Input
                  label="Orden en carrusel"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="bg-zinc-900"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Categoría Estética</label>
                    <div className="relative">
                      <select
                        required
                        className="h-14 w-full border border-white/10 bg-zinc-900 rounded-2xl px-4 text-sm font-black text-white focus:border-amber-500/50 outline-none transition-all appearance-none uppercase"
                        value={formData.categoria}
                        onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      >
                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <Layers className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Barbero Asociado</label>
                    <div className="relative">
                      <select
                        required
                        className="h-14 w-full border border-white/10 bg-zinc-900 rounded-2xl px-4 text-sm font-black text-white focus:border-amber-500/50 outline-none transition-all appearance-none uppercase"
                        value={formData.barbero_id}
                        onChange={(e) => setFormData({ ...formData, barbero_id: e.target.value })}
                      >
                        <option value="">SELECCIONAR...</option>
                        {barberos.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
                      </select>
                      <User className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nota del Trabajo</label>
                  <textarea
                    className="w-full p-4 border border-white/10 bg-zinc-900 rounded-2xl text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                    rows={2}
                    maxLength={150}
                    placeholder="Ej: Fade medio con barba perfilada y acabado premium..."
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                  Visible en galería y carrusel del index
                </label>

                {/* Image Preview handled by ImageUpload */}
              </CardContent>
              <div className="p-8 bg-zinc-900/30 border-t border-white/5 flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-14 border-white/5 text-zinc-500 hover:text-white uppercase font-black tracking-widest text-[10px]"
                  onClick={() => { setShowModal(false); }}
                >
                  Descartar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1 h-14 shadow-lg shadow-amber-500/20 uppercase font-black tracking-widest"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Publicar en Galería
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
