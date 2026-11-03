'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
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
  Check,
  FileText,
  ChevronRight,
  Wallet,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import ReglasComisionesModal from '@/components/comisiones/ReglasComisionesModal'

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

  // Navegación por pestañas principales para UX clara y organizada
  const [activeTab, setActiveTab] = useState<'liquidar' | 'citas' | 'historial'>('liquidar')

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

  // Modal de liquidación enfocado por especialista
  const [showLiquidarModal, setShowLiquidarModal] = useState(false)
  const [barberoALiquidar, setBarberoALiquidar] = useState<any>(null)
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

  // Abrir modal de liquidación enfocada para un barbero específico
  const abrirLiquidacion = (b: any) => {
    setBarberoALiquidar(b)
    setBarberoId(b.id)
    setEstado('pendiente')
    setMetodoPago('efectivo')
    setPagoEfectivo(0)
    setPagoQr(0)
    setComprobanteUrl('')
    setDescuentoAdelanto(0)
    setShowLiquidarModal(true)
  }

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
      setShowLiquidarModal(false)
      setComprobanteUrl('')
      setDescuentoAdelanto(0)
      load()
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Error al procesar pago')
    }
  }

  const editarComision = async (citaId: string, actual: number) => {
    const val = prompt('Nuevo monto de comisión en Bs.:', String(actual))
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
      ['Fecha', 'Barbero', 'Servicio', 'Cliente', 'Precio Catálogo', 'Total Cobrado POS', 'Descuento', '% Comisión', 'Comisión Barbero', 'Propina Barbero', 'Estado'],
      ...citas.map((c) => {
        const precio = Number(c.precio) || 0
        const precioServicio = Number(c.servicios?.precio) || precio
        const descuento = Math.max(0, precioServicio - precio)
        const comision = Number(c.comision_barbero) || 0
        const propinaBarbero = (Number(c.propinas) || 0) * 0.5
        const baseComision = Math.max(0, comision - propinaBarbero)
        const pct = precio > 0 ? `${Math.round((baseComision / precio) * 100)}%` : '0%'
        return [
          new Date(c.fecha_hora).toLocaleDateString('es-BO'),
          c.barbero?.full_name || '',
          c.servicios?.nombre || '',
          c.clientes?.nombre || '',
          String(precioServicio),
          String(precio),
          String(descuento),
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

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* HEADER SUPERIOR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/admin')} 
            className="p-3.5 hover:bg-white/10 border border-white/10 bg-zinc-950 rounded-2xl transition-colors"
            title="Volver al panel principal"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              Control de <span className="text-amber-500">Comisiones</span>
            </h1>
            <p className="text-zinc-400 text-xs mt-1">
              Liquidaciones por barbero, escalas por horas y auditoría de servicios
            </p>
          </div>
        </div>

        {/* Acciones principales de cabecera */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-black font-bold text-xs h-10"
            onClick={() => {
              setModalBarberoId(undefined)
              setShowReglasModal(true)
            }}
          >
            <Settings className="w-4 h-4 mr-2" /> Configurar Reglas %
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={exportarCSV} 
            disabled={!citas.length}
            className="text-xs h-10 border-white/10"
          >
            <Download className="w-4 h-4 mr-1.5" /> CSV
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            className="text-[11px] h-10 border-white/10 text-zinc-400 hover:text-white" 
            onClick={recalcularHistorico} 
            disabled={isRecalculating}
            title="Recalcular citas antiguas en $0.00"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRecalculating ? 'animate-spin' : ''}`} /> 
            Corregir $0.00
          </Button>
        </div>
      </div>

      {/* PESTAÑAS PRINCIPALES (UX CLARA Y ENFOCADA) */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-1">
        <button
          onClick={() => {
            setActiveTab('liquidar')
            setBarberoId('')
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
            activeTab === 'liquidar'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Wallet className="w-4 h-4" />
          1. Liquidar a Especialistas
          {resumen.pendiente > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${activeTab === 'liquidar' ? 'bg-black text-amber-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {formatCurrency(resumen.pendiente)}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('citas')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
            activeTab === 'citas'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Scissors className="w-4 h-4" />
          2. Detalle de Citas ({citas.length})
        </button>

        <button
          onClick={() => setActiveTab('historial')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
            activeTab === 'historial'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText className="w-4 h-4" />
          3. Historial de Pagos ({pagos.length})
        </button>
      </div>

      {/* ============================================================== */}
      {/* PESTAÑA 1: LIQUIDAR A ESPECIALISTAS (FLUJO PRINCIPAL DIARIO)   */}
      {/* ============================================================== */}
      {activeTab === 'liquidar' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Filtros de período rápido y Resumen KPI */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-400 mr-2 uppercase tracking-wider">Periodo:</span>
              <button
                onClick={() => setPeriodo('todas')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  periodo === 'todas'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white border border-white/10'
                }`}
              >
                ⚡ Todo lo pendiente
              </button>
              <button
                onClick={() => setPeriodo('diario')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  periodo === 'diario'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white border border-white/10'
                }`}
              >
                📅 Solo Hoy
              </button>
              <button
                onClick={() => setPeriodo('semanal')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  periodo === 'semanal'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white border border-white/10'
                }`}
              >
                🗓️ Esta Semana
              </button>
            </div>

            {/* KPIs compactos */}
            <div className="flex items-center gap-6 text-right">
              <div>
                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total Cobrado en POS</p>
                <p className="text-lg font-black text-blue-400">{formatCurrency(resumen.total_cobrado)}</p>
              </div>
              <div className="border-l border-white/10 pl-6">
                <p className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Por Liquidar a Barberos</p>
                <p className="text-xl font-black text-amber-400">{formatCurrency(resumen.pendiente)}</p>
              </div>
            </div>
          </div>

          {/* Grid de Cards de Especialistas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resumenBarberos.map((rb) => {
              const tienePendientes = rb.citasPendientes > 0 || rb.comisionPendiente > 0
              const pctActual = rb.barbero.comision_porcentaje || 45

              return (
                <div
                  key={rb.barbero.id}
                  className={`bg-zinc-900 border rounded-2xl p-5 flex flex-col justify-between transition-all relative overflow-hidden group ${
                    tienePendientes ? 'border-amber-500/30 hover:border-amber-500' : 'border-white/5 opacity-85 hover:opacity-100'
                  }`}
                >
                  {/* Encabezado del Barbero */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center font-black text-white text-lg overflow-hidden shrink-0">
                          {rb.barbero.avatar_url ? (
                            <img src={rb.barbero.avatar_url} alt={rb.barbero.full_name} className="w-full h-full object-cover" />
                          ) : (
                            rb.barbero.full_name?.charAt(0) || 'B'
                          )}
                        </div>
                        <div>
                          <h3 className="font-black text-white text-base leading-tight group-hover:text-amber-400 transition-colors">
                            {rb.barbero.full_name}
                          </h3>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-mono mt-1">
                            {rb.barbero.role}
                          </Badge>
                        </div>
                      </div>

                      {tienePendientes ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                          {rb.citasPendientes} pend.
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ✓ Al día
                        </span>
                      )}
                    </div>

                    {/* Métricas clave */}
                    <div className="grid grid-cols-2 gap-3 bg-zinc-950/70 p-3.5 rounded-xl border border-white/5 mb-4">
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider block">Cobrado POS</span>
                        <span className="text-base font-bold text-blue-400">{formatCurrency(rb.cobrado)}</span>
                        <span className="text-[10px] text-zinc-500 block font-mono mt-0.5">{rb.totalCitas} citas</span>
                      </div>
                      <div className="border-l border-white/5 pl-3">
                        <span className="text-[10px] text-amber-500 uppercase font-black tracking-wider block">Comisión Pendiente</span>
                        <span className="text-xl font-black text-amber-400">{formatCurrency(rb.comisionPendiente)}</span>
                        <span className="text-[10px] text-zinc-500 block font-mono mt-0.5">ganancia barbero</span>
                      </div>
                    </div>

                    {/* Selector de Porcentaje Rápido por Horario */}
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">
                          % Comisión Actual:
                        </span>
                        <span className="text-xs font-black text-amber-400 font-mono">
                          {pctActual}%
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {updatingBarberoId === rb.barbero.id ? (
                          <div className="w-full flex items-center justify-center gap-2 py-1 text-xs text-amber-400 font-bold">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Actualizando citas...
                          </div>
                        ) : (
                          <>
                            {[40, 45, 50].map((p) => (
                              <button
                                key={p}
                                type="button"
                                disabled={updatingBarberoId !== null}
                                onClick={() => cambiarPorcentajeBarbero(rb.barbero.id, rb.barbero.full_name, p)}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black border transition-all ${
                                  pctActual === p
                                    ? 'bg-amber-500 text-black border-amber-500 shadow-md font-bold'
                                    : 'bg-zinc-950 text-zinc-400 border-white/10 hover:border-amber-500/50 hover:text-white'
                                }`}
                                title={`Asignar ${p}% (${p === 40 ? 'Turno 8h' : p === 45 ? 'Turno 10h' : 'Turno 11h'})`}
                              >
                                {p}% <span className="text-[8px] font-normal opacity-70">({p === 40 ? '8h' : p === 45 ? '10h' : '11h'})</span>
                              </button>
                            ))}
                            <button
                              type="button"
                              disabled={updatingBarberoId !== null}
                              onClick={() => cambiarPorcentajePersonalizado(rb.barbero.id, rb.barbero.full_name, pctActual)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-zinc-950 text-zinc-400 border border-white/10 hover:text-white hover:border-white/30"
                              title="Porcentaje personalizado"
                            >
                              ✏️
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones de la Card */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                    {tienePendientes ? (
                      <Button
                        variant="primary"
                        onClick={() => abrirLiquidacion(rb.barbero)}
                        className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider text-xs shadow-lg shadow-amber-500/10"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" /> Liquidar {formatCurrency(rb.comisionPendiente)}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        disabled
                        className="w-full h-11 border-white/5 text-zinc-500 text-xs uppercase font-bold"
                      >
                        ✓ Sin comisiones pendientes
                      </Button>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBarberoId(rb.barbero.id)
                          setActiveTab('citas')
                        }}
                        className="flex-1 h-8 text-[10px] uppercase font-bold border-white/5 hover:border-white/20 text-zinc-400 hover:text-white"
                      >
                        Ver Citas ({rb.citasPendientes})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setModalBarberoId(rb.barbero.id)
                          setShowReglasModal(true)
                        }}
                        className="h-8 text-[10px] uppercase font-bold border-white/5 hover:border-amber-500/30 text-zinc-400 hover:text-amber-400 px-2.5"
                        title="Configurar reglas especiales para este barbero"
                      >
                        <Settings className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PESTAÑA 2: DETALLE DE CITAS Y SERVICIOS (AUDITORÍA COMPLETA)   */}
      {/* ============================================================== */}
      {activeTab === 'citas' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Barra de Filtros de la Tabla */}
          <div className="flex flex-wrap items-center gap-3 bg-zinc-900 p-4 rounded-2xl border border-white/5">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1 tracking-wider">Especialista</label>
              <select 
                className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-white font-bold text-xs" 
                value={barberoId} 
                onChange={(e) => setBarberoId(e.target.value)}
              >
                <option value="">Todos los especialistas</option>
                {barberos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.full_name} ({b.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="w-[160px]">
              <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1 tracking-wider">Estado de Pago</label>
              <select 
                className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-white text-xs font-bold" 
                value={estado} 
                onChange={(e) => setEstado(e.target.value)}
              >
                <option value="pendiente">Solo Pendientes</option>
                <option value="pagada">Solo Pagadas</option>
                <option value="todas">Todas las citas</option>
              </select>
            </div>

            <div className="w-[180px]">
              <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1 tracking-wider">Rango de Fecha</label>
              <select 
                className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-white text-xs font-bold" 
                value={periodo} 
                onChange={(e) => setPeriodo(e.target.value as any)}
              >
                <option value="todas">Todas las fechas</option>
                <option value="diario">Solo de hoy</option>
                <option value="semanal">Esta semana</option>
                <option value="personalizado">Personalizado...</option>
              </select>
            </div>

            {periodo === 'personalizado' && (
              <div className="flex items-end gap-2">
                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Desde</label>
                  <input
                    type="date"
                    value={fechaInicioCustom}
                    onChange={(e) => setFechaInicioCustom(e.target.value)}
                    className="h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={fechaFinCustom}
                    onChange={(e) => setFechaFinCustom(e.target.value)}
                    className="h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 text-white text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {barberoId && (
              <div className="self-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBarberoId('')}
                  className="h-11 text-xs border-white/10 text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Quitar filtro
                </Button>
              </div>
            )}
          </div>

          {/* Tabla de Detalle */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm min-w-[960px]">
                <thead>
                  <tr className="text-zinc-500 uppercase text-[10px] tracking-widest border-b border-white/5 bg-zinc-950/60">
                    <th className="text-left py-3.5 px-4">Fecha</th>
                    <th className="text-left py-3.5 px-4">Barbero</th>
                    <th className="text-left py-3.5 px-4">Servicio</th>
                    <th className="text-left py-3.5 px-4">Cliente</th>
                    <th className="text-right py-3.5 px-4">
                      Precio Servicio
                      <span className="block text-[9px] text-zinc-500 font-normal lowercase tracking-normal">catálogo</span>
                    </th>
                    <th className="text-right py-3.5 px-4 text-amber-400">
                      Total Cobrado
                      <span className="block text-[9px] text-amber-500/80 font-normal lowercase tracking-normal">en pos</span>
                    </th>
                    <th className="text-center py-3.5 px-4">% Comisión</th>
                    <th className="text-right py-3.5 px-4">Comisión Barbero</th>
                    <th className="text-right py-3.5 px-4">Estado</th>
                    <th className="text-right py-3.5 px-4">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr><td colSpan={10} className="py-16 text-center text-zinc-500 font-bold text-xs uppercase tracking-wider">Cargando citas...</td></tr>
                  ) : citas.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-20 text-center">
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
                    const propinaBarbero = (Number(c.propinas) || 0) * 0.5
                    const comisionServicioBase = Math.max(0, comision - propinaBarbero)
                    const pct = precioCobrado > 0 ? Math.round((comisionServicioBase / precioCobrado) * 100) : 0
                    const esFija = c.servicios?.comision_tipo === 'fija'
                    const detallesDesc = parseDescuentoDetalle(c)

                    return (
                      <tr key={c.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 text-zinc-400 whitespace-nowrap font-mono text-xs">
                          {new Date(c.fecha_hora).toLocaleDateString('es-BO')}
                        </td>
                        <td className="py-3 px-4 text-white font-bold">{c.barbero?.full_name}</td>
                        <td className="py-3 px-4 text-zinc-200">
                          <div className="font-semibold">{c.servicios?.nombre || 'Servicio'}</div>
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
                          {precioCobrado > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
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

                        {/* COMISION BARBERO */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className={`font-black text-base ${comision > 0 ? 'text-amber-500' : 'text-zinc-600'}`}>
                            {formatCurrency(comision)}
                          </span>
                          {esFija ? (
                            <span className="block text-[10px] text-zinc-400 font-mono">
                              (Fijo {formatCurrency(comision)})
                            </span>
                          ) : precioCobrado > 0 ? (
                            <span className="block text-[10px] text-zinc-400 font-mono">
                              ({pct}% de {formatCurrency(precioCobrado)})
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
                              title="Ajustar monto manual de comisión"
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
      )}

      {/* ============================================================== */}
      {/* PESTAÑA 3: HISTORIAL DE LIQUIDACIONES                          */}
      {/* ============================================================== */}
      {activeTab === 'historial' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <Card className="bg-zinc-900 border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-white uppercase text-sm flex items-center gap-2">
                <FileText size={16} className="text-amber-500" /> Registro Contable de Liquidaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pagos.length === 0 ? (
                <div className="py-16 text-center text-zinc-500 font-bold text-xs uppercase">
                  No hay pagos registrados aún.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {pagos.map((p) => (
                    <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/5 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-base">{p.barbero?.full_name || 'Especialista'}</span>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {p.metodo_pago}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1 font-mono">
                          Periodo: {p.fecha_inicio} → {p.fecha_fin} • Registrado el {new Date(p.created_at).toLocaleDateString('es-BO')}
                        </p>
                        {p.notas && (
                          <p className="text-xs text-zinc-500 mt-0.5">{p.notas}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] uppercase text-zinc-500 block font-bold">Monto Liquidado</span>
                          <span className="text-xl font-black text-emerald-400 font-mono">{formatCurrency(p.monto_total)}</span>
                        </div>

                        {p.comprobante_url && (
                          <a 
                            href={p.comprobante_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-xl bg-zinc-950 border border-white/10 hover:border-amber-500/50 text-zinc-400 hover:text-white transition-colors"
                            title="Ver comprobante adjunto"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL DE LIQUIDACIÓN ENFOCADA (STEP-BY-STEP CHECKOUT)          */}
      {/* ============================================================== */}
      <Modal
        isOpen={showLiquidarModal}
        onClose={() => setShowLiquidarModal(false)}
        title={
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-amber-500" />
            <span>Liquidar a <span className="text-amber-500">{barberoALiquidar?.full_name}</span></span>
          </div>
        }
        subtitle="Revisa el desglose de comisiones, aplica deducciones o adelantos y confirma el pago."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6 pt-2">
          {/* Desglose Contable */}
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
              <span className="text-zinc-400">Total cobrado al cliente (en citas):</span>
              <span className="font-bold text-blue-400">{formatCurrency(citasCobradoPendiente)}</span>
            </div>

            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
              <span className="text-white font-bold">Comisión bruta por servicios:</span>
              <span className="font-bold text-amber-400 text-base">+{formatCurrency(resumen.pendiente)}</span>
            </div>

            {finanzas.total_bonos > 0 && (
              <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                <span className="text-green-400">Bonos adicionales a favor:</span>
                <span className="font-bold text-green-400">+{formatCurrency(finanzas.total_bonos)}</span>
              </div>
            )}

            {finanzas.total_sanciones > 0 && (
              <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                <span className="text-red-400 flex items-center gap-1.5">
                  Sanciones pendientes:
                  <button onClick={() => setShowSancionesModal(true)} className="text-blue-400 hover:underline text-xs">
                    (ver detalles)
                  </button>
                </span>
                <span className="font-bold text-red-400">-{formatCurrency(finanzas.total_sanciones)}</span>
              </div>
            )}

            {finanzas.saldo_adelantos > 0 && (
              <div className="pt-2">
                <div className="flex justify-between items-center text-xs text-zinc-400 mb-1">
                  <span>Deuda previa por adelantos recibidos:</span>
                  <span className="font-bold text-red-400">{formatCurrency(finanzas.saldo_adelantos)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-zinc-300 font-bold shrink-0">Descontar de adelanto hoy:</label>
                  <Input 
                    type="number" 
                    max={finanzas.saldo_adelantos} 
                    min={0} 
                    value={descuentoAdelanto} 
                    onChange={(e) => setDescuentoAdelanto(Math.min(finanzas.saldo_adelantos, Number(e.target.value) || 0))} 
                    className="max-w-[160px] h-9 text-sm"
                  />
                  <span className="text-xs text-zinc-500">Bs.</span>
                </div>
              </div>
            )}

            {/* BANNER TOTAL NETO */}
            <div className="flex justify-between items-center pt-3 border-t border-white/10 bg-black/40 -mx-4 -mb-4 p-4 rounded-b-2xl">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Total Neto a Entregar</p>
                <p className="text-xs text-zinc-500">Monto final luego de deducciones</p>
              </div>
              <p className={`text-3xl font-black ${totalCalculado < 0 ? 'text-red-500' : 'text-amber-400'}`}>
                {formatCurrency(totalCalculado)}
              </p>
            </div>
          </div>

          {/* Método de Pago */}
          <div className="space-y-3">
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
              Método de Pago para la Liquidación
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'efectivo', label: 'Efectivo' },
                { id: 'qr', label: 'QR / Transf.' },
                { id: 'mixto', label: 'Mixto' },
                { id: 'tarjeta', label: 'Tarjeta' },
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetodoPago(m.id)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    metodoPago === m.id
                      ? 'bg-amber-500 text-black border-amber-500 font-black shadow-md'
                      : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {metodoPago === 'mixto' && (
              <div className="p-3 rounded-xl border border-white/10 bg-black/50 flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Monto en Efectivo</label>
                  <Input 
                    type="number" 
                    min={0}
                    value={pagoEfectivo || ''} 
                    onChange={e => setPagoEfectivo(Number(e.target.value) || 0)} 
                    className="h-10"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Monto en QR</label>
                  <Input 
                    type="number" 
                    min={0}
                    value={pagoQr || ''} 
                    onChange={e => setPagoQr(Number(e.target.value) || 0)} 
                    className="h-10"
                  />
                </div>
              </div>
            )}

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
          </div>

          {/* Botones de Acción del Modal */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowLiquidarModal(false)}
              className="border-white/10"
            >
              Cancelar
            </Button>

            <Button
              variant="primary"
              type="button"
              onClick={marcarPagadas}
              className="bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider text-xs h-11 px-6 shadow-lg shadow-amber-500/10"
            >
              <CheckCircle className="w-4 h-4 mr-2" /> Confirmar Pago de {formatCurrency(totalCalculado)}
            </Button>
          </div>
        </div>
      </Modal>

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
