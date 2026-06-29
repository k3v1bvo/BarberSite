'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { User, Save, Shield, Mail, Phone, CreditCard, Image as ImageIcon } from 'lucide-react'
import { ImageUpload } from '@/components/ui/ImageUpload'

export default function PerfilPage() {
  const supabase = createClient()
  const { success, error: toastError } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({
    id: '',
    full_name: '',
    email: '',
    phone: '',
    ci: '',
    role: '',
    avatar_url: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, ci, role, avatar_url')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile({
          id: data.id,
          full_name: data.full_name || '',
          email: data.email || user.email || '',
          phone: data.phone || '',
          ci: data.ci || '',
          role: data.role || 'cliente',
          avatar_url: data.avatar_url || '',
        })
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          ci: profile.ci,
        })
        .eq('id', profile.id)

      if (error) throw error
      success('Perfil actualizado correctamente')
    } catch (err: any) {
      toastError(err.message || 'Error al guardar')
    }
    setSaving(false)
  }

  const roleLabel: Record<string, string> = {
    admin: 'Administrador',
    coordinador: 'Coordinador',
    barbero: 'Barbero',
    cliente: 'Cliente',
  }

  const roleColor: Record<string, string> = {
    admin: 'bg-red-500/20 text-red-400 border-red-500/30',
    coordinador: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    barbero: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    cliente: 'bg-green-500/20 text-green-400 border-green-500/30',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Header */}
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-4xl font-black tracking-tight text-white uppercase">
          Mi <span className="text-amber-500">Perfil</span>
        </h1>
        <p className="text-zinc-500 font-medium mt-1">Actualiza tu información personal</p>
      </div>

      {/* Avatar + Role */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-6 flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              <span className="text-3xl font-black text-amber-500">{profile.full_name.charAt(0) || '?'}</span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-black text-white">{profile.full_name || 'Sin nombre'}</h2>
            <p className="text-sm text-zinc-400 flex items-center gap-1 mt-1">
              <Mail className="w-3.5 h-3.5" /> {profile.email}
            </p>
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${roleColor[profile.role] || roleColor.cliente}`}>
                <Shield className="w-3 h-3" /> {roleLabel[profile.role] || profile.role}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-6 space-y-5">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <User className="w-4 h-4 text-amber-500" /> Información Personal
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre Completo"
              value={profile.full_name}
              onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
            />

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Foto de Perfil</label>
              <ImageUpload
                label="Cambiar Foto (Opcional)"
                defaultImage={profile.avatar_url || undefined}
                onUploadSuccess={(url) => setProfile(p => ({ ...p, avatar_url: url }))}
                onUploadError={(err) => toastError(err)}
              />
            </div>

            <div className="space-y-1">
              <Input
                label="Correo Electrónico"
                value={profile.email}
                disabled
              />
              <p className="text-[10px] text-zinc-600">El correo no se puede cambiar aquí</p>
            </div>
            <div className="relative">
              <Input
                label="Teléfono"
                value={profile.phone}
                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
              />
              <Phone className="absolute right-3 top-9 w-4 h-4 text-zinc-600" />
            </div>
            <div className="relative">
              <Input
                label="Carnet / C.I."
                value={profile.ci}
                onChange={e => setProfile(p => ({ ...p, ci: e.target.value }))}
              />
              <CreditCard className="absolute right-3 top-9 w-4 h-4 text-zinc-600" />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              className="gap-2 font-black uppercase tracking-wider px-8"
            >
              <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
