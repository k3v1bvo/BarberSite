'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, getTodayBolivia } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import {
  Users,
  DollarSign,
  Package,
  Calendar,
  ArrowRight,
  Search,
  BarChart3,
  Store,
  Wallet,
  Receipt,
  Landmark,
  Scale,
  TrendingUp,
  FileText,
  Download,
  Printer,
  PieChart,
  DollarSignIcon
} from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { StatCard } from '@/components/admin/StatCard'
import { AdminQuickActions } from '@/components/admin/AdminQuickActions'
import { AdminAlertsPanel } from '@/components/admin/AdminAlertsPanel'
import { AdminAsistenciaSummary } from '@/components/admin/AdminAsistenciaSummary'
import { useBrand } from '@/components/providers/BrandProvider'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const libroLabel: Record<string, string> = {
  CAJA_CHICA: 'Caja Chica',
  VENTAS: 'Ventas',
  SERVICIOS: 'Servicios',
  BANCO: 'Banco',
  USO_TIENDA: 'Uso Tienda',
}

const libroColor: Record<string, string> = {
  CAJA_CHICA: 'text-amber-500',
  VENTAS: 'text-green-500',
  SERVICIOS: 'text-emerald-500',
  BANCO: 'text-blue-500',
  USO_TIENDA: 'text-violet-500',
}

type DateRangeOption = 'hoy' | 'ayer' | 'esta_semana' | 'este_mes' | 'mes_pasado' | 'este_año' | 'personalizado'

