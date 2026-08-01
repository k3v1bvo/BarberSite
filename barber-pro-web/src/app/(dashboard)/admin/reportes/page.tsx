'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency, getTodayBolivia } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { 
  Users, 
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowLeft,
  Calendar,
  Package,
  Scissors,
  Wallet,
  Activity,
  Heart,
  Crown,
  Download,
  Printer,
  FileText
} from 'lucide-react'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend, AreaChart, Area, ComposedChart
} from 'recharts'

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']
const GOLD_GRADIENT = ['#fbbf24', '#f59e0b', '#d97706']

export default function ReportesPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'general' | 'finanzas' | 'rendimiento' | 'clientes' | 'inventario'>('general')
  const hoyStrInicial = getTodayBolivia()
  const [fechaInicio, setFechaInicio] = useState(hoyStrInicial)
  const [fechaFin, setFechaFin] = useState(hoyStrInicial)
  const [periodoRapido, setPeriodoRapido] = useState<'hoy' | 'semana' | 'mes' | 'personalizado'>('hoy')

  const obtenerFechaBoliviaDesplazada = (diasAtras: number) => {
    const hoyStr = getTodayBolivia()
    const [y, m, d] = hoyStr.split('-').map(Number)
    const f = new Date(y, m - 1, d)
    f.setDate(f.getDate() - diasAtras)
    const fy = f.getFullYear()
    const fm = String(f.getMonth() + 1).padStart(2, '0')
    const fd = String(f.getDate()).padStart(2, '0')
    return `${fy}-${fm}-${fd}`
  }

  const aplicarPeriodoRapido = (periodo: 'hoy' | 'semana' | 'mes' | 'personalizado') => {
    setPeriodoRapido(periodo)
    const hoyStr = getTodayBolivia()
    if (periodo === 'hoy') {
      setFechaInicio(hoyStr)
      setFechaFin(hoyStr)
    } else if (periodo === 'semana') {
      setFechaInicio(obtenerFechaBoliviaDesplazada(7))
      setFechaFin(hoyStr)
    } else if (periodo === 'mes') {
      setFechaInicio(obtenerFechaBoliviaDesplazada(30))
      setFechaFin(hoyStr)
    }
  }
  
  const [data, setData] = useState<any>({
    resumen: { tendencias: {} },
    finanzasDiarias: [],
    metodosPago: [],
    ingresosCategoria: [],
    egresosCategoria: [],
    productividadBarberos: [],
    topServicios: [],
    horasPico: [],
    citasPorEstado: [],
    clientesFrecuentes: [],
    clientesNuevos: 0,
    fidelidadDistribucion: [],
    ingresosPorDiaArr: [],
    inventarioFlujo: []
  })
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadReportes()
  }, [fechaInicio, fechaFin])

  const loadReportes = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') return router.push('/')

      // Calcular fechas del periodo anterior para tendencias
      const dInicio = new Date(fechaInicio)
      const dFin = new Date(fechaFin)
      const diffTime = Math.abs(dFin.getTime() - dInicio.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1
      
      const dPrevInicio = new Date(dInicio)
      dPrevInicio.setDate(dPrevInicio.getDate() - diffDays)
      const prevInicioStr = dPrevInicio.toISOString().split('T')[0]
      
      const dPrevFin = new Date(dInicio)
      dPrevFin.setDate(dPrevFin.getDate() - 1)
      const prevFinStr = dPrevFin.toISOString().split('T')[0]

      const [citasRes, txRes, prevCitasRes, prevTxRes, barberosRes, clientesRes, serviciosRes, inventarioRes] = await Promise.all([
        supabase.from('citas').select('estado, precio, fecha_hora, barbero_id, servicio_id, metodo_pago')
          .gte('fecha_hora', `${fechaInicio}T00:00:00`)
          .lte('fecha_hora', `${fechaFin}T23:59:59`)
          .limit(50000),
        supabase.from('transactions').select('tipo_movimiento, costo, fecha, metodo_pago, subcategoria, monto_efectivo, monto_qr, libro')
          .gte('fecha', fechaInicio)
          .lte('fecha', fechaFin)
          .limit(50000),
        // Periodo Anterior
        supabase.from('citas').select('estado, precio')
          .gte('fecha_hora', `${prevInicioStr}T00:00:00`)
          .lte('fecha_hora', `${prevFinStr}T23:59:59`)
          .limit(50000),
        supabase.from('transactions').select('tipo_movimiento, costo, libro, metodo_pago, monto_qr')
          .gte('fecha', prevInicioStr)
          .lte('fecha', prevFinStr)
          .limit(50000),
        // Entidades
        supabase.from('profiles').select('id, full_name').eq('role', 'barbero'),
        supabase.from('clientes').select('id, nombre, telefono, total_visitas, total_gastado, created_at, nivel_fidelidad').limit(50000),
        supabase.from('servicios').select('id, nombre').limit(5000),
        supabase.from('inventario_movimientos')
          .select('id, tipo, cantidad, created_at, producto:productos(nombre, precio_venta)')
          .gte('created_at', `${fechaInicio}T00:00:00`)
          .lte('created_at', `${fechaFin}T23:59:59`)
          .limit(50000)
      ])

      const citas = citasRes.data || []
      const txs = txRes.data || []
      const prevCitas = prevCitasRes.data || []
      const prevTxs = prevTxRes.data || []
      const barberos = barberosRes.data || []
      const clientes = clientesRes.data || []
      const servicios = serviciosRes.data || []
      const inventarioMovs = inventarioRes.data || []

      // Helper para identificar cobros por QR migrados que en el Excel figuraban como egreso de caja
      const esCobroQrDeCaja = (tx: any) => {
        const mpLower = String(tx.metodo_pago || '').toLowerCase()
        const libroTx = String(tx.libro || '').toUpperCase()
        const tieneQr = ['qr', 'tarjeta'].includes(mpLower) || Number(tx.monto_qr || 0) > 0
        return (libroTx === 'CAJA_CHICA' || libroTx === 'SERVICIOS' || libroTx === 'VENTAS')
          && tieneQr
          && tx.tipo_movimiento === 'EGRESO'
      }
      // Excluir traspasos, depósitos y movimientos entre cuentas internas de ingresos y gastos
      const esMovimientoInterno = (tx: any) => {
        const nombre = String(tx.nombre || '').toUpperCase()
        const glosa = String(tx.glosa || '').toUpperCase()
        const codigo = String(tx.cuenta_codigo || '').toUpperCase()
        return codigo.startsWith('1.1.') || nombre.includes('DEPOSITO') || glosa.includes('DEPOSITO') || nombre.includes('TRANSFERENCIA A BANCO') || glosa.includes('TRANSFERENCIA A BANCO')
      }

      const checkEsIngreso = (tx: any) => {
        if (tx.libro === 'USO_TIENDA' || tx.libro === 'BANCO' || esMovimientoInterno(tx)) return false
        if (esCobroQrDeCaja(tx)) return true
        return tx.tipo_movimiento === 'INGRESO' || tx.tipo_movimiento === 'VENTA_PRODUCTO' || String(tx.cuenta_codigo || '').startsWith('4')
      }
      const checkEsEgreso = (tx: any) => {
        if (tx.libro === 'USO_TIENDA' || tx.libro === 'BANCO' || esMovimientoInterno(tx)) return false
        if (esCobroQrDeCaja(tx)) return false
        return tx.tipo_movimiento === 'EGRESO'
      }

      // --- 1. Finanzas y Transacciones ---
      let ingresosTotal = 0
      let egresosTotal = 0
      const finanzasPorDia: Record<string, { ingresos: number, egresos: number }> = {}

      txs.forEach(tx => {
        const d = tx.fecha || fechaInicio
        if (!finanzasPorDia[d]) finanzasPorDia[d] = { ingresos: 0, egresos: 0 }
        
        const costo = Math.abs(Number(tx.costo || 0))
        if (checkEsIngreso(tx)) {
          finanzasPorDia[d].ingresos += costo
          ingresosTotal += costo
        } else if (checkEsEgreso(tx)) {
          finanzasPorDia[d].egresos += costo
          egresosTotal += costo
        }
      })

      const finanzasDiarias = Object.entries(finanzasPorDia)
        .map(([fecha, vals]) => {
          const [y, m, dia] = fecha.split('-').map(Number)
          const dObj = (!isNaN(y) && !isNaN(m) && !isNaN(dia)) ? new Date(y, m - 1, dia) : new Date(fecha)
          return {
            fecha: dObj.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }),
            ingresos: vals.ingresos,
            egresos: vals.egresos,
            utilidad: vals.ingresos - vals.egresos
          }
        })
        .sort((a, b) => a.fecha.localeCompare(b.fecha))

      const metodos: Record<string, number> = { 'efectivo': 0, 'qr': 0, 'tarjeta': 0, 'descuento_caja': 0 }
      const ingCat: Record<string, number> = {}
      const egCat: Record<string, number> = {}

      txs.forEach(tx => {
        const costo = Math.abs(Number(tx.costo || 0))
        const isIngreso = checkEsIngreso(tx)
        const isEgreso = checkEsEgreso(tx)

        // Métodos de pago sólo se suman para ingresos cobrados
        if (isIngreso) {
          if (tx.metodo_pago === 'mixto') {
            metodos['efectivo'] += Number(tx.monto_efectivo || 0)
            metodos['qr'] += Number(tx.monto_qr || 0)
          } else if (tx.metodo_pago) {
            metodos[tx.metodo_pago] = (metodos[tx.metodo_pago] || 0) + costo
          }
        }

        const sub = tx.subcategoria || 'OTROS'
        if (isIngreso) {
          ingCat[sub] = (ingCat[sub] || 0) + costo
        } else if (isEgreso) {
          egCat[sub] = (egCat[sub] || 0) + costo
        }
      })

      const metodosPago = Object.entries(metodos).filter(([_,v]) => v > 0).map(([name, value]) => ({ name, value }))
      const ingresosCategoria = Object.entries(ingCat).sort((a,b) => b[1]-a[1]).map(([name, value]) => ({ name, value }))
      const egresosCategoria = Object.entries(egCat).sort((a,b) => b[1]-a[1]).map(([name, value]) => ({ name, value }))

      // --- TENDENCIAS (Periodo Anterior) ---
      let prevIngresosTotal = 0
      let prevEgresosTotal = 0
      prevTxs.forEach(tx => {
        const costo = Math.abs(Number(tx.costo || 0))
        if (checkEsIngreso(tx)) prevIngresosTotal += costo
        else if (checkEsEgreso(tx)) prevEgresosTotal += costo
      })
      const prevUtilidadTotal = prevIngresosTotal - prevEgresosTotal
      const citasCompletadas = citas.filter(c => c.estado === 'completado')
      const prevCitasCompletadas = prevCitas.filter(c => c.estado === 'completado')
      
      const prevTicket = prevCitasCompletadas.length ? prevIngresosTotal / prevCitasCompletadas.length : 0
      const ticketPromedio = citasCompletadas.length ? ingresosTotal / citasCompletadas.length : 0

      const calcTendencia = (actual: number, previo: number) => {
        if (previo === 0) return actual > 0 ? 100 : 0;
        return ((actual - previo) / previo) * 100;
      }

      const tendencias = {
        utilidad: calcTendencia(ingresosTotal - egresosTotal, prevUtilidadTotal),
        ingresos: calcTendencia(ingresosTotal, prevIngresosTotal),
        citas: calcTendencia(citasCompletadas.length, prevCitasCompletadas.length),
        ticket: calcTendencia(ticketPromedio, prevTicket)
      }

      // --- 2. Rendimiento (Staff y Servicios) ---
      const prodBarberos = barberos.map(b => {
        const cb = citasCompletadas.filter(c => c.barbero_id === b.id)
        const ventas = cb.reduce((acc, curr) => acc + curr.precio, 0)
        return {
          barbero: b.full_name || 'Sin nombre',
          citas: cb.length,
          ventas
        }
      }).sort((a, b) => b.ventas - a.ventas)

      const svcCount: Record<string, { cant: number, monto: number }> = {}
      const horaCount: Record<string, number> = {}
      const estadoCount: Record<string, number> = {}
      
      const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      const ingresosPorDiaSemana: Record<string, number> = { 'Dom': 0, 'Lun': 0, 'Mar': 0, 'Mié': 0, 'Jue': 0, 'Vie': 0, 'Sáb': 0 }

      citas.forEach(c => {
        estadoCount[c.estado] = (estadoCount[c.estado] || 0) + 1
        
        if (c.estado === 'completado' && c.servicio_id) {
          if (!svcCount[c.servicio_id]) svcCount[c.servicio_id] = { cant: 0, monto: 0 }
          svcCount[c.servicio_id].cant += 1
          svcCount[c.servicio_id].monto += c.precio

          // Ingresos por día de la semana
          const d = new Date(c.fecha_hora)
          const dia = diasSemana[d.getDay()]
          ingresosPorDiaSemana[dia] += Number(c.precio)
        }

        if (c.estado !== 'cancelado') {
          const hour = new Date(c.fecha_hora).getHours()
          const label = `${hour}:00`
          horaCount[label] = (horaCount[label] || 0) + 1
        }
      })

      const topServicios = Object.entries(svcCount).map(([id, stats]) => {
        const sName = servicios.find(s => s.id === id)?.nombre || 'Desconocido'
        return { nombre: sName, ...stats }
      }).sort((a, b) => b.cant - a.cant).slice(0, 5)

      const horasPico = Object.entries(horaCount)
        .map(([hora, cantidad]) => ({ hora, cantidad }))
        .sort((a, b) => parseInt(a.hora) - parseInt(b.hora))

      const citasPorEstado = Object.entries(estadoCount).map(([estado, cantidad]) => ({ estado, cantidad }))
      
      // Asegurar orden de la semana: Lunes a Domingo
      const diasOrdenados = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
      const ingresosPorDiaArr = diasOrdenados.map(dia => ({ dia, ingresos: ingresosPorDiaSemana[dia] }))


      // --- 3. Clientes y Fidelidad ---
      const dateStart = new Date(fechaInicio).getTime()
      const clientesNuevos = clientes.filter(c => new Date(c.created_at).getTime() >= dateStart).length
      
      const fidelidadCount: Record<string, number> = { 'BRONCE': 0, 'PLATA': 0, 'ORO': 0 }
      clientes.forEach(c => {
         const nivel = c.nivel_fidelidad || 'BRONCE'
         fidelidadCount[nivel] = (fidelidadCount[nivel] || 0) + 1
      })
      const fidelidadDistribucion = Object.entries(fidelidadCount)
        .map(([name, value]) => ({ name, value }))
        .filter(i => i.value > 0)
      
      const clientesFrecuentes = clientes
        .filter(c => c.total_visitas > 0)
        .sort((a, b) => b.total_visitas - a.total_visitas)
        .slice(0, 10)

      const totalCanceladas = (estadoCount['cancelado'] || 0) + (estadoCount['no_presento'] || 0)
      const tasaCancelacion = citas.length > 0 ? (totalCanceladas / citas.length) * 100 : 0

      // --- 4. Flujo de Inventario ---
      const invMap: Record<string, { ventas: number, uso: number, ingresosVenta: number, costoUso: number }> = {}
      let totalVentasInv = 0
      let totalUsoInv = 0

      inventarioMovs.forEach((m: any) => {
        if (!m.producto) return
        const pName = m.producto.nombre || 'Desconocido'
        if (!invMap[pName]) invMap[pName] = { ventas: 0, uso: 0, ingresosVenta: 0, costoUso: 0 }
        
        // Supongamos que tipo = 'venta' es a clientes, y 'salida' es uso tienda
        if (m.tipo === 'venta') {
           invMap[pName].ventas += m.cantidad
           invMap[pName].ingresosVenta += (m.cantidad * (m.producto.precio_venta || 0))
           totalVentasInv += (m.cantidad * (m.producto.precio_venta || 0))
        } else if (m.tipo === 'salida' || m.tipo === 'ajuste') {
           // asumimos salidas y ajustes como uso/pérdida
           invMap[pName].uso += m.cantidad
           invMap[pName].costoUso += (m.cantidad * (m.producto.precio_venta || 0))
           totalUsoInv += (m.cantidad * (m.producto.precio_venta || 0))
        }
      })
      
      const inventarioFlujo = Object.entries(invMap).map(([nombre, vals]) => ({
        nombre,
        ventas: vals.ventas,
        uso: vals.uso,
        ingresosVenta: vals.ingresosVenta,
        costoUso: vals.costoUso
      }))

      setData({
        resumen: {
          ingresosTotal,
          egresosTotal,
          utilidadNeta: ingresosTotal - egresosTotal,
          totalCitas: citasCompletadas.length,
          ticketPromedio,
          tasaCancelacion: tasaCancelacion.toFixed(1),
          tendencias,
          totalVentasInv,
          totalUsoInv
        },
        finanzasDiarias,
        metodosPago,
        ingresosCategoria,
        egresosCategoria,
        productividadBarberos: prodBarberos,
        topServicios,
        horasPico,
        citasPorEstado,
        clientesFrecuentes,
        clientesNuevos,
        fidelidadDistribucion,
        ingresosPorDiaArr,
        inventarioFlujo
      })

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportarCSV = () => {
    let csvContent = '\uFEFF' // UTF-8 BOM for Excel
    csvContent += `REPORTE COMPLETO DE GESTIÓN Y FINANZAS - BARBER PRO\n`
    csvContent += `Periodo:;${fechaInicio} al ${fechaFin}\n`
    csvContent += `Generado el:;${new Date().toLocaleString('es-BO')}\n\n`

    csvContent += `--- RESUMEN EJECUTIVO ---\n`
    csvContent += `Métrica;Valor\n`
    csvContent += `Ingresos Brutos;Bs. ${data.resumen.ingresosTotal?.toFixed(2) || '0.00'}\n`
    csvContent += `Egresos Totales;Bs. ${data.resumen.egresosTotal?.toFixed(2) || '0.00'}\n`
    csvContent += `Utilidad Neta;Bs. ${data.resumen.utilidadNeta?.toFixed(2) || '0.00'}\n`
    csvContent += `Total Citas Completadas;${data.resumen.totalCitas || 0}\n`
    csvContent += `Ticket Promedio;Bs. ${data.resumen.ticketPromedio?.toFixed(2) || '0.00'}\n`
    csvContent += `Tasa de Cancelación;${data.resumen.tasaCancelacion || 0}%\n\n`

    csvContent += `--- FINANZAS DIARIAS ---\n`
    csvContent += `Fecha;Ingresos (Bs);Egresos (Bs);Utilidad Neta (Bs)\n`
    data.finanzasDiarias.forEach((d: any) => {
      csvContent += `"${d.fecha}";${d.ingresos.toFixed(2)};${d.egresos.toFixed(2)};${d.utilidad.toFixed(2)}\n`
    })
    csvContent += `\n`

    csvContent += `--- PRODUCTIVIDAD DE BARBEROS ---\n`
    csvContent += `Barbero;Citas Atendidas;Ventas Totales (Bs)\n`
    data.productividadBarberos.forEach((b: any) => {
      csvContent += `"${b.barbero}";${b.citas};${b.ventas.toFixed(2)}\n`
    })
    csvContent += `\n`

    csvContent += `--- TOP SERVICIOS MÁS DEMANDADOS ---\n`
    csvContent += `Servicio;Cantidad Vendida;Monto Recaudado (Bs)\n`
    data.topServicios.forEach((s: any) => {
      csvContent += `"${s.nombre}";${s.cant};${s.monto.toFixed(2)}\n`
    })
    csvContent += `\n`

    csvContent += `--- CLIENTES MAS FRECUENTES ---\n`
    csvContent += `Nombre Cliente;Teléfono;Total Visitas;Total Gastado (Bs)\n`
    data.clientesFrecuentes.forEach((c: any) => {
      csvContent += `"${c.nombre}";"${c.telefono || ''}";${c.total_visitas};${(c.total_gastado || 0).toFixed(2)}\n`
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `reporte_general_barberpro_${fechaInicio}_al_${fechaFin}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportarPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte General & Financiero - Barber Pro (${fechaInicio} al ${fechaFin})</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 30px; color: #18181b; background: #fff; line-height: 1.5; }
            .header { border-bottom: 3px solid #f59e0b; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 24px; font-weight: 900; color: #000; text-transform: uppercase; margin: 0; }
            .subtitle { font-size: 13px; color: #71717a; margin-top: 4px; font-weight: 600; }
            .badge { background: #fef3c7; color: #b45309; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 12px; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .kpi { border: 1px solid #e4e4e7; border-radius: 12px; padding: 15px; background: #fafafa; }
            .kpi-title { font-size: 10px; text-transform: uppercase; font-weight: 800; color: #71717a; letter-spacing: 0.05em; }
            .kpi-value { font-size: 22px; font-weight: 900; color: #000; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
            th { background: #18181b; color: #fff; text-transform: uppercase; font-size: 10px; font-weight: 800; padding: 10px 12px; text-align: left; }
            td { padding: 10px 12px; border-bottom: 1px solid #e4e4e7; }
            tr:nth-child(even) { background: #fafafa; }
            .section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; margin-bottom: 12px; color: #18181b; border-left: 4px solid #f59e0b; padding-left: 8px; }
            .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e4e4e7; text-align: center; font-size: 10px; color: #a1a1aa; font-weight: 600; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">💈 BARBER PRO</h1>
              <p class="subtitle">Reporte General de Operaciones, Rendimiento & Finanzas</p>
            </div>
            <div>
              <span class="badge">Período: ${fechaInicio} al ${fechaFin}</span>
            </div>
          </div>

          <div class="grid">
            <div class="kpi">
              <div class="kpi-title">Utilidad Neta</div>
              <div class="kpi-value">Bs. ${(data.resumen.utilidadNeta || 0).toFixed(2)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Ingresos Brutos</div>
              <div class="kpi-value">Bs. ${(data.resumen.ingresosTotal || 0).toFixed(2)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Servicios Realizados</div>
              <div class="kpi-value">${data.resumen.totalCitas || 0}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Ticket Promedio</div>
              <div class="kpi-value">Bs. ${(data.resumen.ticketPromedio || 0).toFixed(2)}</div>
            </div>
          </div>

          <div class="section-title">Productividad del Equipo de Barberos</div>
          <table>
            <thead>
              <tr>
                <th>Barbero / Profesional</th>
                <th>Citas Completadas</th>
                <th style="text-align: right">Ventas Recaudadas (Bs)</th>
              </tr>
            </thead>
            <tbody>
              ${data.productividadBarberos.map((b: any) => `
                <tr>
                  <td><strong>${b.barbero}</strong></td>
                  <td>${b.citas} servicios</td>
                  <td style="text-align: right"><strong>Bs. ${b.ventas.toFixed(2)}</strong></td>
                </tr>
              `).join('')}
              ${data.productividadBarberos.length === 0 ? '<tr><td colspan="3">Sin registros en este período</td></tr>' : ''}
            </tbody>
          </table>

          <div class="section-title">Top Servicios Más Vendidos</div>
          <table>
            <thead>
              <tr>
                <th>Nombre del Servicio</th>
                <th>Cantidad Vendida</th>
                <th style="text-align: right">Monto Recaudado (Bs)</th>
              </tr>
            </thead>
            <tbody>
              ${data.topServicios.map((s: any) => `
                <tr>
                  <td><strong>${s.nombre}</strong></td>
                  <td>${s.cant} veces</td>
                  <td style="text-align: right"><strong>Bs. ${s.monto.toFixed(2)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">Resumen de Finanzas Diarias</div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ingresos (Bs)</th>
                <th>Egresos (Bs)</th>
                <th style="text-align: right">Utilidad Neta (Bs)</th>
              </tr>
            </thead>
            <tbody>
              ${data.finanzasDiarias.map((d: any) => `
                <tr>
                  <td>${d.fecha}</td>
                  <td style="color: #10b981;">+Bs. ${d.ingresos.toFixed(2)}</td>
                  <td style="color: #ef4444;">-Bs. ${d.egresos.toFixed(2)}</td>
                  <td style="text-align: right; font-weight: bold;">Bs. ${d.utilidad.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            Reporte generado automáticamente por Barber Pro Admin Suite · ${new Date().toLocaleString('es-BO')}
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Helper para renderizar badges de tendencia
  const TendenciaBadge = ({ valor }: { valor: number }) => {
    const isPositive = valor >= 0
    return (
      <div className={`flex items-center gap-1 mt-2 text-xs font-black tracking-widest px-2 py-1 rounded-full w-fit ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {Math.abs(valor).toFixed(1)}% vs anterior
      </div>
    )
  }

  // --- COMPONENTES DE PESTAÑAS ---
  
  const TabGeneral = () => (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-amber-500 text-black border-none glow-amber overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <DollarSign className="w-16 h-16" />
          </div>
          <CardContent className="p-6 relative z-10">
            <p className="text-[10px] uppercase font-black tracking-widest text-black/60">Utilidad Neta</p>
            <p className="text-4xl font-black mt-2 leading-none">{formatCurrency(data.resumen.utilidadNeta)}</p>
            <div className={`flex items-center gap-1 mt-2 text-xs font-black tracking-widest px-2 py-1 rounded-full w-fit ${data.resumen.tendencias.utilidad >= 0 ? 'bg-black/20 text-black' : 'bg-red-900/20 text-red-900'}`}>
              {data.resumen.tendencias.utilidad >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(data.resumen.tendencias.utilidad).toFixed(1)}% vs anterior
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Activity className="w-16 h-16 text-white" />
          </div>
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Ingresos Brutos</p>
            <p className="text-3xl font-black mt-2 text-white">{formatCurrency(data.resumen.ingresosTotal)}</p>
            <TendenciaBadge valor={data.resumen.tendencias.ingresos} />
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-white/5 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-5">
            <Scissors className="w-16 h-16 text-white" />
          </div>
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Servicios Realizados</p>
            <p className="text-3xl font-black mt-2 text-white">{data.resumen.totalCitas}</p>
            <TendenciaBadge valor={data.resumen.tendencias.citas} />
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Wallet className="w-16 h-16 text-amber-500" />
          </div>
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Ticket Promedio</p>
            <p className="text-3xl font-black mt-2 text-amber-500">{formatCurrency(data.resumen.ticketPromedio)}</p>
            <TendenciaBadge valor={data.resumen.tendencias.ticket} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/5 bg-zinc-900 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex justify-between items-center">
            Flujo Financiero (Ingresos vs Egresos)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <ComposedChart data={data.finanzasDiarias}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                <XAxis dataKey="fecha" stroke="#52525b" fontSize={10} fontStyle="bold" />
                <YAxis stroke="#52525b" fontSize={10} fontStyle="bold" />
                <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10', borderRadius: '12px' }} />
                <Legend />
                <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4,4,0,0]} barSize={20} />
                <Bar dataKey="egresos" name="Egresos" fill="#ef4444" radius={[4,4,0,0]} barSize={20} />
                <Line type="monotone" dataKey="utilidad" name="Utilidad Neta" stroke="#f59e0b" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const TabFinanzas = () => (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-white/5 bg-zinc-900 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Tendencia de Utilidad Neta</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={data.finanzasDiarias}>
                  <defs>
                    <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                  <XAxis dataKey="fecha" stroke="#52525b" fontSize={10} fontStyle="bold" />
                  <YAxis stroke="#52525b" fontSize={10} fontStyle="bold" />
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="utilidad" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorUtil)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-zinc-900 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg text-center">Métodos de Pago</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={data.metodosPago}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5}
                  >
                    {data.metodosPago.map((entry: any, index: number) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(value)} contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10', borderRadius: '12px' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Desglose de Ingresos y Egresos */}
        <Card className="lg:col-span-3 border-white/5 bg-zinc-900 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Desglose por Categoría</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-bold text-emerald-400 mb-4 uppercase tracking-widest border-b border-white/5 pb-2">Ingresos</h3>
                <div className="space-y-3">
                  {data.ingresosCategoria?.map((item: any) => (
                    <div key={item.name} className="flex justify-between items-center">
                      <span className="text-zinc-300 text-sm">{item.name.replace('_', ' ')}</span>
                      <span className="font-bold text-white">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                  {(!data.ingresosCategoria || data.ingresosCategoria.length === 0) && (
                    <p className="text-xs text-zinc-500">No hay datos</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-400 mb-4 uppercase tracking-widest border-b border-white/5 pb-2">Egresos</h3>
                <div className="space-y-3">
                  {data.egresosCategoria?.map((item: any) => (
                    <div key={item.name} className="flex justify-between items-center">
                      <span className="text-zinc-300 text-sm">{item.name.replace('_', ' ')}</span>
                      <span className="font-bold text-white">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                  {(!data.egresosCategoria || data.egresosCategoria.length === 0) && (
                    <p className="text-xs text-zinc-500">No hay datos</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const TabRendimiento = () => (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ingresos por Día de la semana */}
        <Card className="lg:col-span-2 border-white/5 bg-zinc-900 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Ingresos por Día de la Semana</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={data.ingresosPorDiaArr}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                  <XAxis dataKey="dia" stroke="#52525b" fontSize={10} fontStyle="bold" />
                  <YAxis stroke="#52525b" fontSize={10} fontStyle="bold" tickFormatter={(value) => `$${value/1000}k`} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10', borderRadius: '12px' }} cursor={{fill: '#ffffff05'}} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4,4,0,0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Servicios */}
        <Card className="border-white/5 bg-zinc-900 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Top 5 Servicios</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={data.topServicios} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff05" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="nombre" type="category" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10', borderRadius: '12px' }} cursor={{fill: '#ffffff05'}} />
                  <Bar dataKey="cant" name="Veces Realizado" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Horas Pico */}
        <Card className="lg:col-span-1 border-white/5 bg-zinc-900 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Horas Pico</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={data.horasPico}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                  <XAxis dataKey="hora" stroke="#52525b" fontSize={10} fontStyle="bold" />
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10', borderRadius: '12px' }} cursor={{fill: '#ffffff05'}}/>
                  <Bar dataKey="cantidad" name="Citas" fill="#8b5cf6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Productividad Staff */}
        <Card className="lg:col-span-2 border-white/5 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg">💰 Productividad por Barbero</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.productividadBarberos.map((b: any, i: number) => (
                <div key={i} className="group flex justify-between items-center p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-amber-500/30 transition-all card-hover">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-black">
                        {b.barbero.charAt(0)}
                     </div>
                     <div>
                        <p className="font-black text-white hover:text-amber-500 transition-colors uppercase tracking-tight">{b.barbero}</p>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{b.citas} SERVICIOS</p>
                     </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-amber-500">{formatCurrency(b.ventas)}</p>
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Ventas Totales</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const TabClientes = () => (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-zinc-900 border-white/5">
          <CardContent className="p-6 text-center">
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Nuevos Clientes</p>
            <p className="text-4xl font-black mt-2 text-emerald-400">{data.clientesNuevos}</p>
            <p className="text-[10px] font-bold text-zinc-600 mt-2 uppercase tracking-widest">EN ESTE PERÍODO</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-white/5">
          <CardContent className="p-6 text-center">
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Tasa de Cancelación</p>
            <p className="text-4xl font-black mt-2 text-red-400">{data.resumen.tasaCancelacion}%</p>
            <p className="text-[10px] font-bold text-zinc-600 mt-2 uppercase tracking-widest">CITAS PERDIDAS</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-white/5 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-center text-zinc-400">Niveles de Fidelidad (Toda la BD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie data={data.fidelidadDistribucion} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} innerRadius={35}>
                    {data.fidelidadDistribucion.map((entry: any, index: number) => {
                      let color = '#a1a1aa' // BRONCE default
                      if (entry.name === 'ORO') color = '#f59e0b'
                      if (entry.name === 'PLATA') color = '#94a3b8'
                      return <Cell key={entry.name} fill={color} />
                    })}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10' }} />
                  <Legend verticalAlign="middle" align="right" layout="vertical" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Crown className="w-48 h-48 text-amber-500" />
        </div>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
             <Crown className="text-amber-500 w-5 h-5" />
             Salón de la Fama (Top 10 Clientes)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.clientesFrecuentes.map((cliente: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-4 bg-zinc-950/80 border border-white/5 rounded-2xl hover:border-amber-500/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center text-black font-black text-xl shadow-lg shadow-amber-500/20">
                      {cliente.nombre.charAt(0)}
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-black rounded-full border border-amber-500 flex items-center justify-center text-amber-500 text-[10px] font-black">
                      #{i+1}
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg leading-tight">{cliente.nombre}</p>
                    <p className="text-zinc-500 text-xs font-medium">{cliente.telefono || 'Sin teléfono'}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="px-2 py-0.5 bg-white/5 rounded text-[9px] font-black tracking-widest uppercase text-zinc-400">
                        Nivel {cliente.nivel_fidelidad || 'BRONCE'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest leading-none mb-1">FIDELIDAD</p>
                  <div className="flex items-center gap-1 justify-end">
                     <p className="text-lg font-black text-white">{cliente.total_visitas}</p>
                     <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">visitas</span>
                  </div>
                  <p className="text-sm font-bold text-emerald-400 mt-1">{formatCurrency(cliente.total_gastado)} <span className="text-[9px] text-zinc-500 uppercase">LTV</span></p>
                </div>
              </div>
            ))}
            {data.clientesFrecuentes.length === 0 && (
              <div className="text-center py-12 opacity-30 col-span-2">
                 <Users className="w-16 h-16 mx-auto mb-2" />
                 <p className="font-black uppercase tracking-widest text-xs">Sin clientes recurrentes aún</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const TabInventario = () => (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="p-6 text-center relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <Package className="w-16 h-16 text-emerald-500" />
             </div>
             <p className="text-[10px] uppercase font-black tracking-widest text-emerald-400">Generado por Ventas (Clientes)</p>
             <p className="text-4xl font-black mt-2 text-white">{formatCurrency(data.resumen.totalVentasInv)}</p>
             <p className="text-[10px] text-zinc-500 mt-2">Productos vendidos directamente.</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-6 text-center relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <Activity className="w-16 h-16 text-red-500" />
             </div>
             <p className="text-[10px] uppercase font-black tracking-widest text-red-400">Consumo Interno / Uso Tienda</p>
             <p className="text-4xl font-black mt-2 text-white">{formatCurrency(data.resumen.totalUsoInv)}</p>
             <p className="text-[10px] text-zinc-500 mt-2">Valor de insumos usados por barberos.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/5 shadow-2xl bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-500" />
            Análisis de Productos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
           <div className="overflow-x-auto w-full">
             <table className="w-full text-left border-collapse min-w-[1000px]">
               <thead>
                 <tr className="border-b border-white/5">
                   <th className="py-3 text-[10px] font-black uppercase text-zinc-500 tracking-widest">Producto</th>
                   <th className="py-3 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-center">Unidades (Venta)</th>
                   <th className="py-3 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right">Ingreso Venta</th>
                   <th className="py-3 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-center">Unidades (Uso)</th>
                   <th className="py-3 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right">Costo Interno</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                 {data.inventarioFlujo.length === 0 && (
                   <tr>
                     <td colSpan={5} className="py-8 text-center text-zinc-500 text-sm">No hay movimientos en este periodo</td>
                   </tr>
                 )}
                 {data.inventarioFlujo.map((inv: any, i: number) => (
                   <tr key={i} className="hover:bg-white/5 transition">
                     <td className="py-3 text-sm font-bold">{inv.nombre}</td>
                     <td className="py-3 text-sm text-center text-emerald-400 font-bold">{inv.ventas}</td>
                     <td className="py-3 text-sm text-right text-white font-bold">{formatCurrency(inv.ingresosVenta)}</td>
                     <td className="py-3 text-sm text-center text-red-400 font-bold">{inv.uso}</td>
                     <td className="py-3 text-sm text-right text-white font-bold">{formatCurrency(inv.costoUso)}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin')} className="p-3 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl transition-all btn-press group">
             <ArrowLeft className="w-5 h-5 text-zinc-500 group-hover:text-amber-500" />
          </button>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white uppercase">
              Business <span className="text-amber-500">Analytics</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-1">Inteligencia de negocios y rendimiento integral</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-amber-500/10 bg-zinc-900/40">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mr-2">Periodo Rápido:</span>
            {[
              { id: 'hoy', label: 'Hoy' },
              { id: 'semana', label: 'Últimos 7 Días' },
              { id: 'mes', label: 'Últimos 30 Días' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => aplicarPeriodoRapido(p.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  periodoRapido === p.id
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-6 items-end justify-between">
            <div className="flex flex-wrap gap-6 items-end">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fecha Inicio</label>
                <div className="relative">
                  <input
                    type="date"
                    style={{ colorScheme: 'dark' }}
                    className="h-12 w-48 border border-white/10 bg-zinc-950 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                    value={fechaInicio}
                    onChange={(e) => { setFechaInicio(e.target.value); setPeriodoRapido('personalizado') }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fecha Fin</label>
                <div className="relative">
                  <input
                    type="date"
                    style={{ colorScheme: 'dark' }}
                    className="h-12 w-48 border border-white/10 bg-zinc-950 rounded-xl px-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                    value={fechaFin}
                    onChange={(e) => { setFechaFin(e.target.value); setPeriodoRapido('personalizado') }}
                  />
                </div>
              </div>
              <Button variant="primary" size="lg" className="h-12 uppercase tracking-widest font-black" onClick={loadReportes}>
                <TrendingUp className="w-4 h-4 mr-2" />
                Actualizar Datos
              </Button>
            </div>
            
            <div className="flex gap-3 shrink-0 flex-wrap">
              <Button variant="outline" size="lg" className="h-12 uppercase tracking-widest font-black border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={exportarCSV} title="Exportar archivo CSV completo para Excel">
                <Download className="w-4 h-4 mr-2" />
                CSV Excel
              </Button>
              <Button variant="outline" size="lg" className="h-12 uppercase tracking-widest font-black border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={exportarPDF} title="Generar e imprimir Reporte Ejecutivo PDF">
                <Printer className="w-4 h-4 mr-2" />
                PDF Ejecutivo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pestañas (Tabs) Nav */}
      <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
        {[
          { id: 'general', label: 'Resumen Ejecutivo', icon: BarChart3 },
          { id: 'finanzas', label: 'Finanzas', icon: DollarSign },
          { id: 'rendimiento', label: 'Rendimiento (Staff)', icon: Activity },
          { id: 'clientes', label: 'Clientes & Fidelidad', icon: Heart },
          { id: 'inventario', label: 'Flujo Inventario', icon: Package }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' 
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <tab.icon size={16} className={activeTab === tab.id ? "text-black" : "text-amber-500"} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido de la Pestaña Activa */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Calculando Analíticas...</p>
        </div>
      ) : (
        <div className="pt-2">
          {activeTab === 'general' && <TabGeneral />}
          {activeTab === 'finanzas' && <TabFinanzas />}
          {activeTab === 'rendimiento' && <TabRendimiento />}
          {activeTab === 'clientes' && <TabClientes />}
          {activeTab === 'inventario' && <TabInventario />}
        </div>
      )}
    </div>
  )
}