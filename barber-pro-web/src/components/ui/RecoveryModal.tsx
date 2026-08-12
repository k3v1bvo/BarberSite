'use client'

import { useState } from 'react'
import { X, KeyRound, CheckCircle2, ShieldAlert, Mail, CreditCard, Send } from 'lucide-react'
import { Button } from './Button'
import { Input } from './Input'
import { useToast } from './Toast'

interface RecoveryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function RecoveryModal({ isOpen, onClose }: RecoveryModalProps) {
  const { error: toastError, success: toastSuccess } = useToast()
  const [identificador, setIdentificador] = useState('')
  const [nota, setNota] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identificador.trim()) {
      toastError('Ingresa tu Cédula de Identidad (CI) o Correo Electrónico.')
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/auth/solicitar-recuperacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identificador: identificador.trim(),
          nota: nota.trim()
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Ocurrió un error al procesar tu solicitud.')
      }

      setSubmitted(true)
      toastSuccess('Solicitud enviada a la administración con éxito.')
    } catch (err: any) {
      toastError(err.message || 'Error al conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetAndClose = () => {
    setIdentificador('')
    setNota('')
    setSubmitted(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-md p-6 sm:p-8 relative shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          onClick={handleResetAndClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">
              ¡Solicitud Registrada!
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Hemos notificado al equipo de administración y coordinación. Un encargado verificará tu identidad y autorizará el restablecimiento de tu contraseña o cambio de correo.
            </p>
            <Button
              onClick={handleResetAndClose}
              className="w-full bg-amber-500 text-black font-black uppercase text-xs tracking-wider py-3 rounded-xl mt-4"
            >
              Entendido
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="w-10 h-10 bg-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center border border-amber-500/30">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  Recuperar Cuenta
                </h3>
                <p className="text-xs text-zinc-500">
                  Solicita el restablecimiento de tu contraseña o cambio de correo.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-wider">
                  Carnet de Identidad (CI) o Correo *
                </label>
                <div className="relative">
                  <Input
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    placeholder="Ej. 14267585 o correo@gmail.com"
                    required
                    className="bg-zinc-900 border-white/10 text-white pl-10"
                  />
                  <CreditCard className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-wider">
                  Detalle o Motivo (Opcional)
                </label>
                <textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ej. Perdí mi teléfono, solicitó enviar clave a mi nuevo correo..."
                  rows={3}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-zinc-600 focus:border-amber-500/50 outline-none"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-400/90 leading-tight">
                  Por seguridad, la administración confirmará la solicitud antes de autorizar el envío de credenciales o el cambio de acceso.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetAndClose}
                className="flex-1 border-white/10 text-zinc-400 hover:text-white font-bold uppercase text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider shadow-lg shadow-amber-500/10"
              >
                {loading ? 'Enviando...' : 'Enviar Solicitud'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