const getDateRange = (option: DateRangeOption, customStart?: string, customEnd?: string) => {
  const hoy = new Date()
  let start = new Date(hoy)
  let end = new Date(hoy)

  switch (option) {
    case 'hoy':
      break
    case 'ayer':
      start.setDate(start.getDate() - 1)
      end.setDate(end.getDate() - 1)
      break
    case 'esta_semana':
      const day = start.getDay()
      const diff = start.getDate() - day + (day === 0 ? -6 : 1) // Ajustar al lunes
      start.setDate(diff)
      break
    case 'este_mes':
      start = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      break
    case 'mes_pasado':
      start = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      end = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      break
    case 'este_año':
      start = new Date(hoy.getFullYear(), 0, 1)
      break
    case 'personalizado':
      if (customStart) start = new Date(customStart + 'T00:00:00')
      if (customEnd) end = new Date(customEnd + 'T23:59:59')
      break
  }
  
  const formatYMD = (d: Date) => {
    // Para evitar problemas de zona horaria, extraemos año, mes y dia locales
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  
  return {
    start: formatYMD(start),
    end: formatYMD(end),
  }
}

interface Stats {
  ventasHoy: number
  citasHoy: number
  clientesTotal: number
  productosStockBajo: number
  pedidosPendientes: number
}

interface Cita {
  id: string
  estado: string
  precio: number
  clientes?: { nombre: string }
  barberos?: { full_name: string }
  servicios?: { nombre: string }
}

export default function AdminPage() {
  const { brand } = useBrand()
  const [stats, setStats] = useState<Stats>({
    ventasHoy: 0,
    citasHoy: 0,
    clientesTotal: 0,
    productosStockBajo: 0,
    pedidosPendientes: 0,
  })
  const [turnosAbiertos, setTurnosAbiertos] = useState(0)
  const [citasRecientes, setCitasRecientes] = useState<Cita[]>([])
  const [ventasSemana, setVentasSemana] = useState<{fecha: string, total: number}[]>([])
  const [topBarberos, setTopBarberos] = useState<{nombre: string, ventas: number, citas: number}[]>([])
  const [usoTiendaHoy, setUsoTiendaHoy] = useState(0)
  const [summaryContable, setSummaryContable] = useState({
    caja_chica: 0,
    ventas: 0,
    banco: 0,
    total: 0,
    arqueoCerrado: false,
  })
  const [recentTx, setRecentTx] = useState<any[]>([])
  const [tabTabla, setTabTabla] = useState<'citas' | 'movimientos'>('citas')
  const [loading, setLoading] = useState(true)
  
  // Date range state
  const [rangoSeleccionado, setRangoSeleccionado] = useState<DateRangeOption>('hoy')
  const [fechaInicioStr, setFechaInicioStr] = useState(getTodayBolivia())
  const [fechaFinStr, setFechaFinStr] = useState(getTodayBolivia())
  
  const router = useRouter()
  const supabase = createClient()

  const loadData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { start, end } = getDateRange(rangoSeleccionado, fechaInicioStr, fechaFinStr)

      const [
        { data: ventasData },
        { count: citasHoy },
        { count: clientesTotal },
        { data: productosStock },
        { count: pedidosPendientes },
        { data: citasRecientesData },
      ] = await Promise.all([
        supabase
          .from('citas')
          .select('precio')
          .eq('estado', 'completado')
          .gte('fecha_hora', `${start}T00:00:00`)
          .lte('fecha_hora', `${end}T23:59:59`),
        supabase
          .from('citas')
          .select('*', { count: 'exact', head: true })
          .gte('fecha_hora', `${start}T00:00:00`)
          .lte('fecha_hora', `${end}T23:59:59`),
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('productos').select('id').lte('stock_actual', 5),
        supabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true })
          .in('estado', ['pendiente', 'confirmado']),
        supabase
          .from('citas')
          .select(
            `
          id,
          estado,
          precio,
          fecha_hora,
          clientes (nombre),
          barberos:profiles!barbero_id (full_name),
          servicios (nombre)
        `
          )
          .gte('fecha_hora', `${start}T00:00:00`)
          .lte('fecha_hora', `${end}T23:59:59`)
          .order('fecha_hora', { ascending: false })
          .limit(10), // Limit increased slightly to show more if range is larger
      ])

      // Data for charts
      const { data: citasMes } = await supabase
        .from('citas')
        .select('precio, fecha_hora, barberos:profiles!barbero_id(full_name)')
        .eq('estado', 'completado')
        .gte('fecha_hora', `${start}T00:00:00`)
        .lte('fecha_hora', `${end}T23:59:59`)

      // Check if range spans more than 31 days to determine grouping (by month or by day)
      const startDate = new Date(`${start}T00:00:00`)
      const endDate = new Date(`${end}T23:59:59`)
      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const groupByMonth = diffDays > 31

      // Agrupar ventas del periodo
      const ventasPorDia: Record<string, number> = {}
      // Agrupar top barberos
      const barberosStats: Record<string, { ventas: number, citas: number }> = {}

      if (citasMes) {
        citasMes.forEach((c: any) => {
          let fechaStr = ''
          const d = new Date(c.fecha_hora)
          if (groupByMonth) {
            fechaStr = d.toLocaleDateString('es-BO', { month: 'short', year: 'numeric' })
          } else {
            fechaStr = d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })
          }
          
          ventasPorDia[fechaStr] = (ventasPorDia[fechaStr] || 0) + c.precio

          const barberoNombre = c.barberos?.full_name || 'Sin asignar'
          if (!barberosStats[barberoNombre]) barberosStats[barberoNombre] = { ventas: 0, citas: 0 }
          barberosStats[barberoNombre].ventas += c.precio
          barberosStats[barberoNombre].citas += 1
        })
      }

      const arrVentasSemana = Object.entries(ventasPorDia).map(([f, t]) => ({ fecha: f, total: t }))
      const arrTopBarberos = Object.entries(barberosStats)
        .map(([n, s]) => ({ nombre: n, ventas: s.ventas, citas: s.citas }))
        .sort((a, b) => b.ventas - a.ventas)
        .slice(0, 5)

      setVentasSemana(arrVentasSemana)
      setTopBarberos(arrTopBarberos)

      const ventasHoy =
        ventasData?.reduce((acc: number, v: { precio: number }) => acc + v.precio, 0) || 0

      setStats({
        ventasHoy,
        citasHoy: citasHoy || 0,
        clientesTotal: clientesTotal || 0,
        productosStockBajo: productosStock?.length || 0,
        pedidosPendientes: pedidosPendientes || 0,
      })

      // Uso tienda hoy
      const hoy = getTodayBolivia()
      const { data: txTienda } = await supabase
        .from('transactions')
        .select('costo')
        .eq('libro', 'USO_TIENDA')
        .eq('fecha', hoy)
      setUsoTiendaHoy(txTienda?.reduce((s: number, t: any) => s + Number(t.costo), 0) || 0)

      // Resumen Contable del período seleccionado (start -> end)
      const [ { data: txPeriodo }, { data: citasPeriodo }, { data: arqueoData } ] = await Promise.all([
        supabase
          .from('transactions')
          .select('libro, costo, tipo_movimiento, metodo_pago, monto_qr, monto_efectivo, cuenta_codigo, notas, fecha')
          .gte('fecha', start)
          .lte('fecha', end)
          .limit(10000),
        supabase
          .from('citas')
          .select('id, total, metodo_pago, anticipo_monto, estado, fecha_hora')
          .eq('estado', 'completado')
          .gte('fecha_hora', `${start}T00:00:00`)
          .lte('fecha_hora', `${end}T23:59:59`)
          .limit(10000),
        supabase
          .from('daily_closures')
          .select('cerrado, monto_apertura, total_efectivo_calculado, total_qr_calculado')
          .eq('fecha', end)
          .maybeSingle()
      ])

      let efIngresos = 0
      let efEgresos = 0
      let qrIngresos = 0
      let qrEgresos = 0
      let totalVentasFacturadas = 0

      // 1. Sumar citas completadas en el período
      if (citasPeriodo) {
        citasPeriodo.forEach((c: any) => {
          const m = Number(c.total || 0)
          totalVentasFacturadas += m
          const mp = String(c.metodo_pago || '').toLowerCase()
          if (mp === 'efectivo') {
            efIngresos += m
          } else if (mp === 'qr' || mp === 'tarjeta') {
            qrIngresos += m
          } else if (mp === 'mixto') {
            const matchEf = String(c.notas || '').match(/Efectivo:\s*Bs\s*([0-9.]+)/i)
            const matchQr = String(c.notas || '').match(/QR:\s*Bs\s*([0-9.]+)/i)
            const ef = matchEf ? parseFloat(matchEf[1]) : Math.max(0, m - 20)
            const qr = matchQr ? parseFloat(matchQr[1]) : 20
            efIngresos += ef
            qrIngresos += qr
          } else {
            efIngresos += m
          }
        })
      }

      // 2. Sumar transacciones del período
      if (txPeriodo) {
        txPeriodo.forEach((tx: any) => {
          const costo = Number(tx.costo || 0)
          const mpLower = String(tx.metodo_pago || '').toLowerCase()
          const esIngreso = tx.tipo_movimiento === 'INGRESO' || tx.tipo_movimiento === 'VENTA_PRODUCTO' || String(tx.cuenta_codigo || '').startsWith('4')

          if (esIngreso) {
            totalVentasFacturadas += costo
            if (mpLower === 'qr' || mpLower === 'tarjeta' || tx.libro === 'BANCO') {
              qrIngresos += costo
            } else {
              efIngresos += costo
            }
          } else {
            // Egreso
            if (mpLower === 'qr' || mpLower === 'tarjeta' || tx.libro === 'BANCO') {
              qrEgresos += costo
            } else {
              efEgresos += costo
            }
          }
        })
      }

      const apertura = Number(arqueoData?.monto_apertura || 0)
      const saldoCajaFisica = Math.max(0, apertura + efIngresos - efEgresos)
      const saldoBancoQr = Math.max(0, qrIngresos - qrEgresos)

      setSummaryContable({
        caja_chica: saldoCajaFisica,
        ventas: totalVentasFacturadas,
        banco: saldoBancoQr,
        total: saldoCajaFisica + saldoBancoQr,
        arqueoCerrado: arqueoData?.cerrado ?? false
      })

      // Últimos movimientos contables
      const { data: recTx } = await supabase
        .from('transactions')
        .select('id, libro, ci, nombre, glosa, costo, es_sancion, creado_en')
        .order('creado_en', { ascending: false })
        .limit(10)
      if (recTx) setRecentTx(recTx)

      setCitasRecientes((citasRecientesData as unknown as Cita[]) || [])
    } catch (error) {
      console.error('Error cargando datos:', JSON.stringify(error, null, 2), error)
    } finally {
      setLoading(false)
    }
  }, [router, supabase, rangoSeleccionado, fechaInicioStr, fechaFinStr])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 45_000)
    return () => clearInterval(interval)
  }, [loadData])

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      pendiente: 'warning',
      confirmado: 'info',
      en_proceso: 'info',
      completado: 'success',
      cancelado: 'danger',
    }
    return variants[estado] || 'default'
  }

  const handleExportCSV = () => {
    const { start, end } = getDateRange(rangoSeleccionado, fechaInicioStr, fechaFinStr)
    const ticketPromedio = stats.citasHoy > 0 ? (stats.ventasHoy / stats.citasHoy).toFixed(2) : '0.00'

    let csvContent = '\uFEFF' // UTF-8 BOM for Excel
    csvContent += `REPORTE EJECUTIVO DE ADMINISTRACIÓN - ${(brand.nombre || 'BarberSite').toUpperCase()}\n`
    csvContent += `Periodo:;${start} al ${end}\n`
    csvContent += `Generado el:;${new Date().toLocaleString('es-BO')}\n\n`

    csvContent += `--- RESUMEN DE INDICADORES (KPIs) ---\n`
    csvContent += `Indicador;Valor\n`
    csvContent += `Ventas del Período;Bs. ${stats.ventasHoy.toFixed(2)}\n`
    csvContent += `Citas Completadas;${stats.citasHoy}\n`
    csvContent += `Ticket Promedio por Cita;Bs. ${ticketPromedio}\n`
    csvContent += `Clientes Registrados;${stats.clientesTotal}\n`
    csvContent += `Saldo Caja Chica;Bs. ${summaryContable.caja_chica.toFixed(2)}\n`
    csvContent += `Saldo Banco / QR;Bs. ${summaryContable.banco.toFixed(2)}\n`
    csvContent += `Productos Stock Bajo;${stats.productosStockBajo}\n\n`

    csvContent += `--- TOP BARBEROS DEL PERÍODO ---\n`
    csvContent += `Barbero;Ventas Totales (Bs);Citas Atendidas\n`
    topBarberos.forEach(b => {
      csvContent += `"${b.nombre}";Bs. ${b.ventas.toFixed(2)};${b.citas}\n`
    })
    csvContent += `\n`

    csvContent += `--- CITAS RECIENTES --- \n`
    csvContent += `ID;Fecha/Hora;Cliente;Servicio;Barbero;Monto (Bs);Estado\n`
    citasRecientes.forEach(c => {
      const fecha = c.id ? (c as any).fecha_hora : ''
      csvContent += `"${c.id}";"${fecha}";"${c.clientes?.nombre || 'Walk-in'}";"${c.servicios?.nombre || '—'}";"${c.barberos?.full_name || '—'}";${c.precio};"${c.estado}"\n`
    })
    csvContent += `\n`

    csvContent += `--- ÚLTIMOS MOVIMIENTOS CONTABLES ---\n`
    csvContent += `Libro;Fecha;Glosa;Nombre;Monto (Bs)\n`
    recentTx.forEach(tx => {
      csvContent += `"${tx.libro}";"${tx.creado_en}";"${tx.glosa}";"${tx.nombre}";${tx.costo}\n`
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `reporte_admin_barberpro_${start}_a_${end}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportPDF = () => {
    const { start, end } = getDateRange(rangoSeleccionado, fechaInicioStr, fechaFinStr)
    const ticketPromedio = stats.citasHoy > 0 ? (stats.ventasHoy / stats.citasHoy).toFixed(2) : '0.00'

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte Ejecutivo - Barber Pro (${start} al ${end})</title>
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
              <h1 class="title">💈 ${(brand.nombre || 'BarberSite').toUpperCase()}</h1>
              <p class="subtitle">Informe Ejecutivo de Administración & Rendimiento Financiero</p>
            </div>
            <div>
              <span class="badge">Período: ${start} al ${end}</span>
            </div>
          </div>

          <div class="grid">
            <div class="kpi">
              <div class="kpi-title">Ventas del Período</div>
              <div class="kpi-value">Bs. ${stats.ventasHoy.toFixed(2)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Citas Atendidas</div>
              <div class="kpi-value">${stats.citasHoy}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Ticket Promedio</div>
              <div class="kpi-value">Bs. ${ticketPromedio}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Caja Chica Saldo</div>
              <div class="kpi-value">Bs. ${summaryContable.caja_chica.toFixed(2)}</div>
            </div>
          </div>

          <div class="section-title">Desglose de Libros Contables y Liquidez</div>
          <table>
            <thead>
              <tr>
                <th>Libro / Concepto</th>
                <th>Tipo de Saldo</th>
                <th>Estado</th>
                <th style="text-align: right">Monto Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Caja Chica (Efectivo Físico)</strong></td>
                <td>Ingresos / Egresos en Efectivo</td>
                <td>Disponible</td>
                <td style="text-align: right"><strong>Bs. ${summaryContable.caja_chica.toFixed(2)}</strong></td>
              </tr>
              <tr>
                <td><strong>Ventas y Servicios</strong></td>
                <td>Total Facturado en Período</td>
                <td>Facturado</td>
                <td style="text-align: right"><strong>Bs. ${summaryContable.ventas.toFixed(2)}</strong></td>
              </tr>
              <tr>
                <td><strong>Banco / Pagos QR</strong></td>
                <td>Transferencias y QR Ganadero</td>
                <td>Depositado</td>
                <td style="text-align: right"><strong>Bs. ${summaryContable.banco.toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Top Barberos en Rendimiento</div>
          <table>
            <thead>
              <tr>
                <th>Barbero / Profesional</th>
                <th>Citas Completadas</th>
                <th style="text-align: right">Total Recaudado</th>
              </tr>
            </thead>
            <tbody>
              ${topBarberos.map(b => `
                <tr>
                  <td><strong>${b.nombre}</strong></td>
                  <td>${b.citas} citas</td>
                  <td style="text-align: right"><strong>Bs. ${b.ventas.toFixed(2)}</strong></td>
                </tr>
              `).join('')}
              ${topBarberos.length === 0 ? '<tr><td colspan="3">Sin datos registrados en el período</td></tr>' : ''}
            </tbody>
          </table>

          <div class="footer">
            Generado automáticamente por Barber Pro Admin Suite · ${new Date().toLocaleString('es-BO')}
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando panel…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-24 lg:pb-8">
      <AdminPageHeader
        title="Panel"
        highlight="Admin"
        description="Resumen del día: ventas, citas, equipo y alertas en un solo lugar."
        actions={
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-xl px-2 py-1 overflow-x-auto w-full max-w-full sm:w-auto">
              <select 
                className="bg-transparent text-sm font-bold text-zinc-300 outline-none p-2 cursor-pointer border-none min-w-[120px]"
                value={rangoSeleccionado}
                onChange={(e) => setRangoSeleccionado(e.target.value as DateRangeOption)}
              >
                <option value="hoy" className="bg-zinc-900">Hoy</option>
                <option value="ayer" className="bg-zinc-900">Ayer</option>
                <option value="esta_semana" className="bg-zinc-900">Esta Semana</option>
                <option value="este_mes" className="bg-zinc-900">Este Mes</option>
                <option value="mes_pasado" className="bg-zinc-900">Mes Pasado</option>
                <option value="este_año" className="bg-zinc-900">Este Año</option>
                <option value="personalizado" className="bg-zinc-900">Personalizado...</option>
              </select>
              {rangoSeleccionado === 'personalizado' && (
                <div className="flex items-center gap-2 pl-2 border-l border-white/10 shrink-0">
                  <input 
                    type="date" 
                    className="bg-transparent text-sm text-zinc-300 outline-none cursor-pointer" 
                    value={fechaInicioStr} 
                    onChange={e => setFechaInicioStr(e.target.value)} 
                  />
                  <span className="text-zinc-500">-</span>
                  <input 
                    type="date" 
                    className="bg-transparent text-sm text-zinc-300 outline-none cursor-pointer" 
                    value={fechaFinStr} 
                    onChange={e => setFechaFinStr(e.target.value)} 
                  />
                </div>
              )}
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end flex-wrap">
              <Button 
                variant="outline" 
                size="md" 
                onClick={handleExportCSV}
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-bold text-xs"
                title="Exportar archivo CSV para Excel"
              >
                <Download className="w-4 h-4 mr-1.5" />
                CSV Excel
              </Button>
              <Button 
                variant="outline" 
                size="md" 
                onClick={handleExportPDF}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-bold text-xs"
                title="Generar e imprimir Reporte Ejecutivo PDF"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                PDF Ejecutivo
              </Button>
              <Button variant="secondary" size="md" onClick={() => router.push('/admin/reportes')}>
                <BarChart3 className="w-4 h-4 mr-2 hidden sm:block" />
                Reportes
              </Button>
              <Button
                variant="primary"
                size="md"
                className="shadow-lg shadow-amber-500/20 font-black uppercase tracking-wider"
                onClick={() => router.push('/admin/buscar')}
              >
                <Search className="w-4 h-4 mr-2 hidden sm:block" />
                Buscar
              </Button>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="Ventas del período"
          value={formatCurrency(stats.ventasHoy)}
          icon={DollarSign}
          variant="primary"
          delay={0}
          onClick={() => router.push('/admin/reportes')}
        />
        <StatCard
          label="Citas del período"
          value={stats.citasHoy}
          icon={Calendar}
          delay={75}
          onClick={() => router.push('/agenda')}
        />
        <StatCard
          label="Ticket Promedio"
          value={formatCurrency(stats.citasHoy > 0 ? stats.ventasHoy / stats.citasHoy : 0)}
          icon={TrendingUp}
          delay={110}
          onClick={() => router.push('/admin/reportes')}
        />
        <StatCard
          label="Clientes"
          value={stats.clientesTotal}
          icon={Users}
          delay={150}
          onClick={() => router.push('/admin/clientes')}
        />
        <StatCard
          label="Stock en alerta"
          value={stats.productosStockBajo}
          icon={Package}
          variant={stats.productosStockBajo > 0 ? 'danger' : 'default'}
          delay={225}
          onClick={() => router.push('/admin/productos')}
        />
      </div>

      {/* Libros Contables del Período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-zinc-900/80 hover:border-amber-500/30 transition-all cursor-pointer" onClick={() => router.push('/coordinador/caja-chica')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Wallet className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/70">Caja Chica</span>
            </div>
            <p className="text-xl font-black text-white">{formatCurrency(summaryContable.caja_chica)}</p>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-zinc-900/80 hover:border-green-500/30 transition-all cursor-pointer" onClick={() => router.push('/coordinador/ventas')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Receipt className="w-4 h-4 text-green-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-green-500/70">Ventas / Servicios</span>
            </div>
            <p className="text-xl font-black text-white">{formatCurrency(summaryContable.ventas)}</p>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-zinc-900/80 hover:border-blue-500/30 transition-all cursor-pointer" onClick={() => router.push('/coordinador/banco')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Landmark className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500/70">Banco</span>
            </div>
            <p className="text-xl font-black text-white">{formatCurrency(summaryContable.banco)}</p>
          </CardContent>
        </Card>

        <Card className={`border-white/5 bg-zinc-900/80 transition-all cursor-pointer ${summaryContable.arqueoCerrado ? 'hover:border-green-500/30' : 'hover:border-red-500/30 border-red-500/20'}`} onClick={() => router.push('/coordinador/arqueo')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Scale className="w-4 h-4 text-zinc-400" />
              <span className={`text-[10px] font-black uppercase tracking-widest ${summaryContable.arqueoCerrado ? 'text-green-500' : 'text-red-400'}`}>
                Arqueo
              </span>
            </div>
            <p className={`text-base font-black ${summaryContable.arqueoCerrado ? 'text-green-400' : 'text-red-400'}`}>
              {summaryContable.arqueoCerrado ? '✅ Cerrado' : '⚠️ Pendiente'}
            </p>
          </CardContent>
        </Card>
      </div>

      {usoTiendaHoy > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both">
          <Card className="border-violet-500/20 bg-violet-500/5">
            <CardContent className="py-3 px-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-500/10">
                  <Store className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-500">Uso Tienda Hoy</p>
                  <p className="text-lg font-black text-violet-300">{formatCurrency(usoTiendaHoy)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-violet-400 font-bold text-xs"
                onClick={() => router.push('/coordinador/ventas')}
              >
                Ver detalle
                <ArrowRight size={14} className="ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <AdminQuickActions />

      {/* Gráficas Mamalonas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500 delay-200 fill-mode-both">
        <Card className="border-white/5 bg-gradient-to-br from-zinc-900 to-black relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none"></div>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              Ingresos del Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={ventasSemana}>
                  <defs>
                    <linearGradient id="amberGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                  <XAxis dataKey="fecha" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff15', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                    itemStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                    formatter={(value: any) => formatCurrency(value)} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#f59e0b" 
                    strokeWidth={3.5}
                    fill="url(#amberGlow)"
                    dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 7, stroke: '#000', strokeWidth: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-gradient-to-bl from-zinc-900 to-black relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              Top Barberos del Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={topBarberos} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff05" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="nombre" type="category" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} width={80} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10', borderRadius: '12px' }}
                    itemStyle={{ color: '#a855f7', fontWeight: 'bold' }}
                    cursor={{fill: '#ffffff05'}}
                    formatter={(value: any) => formatCurrency(value)} 
                  />
                  <Bar dataKey="ventas" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Card className="border-white/5 animate-in fade-in duration-500 delay-200 fill-mode-both">
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTabTabla('citas')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    tabTabla === 'citas'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Citas del período
                </button>
                <button
                  onClick={() => setTabTabla('movimientos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    tabTabla === 'movimientos'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Últimos Movimientos
                </button>
              </div>

              {tabTabla === 'citas' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-500 font-bold text-xs"
                  onClick={() => router.push('/agenda')}
                >
                  Agenda completa
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-500 font-bold text-xs"
                  onClick={() => router.push('/coordinador/caja-chica')}
                >
                  Ver libros
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {tabTabla === 'citas' ? (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left min-w-[700px]">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="py-3 px-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                          Cliente
                        </th>
                        <th className="py-3 px-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest hidden sm:table-cell">
                          Servicio
                        </th>
                        <th className="py-3 px-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right">
                          Monto
                        </th>
                        <th className="py-3 px-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-center">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {citasRecientes.map((cita, idx) => (
                        <tr
                          key={cita.id}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors duration-200"
                        >
                          <td className="py-4 px-5">
                            <p className="font-bold text-white text-sm">
                              {cita.clientes?.nombre || 'Walk-in'}
                            </p>
                            <p className="text-[10px] text-zinc-600 sm:hidden">
                              {cita.servicios?.nombre || '—'} · {cita.barberos?.full_name || '—'}
                            </p>
                          </td>
                          <td className="py-4 px-5 hidden sm:table-cell">
                            <p className="text-sm text-zinc-300">{cita.servicios?.nombre || 'General'}</p>
                            <p className="text-[10px] text-zinc-500">{cita.barberos?.full_name || 'Sin asignar'}</p>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <p className="font-black text-amber-500">{formatCurrency(cita.precio)}</p>
                          </td>
                          <td className="py-4 px-5 text-center">
                            <Badge
                              variant={getEstadoBadge(cita.estado)}
                              className="uppercase font-black text-[10px] tracking-widest"
                            >
                              {cita.estado.replace('_', ' ')}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {citasRecientes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-16 text-center">
                            <Calendar size={40} className="mx-auto text-zinc-800 mb-3 opacity-40" />
                            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">
                              Sin citas en el período
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-4"
                              onClick={() => router.push('/admin/caja')}
                            >
                              Crear cita
                            </Button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {recentTx.length === 0 ? (
                    <div className="text-center py-12">
                      <TrendingUp className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                      <p className="text-zinc-600 font-bold text-sm">Sin movimientos registrados</p>
                    </div>
                  ) : (
                    recentTx.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-4 p-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-900 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`text-[10px] font-black uppercase tracking-widest w-20 shrink-0 ${libroColor[tx.libro] || 'text-zinc-500'}`}>
                            {libroLabel[tx.libro] || tx.libro}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                              {tx.es_sancion && <span className="text-red-400 mr-1">⚠</span>}
                              {tx.glosa}
                            </p>
                            <p className="text-[10px] text-zinc-600 font-bold">{tx.ci} — {tx.nombre}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-white">{formatCurrency(tx.costo)}</p>
                          <p className="text-[10px] text-zinc-600">
                            {new Date(tx.creado_en).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-500 delay-300 fill-mode-both">
          <AdminAsistenciaSummary onTurnosAbiertos={setTurnosAbiertos} />
          <AdminAlertsPanel
            stockBajo={stats.productosStockBajo}
            turnosAbiertos={turnosAbiertos}
            pedidosPendientes={stats.pedidosPendientes}
          />
        </div>
      </div>
    </div>
  )
}
