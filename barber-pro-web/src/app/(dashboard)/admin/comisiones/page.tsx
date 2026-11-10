'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import {
  ArrowLeft,
  DollarSign,
  CheckCircle,
  Filter,
  Download,
  Edit,
  RefreshCw,
  AlertTriangle,
  X,
  Plus,
  Users,
  Settings,
  Scissors,
  Calendar,
  CreditCard,
  Building2,
  ExternalLink,
} from 'lucide-react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import ReglasComisionesModal from '@/components/comisiones/ReglasComisionesModal'

function parseDescuentoDetalle(c: any) {
  const notas = c.notas || ''
  const precio = Number(c.precio) || 0
  const precioBase = Number(c.servicios?.precio) || 0
  const badges: { text: string; color: string }[] = []

  let asume: 'barberia' | 'barbero' | '50/50' | 'ninguno' = 'ninguno'
  let montoDescuento = 0

  const matchDesc = notas.match(/Desc\.\s*Especial:\s*-?Bs\s*(\d+(?:\.\d+)?)/i)
  if (matchDesc) {
    montoDescuento = Number(matchDesc[1]) || 0
  } else if (precioBase > precio) {
    montoDescuento = precioBase - precio
  }

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
  if (notas.includes('Desc. Especial') || notas.includes('Asume:') || notas.toLowerCase().includes('asume')) {
    if (notas.includes('Asume: Barbero') || notas.toLowerCase().includes('asume: barbero')) {
      asume = 'barbero'
      badges.push({ text: '💈 Asume Barbero (100%)', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' })
    } else if (notas.includes('Compartido') || notas.includes('50/50')) {
      asume = '50/50'
      badges.push({ text: '🤝 Asume 50/50', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' })
    } else if (notas.includes('Asume: Barbería') || notas.toLowerCase().includes('barbería') || notas.toLowerCase().includes('barberia')) {
      asume = 'barberia'
      badges.push({ text: '🏢 Asume Barbería', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' })
    }
  } else if (precioBase > precio && !notas.includes('Asume:')) {
    asume = 'barberia'
  }

  // Productos adicionales y comisión por venta de productos (+Bs 10 por producto para el barbero)
  let comisionProductos = 0
  let unidadesProductos = 0
  let nombresProductos = ''

  if (c.productos_adicionales && Array.isArray(c.productos_adicionales) && c.productos_adicionales.length > 0) {
    unidadesProductos = c.productos_adicionales.reduce((acc: number, p: any) => acc + (Number(p.cantidad) || 1), 0)
    comisionProductos = unidadesProductos * 10
    nombresProductos = c.productos_adicionales.map((p: any) => `${p.cantidad || 1}x ${p.nombre}`).join(', ')
  } else if (notas) {
    const matchProd = notas.match(/Comisi[oó]n Productos:\s*\+?Bs\s*(\d+(?:\.\d+)?)/i)
    if (matchProd) {
      comisionProductos = Number(matchProd[1]) || 0
      const matchUnits = notas.match(/\((\d+)x\s*prod/i)
      unidadesProductos = matchUnits ? Number(matchUnits[1]) : Math.round(comisionProductos / 10)
    }
  }

  if (comisionProductos > 0) {
    badges.push({ 
      text: `🧴 +Bs ${comisionProductos} (${unidadesProductos} prod.)`, 
      color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
    })
  }

  const esSoloProducto = !c.servicio_id && (unidadesProductos > 0 || (c.productos_adicionales && c.productos_adicionales.length > 0) || notas.toLowerCase().includes('venta de productos'))

  return {
    esGratis: precio === 0 && precioBase > 0,
    precioBase,
    asume,
    montoDescuento,
    badges,
    comisionProductos,
    unidadesProductos,
    nombresProductos,
    esSoloProducto,
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
  const [periodo, setPeriodo] = useState<'todas' | 'diario' | 'semanal' | 'personalizado'>('todas')
  const [fechaInicioCustom, setFechaInicioCustom] = useState<string>('')
  const [fechaFinCustom, setFechaFinCustom] = useState<string>('')
  const [rendimientoBarberos, setRendimientoBarberos] = useState<any[]>([])

  // Modal de liquidación y pagos
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [pagoEfectivo, setPagoEfectivo] = useState<number>(0)
  const [pagoQr, setPagoQr] = useState<number>(0)
  const [comprobanteUrl, setComprobanteUrl] = useState<string>('')
  const [descuentoAdelanto, setDescuentoAdelanto] = useState<number>(0)

  const [loading, setLoading] = useState(true)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [showReglasModal, setShowReglasModal] = useState(false)
  const [modalBarberoId, setModalBarberoId] = useState<string | undefined>(undefined)
  const [updatingBarberoId, setUpdatingBarberoId] = useState<string | null>(null)
  
  // Sanciones Modal
  const [showSancionesModal, setShowSancionesModal] = useState(false)
  const [nuevaSancion, setNuevaSancion] = useState({ tipo: 'llegada_tarde', monto: 12, descripcion: '' })
  const [savingSancion, setSavingSancion] = useState(false)

  const [finanzas, setFinanzas] = useState({ saldo_adelantos: 0, sanciones_pendientes: [] as any[], total_sanciones: 0, bonos_pendientes: [] as any[], total_bonos: 0 })
  const [sancionesCatalogo, setSancionesCatalogo] = useState<any[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ estado })
      if (barberoId) params.set('barbero_id', barberoId)

      const hoyStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      if (periodo === 'diario') {
        params.set('fecha_inicio', hoyStr)
        params.set('fecha_fin', hoyStr)
      } else if (periodo === 'semanal') {
        const d = new Date()
        const boliviaDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/La_Paz' }))
        boliviaDate.setDate(boliviaDate.getDate() - boliviaDate.getDay())
        const inicioSemana = `${boliviaDate.getFullYear()}-${String(boliviaDate.getMonth() + 1).padStart(2, '0')}-${String(boliviaDate.getDate()).padStart(2, '0')}`
        params.set('fecha_inicio', inicioSemana)
        params.set('fecha_fin', hoyStr)
      } else if (periodo === 'personalizado' && fechaInicioCustom && fechaFinCustom) {
        params.set('fecha_inicio', fechaInicioCustom)
        params.set('fecha_fin', fechaFinCustom)
      }

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
      if (cJson.rendimiento_barberos && Array.isArray(cJson.rendimiento_barberos)) {
        setRendimientoBarberos(cJson.rendimiento_barberos)
      }
      
      const cuentasSancion = (rJson.plan_cuentas ?? []).filter((c: any) => c.es_sancion)
      setSancionesCatalogo(cuentasSancion)
      if (cuentasSancion.length > 0 && nuevaSancion.tipo === 'llegada_tarde') {
        setNuevaSancion(prev => ({ ...prev, tipo: cuentasSancion[0].detalle }))
      }
      setDescuentoAdelanto(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .from('profiles')
        .select('id, full_name, role, avatar_url, comision_porcentaje')
        .in('role', ['barbero', 'coordinador'])
        .eq('is_active', true)
        .order('full_name')
        .then(({ data }) => {
          if (data) setBarberos(data)
        })
    })
  }, [])

  useEffect(() => {
    load()
  }, [barberoId, estado, periodo, fechaInicioCustom, fechaFinCustom])

  const marcarPagadas = async () => {
    if (!barberoId) {
      toastError('Selecciona un especialista')
      return
    }
    const barberoSeleccionado = barberos.find((b: any) => b.id === barberoId)
    const citasPendientes = citas.filter((c: any) => !c.comision_pagada)
    const citasPendientesIds = citasPendientes.map((c: any) => c.id)
    if (citasPendientesIds.length === 0) {
      toastError('No hay citas pendientes para liquidar a este especialista')
      return
    }

    if (metodoPago === 'mixto') {
      const sumaMixto = Number((pagoEfectivo + pagoQr).toFixed(2))
      const totalEsperado = Number(totalCalculado.toFixed(2))
      if (Math.abs(sumaMixto - totalEsperado) > 0.01) {
        toastError(`La suma de Efectivo (Bs ${pagoEfectivo}) + QR (Bs ${pagoQr}) debe ser igual al Total a Pagar (Bs ${totalCalculado.toFixed(2)})`)
        return
      }
    }

    if (!confirm(`¿Confirmas liquidar ${citasPendientesIds.length} cita(s) y pagar Bs ${totalCalculado.toFixed(2)} a ${barberoSeleccionado?.full_name || 'este especialista'}?`)) {
      return
    }

    const hoyStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const fechas = citasPendientes.map((c: any) => (c.fecha_hora || '').split('T')[0]).filter(Boolean).sort()
    const inicio = fechas[0] || hoyStr
    const fin = fechas[fechas.length - 1] || hoyStr

    try {
      const res = await fetch('/api/comisiones/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barbero_id: barberoId,
          periodo_tipo: periodo === 'todas' ? 'diario' : periodo,
          fecha_inicio: inicio,
          fecha_fin: fin,
          cita_ids: citasPendientesIds,
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
      success(`Comisiones pagadas correctamente a ${barberoSeleccionado?.full_name || 'especialista'}`)
      setComprobanteUrl('')
      setDescuentoAdelanto(0)
      load()
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Error al procesar pago')
    }
  }

  const editarComision = async (citaId: string, actual: number) => {
    const val = prompt('Nuevo monto de comisión para el barbero en Bs.:', String(actual))
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

  const cambiarPorcentajeBarbero = async (bId: string, bNombre: string, pct: number) => {
    if (!confirm(`¿Actualizar el porcentaje de ${bNombre} a ${pct}% y recalcular sus citas pendientes?`)) return
    setUpdatingBarberoId(bId)
    try {
      const res = await fetch('/api/comisiones/pagos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barbero_id: bId,
          nuevo_porcentaje: pct,
          recalcular_pendientes: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      success(data.mensaje || `Comisión actualizada a ${pct}%`)
      await load()
    } catch (e: any) {
      toastError(e.message || 'Error al cambiar porcentaje')
    } finally {
      setUpdatingBarberoId(null)
    }
  }

  const cambiarPorcentajePersonalizado = async (bId: string, bNombre: string, actual: number) => {
    const val = prompt(`Ingresa el nuevo porcentaje para ${bNombre} (0 - 100):`, String(actual || 45))
    if (val === null) return
    const num = parseFloat(val)
    if (isNaN(num) || num < 0 || num > 100) {
      toastError('Porcentaje inválido')
      return
    }
    cambiarPorcentajeBarbero(bId, bNombre, num)
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
      toastError(e instanceof Error ? e.message : 'Error')
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
    if (!confirm('¿Deseas recalcular las comisiones antiguas que se guardaron en $0.00 automáticamente? El sistema revisará el porcentaje de cada barbero y el precio del servicio.')) return
    
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
      ['Fecha', 'Barbero', 'Servicio', 'Cliente', 'Precio Catálogo', 'Total Cobrado POS', 'Descuento', '% Comisión', 'Comisión Servicio', 'Comisión Productos', 'Gana Barbero', 'Queda Barbería', 'Propina Barbero', 'Estado'],
      ...citas.map((c) => {
        const detallesDesc = parseDescuentoDetalle(c)
        const precio = Number(c.precio) || 0
        const precioServicio = Number(c.servicios?.precio) || precio
        const descuento = Math.max(0, precioServicio - precio)
        const comision = Number(c.comision_barbero) || 0
        const propinaBarbero = (Number(c.propinas) || 0) * 0.5
        const comisionProductos = detallesDesc.comisionProductos
        const baseComisionServicio = Math.max(0, comision - propinaBarbero - comisionProductos)
        const quedaBarberia = Math.max(0, precio - (baseComisionServicio + comisionProductos)) + propinaBarbero
        const baseCalculoPct = precioServicio > 0 ? precioServicio : (precio > 0 ? precio : 1)
        const pct = detallesDesc.esSoloProducto ? 'Fijo (Bs 10/u)' : `${Math.round((baseComisionServicio / baseCalculoPct) * 100)}%`
        const nombreServicio = detallesDesc.esSoloProducto
          ? `Venta Productos${detallesDesc.nombresProductos ? `: ${detallesDesc.nombresProductos}` : ''}`
          : `${c.servicios?.nombre || 'Servicio'}${detallesDesc.nombresProductos ? ` + ${detallesDesc.nombresProductos}` : ''}`

        return [
          new Date(c.fecha_hora).toLocaleDateString('es-BO'),
          c.barbero?.full_name || '',
          nombreServicio,
          c.clientes?.nombre || '',
          String(precioServicio),
          String(precio),
          String(descuento),
          pct,
          String(baseComisionServicio),
          String(comisionProductos),
          String(comision),
          String(quedaBarberia),
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
  const citasPendientes = citas.filter((c: any) => !c.comision_pagada)
  const citasCobradoPendiente = citasPendientes.reduce((sum: number, c: any) => sum + (Number(c.precio) || 0), 0)

  // Desglose de comisiones pendientes: Servicios vs Productos (+Bs 10 c/u)
  let totalComisionProductosPendiente = 0
  citasPendientes.forEach(c => {
    const d = parseDescuentoDetalle(c)
    totalComisionProductosPendiente += d.comisionProductos
  })
  const totalComisionServiciosPendiente = Math.max(0, resumen.pendiente - totalComisionProductosPendiente)

  // Margen de ganancia total que queda para la barbería (cobrado menos comisiones)
  const totalQuedaBarberia = Math.max(0, resumen.total_cobrado - (resumen.pendiente + resumen.pagado))

  const resumenBarberos = (rendimientoBarberos && rendimientoBarberos.length > 0)
    ? rendimientoBarberos
    : barberos.map((b) => {
        const citasB = citas.filter((c: any) => c.barbero_id === b.id)
        const cobrado = citasB.reduce((sum: number, c: any) => sum + (Number(c.precio) || 0), 0)
        const comisionTotal = citasB.reduce((sum: number, c: any) => sum + (Number(c.comision_barbero) || 0), 0)
        const pendientes = citasB.filter((c: any) => !c.comision_pagada)
        const comisionPendiente = pendientes.reduce((sum: number, c: any) => sum + (Number(c.comision_barbero) || 0), 0)
        const cobradoPendiente = pendientes.reduce((sum: number, c: any) => sum + (Number(c.precio) || 0), 0)
        const pctEfectivo = cobrado > 0 ? Math.round((comisionTotal / cobrado) * 100) : (b.comision_porcentaje || 45)

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

  const barberoSeleccionado = barberos.find((b: any) => b.id === barberoId)

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto">
      {/* 1. ENCABEZADO SUPERIOR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/admin')} 
            className="p-3.5 hover:bg-white/10 border border-white/10 bg-zinc-950 rounded-2xl transition-colors"
            title="Volver al panel"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              Control de <span className="text-amber-500">Comisiones</span>
            </h1>
            <p className="text-zinc-400 text-xs mt-1">
              Desglose transparente: lo cobrado en POS, ganancia del barbero y margen para la barbería
            </p>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs h-10 shadow-lg shadow-amber-500/10 uppercase tracking-wider"
            onClick={() => {
              setModalBarberoId(undefined)
              setShowReglasModal(true)
            }}
          >
            <Settings className="w-4 h-4 mr-2" /> Configurar Porcentajes y Reglas
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={exportarCSV} 
            disabled={!citas.length}
            className="text-xs h-10 border-white/10"
          >
            <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            className="text-[11px] h-10 border-white/10 text-zinc-400 hover:text-white" 
            onClick={recalcularHistorico} 
            disabled={isRecalculating}
            title="Recalcular citas históricas en $0.00"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRecalculating ? 'animate-spin' : ''}`} /> 
            Corregir $0.00
          </Button>
        </div>
      </div>

      {/* 2. TARJETAS DE KPIS PRINCIPALES */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-zinc-900 border-white/5">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Total Cobrado (POS)</p>
            <p className="text-2xl font-black text-blue-400 mt-1">{formatCurrency(resumen.total_cobrado)}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Ingreso total en caja</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-white/5 border-l-2 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Comisión Barberos</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{formatCurrency(resumen.pendiente)}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Por liquidar a especialistas</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-white/5 border-l-2 border-l-emerald-500">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Queda para Barbería</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{formatCurrency(totalQuedaBarberia)}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Margen casa del periodo</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-white/5">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Generado Hoy</p>
            <p className="text-2xl font-black text-white mt-1">{formatCurrency(resumen.hoy)}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Comisiones del día</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-white/5">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase text-green-500 tracking-wider">Total Ya Pagado</p>
            <p className="text-2xl font-black text-green-400 mt-1">{formatCurrency(resumen.pagado)}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Historial liquidado</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. TABLA DE RENDIMIENTO Y COMISIONES POR ESPECIALISTA CON BOTONES DE % RÁPIDOS */}
      {barberos.length > 0 && (
        <Card className="bg-zinc-900 border-white/5 shadow-xl">
          <CardHeader className="pb-3 border-b border-white/5 bg-zinc-950/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-white uppercase text-sm flex items-center gap-2">
                  <Users size={16} className="text-amber-500" /> Rendimiento y Liquidación por Especialista
                </CardTitle>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Cambia el % de cada barbero con 1 clic (8h: 40%, 10h: 45%, 11h: 50%) y liquida sus servicios
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[850px]">
                <thead>
                  <tr className="text-zinc-500 uppercase text-[10px] tracking-widest border-b border-white/5 bg-zinc-950/70">
                    <th className="text-left py-3 px-4">Especialista</th>
                    <th className="text-center py-3 px-3">Citas</th>
                    <th className="text-right py-3 px-4">Total Cobrado (POS)</th>
                    <th className="text-right py-3 px-4 text-amber-400 font-bold">Agarra Barbero</th>
                    <th className="text-right py-3 px-4 text-emerald-400 font-bold">Queda Barbería</th>
                    <th className="text-center py-3 px-3">% Comisión (Cambio Rápido)</th>
                    <th className="text-right py-3 px-4">Por Liquidar</th>
                    <th className="text-right py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {resumenBarberos.map((rb) => {
                    const esActivo = barberoId === rb.barbero.id
                    const pctActual = rb.barbero.comision_porcentaje || 45
                    const margenBarberia = Math.max(0, rb.cobrado - rb.comisionTotal)

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
                        <td className="py-3 px-4 text-right font-bold text-blue-400 font-mono">
                          {formatCurrency(rb.cobrado)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-amber-400 font-mono text-sm">
                          {formatCurrency(rb.comisionTotal)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400 font-mono text-sm">
                          {formatCurrency(margenBarberia)}
                        </td>

                        {/* SELECTOR RÁPIDO DE PORCENTAJE (8h: 40%, 10h: 45%, 11h: 50%) */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                              {pctActual}% activo
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {updatingBarberoId === rb.barbero.id ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-bold py-0.5">
                                  <RefreshCw className="w-3 h-3 animate-spin" /> Actualizando...
                                </span>
                              ) : (
                                <>
                                  {[40, 45, 50].map((p) => (
                                    <button
                                      key={p}
                                      type="button"
                                      disabled={updatingBarberoId !== null}
                                      onClick={() => cambiarPorcentajeBarbero(rb.barbero.id, rb.barbero.full_name, p)}
                                      className={`px-2 py-0.5 rounded text-[10px] font-black border transition-all ${
                                        pctActual === p
                                          ? 'bg-amber-500 text-black border-amber-500 shadow-md font-bold'
                                          : 'bg-zinc-950 text-zinc-400 border-white/10 hover:border-amber-500/50 hover:text-white'
                                      }`}
                                      title={`Fijar a ${p}% (${p === 40 ? '8 horas' : p === 45 ? '10 horas' : '11 horas'})`}
                                    >
                                      {p}%
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    disabled={updatingBarberoId !== null}
                                    onClick={() => cambiarPorcentajePersonalizado(rb.barbero.id, rb.barbero.full_name, pctActual)}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-950 text-zinc-400 border border-white/10 hover:text-white hover:border-white/30"
                                    title="Ingresar porcentaje personalizado"
                                  >
                                    ✏️
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-black text-amber-500 text-sm font-mono">
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
                                setModalBarberoId(rb.barbero.id)
                                setShowReglasModal(true)
                              }}
                              title="Configurar comisión por porcentaje o por servicio"
                            >
                              <Settings className="w-3.5 h-3.5 mr-1" /> Reglas %
                            </Button>
                            <Button
                              variant={esActivo ? 'primary' : 'outline'}
                              size="sm"
                              type="button"
                              className="h-8 text-xs font-bold"
                              onClick={() => {
                                setBarberoId(rb.barbero.id)
                                setEstado('pendiente')
                              }}
                            >
                              {esActivo ? '✓ Seleccionado' : 'Liquidar'}
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

      {/* 4. FILTROS Y PANEL DE LIQUIDACIÓN / PAGO */}
      <Card className="bg-zinc-900 border-white/5">
        <CardHeader className="pb-3 border-b border-white/5">
          <CardTitle className="text-white uppercase text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><Filter size={16} /> Filtros de Auditoría y Liquidación</span>
            {barberoId && (
              <span className="text-xs text-amber-400 font-bold normal-case">
                Especialista seleccionado: {barberoSeleccionado?.full_name}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <select 
              className="h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white font-bold text-xs" 
              value={barberoId} 
              onChange={(e) => setBarberoId(e.target.value)}
            >
              <option value="">Todos los barberos y especialistas</option>
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
                  setModalBarberoId(barberoId)
                  setShowReglasModal(true)
                }}
              >
                <Settings className="w-4 h-4 mr-2" /> Reglas de {barberoSeleccionado?.full_name?.split(' ')[0]}
              </Button>
            )}

            <select className="h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white text-xs font-bold" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="pendiente">Solo Pendientes de Pago</option>
              <option value="pagada">Solo Pagadas</option>
              <option value="todas">Todas las citas</option>
            </select>

            <select className="h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white text-xs font-bold" value={periodo} onChange={(e) => setPeriodo(e.target.value as any)}>
              <option value="todas">Todas las pendientes (Recomendado)</option>
              <option value="diario">Solo de hoy (Diario)</option>
              <option value="semanal">Esta semana</option>
              <option value="personalizado">Rango personalizado</option>
            </select>

            {periodo === 'personalizado' && (
              <div className="flex items-center gap-2 bg-zinc-950 border border-white/10 rounded-xl px-3 h-12">
                <input
                  type="date"
                  value={fechaInicioCustom}
                  onChange={(e) => setFechaInicioCustom(e.target.value)}
                  className="bg-transparent text-white text-xs font-mono outline-none"
                  title="Fecha inicio"
                />
                <span className="text-zinc-500 text-xs">a</span>
                <input
                  type="date"
                  value={fechaFinCustom}
                  onChange={(e) => setFechaFinCustom(e.target.value)}
                  className="bg-transparent text-white text-xs font-mono outline-none"
                  title="Fecha fin"
                />
              </div>
            )}

            <select className="h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white uppercase text-xs font-bold" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="qr">QR / Transferencia</option>
              <option value="mixto">Mixto (Efec. + QR)</option>
              <option value="tarjeta">Tarjeta</option>
            </select>

            {barberoId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBarberoId('')}
                className="h-12 text-xs border-white/10 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4 mr-1" /> Quitar filtro
              </Button>
            )}
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

          {/* CAJA DE LIQUIDACIÓN (CUANDO SE FILTRA UN BARBERO) */}
          {barberoId && estado === 'pendiente' && (
            <div className="p-5 rounded-2xl border border-amber-500/30 bg-black/60 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                  <DollarSign size={16} /> Resumen Financiero para Liquidar a {barberoSeleccionado?.full_name}
                </h3>
                <span className="text-xs text-zinc-400 font-mono">
                  {citas.filter((c: any) => !c.comision_pagada).length} citas pendientes de pago
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                <div>
                  <span className="block text-zinc-400 mb-1 text-xs">Total Cobrado (POS)</span>
                  <span className="font-bold text-blue-400 text-lg">{formatCurrency(citasCobradoPendiente)}</span>
                  <span className="text-[10px] text-zinc-500 block">En caja a liquidar</span>
                </div>
                <div>
                  <span className="block text-zinc-400 mb-1 text-xs">Comisión Servicios</span>
                  <span className="font-bold text-amber-400 text-lg">{formatCurrency(totalComisionServiciosPendiente)}</span>
                  <span className="text-[10px] text-zinc-500 block">Cortes y combos</span>
                </div>
                <div>
                  <span className="block text-zinc-400 mb-1 text-xs text-cyan-400 font-bold">Comisión Productos</span>
                  <span className="font-bold text-cyan-400 text-lg">+{formatCurrency(totalComisionProductosPendiente)}</span>
                  <span className="text-[10px] text-zinc-500 block">Bs 10 por unidad</span>
                </div>
                <div>
                  <span className="block text-zinc-400 mb-1 text-xs">Deuda por Adelantos</span>
                  <span className="font-bold text-red-400 text-lg">{formatCurrency(finanzas.saldo_adelantos)}</span>
                  <span className="text-[10px] text-zinc-500 block">Saldo pendiente</span>
                </div>
                <div>
                  <span className="block text-zinc-400 mb-1 text-xs flex items-center gap-2">
                    Sanciones (se restan)
                    <button onClick={() => setShowSancionesModal(true)} className="text-blue-400 hover:text-blue-300">
                      <Edit className="w-3 h-3" />
                    </button>
                  </span>
                  <span className="font-bold text-red-400 text-lg cursor-pointer" onClick={() => setShowSancionesModal(true)}>
                    -{formatCurrency(finanzas.total_sanciones)} ({finanzas.sanciones_pendientes.length})
                  </span>
                </div>
                <div>
                  <span className="block text-zinc-400 mb-1 text-xs">Bonos (se suman)</span>
                  <span className="font-bold text-green-400 text-lg">+{formatCurrency(finanzas.total_bonos)}</span>
                </div>
              </div>

              {(metodoPago === 'qr' || metodoPago === 'mixto' || metodoPago === 'tarjeta') && (
                <div className="pt-2">
                  <ImageUpload
                    label="Comprobante de Pago (Opcional)"
                    defaultImage={comprobanteUrl || undefined}
                    onUploadSuccess={(url) => setComprobanteUrl(url)}
                    onUploadError={(err) => toastError(err)}
                  />
                </div>
              )}
              
              <div className="flex flex-col md:flex-row items-center gap-4 pt-4 border-t border-white/10">
                <div className="flex-1 w-full sm:w-auto">
                  <label className="block text-xs text-zinc-400 mb-1">
                    Descontar de adelanto hoy (Máximo: {formatCurrency(finanzas.saldo_adelantos)}):
                  </label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      max={finanzas.saldo_adelantos} 
                      min={0} 
                      value={descuentoAdelanto} 
                      onChange={(e) => setDescuentoAdelanto(Math.min(finanzas.saldo_adelantos, Number(e.target.value) || 0))} 
                      className="max-w-[200px] h-11"
                    />
                    <span className="text-xs text-zinc-500">Bs.</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Total Neto a Entregar</p>
                  <p className={`text-3xl font-black ${totalCalculado < 0 ? 'text-red-500' : 'text-amber-400'}`}>
                    {formatCurrency(totalCalculado)}
                  </p>
                </div>
                <Button 
                  variant="primary" 
                  onClick={marcarPagadas} 
                  disabled={!barberoId || estado !== 'pendiente' || citas.filter((c: any) => !c.comision_pagada).length === 0} 
                  className="h-12 px-8 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider text-xs shadow-lg shadow-amber-500/20"
                >
                  <CheckCircle className="w-5 h-5 mr-2" /> Pagar Comisiones ({formatCurrency(totalCalculado)})
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. TABLA COMPLETA DE DETALLE DE CITAS Y SERVICIOS (TODO VISIBLE EN PANTALLA) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Scissors className="w-5 h-5 text-amber-500" /> Detalle de Servicios ({citas.length} citas registradas)
          </h2>
          <span className="text-xs text-zinc-400">
            Desglose completo: cobrado en POS, ganancia del barbero y margen para la barbería
          </span>
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="text-zinc-500 uppercase text-[10px] tracking-widest border-b border-white/5 bg-zinc-950/70">
                  <th className="text-left py-3.5 px-4">Fecha</th>
                  <th className="text-left py-3.5 px-4">Barbero</th>
                  <th className="text-left py-3.5 px-4">Servicio</th>
                  <th className="text-left py-3.5 px-4">Cliente</th>
                  <th className="text-right py-3.5 px-4">
                    Precio Servicio
                    <span className="block text-[9px] text-zinc-500 font-normal lowercase tracking-normal">catálogo</span>
                  </th>
                  <th className="text-right py-3.5 px-4 text-blue-400">
                    Total Cobrado
                    <span className="block text-[9px] text-blue-400/80 font-normal lowercase tracking-normal">en pos</span>
                  </th>
                  <th className="text-center py-3.5 px-4">% Comisión</th>
                  <th className="text-right py-3.5 px-4 text-amber-400">
                    Agarra Barbero
                    <span className="block text-[9px] text-amber-500/80 font-normal lowercase tracking-normal">comisión barbero</span>
                  </th>
                  <th className="text-right py-3.5 px-4 text-emerald-400">
                    Queda Barbería
                    <span className="block text-[9px] text-emerald-400/80 font-normal lowercase tracking-normal">margen casa</span>
                  </th>
                  <th className="text-right py-3.5 px-4">Estado</th>
                  <th className="text-right py-3.5 px-4">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={11} className="py-16 text-center text-zinc-500 font-bold text-xs uppercase tracking-wider">Cargando servicios...</td></tr>
                ) : citas.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-20 text-center">
                      <Scissors className="w-12 h-12 mx-auto text-zinc-700 mb-3 opacity-40" />
                      <p className="text-zinc-400 font-bold text-sm">No se encontraron citas con los filtros seleccionados.</p>
                    </td>
                  </tr>
                ) : citas.map((c) => {
                  const precioCobrado = Number(c.precio) || 0
                  const precioServicio = Number(c.servicios?.precio) || precioCobrado
                  const hayDescuento = precioServicio > precioCobrado
                  const montoDescuento = Math.max(0, precioServicio - precioCobrado)

                  const comision = Number(c.comision_barbero) || 0
                  const propinaTotal = Number(c.propinas) || 0
                  const propinaBarbero = propinaTotal * 0.5
                  const propinaBarberia = propinaTotal * 0.5

                  const detallesDesc = parseDescuentoDetalle(c)
                  const comisionProductos = detallesDesc.comisionProductos
                  const comisionBaseBarbero = Math.max(0, comision - propinaBarbero)
                  const comisionServicio = Math.max(0, comisionBaseBarbero - comisionProductos)

                  // Lo que agarra el barbero
                  const agarraBarbero = comision

                  // Lo que le queda a la barbería
                  const quedaBarberia = Math.max(0, precioCobrado - (comisionServicio + comisionProductos)) + propinaBarberia

                  const esFija = c.servicios?.comision_tipo === 'fija'

                  // El porcentaje SIEMPRE se calcula sobre el precio oficial del servicio/corte (sin inflar por productos)
                  const baseCalculoPct = precioServicio > 0 ? precioServicio : (precioCobrado > 0 ? precioCobrado : 1)
                  const pct = detallesDesc.esSoloProducto ? 0 : Math.round((comisionServicio / baseCalculoPct) * 100)

                  return (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 text-zinc-400 whitespace-nowrap font-mono text-xs">
                        {new Date(c.fecha_hora).toLocaleDateString('es-BO')}
                      </td>
                      <td className="py-3 px-4 text-white font-bold">{c.barbero?.full_name}</td>
                      <td className="py-3 px-4 text-zinc-200">
                        <div className="font-semibold">
                          {detallesDesc.esSoloProducto ? (
                            <span className="text-cyan-400 flex items-center gap-1.5 font-bold">
                              🛍️ Venta de Productos
                            </span>
                          ) : (
                            c.servicios?.nombre || 'Servicio'
                          )}
                        </div>
                        {detallesDesc.nombresProductos && (
                          <span className="text-[10px] text-cyan-400/90 font-mono block">
                            + {detallesDesc.nombresProductos}
                          </span>
                        )}
                        {c.comision_categoria && (
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                            Cat: {c.comision_categoria}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">{c.clientes?.nombre || '—'}</td>
                      
                      {/* PRECIO ORIGINAL DEL SERVICIO (CATÁLOGO) */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="font-semibold text-zinc-400">
                          {formatCurrency(precioServicio)}
                        </span>
                      </td>

                      {/* PRECIO REAL COBRADO */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {detallesDesc.esGratis || precioCobrado === 0 ? (
                          <div>
                            <span className="font-bold text-emerald-400">Bs 0.00</span>
                            <span className="block text-[10px] text-red-400 font-mono">
                              (-{formatCurrency(precioServicio)})
                            </span>
                          </div>
                        ) : hayDescuento ? (
                          <div>
                            <span className="font-bold text-white">{formatCurrency(precioCobrado)}</span>
                            <span className="block text-[10px] text-red-400 font-mono">
                              (-{formatCurrency(montoDescuento)})
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold text-white">{formatCurrency(precioCobrado)}</span>
                        )}
                      </td>
                      
                      {/* % COMISION */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {detallesDesc.esSoloProducto ? (
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                              Bs 10 / prod.
                            </span>
                            <span className="block text-[9px] text-zinc-500 font-mono mt-0.5">comisión fija</span>
                          </div>
                        ) : esFija ? (
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
                              Fijo
                            </span>
                            <span className="block text-[9px] text-zinc-500 font-mono mt-0.5">monto fijo</span>
                          </div>
                        ) : pct > 0 ? (
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                              {pct}%
                            </span>
                            {hayDescuento && (
                              <span className="block text-[9px] text-emerald-400/90 font-mono mt-0.5">
                                s/ servicio
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                            0%
                          </span>
                        )}
                        {detallesDesc.badges.map((b, i) => (
                          <span key={i} className={`block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 border ${b.color}`}>
                            {b.text}
                          </span>
                        ))}
                      </td>

                      {/* LO QUE AGARRA EL BARBERO */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className={`font-black text-base ${agarraBarbero > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
                          {formatCurrency(agarraBarbero)}
                        </span>
                        {detallesDesc.esSoloProducto ? (
                          <span className="block text-[10px] text-cyan-400 font-mono">
                            ({detallesDesc.unidadesProductos}x a Bs 10 c/u)
                          </span>
                        ) : esFija ? (
                          <span className="block text-[10px] text-zinc-400 font-mono">
                            (Fijo {formatCurrency(comisionServicio)}{comisionProductos > 0 ? ` + Bs ${comisionProductos} prod.` : ''})
                          </span>
                        ) : hayDescuento ? (
                          <div>
                            <span className="block text-[10px] text-zinc-400 font-mono">
                              ({pct}% de {formatCurrency(precioServicio)}{comisionProductos > 0 ? ` + Bs ${comisionProductos} prod.` : ''})
                            </span>
                            {detallesDesc.asume === 'barberia' && (
                              <span className="block text-[9px] text-emerald-400 font-bold">
                                Barbería asume desc.
                              </span>
                            )}
                          </div>
                        ) : precioCobrado > 0 ? (
                          <span className="block text-[10px] text-zinc-400 font-mono">
                            ({pct}% de {formatCurrency(precioServicio)}{comisionProductos > 0 ? ` + Bs ${comisionProductos} prod.` : ''})
                          </span>
                        ) : (
                          <span className="block text-[10px] text-zinc-600 font-mono">
                            (Sin cobro)
                          </span>
                        )}
                        {propinaBarbero > 0 && (
                          <span className="block text-[10px] text-green-400 font-mono">
                            +{formatCurrency(propinaBarbero)} propina
                          </span>
                        )}
                      </td>

                      {/* LO QUE LE QUEDA A LA BARBERÍA */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className={`font-black text-base ${quedaBarberia > 0 ? 'text-emerald-400' : 'text-zinc-600'}`}>
                          {formatCurrency(quedaBarberia)}
                        </span>
                        {hayDescuento ? (
                          <div>
                            <span className="block text-[10px] text-zinc-400 font-mono">
                              ({formatCurrency(precioCobrado)} cobrado - {formatCurrency(comisionBaseBarbero)})
                            </span>
                            {detallesDesc.asume === 'barberia' && (
                              <span className="block text-[9px] text-amber-400 font-mono font-bold">
                                Asume -{formatCurrency(montoDescuento)}
                              </span>
                            )}
                          </div>
                        ) : precioCobrado > 0 ? (
                          <span className="block text-[10px] text-zinc-400 font-mono">
                            ({Math.max(0, 100 - pct)}% margen)
                          </span>
                        ) : (
                          <span className="block text-[10px] text-zinc-600 font-mono">
                            (Bs 0.00)
                          </span>
                        )}
                        {propinaBarberia > 0 && (
                          <span className="block text-[10px] text-green-400 font-mono">
                            +{formatCurrency(propinaBarberia)} propina
                          </span>
                        )}
                      </td>

                      {/* ESTADO */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Badge variant={c.comision_pagada ? 'success' : 'warning'}>
                          {c.comision_pagada ? 'Pagada' : 'Pendiente'}
                        </Badge>
                      </td>

                      {/* ACCION */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {!c.comision_pagada && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => editarComision(c.id, c.comision_barbero || 0)} 
                            title="Ajustar monto manual de comisión del barbero"
                            className="h-8 px-2 border-white/10 hover:border-amber-500"
                          >
                            <Edit className="w-3.5 h-3.5 text-zinc-300" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. HISTORIAL DE PAGOS */}
      {pagos.length > 0 && (
        <Card className="bg-zinc-900 border-white/5">
          <CardHeader className="pb-3 border-b border-white/5">
            <CardTitle className="text-white uppercase text-sm flex items-center gap-2">
              <DollarSign size={16} className="text-amber-500" /> Historial de Liquidaciones Anteriores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-3">
            {pagos.slice(0, 15).map((p: any) => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-white/5 text-sm gap-2">
                <div>
                  <span className="font-bold text-white">{p.barbero?.full_name}</span>
                  <span className="text-zinc-400 text-xs ml-2 font-mono">
                    — {p.periodo_tipo} ({p.fecha_inicio} → {p.fecha_fin})
                  </span>
                  {p.notas && <p className="text-zinc-500 text-xs mt-0.5">{p.notas}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">{p.metodo_pago}</Badge>
                  <span className="font-black text-green-400 font-mono text-base">{formatCurrency(p.monto_total)}</span>
                  {p.comprobante_url && (
                    <a 
                      href={p.comprobante_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                      title="Ver comprobante"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* MODAL DE REGLAS GENERALES Y PORCENTAJES */}
      <ReglasComisionesModal
        isOpen={showReglasModal}
        onClose={() => setShowReglasModal(false)}
        barberoIdInicial={modalBarberoId}
        onSaved={() => load()}
      />

      {/* MODAL DE SANCIONES */}
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
                      <p className="font-bold text-white text-sm">{s.tipo}</p>
                      {s.descripcion && <p className="text-xs text-zinc-400">{s.descripcion}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-red-400">-{formatCurrency(s.monto)}</span>
                      <button onClick={() => eliminarSancion(s.id)} className="text-zinc-500 hover:text-red-400">
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
    </div>
  )
}
