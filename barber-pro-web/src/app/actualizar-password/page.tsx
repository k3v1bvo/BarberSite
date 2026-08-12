'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useRouter } from 'next/navigation'
import { Lock, CheckCircle2, ShieldAlert } from 'lucide-react'

export default function ActualizarPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Supabase procesa automáticamente el hash de recuperación en la URL
    supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Modo recuperación de contraseña activo')
      }
    })
  }, [supabase])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        throw updateError
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(217,119,6,0.15),rgba(255,255,255,0))]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-xl">
            <Lock className="w-7 h-7" />
          </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-white tracking-tight">
          Restablecer Contraseña
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Ingresa tu nueva contraseña para acceder a tu cuenta
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Card className="border-white/10 bg-zinc-900/80 backdrop-blur-xl shadow-2xl">
          <CardContent className="p-8">
            {success ? (
              <div className="text-center py-6 space-y-4">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                <h3 className="text-xl font-bold text-white">¡Contraseña Actualizada!</h3>
                <p className="text-sm text-zinc-400">
                  Tu contraseña ha sido cambiada exitosamente. Redirigiendo al inicio de sesión...
                </p>
                <Button
                  onClick={() => router.push('/login')}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Ir a Iniciar Sesión
                </Button>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <PasswordInput
                  label="Nueva Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />

                <PasswordInput
                  label="Confirmar Nueva Contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  required
                />

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold h-12 rounded-xl shadow-lg shadow-amber-500/20"
                >
                  {loading ? 'Actualizando...' : 'Guardar Nueva Contraseña'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
