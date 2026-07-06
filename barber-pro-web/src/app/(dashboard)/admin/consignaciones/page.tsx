'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { PackageOpen, DollarSign, Plus, ArrowRight, History, Package, Activity, AlertCircle, RefreshCw } from 'lucide-react'

export default function ConsignacionesPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const supabase = createClient()
  
  const [consignaciones, setConsignaciones] = useState<any[]>([])
  const [resumen, setResumen] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [pagoMonto, setPagoMonto] = useState('')
  const [pagoMetodo, setPagoMetodo] = useState('efectivo')
  const [pagoEfectivo, setPagoEfectivo] = useState('')
  const [pagoQr, setPagoQr] = useState('')
  const [pagoNotas, setPagoNotas] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [resCons, resResumen] = await Promise.all([
        fetch('/api/consignaciones'),
        fetch('/api/consignaciones/resumen-semanal')
      ])
      
      if (resCons.ok) {
        const data = await resCons.json()
        setConsignaciones(data)
      }
      
      if (resResumen.ok) {
        const data = await resResumen.json()
        setResumen(data)
      }
    } catch (err) {
      console.error(err)
      toastError('Error cargando consignaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handlePago = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pagoMonto || Number(pagoMonto) <= 0) return toastError('Monto inválido')
    
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/consignaciones/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: Number(pagoMonto),
          metodo_pago: pagoMetodo,
          monto_efectivo: pagoEfectivo ? Number(pagoEfectivo) : 0,
          monto_qr: pagoQr ? Number(pagoQr) : 0,
          notas: pagoNotas
        })
      })

      if (!res.ok) throw new Error('Error al registrar pago')
      
      toastSuccess('Pago registrado correctamente')
      setShowPagoModal(false)
      setPagoMonto('')
      setPagoNotas('')
      setPagoEfectivo('')
      setPagoQr('')
      loadData()
    } catch (err: any) {
      toastError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">Cargando consignaciones...</div>
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <PackageOpen className="w-8 h-8 text-blue-500" /> Consignaciones
          </h1>
          <p className="text-zinc-400 mt-1">Gestiona los pagos a proveedores por productos en consignación</p>
        </div>
        <Button onClick={() => setShowPagoModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 px-6">
          <DollarSign className="w-5 h-5 mr-2" /> Registrar Pago a Proveedor
        </Button>
      </div>

      {resumen && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Vendido esta semana</p>
                  <h3 className="text-3xl font-black text-white">{resumen.productosVendidos}</h3>
                  <p className="text-xs text-zinc-500 mt-1">unidades entregadas</p>
                </div>
                <div className="p-3 bg-zinc-800/50 rounded-xl text-zinc-400"><Package className="w-6 h-6"/></div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-bl-full -mr-4 -mt-4" />
            <CardContent className="p-6">
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-sm font-semibold text-red-400/80 uppercase tracking-wider mb-2">Deuda Semanal Estimada</p>
                  <h3 className="text-3xl font-black text-red-400">{formatCurrency(resumen.deudaTotal)}</h3>
                  <p className="text-xs text-red-400/60 mt-1">Costo de reposición a pagar</p>
                </div>
                <div className="p-3 bg-red-500/10 rounded-xl text-red-400"><AlertCircle className="w-6 h-6"/></div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4" />
            <CardContent className="p-6">
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-sm font-semibold text-emerald-400/80 uppercase tracking-wider mb-2">Ganancia Neta Semanal</p>
                  <h3 className="text-3xl font-black text-emerald-400">{formatCurrency(resumen.gananciaTotal)}</h3>
                  <p className="text-xs text-emerald-400/60 mt-1">Margen de la barbería</p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400"><Activity className="w-6 h-6"/></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="border-b border-zinc-800/50 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-zinc-400" /> Historial de Lotes en Consignación
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-950 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="py-4 px-6 font-semibold">Fecha Lote</th>
                <th className="py-4 px-6 font-semibold">Proveedor</th>
                <th className="py-4 px-6 font-semibold text-center">Items</th>
                <th className="py-4 px-6 font-semibold text-right">Deuda Original</th>
                <th className="py-4 px-6 font-semibold text-right">Pagado</th>
                <th className="py-4 px-6 font-semibold text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {consignaciones.map(c => (
                <tr key={c.id} className="hover:bg-zinc-800/20 transition">
                  <td className="py-4 px-6">
                    <p className="font-bold text-white text-sm">{new Date(c.creado_en).toLocaleDateString()}</p>
                    <p className="text-xs text-zinc-500">{new Date(c.creado_en).toLocaleTimeString()}</p>
                  </td>
                  <td className="py-4 px-6 font-medium text-sm text-zinc-300">{c.proveedor_nombre}</td>
                  <td className="py-4 px-6 text-center text-sm font-medium">
                    {c.consignacion_items?.length || 0} productos
                  </td>
                  <td className="py-4 px-6 text-right font-bold text-red-400 text-sm">
                    {formatCurrency(c.total_costo)}
                  </td>
                  <td className="py-4 px-6 text-right font-bold text-emerald-400 text-sm">
                    {formatCurrency(c.total_pagado || 0)}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <Badge variant={c.estado === 'pagado' ? 'success' : c.estado === 'pagado_parcial' ? 'warning' : 'danger'}>
                      {c.estado.replace('_', ' ')}
                    </Badge>
                  </td>
                </tr>
              ))}
              {consignaciones.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-zinc-500">No hay lotes en consignación</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modal de Pago */}
      {showPagoModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-zinc-900 border-zinc-700 shadow-2xl">
            <CardHeader className="border-b border-zinc-800 pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-blue-500" /> Registrar Pago
              </CardTitle>
            </CardHeader>
            <form onSubmit={handlePago}>
              <CardContent className="p-6 space-y-4">
                <p className="text-sm text-zinc-400">Este pago se registrará como un EGRESO en la caja y descontará el monto de tu total registrado del día.</p>
                
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase">Monto Total a Pagar</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={pagoMonto} 
                    onChange={e => setPagoMonto(e.target.value)} 
                    className="bg-black text-xl font-bold h-12"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Método de Pago</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['efectivo', 'qr', 'mixto'] as const).map(m => (
                      <button
                        type="button"
                        key={m}
                        className={`py-2 rounded-md text-xs font-bold transition ${pagoMetodo === m ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                        onClick={() => setPagoMetodo(m)}
                      >
                        {m === 'efectivo' ? 'Efectivo' : m === 'qr' ? 'QR' : 'Mixto'}
                      </button>
                    ))}
                  </div>
                </div>

                {pagoMetodo === 'mixto' && (
                  <div className="grid grid-cols-2 gap-4 p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <div>
                      <label className="text-xs text-zinc-500">Monto Efectivo</label>
                      <Input type="number" step="0.01" value={pagoEfectivo} onChange={e => setPagoEfectivo(e.target.value)} className="bg-black" required/>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Monto QR</label>
                      <Input type="number" step="0.01" value={pagoQr} onChange={e => setPagoQr(e.target.value)} className="bg-black" required/>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase">Notas / Detalle</label>
                  <Input 
                    value={pagoNotas} 
                    onChange={e => setPagoNotas(e.target.value)} 
                    placeholder="Ej. Pago semanal de productos"
                    className="bg-black"
                  />
                </div>
              </CardContent>
              <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowPagoModal(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold" disabled={isSubmitting}>
                  Confirmar Pago
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
