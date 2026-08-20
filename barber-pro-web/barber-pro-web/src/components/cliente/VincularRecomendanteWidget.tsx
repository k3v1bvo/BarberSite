'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Search, UserCheck, CheckCircle2, AlertCircle } from 'lucide-react'

interface RecomendanteOption {
  id: string
  nombre: string
  ci?: string | null
  telefono?: string | null
  email?: string | null
  referral_code?: string | null
}

export function VincularRecomendanteWidget({ onSuccess }: { onSuccess: () => void }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [options, setOptions] = useState<RecomendanteOption[]>([])
  const [selectedRecomendante, setSelectedRecomendante] = useState<RecomendanteOption | null>(null)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const { success: toastSuccess, error: toastError } = useToast()

  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setOptions([])
      return
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/referidos/buscar-recomendante?q=${encodeURIComponent(searchTerm.trim())}`)
        const data = await res.json()
        if (res.ok) {
          setOptions(data.resultados || [])
          setShowDropdown(true)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  const handleConfirmVincular = async () => {
    if (!selectedRecomendante) return toastError('Selecciona la persona que te recomendó')

    setSubmitting(true)
    try {
      const res = await fetch('/api/referidos/vincular-mi-recomendante', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recomendante_id: selectedRecomendante.id })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toastSuccess(data.message || `¡Recomendante ${selectedRecomendante.nombre} vinculado!`)
        onSuccess()
      } else {
        toastError(data.error || 'Error al vincular recomendante')
      }
    } catch (err: any) {
      toastError(err.message || 'Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 pt-1">
      {selectedRecomendante ? (
        <div className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs text-zinc-400">Recomendante seleccionado:</p>
              <p className="text-sm font-black text-white">{selectedRecomendante.nombre}</p>
              <p className="text-[10px] text-zinc-400">
                {selectedRecomendante.telefono ? `Tel: ${selectedRecomendante.telefono}` : ''} {selectedRecomendante.ci ? `· CI: ${selectedRecomendante.ci}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedRecomendante(null)}
              className="text-xs text-zinc-400 hover:text-white underline px-2 py-1"
            >
              Cambiar
            </button>
            <Button
              onClick={handleConfirmVincular}
              disabled={submitting}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase px-4 py-2 rounded-xl"
            >
              {submitting ? 'Viculando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-amber-400/80" />
            <Input
              placeholder="Buscar amigo por Nombre, Código (ej. ROBERTO10), Celular o CI..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              className="bg-zinc-950 border-amber-500/30 text-xs font-bold text-white pl-9 h-10 focus:border-amber-500"
            />
          </div>

          {showDropdown && (searchTerm.length >= 2) && (
            <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
              {searching ? (
                <p className="text-xs text-zinc-400 p-3 text-center">Buscando clientes...</p>
              ) : options.length === 0 ? (
                <p className="text-xs text-zinc-500 p-3 text-center">No se encontraron clientes con esa búsqueda.</p>
              ) : (
                options.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedRecomendante(opt)
                      setShowDropdown(false)
                    }}
                    className="w-full text-left p-3 hover:bg-amber-500/10 border-b border-zinc-800 last:border-b-0 flex items-center justify-between transition"
                  >
                    <div>
                      <p className="font-bold text-white text-xs">{opt.nombre}</p>
                      <p className="text-[10px] text-zinc-400">
                        {opt.referral_code ? `Cód: ${opt.referral_code}` : ''} {opt.telefono ? `· Tel: ${opt.telefono}` : ''} {opt.ci ? `· CI: ${opt.ci}` : ''}
                      </p>
                    </div>
                    <UserCheck className="w-4 h-4 text-amber-400 opacity-60" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
