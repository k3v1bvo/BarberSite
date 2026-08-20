'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { Coins, Calculator } from 'lucide-react'

interface Barbero {
  id: string
  full_name: string
}

interface ResumenBarbero {
  barbero_id: string
  nombre: string
  total_ventas: number
  comision: number
}

export default function ComisionesPage() {
  const supabase = createClient()
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [resumen, setResumen] = useState<ResumenBarbero[]>([])
  const [loading, setLoading] = useState(true)
  const [mesActual, setMesActual] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    // Barberos
    const { data: bList } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'barbero')
      .eq('is_active', true)

    if (!bList) { setLoading(false); return }
    setBarberos(bList)

    // Citas completadas del mes
    const [year, month] = mesActual.split('-').map(Number)
    const desde = `${year}-${String(month).padStart(2, '0')}-01`
    const hasta = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const { data: citas } = await supabase
      .from('citas')
      .select('barbero_id, precio, comision_barbero')
      .eq('estado', 'completado')
      .gte('fecha_hora', desde)
      .lt('fecha_hora', hasta)

    const mapaVentas: Record<string, number> = {}
    const mapaComisiones: Record<string, number> = {}
    citas?.forEach((c) => {
      if (c.barbero_id) {
        mapaVentas[c.barbero_id] = (mapaVentas[c.barbero_id] || 0) + Number(c.precio || 0)
        mapaComisiones[c.barbero_id] = (mapaComisiones[c.barbero_id] || 0) + Number(c.comision_barbero || 0)
      }
    })

    const resumenCalc: ResumenBarbero[] = bList.map((b) => {
      const totalVentas = mapaVentas[b.id] || 0
      const comision = mapaComisiones[b.id] || 0
      return {
        barbero_id: b.id,
        nombre: b.full_name,
        total_ventas: totalVentas,
        comision: comision,
      }
    })

    setResumen(resumenCalc.sort((a, b) => b.comision - a.comision))
    setLoading(false)
  }, [supabase, mesActual])

  useEffect(() => { loadData() }, [loadData])

  const totalComisiones = resumen.reduce((s, r) => s + r.comision, 0)
  const totalVentas = resumen.reduce((s, r) => s + r.total_ventas, 0)

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-purple-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            <span className="text-purple-500">Comisiones</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Cálculo automático basado en citas completadas</p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={mesActual}
            onChange={(e) => setMesActual(e.target.value)}
            className="h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-purple-500/50 outline-none"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Ventas (mes)</p>
            <p className="text-2xl font-black text-green-400">{formatCurrency(totalVentas)}</p>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Comisiones</p>
            <p className="text-2xl font-black text-purple-400">{formatCurrency(totalComisiones)}</p>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Barberos activos</p>
            <p className="text-2xl font-black text-white">{barberos.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de comisiones */}
      <Card className="border-white/5 bg-zinc-900/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Barbero</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Ventas</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Comisión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {resumen.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-zinc-600">No hay datos para este mes</td></tr>
                ) : (
                  resumen.map((r) => (
                    <tr key={r.barbero_id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-4 text-white font-bold">{r.nombre}</td>
                      <td className="px-4 py-4 text-right text-green-400 font-bold">{formatCurrency(r.total_ventas)}</td>
                      <td className="px-4 py-4 text-right font-black text-purple-400 text-lg">{formatCurrency(r.comision)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {resumen.length > 0 && (
                <tfoot>
                  <tr className="border-t border-white/10 bg-zinc-950/50">
                    <td className="px-4 py-3 font-black text-zinc-400 uppercase text-xs tracking-widest">Total</td>
                    <td className="px-4 py-3 text-right font-black text-green-400">{formatCurrency(totalVentas)}</td>
                    <td className="px-4 py-3 text-right font-black text-purple-400 text-lg">{formatCurrency(totalComisiones)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
