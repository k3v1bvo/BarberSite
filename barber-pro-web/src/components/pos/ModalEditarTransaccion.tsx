'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { X, Trash2, Save, Edit3, AlertTriangle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface TransactionToEdit {
  id: string
  fecha?: string
  ci?: string | null
  nombre?: string | null
  cuenta_codigo?: string | null
  cuenta_detalle?: string | null
  glosa?: string | null
  costo: number
  tipo_movimiento: string
  metodo_pago?: string | null
  monto_efectivo?: number
  monto_qr?: number
  notas?: string | null
}

interface ModalEditarTransaccionProps {
  transaction: TransactionToEdit | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ModalEditarTransaccion({ transaction, isOpen, onClose, onSuccess }: ModalEditarTransaccionProps) {
  const { success: toastSuccess, error: toastError } = useToast()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    ci: '',
    cuenta_detalle: '',
    glosa: '',
    costo: '',
    tipo_movimiento: 'INGRESO',
    metodo_pago: 'efectivo',
    monto_efectivo: '',
    monto_qr: '',
    notas: '',
  })

  useEffect(() => {
    if (transaction) {
      let initEf = transaction.monto_efectivo !== undefined && Number(transaction.monto_efectivo) > 0 ? String(transaction.monto_efectivo) : ''
      let initQr = transaction.monto_qr !== undefined && Number(transaction.monto_qr) > 0 ? String(transaction.monto_qr) : ''

      if ((!initEf || !initQr) && transaction.notas) {
        const efMatch = transaction.notas.match(/Efectivo:\s*Bs\s*([0-9.]+)/i)
        const qrMatch = transaction.notas.match(/QR:\s*Bs\s*([0-9.]+)/i)
        if (efMatch && !initEf) initEf = efMatch[1]
        if (qrMatch && !initQr) initQr = qrMatch[1]
      }

      if (transaction.metodo_pago === 'mixto' && !initEf && !initQr) {
        const total = Number(transaction.costo || 0)
        initEf = String(Math.floor(total / 2))
        initQr = String(Math.round((total - Math.floor(total / 2)) * 100) / 100)
      }

      setForm({
        nombre: transaction.nombre || '',
        ci: transaction.ci && transaction.ci !== '0000000' && transaction.ci !== '—' ? transaction.ci : '',
        cuenta_detalle: transaction.cuenta_detalle || '',
        glosa: transaction.glosa || '',
        costo: String(transaction.costo || 0),
        tipo_movimiento: transaction.tipo_movimiento || 'INGRESO',
        metodo_pago: transaction.metodo_pago || 'efectivo',
        monto_efectivo: initEf,
        monto_qr: initQr,
        notas: transaction.notas || '',
      })
      setShowConfirmDelete(false)
    }
  }, [transaction])

  if (!isOpen || !transaction) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const costoNum = parseFloat(form.costo)
    if (isNaN(costoNum) || costoNum < 0) {
      return toastError('Ingresa un monto válido')
    }

    const realEf = form.metodo_pago === 'efectivo' 
      ? costoNum 
      : (form.metodo_pago === 'mixto' ? (parseFloat(form.monto_efectivo) || 0) : 0)
      
    const realQr = (form.metodo_pago === 'qr' || form.metodo_pago === 'tarjeta') 
      ? costoNum 
      : (form.metodo_pago === 'mixto' ? (parseFloat(form.monto_qr) || 0) : 0)

    if (form.metodo_pago === 'mixto' && (realEf <= 0 && realQr <= 0)) {
      return toastError('En pago mixto debes ingresar al menos el monto en efectivo o QR')
    }

    let finalNotas = form.notas || ''
    if (form.metodo_pago === 'mixto') {
      if (finalNotas.includes('Efectivo: Bs')) {
        finalNotas = finalNotas.replace(/Efectivo:\s*Bs\s*[0-9.]+\s*\|\s*QR:\s*Bs\s*[0-9.]+/i, `Efectivo: Bs ${realEf} | QR: Bs ${realQr}`)
      } else {
        finalNotas = `Efectivo: Bs ${realEf} | QR: Bs ${realQr}${finalNotas ? ' | ' + finalNotas : ''}`
      }
    }

    setLoading(true)
    try {
      const res = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transaction.id,
          nombre: form.nombre,
          ci: form.ci || '—',
          cuenta_detalle: form.cuenta_detalle,
          glosa: form.glosa,
          costo: costoNum,
          tipo_movimiento: form.tipo_movimiento,
          metodo_pago: form.metodo_pago,
          monto_efectivo: realEf,
          monto_qr: realQr,
          notas: finalNotas || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al actualizar el registro')
      }

      toastSuccess('Registro contable actualizado con éxito ✅')
      onSuccess()
      onClose()
    } catch (err: any) {
      toastError(err.message || 'Error al guardar cambios')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/transactions?id=${transaction.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar el registro')
      }

      toastSuccess('Registro eliminado exitosamente')
      onSuccess()
      onClose()
    } catch (err: any) {
      toastError(err.message || 'Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const isVirtual = transaction.id.startsWith('virtual-cita-')

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-700/80 w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Edit3 size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Editar Registro Contable</h3>
              <p className="text-[11px] text-zinc-400">Corrige monto, cliente, método o glosa si hubo error</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Tipo Movimiento */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1.5">Tipo de Movimiento</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo_movimiento: 'INGRESO' })}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition ${
                  form.tipo_movimiento === 'INGRESO'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-black/40 border-zinc-800 text-zinc-400'
                }`}
              >
                <ArrowUpCircle size={14} /> INGRESO (+)
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo_movimiento: 'EGRESO' })}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition ${
                  form.tipo_movimiento === 'EGRESO'
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'bg-black/40 border-zinc-800 text-zinc-400'
                }`}
              >
                <ArrowDownCircle size={14} /> EGRESO (-)
              </button>
            </div>
          </div>

          {/* Cliente y CI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Nombre Cliente / Proveedor</label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="bg-black/60 border-zinc-800 text-sm h-11"
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Carnet de Identidad (CI)</label>
              <Input
                value={form.ci}
                onChange={(e) => setForm({ ...form, ci: e.target.value })}
                className="bg-black/60 border-zinc-800 text-sm h-11 font-mono"
                placeholder="Ej: 5194847"
              />
            </div>
          </div>

          {/* Concepto y Monto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Concepto / Servicio</label>
              <Input
                value={form.cuenta_detalle}
                onChange={(e) => setForm({ ...form, cuenta_detalle: e.target.value })}
                className="bg-black/60 border-zinc-800 text-sm h-11"
                placeholder="Ej: Corte de cabello / Devolución"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Monto Total (Bs.) *</label>
              <Input
                type="number"
                step="any"
                required
                value={form.costo}
                onChange={(e) => setForm({ ...form, costo: e.target.value })}
                className="bg-black/60 border-amber-500/40 text-amber-400 font-bold text-base h-11 font-mono"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Método de Pago */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1.5">Método de Pago</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'efectivo', label: '💵 Efectivo' },
                { id: 'qr', label: '📱 QR' },
                { id: 'tarjeta', label: '💳 Tarjeta' },
                { id: 'mixto', label: '🔄 Mixto' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    const total = parseFloat(form.costo || '0')
                    let ef = form.monto_efectivo
                    let qr = form.monto_qr
                    if (m.id === 'mixto' && (!ef || !qr || parseFloat(ef) === 0 || parseFloat(qr) === 0) && total > 0) {
                      ef = String(Math.floor(total / 2))
                      qr = String(Math.round((total - Math.floor(total / 2)) * 100) / 100)
                    }
                    setForm({ ...form, metodo_pago: m.id, monto_efectivo: ef, monto_qr: qr })
                  }}
                  className={`py-2 rounded-xl text-[11px] font-bold border transition ${
                    form.metodo_pago === m.id
                      ? 'bg-amber-500 text-black border-amber-400'
                      : 'bg-black/40 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pago Mixto Split */}
          {form.metodo_pago === 'mixto' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-black/40 border border-zinc-800 rounded-xl">
              <div>
                <label className="text-[9px] font-bold text-zinc-400 block mb-1">Monto Efectivo (Bs.)</label>
                <Input
                  type="number"
                  step="any"
                  value={form.monto_efectivo}
                  onChange={(e) => setForm({ ...form, monto_efectivo: e.target.value })}
                  className="bg-zinc-950 border-zinc-700 text-xs h-9 font-mono text-emerald-400"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-zinc-400 block mb-1">Monto QR (Bs.)</label>
                <Input
                  type="number"
                  step="any"
                  value={form.monto_qr}
                  onChange={(e) => setForm({ ...form, monto_qr: e.target.value })}
                  className="bg-zinc-950 border-zinc-700 text-xs h-9 font-mono text-blue-400"
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          {/* Glosa / Detalle */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Glosa / Observación</label>
            <Input
              value={form.glosa}
              onChange={(e) => setForm({ ...form, glosa: e.target.value })}
              className="bg-black/60 border-zinc-800 text-xs h-10"
              placeholder="Detalle adicional del cobro o egreso"
            />
          </div>

          {/* Botones de acción */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
            {!isVirtual && (
              <div>
                {!showConfirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(true)}
                    className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Trash2 size={13} /> Eliminar
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={handleDelete}
                      className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black transition"
                    >
                      {deleting ? 'Eliminando...' : '¿Confirmar?'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmDelete(false)}
                      className="px-2 py-2 text-xs text-zinc-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose} className="border-zinc-800 text-xs">
                Cerrar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs px-5 shadow-lg shadow-amber-500/20"
              >
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
