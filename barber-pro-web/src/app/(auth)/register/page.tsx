'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import { Scissors, Gift } from 'lucide-react'
import { Suspense } from 'react'
import { useBrand } from '@/components/providers/BrandProvider'

function RegisterContent() {
  const { brand } = useBrand()
  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref')

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    ci: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [welcome, setWelcome] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { success, error: toastError } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
            ci: formData.ci,
          },
        },
      })

      if (authError) {
        setError(authError.message)
        toastError(authError.message)
        return
      }

      if (!authData.user) {
        setError('Error al crear usuario.')
        return
      }

      let referidoPorId = null
      let recomendanteNombre = ''
      if (refCode) {
        const { data: refData } = await supabase
          .from('clientes')
          .select('id, nombre')
          .eq('referral_code', refCode)
          .single()
        
        if (refData) {
          referidoPorId = refData.id
          recomendanteNombre = refData.nombre
        }
      }

      const { error: clienteError } = await supabase.from('clientes').insert({
        id: authData.user.id,
        nombre: formData.full_name,
        telefono: formData.phone,
        ci: formData.ci?.trim() || null,
        email: formData.email,
        total_visitas: 0,
        total_gastado: 0,
        referido_por: referidoPorId,
      })

      if (clienteError) {
        console.warn('Error creando cliente:', clienteError.message)
      }

      // Auto-sincronizar historial previo por CI, Email o Nombre
      try {
        await fetch('/api/auth/autosync-cliente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            new_user_id: authData.user.id,
            ci: formData.ci,
            email: formData.email,
            nombre: formData.full_name,
          })
        })
      } catch (syncErr) {
        console.warn('Error al auto-sincronizar historial previo:', syncErr)
      }

      if (referidoPorId) {
        // Obtenemos la config del monto de bono si existe, o por defecto 10
        const { data: config } = await supabase.from('configuraciones').select('valor').eq('llave', 'monto_bono_referido').single()
        const montoBono = config ? parseFloat(config.valor) : 10

        await supabase.from('referrals').insert({
          cliente_recomendante_id: referidoPorId,
          cliente_recomendado_id: authData.user.id,
          monto_bono: montoBono,
          bono_otorgado: false
        })
      }

      // Enviar correo de bienvenida a través de la API interna
      fetch('/api/auth/bienvenida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          full_name: formData.full_name,
          password: formData.password
        })
      }).catch(err => console.error('Error enviando email de bienvenida:', err))

      if (authData.session) {
        success(`¡Bienvenido a Barber Pro, ${formData.full_name.split(' ')[0]}!`)
        router.push('/cliente')
        router.refresh()
        return
      }

      setWelcome(true)
      success('¡Cuenta creada! Revisa tu correo si se requiere confirmación.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado.'
      setError(msg)
      toastError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (welcome) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-4 py-16">
        <Card className="relative w-full max-w-md bg-white/5 backdrop-blur-xl border border-amber-500/30 shadow-2xl rounded-2xl text-center">
          <CardContent className="p-10 space-y-6">
            <div className="w-16 h-16 mx-auto bg-amber-500/20 rounded-2xl flex items-center justify-center overflow-hidden">
              {brand.logo_url ? (
                <img src={brand.logo_url} alt={brand.nombre} className="w-12 h-12 object-contain" />
              ) : (
                <Scissors className="w-8 h-8 text-amber-500" />
              )}
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              ¡Bienvenido a <span className="text-amber-500">{brand.nombre}</span>!
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Tu cuenta está lista. Inicia sesión para reservar citas, ver tu club de lealtad y comprar en la tienda.
            </p>
            <Button
              variant="primary"
              size="lg"
              className="w-full font-black uppercase"
              onClick={() => router.push('/login')}
            >
              Ir a iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-4 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_70%)]" />

      <Card className="relative w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            {brand.logo_url ? (
              <img src={brand.logo_url} alt={brand.nombre} className="h-12 max-w-[180px] object-contain" />
            ) : (
              <Scissors className="w-10 h-10 text-amber-500" />
            )}
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
            Únete a {brand.nombre}
          </CardTitle>
          <p className="text-zinc-400 text-sm mb-4">
            Crea tu cuenta y reserva en segundos
          </p>
          
          {refCode && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mb-2">
              <Gift size={16} /> Fuiste invitado por un amigo. ¡Regístrate ahora!
            </div>
          )}
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Nombre completo"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Juan Pérez"
              required
            />

            <Input
              label="Cédula de Identidad (CI / Carnet)"
              value={formData.ci}
              onChange={(e) => setFormData({ ...formData, ci: e.target.value })}
              placeholder="Ej. 1234567 (Indispensable para vincular tu historial previo)"
              required
            />

            <Input
              label="Teléfono (Opcional)"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="71234567"
            />

            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="tu@email.com"
              required
            />

            <PasswordInput
              label="Contraseña"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-lg shadow-amber-500/30 transition-all duration-300"
              size="lg"
              disabled={loading}
            >
              {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-zinc-400 text-sm">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-amber-400 hover:text-amber-300 font-medium">
                Inicia sesión
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-amber-500">Cargando...</div>}>
      <RegisterContent />
    </Suspense>
  )
}
