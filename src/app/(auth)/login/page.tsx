'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBrand } from '@/components/providers/BrandProvider'

import { RecoveryModal } from '@/components/ui/RecoveryModal'

export default function LoginPage() {
  const { brand } = useBrand()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Si ya está logueado, redirigir
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', user.id)
          .single()

        if (profile && profile.is_active === false) {
          await supabase.auth.signOut()
          return
        }

        if (profile?.role === 'admin') router.push('/admin')
        else if (profile?.role === 'coordinador') router.push('/coordinador')
        else if (profile?.role === 'barbero') router.push('/barbero')
        else if (profile?.role === 'cliente') router.push('/cliente')
        else router.push('/')
      }
    }
    checkUser()
  }, [router, supabase])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      // Obtener perfil para redirigir según rol
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', user.id)
          .single()

        if (profile && profile.is_active === false) {
          await supabase.auth.signOut()
          setError('Tu cuenta ha sido deshabilitada por administración.')
          return
        }

        if (profile?.role === 'admin') router.push('/admin')
        else if (profile?.role === 'coordinador') router.push('/coordinador')
        else if (profile?.role === 'barbero') router.push('/barbero')
        else if (profile?.role === 'cliente') router.push('/cliente')
        else router.push('/')
      }
    } catch (err) {
      setError('Ocurrió un error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-4">

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_70%)]" />

      <Card className="relative w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl">
        <CardHeader className="text-center space-y-4 pt-6 pb-2">
          {brand.logo_url && brand.mostrar_modo !== 'texto' ? (
            <div className="flex justify-center items-center py-2">
              <img
                src={brand.logo_url}
                alt={brand.nombre}
                className="h-28 md:h-32 max-w-[320px] w-auto object-contain filter drop-shadow-[0_4px_25px_rgba(245,158,11,0.3)] transition-transform duration-300 hover:scale-105"
              />
            </div>
          ) : (
            <CardTitle className="text-3xl font-black tracking-wider uppercase bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent drop-shadow-sm">
              {brand.nombre}
            </CardTitle>
          )}
          <p className="text-zinc-400 text-sm font-medium tracking-wide">
            Inicia sesión para continuar
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />

            {/* ✅ PASSWORDINPUT CON OJITO */}
            <PasswordInput
              label="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
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
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <p className="text-zinc-400 text-sm">
              ¿No tienes cuenta?{' '}
              <Link
                href="/register"
                className="text-amber-400 hover:text-amber-300 font-medium"
              >
                Regístrate aquí
              </Link>
            </p>
            <div>
              <Link
                href="/"
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                ← Volver al inicio
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <RecoveryModal isOpen={isRecoveryOpen} onClose={() => setIsRecoveryOpen(false)} />
    </div>
  )
}