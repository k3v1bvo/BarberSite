'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowLeft, X, Save, Edit, Eye, EyeOff, Users, Instagram, Globe, GripVertical, RotateCcw, Link, Link2Off } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn, toTitleCase } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { isValidImageUrl } from '@/lib/validators'
import { ImageUpload } from '@/components/ui/ImageUpload'

interface EquipoMember {
  id: string
  nombre: string
  especialidad: string
  descripcion: string | null
  imagen_url: string
  redes_sociales: {
    instagram?: string
    facebook?: string
    tiktok?: string
    web?: string
  }
  sort_order: number
  is_active: boolean
  created_at: string
  profile_id: string | null
  is_configured?: boolean
}

interface BarberoProfile {
  id: string
  full_name: string | null
  email: string
  role: string
}

const EMPTY_FORM = {
  nombre: '',
  especialidad: '',
  descripcion: '',
  imagen_url: '',
  redes_sociales: { instagram: '', facebook: '', tiktok: '', web: '' },
  sort_order: 0,
  is_active: true,
  profile_id: null as string | null,
}

type FilterType = 'todos' | 'activos'

export default function AdminEquipoPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [members, setMembers] = useState<EquipoMember[]>([])
  const [barberos, setBarberos] = useState<BarberoProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EquipoMember | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<FilterType>('activos')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [filter])

  useEffect(() => {
    loadBarberos()
  }, [])

  const loadBarberos = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('role', ['barbero', 'coordinador', 'admin'])
      .eq('is_active', true)
      .order('full_name', { ascending: true })
    if (data) setBarberos(data)
  }

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      let query = supabase
        .from('equipo_home')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (filter === 'activos') {
        query = query.eq('is_active', true)
      }

      const { data: equipoData, error } = await query
      if (error) throw error

      const { data: barberosData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .in('role', ['barbero', 'coordinador', 'admin'])
        .eq('is_active', true)

      if (barberosData) setBarberos(barberosData as any)

      const processed: EquipoMember[] = []
      const foundProfileIds = new Set()

      if (equipoData) {
        equipoData.forEach((eq: any) => {
          if (eq.profile_id) foundProfileIds.add(eq.profile_id)
          processed.push({ ...eq, is_configured: true })
        })
      }

      if (filter === 'todos' && barberosData) {
        barberosData.forEach((b: any) => {
          if (!foundProfileIds.has(b.id) && b.role === 'barbero') {
             processed.push({
               id: 'virtual_' + b.id,
               nombre: b.full_name || 'Barbero',
               especialidad: 'Especialista',
               descripcion: 'Pendiente de configurar',
               imagen_url: b.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(b.full_name || 'B')}&background=f59e0b&color=000&size=256`,
               redes_sociales: {},
               sort_order: 999,
               is_active: false,
               profile_id: b.id,
               is_configured: false,
               created_at: new Date().toISOString()
             })
          }
        })
      }

      setMembers(processed)
    } catch (e: any) {
      console.error(e)
      toastError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setFormData({ ...EMPTY_FORM, sort_order: members.length })
    setShowModal(true)
  }

  const openEdit = (member: EquipoMember) => {
    setEditing(member)
    setFormData({
      nombre: member.nombre,
      especialidad: member.especialidad,
      descripcion: member.descripcion || '',
      imagen_url: member.imagen_url,
      redes_sociales: {
        instagram: member.redes_sociales?.instagram || '',
        facebook: member.redes_sociales?.facebook || '',
        tiktok: member.redes_sociales?.tiktok || '',
        web: member.redes_sociales?.web || '',
      },
      sort_order: member.sort_order,
      is_active: member.is_active,
      profile_id: member.profile_id || null,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nombre.trim()) return toastError('El nombre es requerido')
    if (!formData.especialidad.trim()) return toastError('La especialidad es requerida')
    if (!formData.imagen_url.trim() || !isValidImageUrl(formData.imagen_url)) {
      return toastError('La URL de la imagen no es válida')
    }

    setSaving(true)
    try {
      // Limpiar redes vacías
      const redes: Record<string, string> = {}
      if (formData.redes_sociales.instagram?.trim()) redes.instagram = formData.redes_sociales.instagram.trim()
      if (formData.redes_sociales.facebook?.trim()) redes.facebook = formData.redes_sociales.facebook.trim()
      if (formData.redes_sociales.tiktok?.trim()) redes.tiktok = formData.redes_sociales.tiktok.trim()
      if (formData.redes_sociales.web?.trim()) redes.web = formData.redes_sociales.web.trim()

      const payload = {
        nombre: toTitleCase(formData.nombre.trim()),
        especialidad: toTitleCase(formData.especialidad.trim()),
        descripcion: formData.descripcion.trim() || null,
        imagen_url: formData.imagen_url.trim(),
        redes_sociales: redes,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
        profile_id: formData.profile_id || null,
      }

      if (editing) {
        if (editing.is_configured === false) {
          const { error } = await supabase.from('equipo_home').insert(payload)
          if (error) throw error
          toastSuccess('Miembro configurado y agregado al equipo')
        } else {
          const { error } = await supabase.from('equipo_home').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
          if (error) throw error
          toastSuccess('Miembro actualizado')
        }
      } else {
        const { error } = await supabase.from('equipo_home').insert(payload)
        if (error) throw error
        toastSuccess('Miembro agregado al equipo')
      }

      setShowModal(false)
      setEditing(null)
      setFormData(EMPTY_FORM)
      loadData()
    } catch (e: unknown) {
      toastError('Error: ' + (e instanceof Error ? e.message : 'Error desconocido'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (member: EquipoMember) => {
    if (member.is_configured === false) {
      toastError('Debes editar y guardar al barbero antes de hacerlo visible')
      return;
    }
    const { error } = await supabase.from('equipo_home').update({ is_active: !member.is_active, updated_at: new Date().toISOString() }).eq('id', member.id)
    if (error) {
      toastError('Error al cambiar estado')
    } else {
      toastSuccess(member.is_active ? 'Ocultado del home' : 'Visible en el home')
      loadData()
    }
  }

  const deleteMember = async (id: string) => {
    if (!confirm('¿Eliminar definitivamente a este miembro del equipo?')) return
    const { error } = await supabase.from('equipo_home').delete().eq('id', id)
    if (error) {
      toastError('Error al eliminar')
    } else {
      toastSuccess('Miembro eliminado')
      loadData()
    }
  }



  // Helpers
  const getLinkedBarbero = (member: EquipoMember) =>
    member.profile_id ? barberos.find(b => b.id === member.profile_id) : null

  const getRoleBadgeColor = (role: string) => {
    if (role === 'admin') return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    if (role === 'coordinador') return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando equipo...</p>
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
              Nuestro <span className="text-amber-500">Equipo</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-2 text-lg">Gestiona los barberos que aparecen en el Home</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="h-14 bg-zinc-900 border border-white/10 rounded-2xl px-4 text-white font-bold uppercase text-xs"
          >
            <option value="activos">Solo Visibles</option>
            <option value="todos">Todos (Visibles + Ocultos)</option>
          </select>
          <Button variant="primary" size="lg" className="shadow-lg shadow-amber-500/20 font-black uppercase tracking-widest h-14 px-8" onClick={openCreate}>
            <Plus className="w-5 h-5 mr-2 stroke-[3px]" />
            Nuevo Miembro
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {members.map(member => {
          const linkedBarbero = getLinkedBarbero(member)
          return (
            <Card key={member.id} className={cn(
              'group relative overflow-hidden bg-zinc-900 border-white/5 shadow-2xl transition-all card-hover rounded-3xl',
              (!member.is_active) && 'opacity-50'
            )}>
              <div className="aspect-square bg-zinc-800 relative overflow-hidden">
                <img
                  src={member.imagen_url}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80' }}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  alt={member.nombre}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60"></div>

                <Badge variant="warning" className="absolute top-4 left-4 bg-amber-500 text-black border-none uppercase font-black text-[10px] tracking-widest px-3 py-1 shadow-xl">
                  {member.especialidad}
                </Badge>

                {/* Linked profile badge */}
                {linkedBarbero && (
                  <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30 rounded-full px-2.5 py-1">
                    <Link size={10} className="text-emerald-400 shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300 truncate max-w-[100px]">
                      {linkedBarbero.full_name || linkedBarbero.email}
                    </span>
                  </div>
                )}

                {!member.is_active ? (
                  <Badge variant="outline" className="absolute top-4 right-4 bg-zinc-500/20 text-zinc-300 border-zinc-500/30 uppercase font-black text-[10px] tracking-widest px-3 py-1">
                    {member.is_configured === false ? 'Pendiente' : 'Oculto'}
                  </Badge>
                ) : null}

                {/* Hover actions */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm gap-3">
                    <>
                      <button
                        onClick={() => openEdit(member)}
                        className="w-12 h-12 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-2xl hover:bg-amber-400 transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => toggleActive(member)}
                        className="w-12 h-12 rounded-full bg-zinc-800 text-white flex items-center justify-center shadow-2xl hover:bg-zinc-700 transition-colors"
                        title={member.is_active ? 'Ocultar' : 'Mostrar'}
                      >
                        {member.is_active ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      {member.is_configured !== false && (
                        <button
                          onClick={() => deleteMember(member.id)}
                          className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center shadow-2xl hover:bg-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </>
                </div>
              </div>

              <CardContent className="p-6">
                <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1">{member.nombre}</h3>
                {member.descripcion && (
                  <p className="text-sm text-zinc-400 mb-3 line-clamp-2 italic">"{member.descripcion}"</p>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex gap-2">
                    {member.redes_sociales?.instagram && (
                      <a href={member.redes_sociales.instagram} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-amber-400 transition-colors">
                        <Instagram size={16} />
                      </a>
                    )}
                    {member.redes_sociales?.web && (
                      <a href={member.redes_sociales.web} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-amber-400 transition-colors">
                        <Globe size={16} />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-zinc-600">
                    <GripVertical size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Orden: {member.sort_order}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty state */}
      {members.length === 0 && (
        <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-3xl">
          <Users size={64} className="mx-auto text-zinc-800 mb-4 opacity-30" />
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mb-4">No hay miembros para este filtro</p>
          <Button variant="primary" onClick={openCreate} className="font-bold uppercase tracking-widest">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primer Miembro
          </Button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <Card className="w-full max-w-xl border-white/10 shadow-2xl bg-zinc-950 my-auto max-h-[92vh] flex flex-col overflow-hidden rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 p-8 bg-zinc-900/50">
              <div>
                <CardTitle className="text-2xl font-black uppercase text-white leading-none">
                  {editing ? 'Editar' : 'Nuevo'} <span className="text-amber-500">Miembro</span>
                </CardTitle>
                <p className="text-zinc-500 text-xs mt-2 font-medium">
                  {editing ? 'Actualiza la información del miembro' : 'Agrega un nuevo barbero al equipo del Home'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-3 hover:bg-white/5 rounded-2xl transition-colors border border-white/5"
              >
                <X className="w-6 h-6 text-zinc-500" />
              </button>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="p-8 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    label="Nombre"
                    required
                    placeholder="Carlos Rodríguez"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="bg-zinc-900"
                  />
                  <Input
                    label="Especialidad / Cargo"
                    required
                    placeholder="Cortes Clásicos"
                    value={formData.especialidad}
                    onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })}
                    className="bg-zinc-900"
                  />
                </div>

                <div>
                  <ImageUpload
                    label="Foto del Barbero (Recomendado 500x500px)"
                    defaultImage={formData.imagen_url || undefined}
                    onUploadSuccess={(url) => setFormData({ ...formData, imagen_url: url })}
                    onUploadError={(err) => toastError(err)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Descripción (opcional)</label>
                  <textarea
                    className="w-full p-4 border border-white/10 bg-zinc-900 rounded-2xl text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                    rows={2}
                    maxLength={500}
                    placeholder="Más de 5 años de experiencia en cortes premium..."
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  />
                </div>

                {/* Vincular con cuenta del sistema */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1 flex items-center gap-2">
                    <Link size={10} className="text-emerald-400" />
                    Vincular con cuenta del sistema (opcional)
                  </label>
                  <div className="relative">
                    <select
                      value={formData.profile_id || ''}
                      onChange={(e) => setFormData({ ...formData, profile_id: e.target.value || null })}
                      className="w-full h-12 bg-zinc-900 border border-white/10 rounded-2xl px-4 pr-10 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">— Sin vinculación —</option>
                      {barberos.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.full_name || b.email} ({b.role})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                      {formData.profile_id
                        ? <Link size={14} className="text-emerald-400" />
                        : <Link2Off size={14} className="text-zinc-600" />
                      }
                    </div>
                  </div>
                  {formData.profile_id && (
                    <p className="text-[10px] text-emerald-400 font-bold ml-1 flex items-center gap-1">
                      <Link size={9} />
                      Vinculado — El miembro aparecerá conectado a su cuenta barbero
                    </p>
                  )}
                  {!formData.profile_id && (
                    <p className="text-[10px] text-zinc-600 font-medium ml-1">
                      Sin vinculación — El miembro es solo visual, sin cuenta en el sistema
                    </p>
                  )}
                </div>

                {/* Redes sociales */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Redes Sociales (opcional)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      label=""
                      placeholder="Instagram URL"
                      value={formData.redes_sociales.instagram || ''}
                      onChange={(e) => setFormData({ ...formData, redes_sociales: { ...formData.redes_sociales, instagram: e.target.value } })}
                      className="bg-zinc-900"
                    />
                    <Input
                      label=""
                      placeholder="Facebook URL"
                      value={formData.redes_sociales.facebook || ''}
                      onChange={(e) => setFormData({ ...formData, redes_sociales: { ...formData.redes_sociales, facebook: e.target.value } })}
                      className="bg-zinc-900"
                    />
                    <Input
                      label=""
                      placeholder="TikTok URL"
                      value={formData.redes_sociales.tiktok || ''}
                      onChange={(e) => setFormData({ ...formData, redes_sociales: { ...formData.redes_sociales, tiktok: e.target.value } })}
                      className="bg-zinc-900"
                    />
                    <Input
                      label=""
                      placeholder="Sitio Web URL"
                      value={formData.redes_sociales.web || ''}
                      onChange={(e) => setFormData({ ...formData, redes_sociales: { ...formData.redes_sociales, web: e.target.value } })}
                      className="bg-zinc-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <Input
                    label="Orden de aparición"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    className="bg-zinc-900"
                  />
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-3 text-sm text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-5 h-5 rounded border-white/10 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                      />
                      Visible en el Home
                    </label>
                  </div>
                </div>

                {/* Image Preview handled by ImageUpload */}              </CardContent>

              <div className="p-8 bg-zinc-900/30 border-t border-white/5 flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-14 border-white/5 text-zinc-500 hover:text-white uppercase font-black tracking-widest text-[10px]"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1 h-14 shadow-lg shadow-amber-500/20 uppercase font-black tracking-widest"
                  disabled={saving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Agregar al Equipo'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
