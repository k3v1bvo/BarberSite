'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowLeft, X, Save, Edit, Eye, EyeOff, Users, Instagram, Globe, GripVertical, RotateCcw, Link, Link2Off, Search, DollarSign } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn, toTitleCase } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { isValidImageUrl } from '@/lib/validators'
import { ImageUpload } from '@/components/ui/ImageUpload'
import ComisionBarberoModal from '@/components/comisiones/ComisionBarberoModal'

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

type TabFilter = 'todos' | 'visibles' | 'ocultos'

export default function AdminEquipoPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [members, setMembers] = useState<EquipoMember[]>([])
  const [barberos, setBarberos] = useState<BarberoProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EquipoMember | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  
  // Comisiones modal
  const [comisionModal, setComisionModal] = useState<{ barberoId: string; nombre: string; imagen?: string } | null>(null)
  
  // UI Filters
  const [activeTab, setActiveTab] = useState<TabFilter>('todos')
  const [searchQuery, setSearchQuery] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
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

      // Cargar TODOS los miembros guardados
      const { data: equipoData, error } = await supabase
        .from('equipo_home')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

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

      // Incluir también los barberos y coordinadores del sistema aún no configurados en equipo_home
      if (barberosData) {
        let nextOrder = equipoData?.length || 0
        barberosData.forEach((b: any) => {
          if (!foundProfileIds.has(b.id) && (b.role === 'barbero' || b.role === 'coordinador')) {
            nextOrder++
            processed.push({
              id: 'virtual_' + b.id,
              nombre: b.full_name || (b.role === 'coordinador' ? 'Coordinador' : 'Barbero'),
              especialidad: b.role === 'coordinador' ? 'Coordinador del Local' : 'Especialista en Corte',
              descripcion: '',
              imagen_url: b.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(b.full_name || 'B')}&background=f59e0b&color=000&size=256`,
              redes_sociales: {},
              sort_order: nextOrder,
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
      // Auto-insert into equipo_home directly!
      const payload = {
        nombre: member.nombre,
        especialidad: member.especialidad,
        descripcion: member.descripcion || 'Profesional en BarberSite',
        imagen_url: member.imagen_url,
        redes_sociales: member.redes_sociales || {},
        sort_order: member.sort_order || 1,
        is_active: true,
        profile_id: member.profile_id || null,
      }
      const { error } = await supabase.from('equipo_home').insert(payload)
      if (error) {
        toastError('Error al activar miembro: ' + error.message)
      } else {
        toastSuccess('¡Miembro activado y visible en la web!')
        loadData()
      }
      return
    }
    const { error } = await supabase.from('equipo_home').update({ is_active: !member.is_active, updated_at: new Date().toISOString() }).eq('id', member.id)
    if (error) {
      toastError('Error al cambiar estado')
    } else {
      toastSuccess(member.is_active ? 'Ocultado de la web' : 'Visible en la web')
      loadData()
    }
  }

  const syncAllStaff = async () => {
    try {
      setSaving(true)
      const { data: bList } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .in('role', ['barbero', 'coordinador'])
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      if (!bList || bList.length === 0) {
        toastError('No hay barberos o coordinadores registrados')
        return
      }

      for (let i = 0; i < bList.length; i++) {
        const b = bList[i]
        const existing = members.find(m => m.profile_id === b.id && m.is_configured !== false)
        if (existing) {
          await supabase.from('equipo_home').update({
            sort_order: i + 1,
            is_active: true,
            updated_at: new Date().toISOString()
          }).eq('id', existing.id)
        } else {
          await supabase.from('equipo_home').insert({
            nombre: b.full_name || 'Barbero',
            especialidad: b.role === 'coordinador' ? 'Coordinador del Local' : 'Especialista en Corte',
            descripcion: 'Profesional en BarberSite',
            imagen_url: b.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(b.full_name || 'B')}&background=f59e0b&color=000&size=256`,
            redes_sociales: {},
            sort_order: i + 1,
            is_active: true,
            profile_id: b.id,
          })
        }
      }
      toastSuccess('¡Todo el equipo fue sincronizado, ordenado y activado!')
      loadData()
    } catch (e: any) {
      toastError(e.message)
    } finally {
      setSaving(false)
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

  // Filtradoy búsqueda en el cliente
  const filteredMembers = members.filter(member => {
    // 1. Filtro por tab
    if (activeTab === 'visibles' && !member.is_active) return false
    if (activeTab === 'ocultos' && member.is_active) return false

    // 2. Búsqueda por texto
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchNombre = member.nombre.toLowerCase().includes(q)
      const matchEspecialidad = member.especialidad.toLowerCase().includes(q)
      return matchNombre || matchEspecialidad
    }
    return true
  })

  const countVisibles = members.filter(m => m.is_active).length
  const countOcultos = members.filter(m => !m.is_active).length

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando equipo...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin')} className="p-3.5 hover:bg-white/5 border border-white/10 bg-zinc-950 rounded-2xl transition-all group">
            <ArrowLeft className="w-5 h-5 text-zinc-400 group-hover:text-amber-500" />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase leading-none">
              Gestión del <span className="text-amber-500">Equipo</span>
            </h1>
            <p className="text-zinc-400 text-xs font-medium mt-1">Configura los barberos visibles en la web pública de BarberSite</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500 hover:text-black font-black uppercase tracking-wider text-xs h-12"
            onClick={syncAllStaff}
            disabled={saving}
          >
            ⚡ Activar y Ordenar Todo (1, 2, 3...)
          </Button>

          <Button variant="primary" size="lg" className="shadow-lg shadow-amber-500/20 font-black uppercase tracking-widest px-6 h-12" onClick={openCreate}>
            <Plus className="w-5 h-5 mr-2 stroke-[3px]" />
            Nuevo Miembro
          </Button>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-zinc-900/60 p-3 rounded-2xl border border-white/5">
        {/* Horizontal Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('todos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'todos'
                ? 'bg-amber-500 text-black shadow-lg font-black'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            👥 Todos ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('visibles')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'visibles'
                ? 'bg-emerald-500 text-black shadow-lg font-black'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            👁️ Visibles en Web ({countVisibles})
          </button>
          <button
            onClick={() => setActiveTab('ocultos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'ocultos'
                ? 'bg-zinc-700 text-white shadow-lg font-black'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            👁️‍🗨️ Ocultos / Pendientes ({countOcultos})
          </button>
        </div>

        {/* Buscador */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nombre..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-zinc-950 border-white/10 text-xs text-white"
          />
        </div>
      </div>

      {/* Grid de Miembros */}
      {filteredMembers.length === 0 ? (
        <div className="bg-zinc-900/40 border border-dashed border-white/10 rounded-3xl p-12 text-center">
          <Users className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 font-bold">No se encontraron miembros</p>
          <p className="text-xs text-zinc-500 mt-1">Intenta cambiando de pestaña o limpia el buscador.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map(member => {
            const linkedBarbero = getLinkedBarbero(member)
            return (
              <Card key={member.id} className={cn(
                'group relative overflow-hidden bg-zinc-900 border transition-all duration-300 rounded-3xl shadow-xl hover:border-amber-500/40',
                member.is_active ? 'border-amber-500/20' : 'border-white/5 opacity-80'
              )}>
                <div className="aspect-square bg-zinc-950 relative overflow-hidden">
                  <img
                    src={member.imagen_url}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80' }}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    alt={member.nombre}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />

                  {/* Especialidad Badge */}
                  <Badge variant="warning" className="absolute top-4 left-4 bg-amber-500 text-black border-none uppercase font-black text-[10px] tracking-widest px-3 py-1 shadow-xl">
                    {member.especialidad}
                  </Badge>

                  {/* Estado de Visibilidad Badge */}
                  <div className="absolute top-4 right-4">
                    {member.is_active ? (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-black px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                        👁️ Visible
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-white/10 px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                        {member.is_configured === false ? '⏳ Pendiente' : '👁️‍🗨️ Oculto'}
                      </span>
                    )}
                  </div>

                  {/* Linked Profile Badge */}
                  {linkedBarbero && (
                    <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-black/80 backdrop-blur-md border border-emerald-500/40 rounded-full px-3 py-1">
                      <Link size={11} className="text-emerald-400 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 truncate max-w-[120px]">
                        {linkedBarbero.full_name || linkedBarbero.email}
                      </span>
                    </div>
                  )}
                </div>

                <CardContent className="p-5 space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight line-clamp-1">{member.nombre}</h3>
                    {member.descripcion && member.descripcion !== 'Pendiente de configurar en el home' ? (
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2 italic font-normal">"{member.descripcion}"</p>
                    ) : (
                      <p className="text-[11px] text-zinc-500 mt-1 font-medium flex items-center gap-1">
                        ✂️ Profesional de BarberSite
                      </p>
                    )}
                  </div>

                  {/* Acciones principales rápidas */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                    <button
                      onClick={() => toggleActive(member)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1 ${
                        member.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500 hover:text-black'
                      }`}
                      title={member.is_active ? 'Ocultar de la Web' : 'Hacer Visible en la Web'}
                    >
                      {member.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span className="text-[10px] uppercase font-black">{member.is_active ? 'Ocultar' : 'Mostrar'}</span>
                    </button>

                    <button
                      onClick={() => openEdit(member)}
                      className="py-2 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold border border-white/10 transition flex items-center justify-center gap-1"
                    >
                      <Edit size={14} />
                      <span className="text-[10px] uppercase font-black">Editar</span>
                    </button>

                    {member.is_configured !== false ? (
                      <button
                        onClick={() => deleteMember(member.id)}
                        className="py-2 px-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30 transition flex items-center justify-center gap-1"
                      >
                        <Trash2 size={14} />
                        <span className="text-[10px] uppercase font-black">Borrar</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleActive(member)}
                        className="py-2 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/20 flex items-center justify-center gap-1"
                        title="Activar de inmediato"
                      >
                        <span className="text-[10px] uppercase font-bold">Activar</span>
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (member.profile_id) {
                            router.push(`/admin/horarios?barbero_id=${member.profile_id}`)
                          } else {
                            router.push('/admin/horarios')
                          }
                        }}
                        className="flex-1 text-[10px] font-black uppercase text-amber-400 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500 hover:text-black transition-all"
                      >
                        🕒 Horario
                      </Button>
                      {member.profile_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setComisionModal({
                            barberoId: member.profile_id!,
                            nombre: member.nombre,
                            imagen: member.imagen_url,
                          })}
                          className="flex-1 text-[10px] font-black uppercase text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500 hover:text-black transition-all"
                        >
                          <DollarSign size={12} className="mr-1" />
                          Comisiones
                        </Button>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center">
                      Posición: #{member.sort_order < 900 ? member.sort_order : members.indexOf(member) + 1}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

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

      {/* Modal responsiva de Edición / Creación */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="w-full max-w-2xl border-white/10 shadow-2xl bg-zinc-950 my-auto max-h-[92vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl">
            {/* Header Sticky */}
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 p-4 sm:p-6 bg-zinc-900/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                  💈
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-xl font-black uppercase text-white leading-none">
                    {editing ? 'Editar' : 'Nuevo'} <span className="text-amber-500">Miembro</span>
                  </CardTitle>
                  <p className="text-zinc-400 text-[11px] mt-1 font-medium">
                    {editing ? 'Actualiza la información del barbero para el sitio web' : 'Agrega un nuevo integrante al equipo visible en la portada'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2.5 hover:bg-white/10 rounded-xl transition-colors border border-white/10 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Content */}
              <CardContent className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
                {/* 1. Información Básica */}
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block border-b border-white/5 pb-1">
                    📝 Información General
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Nombre Completo *"
                      required
                      placeholder="Ej. Carlos Rodríguez"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="bg-zinc-900 border-white/10 text-xs"
                    />
                    <Input
                      label="Especialidad / Cargo *"
                      required
                      placeholder="Ej. Especialista en Fades & Barba"
                      value={formData.especialidad}
                      onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })}
                      className="bg-zinc-900 border-white/10 text-xs"
                    />
                  </div>
                </div>

                {/* 2. Imagen de Perfil */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block border-b border-white/5 pb-1">
                    📸 Fotografía del Barbero
                  </span>
                  <ImageUpload
                    label="Subir Foto de Perfil (Recomendado 500x500px)"
                    defaultImage={formData.imagen_url || undefined}
                    onUploadSuccess={(url) => setFormData({ ...formData, imagen_url: url })}
                    onUploadError={(err) => toastError(err)}
                  />
                </div>

                {/* 3. Descripción */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                    Descripción / Biografía Corta
                  </label>
                  <textarea
                    className="w-full p-3.5 border border-white/10 bg-zinc-900 rounded-xl text-xs font-normal text-white focus:border-amber-500 outline-none transition-all resize-none"
                    rows={2}
                    maxLength={500}
                    placeholder="Escribe una breve reseña de la trayectoria del barbero..."
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  />
                </div>

                {/* 4. Vincular con cuenta del sistema */}
                <div className="space-y-2 bg-zinc-900/60 p-4 rounded-2xl border border-white/5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300 flex items-center gap-1.5">
                    <Link size={12} className="text-emerald-400" />
                    Vincular con Usuario del Sistema (Opcional)
                  </label>
                  <div className="relative">
                    <select
                      value={formData.profile_id || ''}
                      onChange={(e) => setFormData({ ...formData, profile_id: e.target.value || null })}
                      className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-3.5 pr-10 text-xs font-bold text-white focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">— Sin vinculación (Perfil solo visual) —</option>
                      {barberos.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.full_name || b.email} ({b.role})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
                      {formData.profile_id
                        ? <Link size={14} className="text-emerald-400" />
                        : <Link2Off size={14} className="text-zinc-600" />
                      }
                    </div>
                  </div>
                </div>

                {/* 5. Redes sociales */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block border-b border-white/5 pb-1">
                    🌐 Redes Sociales (Opcional)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      placeholder="https://instagram.com/..."
                      value={formData.redes_sociales.instagram || ''}
                      onChange={(e) => setFormData({ ...formData, redes_sociales: { ...formData.redes_sociales, instagram: e.target.value } })}
                      className="bg-zinc-900 border-white/10 text-xs"
                    />
                    <Input
                      placeholder="https://facebook.com/..."
                      value={formData.redes_sociales.facebook || ''}
                      onChange={(e) => setFormData({ ...formData, redes_sociales: { ...formData.redes_sociales, facebook: e.target.value } })}
                      className="bg-zinc-900 border-white/10 text-xs"
                    />
                    <Input
                      placeholder="https://tiktok.com/@..."
                      value={formData.redes_sociales.tiktok || ''}
                      onChange={(e) => setFormData({ ...formData, redes_sociales: { ...formData.redes_sociales, tiktok: e.target.value } })}
                      className="bg-zinc-900 border-white/10 text-xs"
                    />
                    <Input
                      placeholder="https://miweb.com"
                      value={formData.redes_sociales.web || ''}
                      onChange={(e) => setFormData({ ...formData, redes_sociales: { ...formData.redes_sociales, web: e.target.value } })}
                      className="bg-zinc-900 border-white/10 text-xs"
                    />
                  </div>
                </div>

                {/* 6. Orden & Visibilidad */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <Input
                    label="Orden de Aparición"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    className="bg-zinc-900 border-white/10 text-xs"
                  />
                  
                  <div className="flex items-center justify-between bg-zinc-900/80 p-3 rounded-xl border border-white/5 mt-auto h-11">
                    <span className="text-xs font-bold text-white">Visible en el Home</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        formData.is_active ? 'bg-amber-500' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          formData.is_active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </CardContent>

              {/* Footer Sticky */}
              <div className="p-4 sm:p-6 bg-zinc-900/80 border-t border-white/5 flex gap-3 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11 border-white/10 text-zinc-400 hover:text-white uppercase font-black tracking-wider text-xs"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1 h-11 shadow-lg shadow-amber-500/20 uppercase font-black tracking-wider text-xs"
                  disabled={saving}
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Agregar al Equipo'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal de Comisiones por Barbero */}
      {comisionModal && (
        <ComisionBarberoModal
          barberoId={comisionModal.barberoId}
          barberoNombre={comisionModal.nombre}
          barberoImagen={comisionModal.imagen}
          onClose={() => setComisionModal(null)}
          onSaved={() => setComisionModal(null)}
        />
      )}
    </div>
  )
}
