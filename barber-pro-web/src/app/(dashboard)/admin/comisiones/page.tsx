'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, DollarSign, CheckCircle, Filter, Download, Edit, RefreshCw, AlertTriangle, X, Plus, Users, Settings } from 'lucide-react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import ComisionBarberoModal from '@/components/comisiones/ComisionBarberoModal'

function parseDescuentoDetalle(c: any) {
  const notas = c.notas || ''
  const precio = Number(c.precio) || 0
  const precioBase = Number(c.servicios?.precio) || 0
  const badges: { text: string; color: string }[] = []

  // Promo 2x1
  if (notas.includes('2×1') || notas.includes('2x1') || notas.includes('2X1')) {
    if (precio === 0) {
      badges.push({ text: '🎟️ 2×1 Acompañante', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' })
    } else {
      badges.push({ text: '🎟️ Promo 2×1', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' })
    }
  }

  // Lealtad / Fidelidad (ej. 5to corte gratis, 10mo corte, etc.)
  if (notas.toLowerCase().includes('lealtad') || notas.toLowerCase().includes('fidelidad') || notas.includes('5ta') || notas.includes('10ma') || notas.includes('5to') || notas.includes('10mo')) {
    badges.push({ text: '🎁 Recompensa Lealtad', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' })
  } else if (precio === 0 && precioBase > 0 && badges.length === 0) {
    badges.push({ text: '🎁 100% Descuento', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' })
  }

  // Descuento manual / Asume
  if (notas.includes('Desc. Especial') || notas.includes('Asume:')) {
    if (notas.includes('Asume: Barbero') || notas.includes('asume: barbero')) {
      badges.push({ text: '💈 Asume Barbero (100%)', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' })
    } else if (notas.includes('Compartido') || notas.includes('50/50')) {
      badges.push({ text: '🤝 Asume 50/50', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' })
    } else if (notas.includes('Asume: Barbería') || notas.includes('Barbería')) {
      badges.push({ text: '🏢 Asume Barbería', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' })
    }
  }

  return {
    esGratis: precio === 0 && precioBase > 0,
    precioBase,
    badges,
  }
}

export default function AdminComisionesPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  const [citas, setCitas] = useState<any[]>([])
  const [pagos, setPagos] = useState<any[]>([])
  const [barberos, setBarberos] = useState<any[]>([])
  const [resumen, setResumen] = useState({ pendiente: 0, pagado: 0, hoy: 0, semana: 0, total_cobrado: 0, total_cobrado_pendiente: 0 })
  const [barberoId, setBarberoId] = useState('')
  const [estado, setEstado] = useState('pendiente')
  const [periodo, setPeriodo] = useState<'diario' | 'semanal' | 'personalizado'>('diario')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [pagoEfectivo, setPagoEfectivo] = useState<number>(0)
  const [pagoQr, setPagoQr] = useState<number>(0)
  const [comprobanteUrl, setComprobanteUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [comisionModalBarbero, setComisionModalBarbero] = useState<{ id: string; nombre: string; imagen?: string } | null>(null)
  
  // Sanciones Modal
  const [showSancionesModal, setShowSancionesModal] = useState(false)
  const [nuevaSancion, setNuevaSancion] = useState({ tipo: 'llegada_tarde', monto: 12, descripcion: '' })
  const [savingSancion, setSavingSancion] = useState(false)

  const [finanzas, setFinanzas] = useState({ saldo_adelantos: 0, sanciones_pendientes: [] as any[], total_sanciones: 0, bonos_pendientes: [] as any[], total_bonos: 0 })
  const [descuentoAdelanto, setDescuentoAdelanto] = useState<number>(0)
  const [sancionesCatalogo, setSancionesCatalogo] = useState<any[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ estado })
      if (barberoId) params.set('barbero_id', barberoId)
      const [cRes, pRes, rRes] = await Promise.all([
        fetch(`/api/comisiones?${params}`),
        fetch('/api/comisiones/pagos'),
        fetch('/api/reglas-laborales')
      ])
      const cJson = await cRes.json()
      const pJson = await pRes.json()
      const rJson = rRes.ok ? await rRes.json() : { plan_cuentas: [] }
      
      setCitas(cJson.citas ?? [])
      setResumen(cJson.resumen ?? { pendiente: 0, pagado: 0, hoy: 0, semana: 0, total_cobrado: 0, total_cobrado_pendiente: 0 })
      setFinanzas(cJson.finanzas ?? { saldo_adelantos: 0, sanciones_pendientes: [], total_sanciones: 0, bonos_pendientes: [], total_bonos: 0 })
      setPagos(pJson.pagos ?? [])
      
      const cuentasSancion = (rJson.plan_cuentas ?? []).filter((c: any) => c.es_sancion)
      setSancionesCatalogo(cuentasSancion)
      if (cuentasSancion.length > 0 && nuevaSancion.tipo === 'llegada_tarde') {
        setNuevaSancion(prev => ({ ...prev, tipo: cuentasSancion[0].detalle }))
      }
      
      setDescuentoAdelanto(0) // Reset descuento on load
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .in('role', ['barbero', 'coordinador'])
        .eq('is_active', true)
        .order('full_name')
        .then(({ data }) => {
          if (data) setBarberos(data)
        })
    })
    load()
  }, [barberoId, estado])

  const marcarPagadas = async () => {
    if (!barberoId) {
      toastError('Selecciona un barbero')
      return
    }
    const hoyStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    let inicio = hoyStr
    let fin = hoyStr
    if (periodo === 'semanal') {
      const d = new Date()
      const boliviaDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/La_Paz' }))
      boliviaDate.setDate(boliviaDate.getDate() - boliviaDate.getDay())
      inicio = `${boliviaDate.getFullYear()}-${String(boliviaDate.getMonth() + 1).padStart(2, '0')}-${String(boliviaDate.getDate()).padStart(2, '0')}`
    }
    try {
      const res = await fetch('/api/comisiones/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barbero_id: barberoId,
          periodo_tipo: periodo,
          fecha_inicio: inicio,
          fecha_fin: fin,
          metodo_pago: metodoPago,
          monto_efectivo: pagoEfectivo,
          monto_qr: pagoQr,
          descuento_adelanto: descuentoAdelanto,
          sanciones_ids: finanzas.sanciones_pendientes.map((s: any) => s.id),
          bonos_ids: finanzas.bonos_pendientes.map((b: any) => b.id),
          comprobante_url: comprobanteUrl
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success('Comisiones marcadas como pagadas')
      setComprobanteUrl('')
      load()
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Error')
    }
  }

  const editarComision = async (citaId: string, actual: number) => {
    const val = prompt('Nuevo monto de comisión:', String(actual))
    if (val === null) return
    const monto = parseFloat(val)
    if (Number.isNaN(monto) || monto < 0) {
      toastError('Monto inválido')
      return
    }
    const res = await fetch('/api/comisiones/pagos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cita_id: citaId, comision_barbero: monto }),
    })
    if (!res.ok) {
      toastError((await res.json()).error)
      return
    }
    success('Comisión actualizada')
    load()
  }

  const crearSancion = async () => {
    if (!barberoId) return
    setSavingSancion(true)
    try {
      const res = await fetch('/api/admin/sanciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevaSancion, barbero_id: barberoId })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success('Sanción creada correctamente')
      setNuevaSancion({ tipo: sancionesCatalogo.length > 0 ? sancionesCatalogo[0].detalle : 'llegada_tarde', monto: 12, descripcion: '' })
      load()
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Error al crear sanción')
    } finally {
      setSavingSancion(false)
    }
  }

  const eliminarSancion = async (id: string) => {
    if (!confirm('¿Eliminar esta sanción?')) return
    try {
      const res = await fetch(`/api/admin/sanciones?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      success('Sanción eliminada')
      load()
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Error')
    }
  }

  const recalcularHistorico = async () => {
    if (!confirm('¿Deseas intentar recalcular las comisiones antiguas que se guardaron en $0.00 automáticamente? El sistema revisará el porcentaje de cada barbero y el precio del servicio.')) return
    
    setIsRecalculating(true)
    try {
      const res = await fetch('/api/admin/comisiones/recalcular', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      success(data.message || 'Recálculo finalizado')
      load()
    } catch (err: any) {
      toastError(err.message || 'Error al recalcular')
    } finally {
      setIsRecalculating(false)
    }
  }

  const exportarCSV = () => {
    const rows = [
      ['Fecha', 'Barbero', 'Servicio', 'Cliente', 'Precio Cobrado', '% Comisión', 'Comisión Barbero', 'Propina Barbero', 'Estado'],
      ...citas.map((c) => {
        const precio = Number(c.precio) || 0
        const comision = Number(c.comision_barbero) || 0
        const propinaBarbero = (Number(c.propinas) || 0) * 0.5
        const baseComision = Math.max(0, comision - propinaBarbero)
        const pct = precio > 0 ? `${Math.round((baseComision / precio) * 100)}%` : '0%'
        return [
          new Date(c.fecha_hora).toLocaleDateString('es-BO'),
          c.barbero?.full_name || '',
          c.servicios?.nombre || '',
          c.clientes?.nombre || '',
          String(precio),
          pct,
          String(comision),
          String(propinaBarbero),
          c.comision_pagada ? 'Pagada' : 'Pendiente',
        ]
      }),
    ]
    const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comisiones_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalCalculado = resumen.pendiente - finanzas.total_sanciones + finanzas.total_bonos - descuentoAdelanto
  const citasCobradoPendiente = citas.filter((c: any) => !c.comision_pagada).reduce((sum: number, c: any) => sum + (Number(c.precio) || 0), 0)

  const resumenBarberos = barberos.map((b) => {
    const citasB = citas.filter((c: any) => c.barbero_id === b.id)
    const cobrado = citasB.reduce((sum: number, c: any) => sum + (Number(c.precio) || 0), 0)
    const comisionTotal = citasB.reduce((sum: number, c: any) => sum + (Number(c.comision_barbero) || 0), 0)
    const pendientes = citasB.filter((c: any) => !c.comision_pagada)
    const comisionPendiente = pendientes.reduce((sum: number, c: any) => sum + (Number(c.comision_barbero) || 0), 0)
    const cobradoPendiente = pendientes.reduce((sum: number, c: any) => sum + (Number(c.precio) || 0), 0)
    const pctEfectivo = cobrado > 0 ? Math.round((comisionTotal / cobrado) * 100) : 0

    return {
      barbero: b,
      totalCitas: citasB.length,
      citasPendientes: pendientes.length,
      cobrado,
      cobradoPendiente,
      comisionTotal,
      comisionPendiente,
      pctEfectivo,
    }
  })

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-6 border-b border-white/5 pb-8">
        <button onClick={() => router.push('/admin')} className="p-4 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl">
          <ArrowLeft className="w-5 h-5 text-zinc-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-4xl font-black text-white uppercase">Control de <span className="text-amber-500">Comisiones</span></h1>
          <p className="text-zinc-500 mt-2">Pagos pendientes, historial y reportes por barbero</p>
        </div>
        <Button variant="outline" className="border-amber-500/30 text-amber-500 hover:bg-amber-500 hover:text-black" onClick={recalcularHistorico} disabled={isRecalculating}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} /> 
          Corregir Citas a $0.00
        </Button>
        <Button variant="outline" onClick={exportarCSV} disabled={!citas.length}>
          <Download className="w-4 h-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Cobrado', value: resumen.total_cobrado, color: 'text-blue-400', sub: 'Monto de servicios' },
          { label: 'Comisión Pendiente', value: resumen.pendiente, color: 'text-amber-500', sub: 'Por liquidar a barberos' },
          { label: 'Generado Hoy', value: resumen.hoy, color: 'text-white', sub: 'Comisiones del día' },
          { label: 'Esta Semana', value: resumen.semana, color: 'text-zinc-300', sub: 'Comisiones de semana' },
          { label: 'Total Pagado', value: resumen.pagado, color: 'text-green-500', sub: 'Historial liquidado' },
        ].map((s) => (
          <Card key={s.label} className="bg-zinc-900 border-white/5">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{s.label}</p>
              <p className={`text-2xl font-black mt-2 ${s.color}`}>{formatCurrency(s.value)}</p>
              <p className="text-[10px] text-zinc-500 mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabla de Rendimiento y Comisiones por Barbero */}
      {barberos.length > 0 && (
        <Card className="bg-zinc-900 border-white/5">
          <CardHeader className="pb-3 border-b border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-white uppercase text-sm flex items-center gap-2">
                <Users size={16} className="text-amber-500" /> Rendimiento y Comisiones por Especialista
              </CardTitle>
              <span className="text-xs text-zinc-400">
                Resumen de servicios atendidos, cobro total y liquidación por persona
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="text-zinc-500 uppercase text-[10px] tracking-widest border-b border-white/5 bg-zinc-950/40">
                    <th className="text-left py-3 px-4">Especialista</th>
                    <th className="text-center py-3 px-3">Citas</th>
                    <th className="text-right py-3 px-4">Total Cobrado</th>
                    <th className="text-right py-3 px-4">Comisión Ganada</th>
                    <th className="text-center py-3 px-3">% Efectivo</th>
                    <th className="text-right py-3 px-4">Por Liquidar</th>
                    <th className="text-right py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {resumenBarberos.map((rb) => {
                    const esActivo = barberoId === rb.barbero.id
                    return (
                      <tr
                        key={rb.barbero.id}
                        className={`hover:bg-white/5 transition-colors ${esActivo ? 'bg-amber-500/10' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{rb.barbero.full_name}</span>
                            <Badge variant="outline" className="text-[9px] uppercase font-mono">
                              {rb.barbero.role}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-300">
                          <span className="font-semibold">{rb.totalCitas}</span>
                          {rb.citasPendientes > 0 && (
                            <span className="text-[10px] text-amber-400 block font-mono">
                              ({rb.citasPendientes} pend.)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-blue-400">
                          {formatCurrency(rb.cobrado)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-white">
                          {formatCurrency(rb.comisionTotal)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {rb.pctEfectivo}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-amber-500 text-sm">
                          {formatCurrency(rb.comisionPendiente)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              className="h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-black"
                              onClick={() => {
                                setComisionModalBarbero({
                                  id: rb.barbero.id,
                                  nombre: rb.barbero.full_name,
                                  imagen: rb.barbero.avatar_url,
                                })
                              }}
                              title="Configurar comisión por porcentaje o por servicio"
                            >
                              <Settings className="w-3.5 h-3.5 mr-1" /> Reglas %
                            </Button>
                            <Button
                              variant={esActivo ? 'primary' : 'outline'}
                              size="sm"
                              type="button"
                              className="h-8 text-xs"
                              onClick={() => {
                                setBarberoId(rb.barbero.id)
                                setEstado('pendiente')
                              }}
                            >
                              {esActivo ? 'Filtrado' : 'Liquidar'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-zinc-900 border-white/5">
        <CardHeader><CardTitle className="text-white uppercase text-sm flex items-center gap-2"><Filter size={16} /> Filtros y pago</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <select className="h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white font-bold text-xs" value={barberoId} onChange={(e) => setBarberoId(e.target.value)}>
              <option value="">Todos los barberos y personal</option>
              {barberos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.full_name} ({b.role === 'coordinador' ? 'Coordinador' : 'Barbero'})
                </option>
              ))}
            </select>
            {barberoId && (
              <Button
                variant="outline"
                type="button"
                className="h-12 border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-black font-bold text-xs uppercase"
                onClick={() => {
                  const b = barberos.find(b => b.id === barberoId)
                  if (b) {
                    setComisionModalBarbero({ id: b.id, nombre: b.full_name, imagen: b.avatar_url })
                  }
                }}
              >
                <Settings className="w-4 h-4 mr-2" /> Configurar Reglas de {barberos.find(b => b.id === barberoId)?.full_name?.split(' ')[0]}
              </Button>
            )}
            <select className="h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="pendiente">Pendientes</option>
              <option value="pagada">Pagadas</option>
              <option value="todas">Todas</option>
            </select>
            <select className="h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white" value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)}>
              <option value="diario">Pago diario</option>
              <option value="semanal">Pago semanal</option>
              <option value="personalizado">Personalizado</option>
            </select>
            <select className="h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white uppercase text-xs font-bold" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="qr">QR / Transferencia</option>
              <option value="mixto">Mixto (Efec. + QR)</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>

          {metodoPago === 'mixto' && barberoId && estado === 'pendiente' && (
            <div className="p-4 rounded-xl border border-white/10 bg-zinc-950 flex gap-4 animate-in fade-in">
              <div className="flex-1">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Monto en Efectivo</label>
                <Input 
                  type="number" 
                  min={0}
                  value={pagoEfectivo || ''} 
                  onChange={e => setPagoEfectivo(Number(e.target.value) || 0)} 
                  className="bg-black text-lg h-12"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Monto en QR</label>
                <Input 
                  type="number" 
                  min={0}
                  value={pagoQr || ''} 
                  onChange={e => setPagoQr(Number(e.target.value) || 0)} 
                  className="bg-black text-lg h-12"
                />
              </div>
            </div>
          )}

          {barberoId && estado === 'pendiente' && (
            <div className="p-4 rounded-xl border border-white/10 bg-black/50 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 border-b border-white/5 pb-2">Resumen Financiero para Pago</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                <div>
                  <span className="block text-zinc-400 mb-1">Total Cobrado</span>
                  <span className="font-bold text-blue-400">{formatCurrency(citasCobradoPendiente)}</span>
                  <span className="text-[10px] text-zinc-500 block">En citas pendientes</span>
                </div>
                <div>
                  <span className="block text-zinc-400 mb-1">Comisión Barbero</span>
                  <span className="font-bold text-amber-500">{formatCurrency(resumen.pendiente)}</span>
                  {citasCobradoPendiente > 0 && (
                    <span className="text-[10px] text-zinc-400 block font-mono">
                      ~{Math.round((resumen.pendiente / citasCobradoPendiente) * 100)}% del cobrado
                    </span>
                  )}
                </div>
                <div>
                  <span className="block text-zinc-400 mb-1">Deuda por Adelantos</span>
                  <span className="font-bold text-red-400">{formatCurrency(finanzas.saldo_adelantos)}</span>
                </div>
                <div>
                  <span className="block text-zinc-400 mb-1 flex items-center gap-2">
                    Sanciones (se restarán)
                    <button onClick={() => setShowSancionesModal(true)} className="text-blue-400 hover:text-blue-300">
                      <Edit className="w-3 h-3" />
                    </button>
                  </span>
                  <span className="font-bold text-red-400 cursor-pointer" onClick={() => setShowSancionesModal(true)}>
                    -{formatCurrency(finanzas.total_sanciones)} ({finanzas.sanciones_pendientes.length})
                  </span>
                </div>
                <div>
                  <span className="block text-zinc-400 mb-1">Bonos (se sumarán)</span>
                  <span className="font-bold text-green-400">+{formatCurrency(finanzas.total_bonos)}</span>
                </div>
              </div>

              {(metodoPago === 'qr' || metodoPago === 'mixto' || metodoPago === 'tarjeta') && (
                <div className="pt-2">
                  <ImageUpload
                    label="Comprobante de Pago"
                    defaultImage={comprobanteUrl || undefined}
                    onUploadSuccess={(url) => setComprobanteUrl(url)}
                    onUploadError={(err) => toastError(err)}
                  />
                </div>
              )}
              
              <div className="flex flex-col md:flex-row items-center gap-4 pt-4 border-t border-white/5">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-400 mb-1">Monto de Adelanto a cobrar hoy (Max: {formatCurrency(finanzas.saldo_adelantos)})</label>
                  <Input 
                    type="number" 
                    max={finanzas.saldo_adelantos} 
                    min={0} 
                    value={descuentoAdelanto} 
                    onChange={(e) => setDescuentoAdelanto(Number(e.target.value) || 0)} 
                    className="max-w-[200px]"
                  />
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400 uppercase tracking-widest">Total a Pagar</p>
                  <p className={`text-2xl font-black ${totalCalculado < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                    {formatCurrency(totalCalculado)}
                  </p>
                </div>
                <Button variant="primary" onClick={marcarPagadas} disabled={!barberoId || estado !== 'pendiente'} className="h-12 px-8">
                  <CheckCircle className="w-5 h-5 mr-2" /> Pagar Comisiones
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm min-w-[880px]">
          <thead>
            <tr className="text-zinc-500 uppercase text-[10px] tracking-widest border-b border-white/5">
              <th className="text-left py-3 px-4">Fecha</th>
              <th className="text-left py-3 px-4">Barbero</th>
              <th className="text-left py-3 px-4">Servicio</th>
              <th className="text-left py-3 px-4">Cliente</th>
              <th className="text-right py-3 px-4">Precio Cobrado</th>
              <th className="text-center py-3 px-4">% Comisión</th>
              <th className="text-right py-3 px-4">Comisión Barbero</th>
              <th className="text-right py-3 px-4">Estado</th>
              <th className="text-right py-3 px-4">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-12 text-center text-zinc-600">Cargando...</td></tr>
            ) : citas.length === 0 ? (
              <tr><td colSpan={9} className="py-12 text-center text-zinc-600">No hay citas registradas con los filtros actuales.</td></tr>
            ) : citas.map((c) => {
              const precio = Number(c.precio) || 0
              const comision = Number(c.comision_barbero) || 0
              const propinaBarbero = (Number(c.propinas) || 0) * 0.5
              const comisionServicioBase = Math.max(0, comision - propinaBarbero)
              const pct = precio > 0 ? Math.round((comisionServicioBase / precio) * 100) : 0
              const esFija = c.servicios?.comision_tipo === 'fija'
              const detallesDesc = parseDescuentoDetalle(c)

              return (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">{new Date(c.fecha_hora).toLocaleDateString('es-BO')}</td>
                  <td className="py-3 px-4 text-white font-bold">{c.barbero?.full_name}</td>
                  <td className="py-3 px-4 text-zinc-200">
                    <div className="font-medium">{c.servicios?.nombre || 'Servicio'}</div>
                    {c.comision_categoria && (
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                        Cat: {c.comision_categoria} {c.comision_herramientas ? '• Con herram.' : ''}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-zinc-400">{c.clientes?.nombre || '—'}</td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {detallesDesc.esGratis ? (
                      <div>
                        <span className="font-bold text-emerald-400">Bs 0.00</span>
                        <span className="block text-[10px] text-zinc-500 line-through">
                          Valor: {formatCurrency(detallesDesc.precioBase || 50)}
                        </span>
                      </div>
                    ) : (
                      <span className="font-bold text-white">{formatCurrency(precio)}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {precio > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {pct}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                        0%
                      </span>
                    )}
                    {esFija && (
                      <span className="block text-[9px] text-zinc-500 font-mono mt-0.5">monto fijo</span>
                    )}
                    {detallesDesc.badges.map((b, i) => (
                      <span key={i} className={`block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 border ${b.color}`}>
                        {b.text}
                      </span>
                    ))}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <span className={`font-black text-base ${comision > 0 ? 'text-amber-500' : 'text-zinc-600'}`}>
                      {formatCurrency(comision)}
                    </span>
                    {propinaBarbero > 0 && (
                      <span className="block text-[10px] text-green-400">
                        +{formatCurrency(propinaBarbero)} propina
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Badge variant={c.comision_pagada ? 'success' : 'warning'}>{c.comision_pagada ? 'Pagada' : 'Pendiente'}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {!c.comision_pagada && (
                      <Button variant="outline" size="sm" onClick={() => editarComision(c.id, c.comision_barbero || 0)} title="Ajustar monto de comisión">
                        <Edit className="w-3 h-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pagos.length > 0 && (
        <Card className="bg-zinc-900 border-white/5">
          <CardHeader><CardTitle className="text-white uppercase text-sm flex items-center gap-2"><DollarSign size={16} /> Historial de pagos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pagos.slice(0, 15).map((p: any) => (
              <div key={p.id} className="flex justify-between py-2 border-b border-white/5 text-sm">
                <span className="text-zinc-300">{p.barbero?.full_name} — {p.periodo_tipo} ({p.fecha_inicio} → {p.fecha_fin})</span>
                <span className="font-black text-green-500">{formatCurrency(p.monto_total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {showSancionesModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-12 overflow-y-auto">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button onClick={() => setShowSancionesModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
              <X size={20} />
            </button>
            <h2 className="text-xl font-black text-white uppercase mb-4 flex items-center gap-2">
              <AlertTriangle className="text-red-500 w-5 h-5" /> Gestión de Sanciones
            </h2>

            <div className="space-y-4 mb-8">
              <h3 className="text-sm font-bold text-zinc-400">Crear Nueva Sanción</h3>
              {sancionesCatalogo.length > 0 ? (
                <select 
                  className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-white text-sm"
                  value={nuevaSancion.tipo}
                  onChange={e => setNuevaSancion({ ...nuevaSancion, tipo: e.target.value })}
                >
                  {sancionesCatalogo.map(c => (
                    <option key={c.id} value={c.detalle}>{c.detalle}</option>
                  ))}
                </select>
              ) : (
                <select 
                  className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-white text-sm"
                  value={nuevaSancion.tipo}
                  onChange={e => setNuevaSancion({ ...nuevaSancion, tipo: e.target.value })}
                >
                  <option value="llegada_tarde">Llegada Tarde</option>
                  <option value="falta">Falta Injustificada</option>
                  <option value="salida_temprano">Salida Temprano</option>
                  <option value="otro">Otro Motivo</option>
                </select>
              )}
              <Input 
                placeholder="Descripción (opcional)"
                value={nuevaSancion.descripcion}
                onChange={e => setNuevaSancion({ ...nuevaSancion, descripcion: e.target.value })}
              />
              <div className="flex gap-2 items-center">
                <Input 
                  type="number"
                  placeholder="Monto a descontar (ej. 12)"
                  value={nuevaSancion.monto}
                  onChange={e => setNuevaSancion({ ...nuevaSancion, monto: Number(e.target.value) || 0 })}
                  className="flex-1"
                />
                <span className="text-zinc-500 text-sm">Bs.</span>
              </div>
              <Button onClick={crearSancion} disabled={savingSancion || nuevaSancion.monto <= 0} variant="primary" className="w-full">
                <Plus size={16} className="mr-2" /> Agregar Sanción
              </Button>
            </div>

            <h3 className="text-sm font-bold text-zinc-400 mb-2">Sanciones Pendientes ({finanzas.sanciones_pendientes.length})</h3>
            {finanzas.sanciones_pendientes.length === 0 ? (
              <p className="text-zinc-600 text-sm">No hay sanciones pendientes para descontar.</p>
            ) : (
              <div className="space-y-2">
                {finanzas.sanciones_pendientes.map((s: any) => (
                  <div key={s.id} className="bg-black/50 border border-red-500/20 p-3 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-red-400 font-bold text-sm capitalize">{s.tipo.replace('_', ' ')}</p>
                      <p className="text-zinc-500 text-xs">{s.descripcion}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-white">{formatCurrency(s.monto)}</span>
                      <button onClick={() => eliminarSancion(s.id)} className="text-zinc-600 hover:text-red-500">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {comisionModalBarbero && (
        <ComisionBarberoModal
          barberoId={comisionModalBarbero.id}
          barberoNombre={comisionModalBarbero.nombre}
          barberoImagen={comisionModalBarbero.imagen}
          onClose={() => setComisionModalBarbero(null)}
          onSaved={() => {
            setComisionModalBarbero(null)
            load()
          }}
        />
      )}
    </div>
  )
}
