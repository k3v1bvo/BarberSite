'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, getTodayBolivia, exportToCSV } from '@/lib/utils'
import { Scale, CheckCircle, AlertCircle, Store, DollarSign, ExternalLink, Printer, Download } from 'lucide-react'
import { ImageUpload } from '@/components/ui/ImageUpload'

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
  comisiones_pendientes_count?: number
  comisiones_pendientes_monto?: number
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

  const [activeTab, setActiveTab] = useState<'arqueo' | 'historial'>('arqueo')
  const [historialList, setHistorialList] = useState<any[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  // Cierre Modal state
  const [showCierreModal, setShowCierreModal] = useState(false)
  const [personaCierre, setPersonaCierre] = useState('')
  const [metodoPagoCierre, setMetodoPagoCierre] = useState<'efectivo' | 'qr'>('efectivo')
  const [comprobanteCierre, setComprobanteCierre] = useState('')

  // QR Historial Modal state
  const [selectedHistorialQr, setSelectedHistorialQr] = useState<any | null>(null)
  const [qrHistorialUrl, setQrHistorialUrl] = useState('')
  const [savingQrHistorial, setSavingQrHistorial] = useState(false)

  const handleSaveQrHistorial = async () => {
    if (!selectedHistorialQr) return
    setSavingQrHistorial(true)
    const res = await fetch('/api/arqueo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedHistorialQr.id,
        fecha: selectedHistorialQr.fecha,
        comprobante_url: qrHistorialUrl || null,
      }),
    })
    if (res.ok) {
      setSelectedHistorialQr(null)
      setQrHistorialUrl('')
      loadHistorial()
    }
    setSavingQrHistorial(false)
  }

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
        if (data.cierre.usuario_cierre) setPersonaCierre(data.cierre.usuario_cierre)
      }
    }
    setLoading(false)
  }, [hoy])

  const loadHistorial = async () => {
    setLoadingHistorial(true)
    try {
      const res = await fetch('/api/arqueo?historial=true')
      if (res.ok) {
        setHistorialList(await res.json())
      }
    } finally {
      setLoadingHistorial(false)
    }
  }

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (activeTab === 'historial') {
      loadHistorial()
    }
  }, [activeTab])

  const handleSave = async (cerrar: boolean, pagoCierreData?: any) => {
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
        usuario_cierre: personaCierre || null,
        pago_cierre: pagoCierreData || null,
      }),
    })
    if (res.ok) {
      setShowCierreModal(false)
      loadData()
    }
    setSaving(false)
  }

  if (loading || !resumen) {
    return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-orange-500 rounded-full animate-spin" /></div>
  }

  const esperadoEfectivo = resumen.total_efectivo || 0
  const esperadoQr = (resumen.total_qr || 0) + (resumen.total_tarjeta || 0)
  const esperadoTotal = esperadoEfectivo + esperadoQr
  const contadoEfectivo = parseFloat(efectivoFisico) || 0
  const contadoQr = parseFloat(qrFisico) || 0

  const difEfectivo = contadoEfectivo - esperadoEfectivo
  const difQr = contadoQr - esperadoQr

  const totalFisico = contadoEfectivo + contadoQr
  const diferencia = totalFisico - esperadoTotal

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

      <div className="flex gap-2 border-b border-white/10 pb-4">
        <button
          type="button"
          onClick={() => setActiveTab('arqueo')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'arqueo' ? 'bg-orange-500 text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          Arqueo del Día
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('historial')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'historial' ? 'bg-orange-500 text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          Historial de Cierres Diarios
        </button>
      </div>

      {activeTab === 'historial' ? (
        <>
          <Card className="border-white/5 bg-zinc-900/80">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Historial de Cierres de Caja (Último Año)</h2>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => window.print()} className="gap-2 font-bold uppercase tracking-wider text-xs border-white/20 text-white hover:bg-white/10 print:hidden shadow-lg shadow-white/5">
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => exportToCSV(historialList, `arqueo_historial_${getTodayBolivia()}`)} 
                    className="gap-2 font-bold uppercase tracking-wider text-xs border-blue-500/20 text-blue-400 hover:bg-blue-500/10 print:hidden shadow-lg shadow-blue-500/5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </Button>
                </div>
              </div>
              {loadingHistorial ? (
                <div className="py-12 text-center text-zinc-500 text-sm">Cargando historial...</div>
              ) : historialList.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-sm">No hay cierres diarios registrados aún.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Responsable de Cierre</th>
                        <th className="py-3 px-4 text-right">Efectivo Físico</th>
                        <th className="py-3 px-4 text-right">QR / Banco</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4">Observaciones</th>
                        <th className="py-3 px-4 text-center">Comprobante QR Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                      {historialList.map((h: any) => (
                        <tr key={h.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-white">{h.fecha}</td>
                          <td className="py-3 px-4 text-orange-400 font-bold">{h.usuario_cierre || 'No registrado'}</td>
                          <td className="py-3 px-4 text-right font-mono text-amber-400">{formatCurrency(Number(h.total_efectivo_fisico || 0))}</td>
                          <td className="py-3 px-4 text-right font-mono text-blue-400">{formatCurrency(Number(h.total_qr || 0))}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-black ${h.cerrado ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400'}`}>
                              {h.cerrado ? 'Cerrado' : 'Borrador'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-zinc-400 text-xs">{h.observaciones || '—'}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedHistorialQr(h)
                                setQrHistorialUrl(h.comprobante_url || '')
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                                h.comprobante_url
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                              }`}
                            >
                              {h.comprobante_url ? '📱 Ver / Cambiar QR' : '📄 + Subir QR Cierre'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* QR Historial Upload Modal */}
          {selectedHistorialQr && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h3 className="text-base font-black uppercase tracking-wider text-white">Comprobante QR de Cierre Diario</h3>
                  <button type="button" onClick={() => setSelectedHistorialQr(null)} className="text-zinc-500 hover:text-white">
                    ✕
                  </button>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Cierre de Caja - Fecha: {selectedHistorialQr.fecha}</p>
                  <p className="text-xs text-zinc-400">Responsable: <b className="text-orange-400">{selectedHistorialQr.usuario_cierre}</b> | Bono: <b>Bs 10.00</b></p>
                </div>

                {selectedHistorialQr.comprobante_url && (
                  <div className="p-3 bg-zinc-950 border border-white/10 rounded-xl space-y-2">
                    <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Comprobante Actual</p>
                    {selectedHistorialQr.comprobante_url.startsWith('http') ? (
                      <a href={selectedHistorialQr.comprobante_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 underline break-all flex items-center gap-1">
                        Ver Comprobante <ExternalLink size={12} />
                      </a>
                    ) : (
                      <p className="text-xs text-zinc-300 font-mono break-all">{selectedHistorialQr.comprobante_url}</p>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <ImageUpload
                    label="Subir Captura del Pago por Cierre"
                    onUploadSuccess={(url) => setQrHistorialUrl(url)}
                  />
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">O pegar enlace / nota de comprobante</label>
                    <input
                      type="text"
                      value={qrHistorialUrl}
                      onChange={(e) => setQrHistorialUrl(e.target.value)}
                      placeholder="https://... o referencia del comprobante"
                      className="w-full h-10 bg-zinc-950 border border-white/10 rounded-xl px-3 text-xs text-white outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                  <Button variant="outline" onClick={() => setSelectedHistorialQr(null)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    disabled={savingQrHistorial}
                    onClick={handleSaveQrHistorial}
                    className="bg-orange-500 hover:bg-orange-400 font-black text-xs uppercase tracking-wider"
                  >
                    {savingQrHistorial ? 'Guardando...' : 'Guardar Comprobante QR'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
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
                    <span className="text-xs text-zinc-500 font-bold uppercase">{item.label}</span>
                    <DollarSign className="w-4 h-4 text-zinc-600" />
                  </div>
                  <p className={`text-xl font-black mt-2 ${item.color}`}>
                    {formatCurrency(item.value)}
                  </p>
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
                  <Button variant="primary" onClick={() => setShowCierreModal(true)} disabled={saving} className="font-black uppercase tracking-wider bg-orange-500 hover:bg-orange-400">
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
        </>
      )}

      {/* MODAL DE CIERRE DE CAJA & PAGO DE BONO */}
      {showCierreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-base font-black uppercase tracking-wider text-white">Cierre Diario y Bono (10 Bs)</h3>
              <button type="button" onClick={() => setShowCierreModal(false)} className="text-zinc-500 hover:text-white">
                ✕
              </button>
            </div>

            {(resumen.comisiones_pendientes_count || 0) > 0 && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <p className="text-xs font-black text-amber-400 uppercase flex items-center gap-1.5">
                  <AlertCircle size={14} /> Comisiones pendientes hoy
                </p>
                <p className="text-xs text-amber-200/80">
                  Hay <b>{resumen.comisiones_pendientes_count}</b> servicio(s) con comisiones sin pagar por un total de <b>Bs {formatCurrency(resumen.comisiones_pendientes_monto || 0)}</b>. Se sugiere pagar las comisiones antes de realizar el cierre.
                </p>
                <a
                  href="/coordinador/comisiones"
                  className="inline-block text-xs font-bold text-amber-400 underline hover:text-amber-300"
                >
                  → Ir a pagar comisiones primero
                </a>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">
                  ¿Quién realiza el cierre hoy? (Nombre) *
                </label>
                <input
                  type="text"
                  value={personaCierre}
                  onChange={(e) => setPersonaCierre(e.target.value)}
                  placeholder="Ej. Carlos Barbero / Operario"
                  className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white outline-none focus:border-orange-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1">Se le pagará el bono de 10 Bs por realizar el cierre.</p>
              </div>

              <div className="p-3 bg-zinc-950/60 border border-white/5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300">Pago por Cierre de Caja</span>
                  <span className="text-sm font-black text-orange-400">Bs 10.00</span>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">
                    Método de Pago del Bono
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMetodoPagoCierre('efectivo')}
                      className={`h-9 rounded-lg text-xs font-black uppercase transition-all border ${
                        metodoPagoCierre === 'efectivo'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-zinc-900 text-zinc-400 border-white/5 hover:border-white/20'
                      }`}
                    >
                      💵 Efectivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetodoPagoCierre('qr')}
                      className={`h-9 rounded-lg text-xs font-black uppercase transition-all border ${
                        metodoPagoCierre === 'qr'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          : 'bg-zinc-900 text-zinc-400 border-white/5 hover:border-white/20'
                      }`}
                    >
                      📱 QR / Banco
                    </button>
                  </div>
                </div>

                {metodoPagoCierre === 'qr' && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">
                      Comprobante QR (Enlace o nota)
                    </label>
                    <input
                      type="text"
                      value={comprobanteCierre}
                      onChange={(e) => setComprobanteCierre(e.target.value)}
                      placeholder="URL o referencia del pago QR"
                      className="w-full h-9 bg-zinc-900 border border-white/10 rounded-lg px-3 text-xs text-white outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
              <Button variant="outline" onClick={() => setShowCierreModal(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={saving || !personaCierre.trim()}
                onClick={() => handleSave(true, {
                  monto: 10,
                  persona: personaCierre.trim(),
                  metodo_pago: metodoPagoCierre,
                  comprobante_url: comprobanteCierre
                })}
                className="bg-orange-500 hover:bg-orange-400 font-black text-xs uppercase tracking-wider"
              >
                {saving ? 'Cerrando...' : 'Confirmar Cierre y Pagar 10 Bs'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
