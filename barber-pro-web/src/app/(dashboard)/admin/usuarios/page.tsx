'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, Users, ArrowLeft, X, Save, KeyRound } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { Modal } from '@/components/ui/Modal'

interface Usuario {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  ci: string | null
  role: string
  is_active: boolean
  comision_porcentaje: number
  avatar_url: string | null
  created_at: string
}

export default function UsuariosPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [resettingPwd, setResettingPwd] = useState(false)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Usuario | null>(null)
  const [pwdUser, setPwdUser] = useState<Usuario | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    ci: '',
    role: 'cliente' as 'cliente' | 'barbero' | 'coordinador' | 'admin',
    avatar_url: '',
    password: '',
  })
  const router = useRouter()
  const supabase = createClient()

  const handleUpdateUserPassword = async (direct: boolean) => {
    if (!pwdUser) return
    setSavingPwd(true)
    try {
      const res = await fetch('/api/admin/usuarios/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(direct ? { userId: pwdUser.id, newPassword } : { email: pwdUser.email })
      })
      const data = await res.json()
      if (res.ok) {
        toastSuccess(direct ? 'Contraseña actualizada directamente' : `Correo de recuperación enviado a ${pwdUser.email}`)
        setPwdUser(null)
        setNewPassword('')
      } else {
        toastError(data.error || 'Error al procesar contraseña')
      }
    } catch {
      toastError('Error al procesar contraseña')
    } finally {
      setSavingPwd(false)
    }
  }

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
        if (formData.email !== editingUser.email) {
          const patchRes = await fetch('/api/admin/usuarios', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingUser.id, email: formData.email })
          })
          if (!patchRes.ok) throw new Error((await patchRes.json()).error)
        }

        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            ci: formData.ci || null,
            role: formData.role,
            avatar_url: formData.avatar_url,
            is_active: true,
          })
          .eq('id', editingUser.id)

        if (error) throw error

        if (formData.role !== editingUser.role) {
          fetch('/api/admin/usuarios', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: editingUser.id,
              role: formData.role,
              nombre: formData.full_name,
              email: formData.email,
            })
          }).catch(console.error)
        }

        toastSuccess('Usuario y rol actualizados')
      } else {
        const response = await fetch('/api/admin/usuarios', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: formData.email,
            full_name: formData.full_name,
            phone: formData.phone,
            ci: formData.ci,
            role: formData.role,
            avatar_url: formData.avatar_url
          })
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Error al crear usuario')
        }
      }

      setShowModal(false)
      setEditingUser(null)
      setFormData({
        email: '',
        full_name: '',
        phone: '',
        ci: '',
        role: 'barbero',
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
      coordinador: 'warning',
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
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[800px]">
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
                          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{usuario.ci ? `C.I. ${usuario.ci}` : `ID: ${usuario.id.substring(0,8)}`}</p>
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
                              ci: usuario.ci || '',
                              role: usuario.role as any,
                              avatar_url: usuario.avatar_url || '',
                              password: '',
                            })
                            setShowModal(true)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Cambiar o restablecer contraseña"
                          className="w-10 h-10 p-0 border-white/5 bg-zinc-950 hover:bg-amber-500 hover:text-black transition-all"
                          onClick={() => {
                            setPwdUser(usuario)
                            setNewPassword('')
                          }}
                        >
                          <KeyRound className="w-4 h-4 text-amber-400" />
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
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingUser(null); }}
        title={<>{editingUser ? 'Editar' : 'Nuevo'} <span className="text-amber-500">Usuario</span></>}
        subtitle="Completa el perfil del profesional"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Nombre Completo"
              placeholder="Ej. Carlos Barbero"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
              className="bg-zinc-900"
            />
            <Input
              label="Correo Electrónico"
              type="email"
              placeholder="barbero@estilo.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={!!editingUser}
              className="bg-zinc-900"
            />
            <Input
              label="Teléfono / Celular"
              placeholder="71234567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="bg-zinc-900"
            />
            <Input
              label="CI / Carnet Identidad"
              placeholder="Ej. 1234567"
              value={formData.ci}
              onChange={(e) => setFormData({ ...formData, ci: e.target.value })}
              className="bg-zinc-900"
            />
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Rol Operativo</label>
              <select
                className="w-full h-12 px-4 border border-white/10 bg-zinc-900 rounded-xl text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              >
                <option value="barbero">Barbero / Estilista</option>
                <option value="coordinador">Coordinador / Cajero</option>
                <option value="admin">Administrador General</option>
                <option value="cliente">Cliente Registrado</option>
              </select>
            </div>
            {!editingUser && (
              <PasswordInput
                label="Contraseña Inicial"
                placeholder="Mínimo 6 caracteres"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="bg-zinc-900"
              />
            )}
            <div className="md:col-span-2">
               <ImageUpload
                 label="Foto de Perfil del Profesional"
                 defaultImage={formData.avatar_url || undefined}
                 onUploadSuccess={(url) => setFormData({ ...formData, avatar_url: url })}
                 onUploadError={(err) => toastError(err)}
               />
            </div>
            {editingUser && (
              <div className="md:col-span-2 pt-4 border-t border-white/5 space-y-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full justify-center text-zinc-300 border-white/10 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-500 transition-colors"
                  disabled={resettingPwd}
                  onClick={async () => {
                    setResettingPwd(true)
                    try {
                      const res = await fetch('/api/admin/usuarios/reset-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: formData.email })
                      })
                      if (!res.ok) throw new Error((await res.json()).error)
                      toastSuccess('Se ha enviado el enlace de recuperación a ' + formData.email)
                    } catch (err: any) {
                      toastError(err.message || 'Error al enviar enlace')
                    } finally {
                      setResettingPwd(false)
                    }
                  }}
                >
                  {resettingPwd ? 'Enviando...' : '📧 Enviar Enlace de Cambio de Contraseña'}
                </Button>
                <p className="text-[10px] text-zinc-500 text-center leading-relaxed uppercase font-bold">
                  Enviará un correo con un enlace temporal para que el usuario restablezca su contraseña.
                </p>
              </div>
            )}
          </div>
          <div className="pt-4 border-t border-white/5 flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1 h-12 border-white/5 text-zinc-500 hover:text-white uppercase font-black tracking-widest text-[10px]"
              onClick={() => { setShowModal(false); setEditingUser(null); }}
            >
              Descartar
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              className="flex-1 h-12 shadow-lg shadow-amber-500/20 uppercase font-black tracking-widest text-xs"
            >
              <Save className="w-4 h-4 mr-2" />
              {editingUser ? 'Actualizar' : 'Crear'} Profesional
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Cambiar Contraseña */}
      <Modal
        isOpen={!!pwdUser}
        onClose={() => setPwdUser(null)}
        title="Seguridad & Contraseña"
        subtitle={pwdUser ? (pwdUser.full_name || pwdUser.email) : ''}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">
              Asignar Nueva Contraseña Directa
            </label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setNewPassword('123456')}
                className="text-[11px] px-2.5 py-1 rounded bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 border border-white/10 text-zinc-300 transition-colors"
              >
                ⚡ Poner &quot;123456&quot;
              </button>
              <button
                type="button"
                onClick={() => setNewPassword('barber123')}
                className="text-[11px] px-2.5 py-1 rounded bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 border border-white/10 text-zinc-300 transition-colors"
              >
                ⚡ Poner &quot;barber123&quot;
              </button>
            </div>
            <Input
              type="text"
              placeholder="Escribe la nueva contraseña (ej: 123456)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-zinc-900 border-white/10 text-white font-mono"
            />
            <p className="text-[11px] text-zinc-500 mt-1.5">
              💡 Por seguridad las contraseñas se guardan encriptadas. Asigna una fácil acá y dísela directamente.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => handleUpdateUserPassword(true)}
              disabled={savingPwd || newPassword.length < 6}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-extrabold"
            >
              {savingPwd ? 'Guardando...' : 'Cambiar Contraseña'}
            </Button>
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-zinc-950 px-2 text-zinc-500">o enviar correo</span></div>
          </div>

          <Button
            variant="outline"
            onClick={() => handleUpdateUserPassword(false)}
            disabled={savingPwd}
            className="w-full border-white/10 text-zinc-300 hover:text-white hover:bg-white/5"
          >
            Enviar Correo de Recuperación
          </Button>
        </div>
      </Modal>
    </div>
  )
}
