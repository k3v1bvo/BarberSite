'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, Users, ArrowLeft, X, Save } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Usuario {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: string
  is_active: boolean
  comision_porcentaje: number
  avatar_url: string | null
  created_at: string
}

export default function UsuariosPage() {
  const { error: toastError } = useToast()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Usuario | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    role: 'barbero' as 'barbero' | 'recepcionista' | 'admin',
    comision_porcentaje: 30,
    avatar_url: '',
    password: '',
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadUsuarios()
  }, [])

  const loadUsuarios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: usuariosData } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id) 
        .order('created_at', { ascending: false })

      setUsuarios(usuariosData as Usuario[] || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingUser) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            phone: formData.phone,
            role: formData.role,
            comision_porcentaje: formData.comision_porcentaje,
            avatar_url: formData.avatar_url,
            is_active: true,
          })
          .eq('id', editingUser.id)

        if (error) throw error
      } else {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          email_confirm: true,
          user_metadata: {
            full_name: formData.full_name,
          },
        })

        if (authError) throw authError

        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            role: formData.role,
            phone: formData.phone,
            comision_porcentaje: formData.comision_porcentaje,
            avatar_url: formData.avatar_url,
          })
          .eq('id', authData.user.id)

        if (profileError) throw profileError
      }

      setShowModal(false)
      setEditingUser(null)
      setFormData({
        email: '',
        full_name: '',
        phone: '',
        role: 'barbero',
        comision_porcentaje: 30,
        avatar_url: '',
        password: '',
      })
      loadUsuarios()
    } catch (error: any) {
      toastError('Error: ' + error.message)
    }
  }

  const toggleActivo = async (usuario: Usuario) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !usuario.is_active })
        .eq('id', usuario.id)

      if (error) throw error
      loadUsuarios()
    } catch (error: any) {
      toastError('Error: ' + error.message)
    }
  }

  const getRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
      admin: 'info',
      recepcionista: 'warning',
      barbero: 'success',
    }
    return variants[role] || 'default'
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Sincronizando Usuarios...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-8">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/admin')} className="p-4 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl transition-all btn-press group">
             <ArrowLeft className="w-5 h-5 text-zinc-500 group-hover:text-amber-500" />
          </button>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">
              Team <span className="text-amber-500">Management</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-2 text-lg">Controla los accesos y comisiones de tu equipo</p>
          </div>
        </div>
        <Button variant="primary" size="lg" className="shadow-lg shadow-amber-500/20 font-black uppercase tracking-widest h-14 px-8" onClick={() => setShowModal(true)}>
          <Plus className="w-5 h-5 mr-2 stroke-[3px]" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Users Table */}
      <Card className="border-white/5 bg-zinc-900 shadow-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-950/50">
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest">Profesional</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest">Información de Contacto</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-center">Rol</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-center">Comisión</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-center">Estado</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-zinc-800 border-2 border-white/5 group-hover:border-amber-500/30 transition-all">
                          {usuario.avatar_url ? (
                            <img src={usuario.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-950 font-black text-xl uppercase">
                               {usuario.full_name?.charAt(0) || '?'}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-black text-white group-hover:text-amber-500 transition-colors uppercase tracking-tight">{usuario.full_name || 'Sin nombre'}</p>
                          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">ID: {usuario.id.substring(0,8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <p className="text-sm font-bold text-zinc-300">{usuario.email}</p>
                      <p className="text-xs text-zinc-500 font-medium">{usuario.phone || 'Sin teléfono'}</p>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <Badge variant={getRoleBadge(usuario.role)} className="uppercase font-black text-[10px] tracking-widest px-3">
                        {usuario.role}
                      </Badge>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-8 bg-zinc-800 rounded-lg text-sm font-black text-amber-500">
                         {usuario.comision_porcentaje}%
                      </div>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <Badge variant={usuario.is_active ? 'success' : 'danger'} className="uppercase font-black text-[10px] tracking-widest px-3">
                        {usuario.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-10 h-10 p-0 border-white/5 bg-zinc-950 hover:bg-amber-500 hover:text-black transition-all"
                          onClick={() => {
                            setEditingUser(usuario)
                            setFormData({
                              email: usuario.email,
                              full_name: usuario.full_name || '',
                              phone: usuario.phone || '',
                              role: usuario.role as any,
                              comision_porcentaje: usuario.comision_porcentaje,
                              avatar_url: usuario.avatar_url || '',
                              password: '',
                            })
                            setShowModal(true)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant={usuario.is_active ? 'danger' : 'success'}
                          size="sm"
                          className="w-10 h-10 p-0"
                          onClick={() => toggleActivo(usuario)}
                        >
                          {usuario.is_active ? <Trash2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {usuarios.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-24 text-center">
                       <Users size={64} className="mx-auto text-zinc-800 mb-4 opacity-30" />
                       <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No hay usuarios registrados en el sistema</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Usuario */}
      {showModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <Card className="w-full max-w-xl border-white/10 shadow-2xl bg-zinc-950 my-auto">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 p-8 bg-zinc-900/50">
              <div>
                <CardTitle className="text-2xl font-black uppercase text-white leading-none">
                   {editingUser ? 'Editar' : 'Nuevo'} <span className="text-amber-500">Usuario</span>
                </CardTitle>
                <p className="text-zinc-500 text-xs mt-2 font-medium">Completa el perfil del profesional</p>
              </div>
              <button 
                onClick={() => { setShowModal(false); setEditingUser(null); }} 
                className="p-3 hover:bg-white/5 rounded-2xl transition-colors border border-white/5"
              >
                <X className="w-6 h-6 text-zinc-500" />
              </button>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="md:col-span-2">
                     <Input
                        label="Nombre Completo"
                        placeholder="Ej. Juan Pérez"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        required
                        className="bg-zinc-900"
                      />
                   </div>
                   <Input
                    label="Email Corporativo"
                    type="email"
                    placeholder="email@barberpro.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={!!editingUser}
                    className="bg-zinc-900"
                  />
                  {!editingUser && (
                    <Input
                      label="Contraseña"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editingUser}
                      className="bg-zinc-900"
                    />
                  )}
                  <Input
                    label="Teléfono"
                    type="tel"
                    placeholder="+54 11 ..."
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-zinc-900"
                  />
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Comisión (%)</label>
                    <input
                      type="number"
                      className="h-12 w-full border border-white/10 bg-zinc-900 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                      value={formData.comision_porcentaje}
                      onChange={(e) => setFormData({ ...formData, comision_porcentaje: parseInt(e.target.value) })}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Rol Operativo</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                      className="h-12 w-full border border-white/10 bg-zinc-900 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all appearance-none uppercase"
                    >
                      <option value="barbero">Barbero</option>
                      <option value="recepcionista">Recepcionista</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className="md:col-span-1">
                     <Input
                        label="URL Avatar"
                        placeholder="https://..."
                        value={formData.avatar_url}
                        onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                        className="bg-zinc-900"
                      />
                  </div>
                </div>
              </CardContent>
              <div className="p-8 bg-zinc-900/30 border-t border-white/5 flex gap-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 h-14 border-white/5 text-zinc-500 hover:text-white uppercase font-black tracking-widest text-[10px]"
                  onClick={() => { setShowModal(false); setEditingUser(null); }}
                >
                  Descartar
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  className="flex-1 h-14 shadow-lg shadow-amber-500/20 uppercase font-black tracking-widest"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingUser ? 'Actualizar' : 'Crear'} Profesional
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
