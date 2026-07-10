'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, getTodayBolivia } from '@/lib/utils'
import { Scale, CheckCircle, AlertCircle, Store } from 'lucide-react'

interface Resumen {
  fecha: string
  caja_chica: number
  ventas: number
  servicios: number
  banco: number
  uso_tienda: number
  total_registrado: number
  total_efectivo: number
  total_qr: number
  total_tarjeta: number
  total_descuento_caja: number
  sanciones: number
  movimientos: number
  cantidad_servicios?: number
}

interface Cierre {
  id: string
  fecha: string
  cerrado: boolean
  total_efectivo_fisico: number
  total_qr: number
  observaciones: string | null
  usuario_cierre: string
}

export default function ArqueoPage() {
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [cierre, setCierre] = useState<Cierre | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [efectivoFisico, setEfectivoFisico] = useState('')
  const [qrFisico, setQrFisico] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const hoy = getTodayBolivia()

  const loadData = useCallback(async () => {
    const res = await fetch(`/api/arqueo?fecha=${hoy}`)
    if (res.ok) {
      const data = await res.json()
      setResumen(data.resumen)
      setCierre(data.cierre)
      if (data.cierre) {
        setEfectivoFisico(String(data.cierre.total_efectivo_fisico || 0))
        setQrFisico(String(data.cierre.total_qr || 0))
        setObservaciones(data.cierre.observaciones || '')
      }
    }
    setLoading(false)
  }, [hoy])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async (cerrar: boolean) => {
    if (!resumen) return
    setSaving(true)
    const res = await fetch('/api/arqueo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha: hoy,
        caja_chica: resumen.caja_chica,
        ventas: resumen.ventas,
        servicios: resumen.servicios,
        banco: resumen.banco,
        total_efectivo_fisico: parseFloat(efectivoFisico) || 0,
        total_qr: parseFloat(qrFisico) || 0,
        observaciones: observaciones || null,
        cerrado: cerrar,
      }),
    })
    if (res.ok) loadData()
    setSaving(false)
  }

  if (loading || !resumen) {
    return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-orange-500 rounded-full animate-spin" /></div>
  }

  const esperadoEfectivo = resumen.total_efectivo || 0
  const esperadoQr = (resumen.total_qr || 0) + (resumen.total_tarjeta || 0)
  const contadoEfectivo = parseFloat(efectivoFisico) || 0
  const contadoQr = parseFloat(qrFisico) || 0

  const difEfectivo = contadoEfectivo - esperadoEfectivo
  const difQr = contadoQr - esperadoQr

  const totalFisico = contadoEfectivo + contadoQr
  const diferencia = totalFisico - resumen.total_registrado

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-4xl font-black tracking-tight text-white uppercase">
          Arqueo de <span className="text-orange-500">Caja</span>
        </h1>
        <p className="text-zinc-500 font-medium mt-1">
          Cierre diario — {new Date().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {cierre?.cerrado && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <div>
              <p className="text-green-400 font-bold">Arqueo cerrado</p>
              <p className="text-green-400/60 text-sm">Cerrado por {cierre.usuario_cierre}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen por libro */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Caja Chica', value: resumen.caja_chica, color: 'text-amber-400' },
          { label: 'Ventas', value: resumen.ventas, color: 'text-green-400' },
          { label: 'Servicios', value: resumen.servicios, color: 'text-emerald-400' },
          { label: 'Banco', value: resumen.banco, color: 'text-blue-400' },
          { label: 'Uso Tienda', value: resumen.uso_tienda, color: 'text-violet-400' },
          { label: 'Total Sistema', value: resumen.total_registrado, color: 'text-white' },
        ].map((item) => (
          <Card key={item.label} className={`border-white/5 bg-zinc-900/80 ${item.label === 'Uso Tienda' && resumen.uso_tienda > 0 ? 'border-violet-500/20' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">{item.label}</p>
                {item.label === 'Servicios' && resumen.cantidad_servicios !== undefined && (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {resumen.cantidad_servicios} {resumen.cantidad_servicios === 1 ? 'hecho' : 'hechos'}
                  </span>
                )}
              </div>
              <p className={`text-xl font-black ${item.color}`}>{formatCurrency(item.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conteo físico */}
      <Card className="border-white/5 bg-zinc-900/80">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Conteo Físico & Cuadre de Caja</h2>
              <p className="text-xs text-zinc-500">Compara el dinero real contado frente al esperado en el sistema</p>
            </div>
            <div className="flex gap-4 text-xs font-bold">
              <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                💵 Esperado Efectivo: {formatCurrency(esperadoEfectivo)}
              </span>
              <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                📱 Esperado QR/Banco: {formatCurrency(esperadoQr)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Efectivo Físico Contado</label>
                <span className={`text-[11px] font-black ${Math.abs(difEfectivo) < 0.1 ? 'text-green-400' : difEfectivo > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {Math.abs(difEfectivo) < 0.1 ? '✔ Cuadra' : difEfectivo > 0 ? `+${formatCurrency(difEfectivo)}` : formatCurrency(difEfectivo)}
                </span>
              </div>
              <input
                type="number" step="0.01" value={efectivoFisico}
                onChange={(e) => setEfectivoFisico(e.target.value)}
                disabled={cierre?.cerrado}
                placeholder="Ej. 1250.00"
                className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-lg font-black text-white focus:border-orange-500/50 outline-none disabled:opacity-50"
              />
              <p className="text-[11px] text-zinc-500">Sistema indica: {formatCurrency(esperadoEfectivo)}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">QR / Transferencias Verificado</label>
                <span className={`text-[11px] font-black ${Math.abs(difQr) < 0.1 ? 'text-green-400' : difQr > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {Math.abs(difQr) < 0.1 ? '✔ Cuadra' : difQr > 0 ? `+${formatCurrency(difQr)}` : formatCurrency(difQr)}
                </span>
              </div>
              <input
                type="number" step="0.01" value={qrFisico}
                onChange={(e) => setQrFisico(e.target.value)}
                disabled={cierre?.cerrado}
                placeholder="Ej. 840.00"
                className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-lg font-black text-white focus:border-orange-500/50 outline-none disabled:opacity-50"
              />
              <p className="text-[11px] text-zinc-500">Sistema indica: {formatCurrency(esperadoQr)}</p>
            </div>

            <Card className={`border ${Math.abs(diferencia) < 0.1 ? 'border-green-500/30 bg-green-500/5' : diferencia > 0 ? 'border-blue-500/30 bg-blue-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
              <CardContent className="p-4 flex flex-col items-center justify-center h-full">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Diferencia Total</p>
                <p className={`text-2xl font-black ${Math.abs(diferencia) < 0.1 ? 'text-green-400' : diferencia > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {diferencia > 0 ? '+' : ''}{formatCurrency(diferencia)}
                </p>
                {Math.abs(diferencia) < 0.1 ? (
                  <p className="text-[10px] text-green-400 mt-1 font-bold">✔ Caja perfectamente cuadrada</p>
                ) : (
                  <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {diferencia > 0 ? 'Sobrante Total' : 'Faltante Total'}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Observaciones</label>
            <textarea
              value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
              disabled={cierre?.cerrado}
              className="w-full h-24 bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-orange-500/50 outline-none resize-none disabled:opacity-50"
              placeholder="Notas del cierre..."
            />
          </div>

          {!cierre?.cerrado && (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar borrador'}
              </Button>
              <Button variant="primary" onClick={() => handleSave(true)} disabled={saving} className="font-black uppercase tracking-wider bg-orange-500 hover:bg-orange-400">
                <Scale className="w-4 h-4 mr-2" />
                Cerrar Arqueo del Día
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalle por método de pago */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Efectivo (sistema)', value: resumen.total_efectivo, color: 'text-amber-400' },
          { label: 'QR (sistema)', value: resumen.total_qr, color: 'text-blue-400' },
          { label: 'Tarjeta (sistema)', value: resumen.total_tarjeta, color: 'text-purple-400' },
          { label: 'Desc. Caja (tienda)', value: resumen.total_descuento_caja, color: 'text-violet-400' },
        ].map((item) => (
          <Card key={item.label} className={`border-white/5 bg-zinc-900/50 ${item.label.includes('tienda') && item.value > 0 ? 'border-violet-500/20' : ''}`}>
            <CardContent className="p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">{item.label}</p>
              <p className={`text-lg font-black ${item.color}`}>{formatCurrency(item.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
