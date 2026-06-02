'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import {
  Users,
  DollarSign,
  Package,
  Calendar,
  ArrowRight,
  Search,
  BarChart3,
} from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { StatCard } from '@/components/admin/StatCard'
import { AdminQuickActions } from '@/components/admin/AdminQuickActions'
import { AdminAlertsPanel } from '@/components/admin/AdminAlertsPanel'
import { AdminAsistenciaSummary } from '@/components/admin/AdminAsistenciaSummary'

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
  const [stats, setStats] = useState<Stats>({
    ventasHoy: 0,
    citasHoy: 0,
    clientesTotal: 0,
    productosStockBajo: 0,
    pedidosPendientes: 0,
  })
  const [turnosAbiertos, setTurnosAbiertos] = useState(0)
  const [citasRecientes, setCitasRecientes] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const loadData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const hoy = new Date().toISOString().split('T')[0]

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
          .gte('fecha_hora', `${hoy}T00:00:00`)
          .lte('fecha_hora', `${hoy}T23:59:59`),
        supabase
          .from('citas')
          .select('*', { count: 'exact', head: true })
          .gte('fecha_hora', `${hoy}T00:00:00`)
          .lte('fecha_hora', `${hoy}T23:59:59`),
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
          clientes (nombre),
          barberos (full_name),
          servicios (nombre)
        `
          )
          .gte('fecha_hora', `${hoy}T00:00:00`)
          .order('fecha_hora', { ascending: false })
          .limit(8),
      ])

      const ventasHoy =
        ventasData?.reduce((acc: number, v: { precio: number }) => acc + v.precio, 0) || 0

      setStats({
        ventasHoy,
        citasHoy: citasHoy || 0,
        clientesTotal: clientesTotal || 0,
        productosStockBajo: productosStock?.length || 0,
        pedidosPendientes: pedidosPendientes || 0,
      })

      setCitasRecientes((citasRecientesData as unknown as Cita[]) || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

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
          <>
            <Button variant="secondary" size="md" onClick={() => router.push('/admin/reportes')}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Reportes
            </Button>
            <Button
              variant="primary"
              size="md"
              className="shadow-lg shadow-amber-500/20 font-black uppercase tracking-wider"
              onClick={() => router.push('/admin/buscar')}
            >
              <Search className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Ventas de hoy"
          value={formatCurrency(stats.ventasHoy)}
          icon={DollarSign}
          variant="primary"
          delay={0}
          onClick={() => router.push('/admin/reportes')}
        />
        <StatCard
          label="Citas hoy"
          value={stats.citasHoy}
          icon={Calendar}
          delay={75}
          onClick={() => router.push('/agenda')}
        />
        <StatCard
          label="Clientes"
          value={stats.clientesTotal}
          icon={Users}
          delay={150}
          onClick={() => router.push('/admin/usuarios')}
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

      <AdminQuickActions />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Card className="border-white/5 animate-in fade-in duration-500 delay-200 fill-mode-both">
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                Citas de hoy
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-500 font-bold"
                onClick={() => router.push('/agenda')}
              >
                Agenda completa
                <ArrowRight size={14} className="ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
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
                        className="border-b border-white/5 hover:bg-white/5 transition-colors duration-200 animate-in fade-in slide-in-from-left-1 fill-mode-both"
                        style={{ animationDelay: `${idx * 40}ms` }}
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
                            Sin citas registradas hoy
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => router.push('/reservar')}
                          >
                            Crear cita
                          </Button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
