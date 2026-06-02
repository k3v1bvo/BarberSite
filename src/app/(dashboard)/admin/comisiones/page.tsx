'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, DollarSign, CheckCircle, Filter, Download, Edit } from 'lucide-react'

export default function AdminComisionesPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  const [citas, setCitas] = useState<any[]>([])
  const [pagos, setPagos] = useState<any[]>([])
  const [barberos, setBarberos] = useState<any[]>([])
  const [resumen, setResumen] = useState({ pendiente: 0, pagado: 0, hoy: 0, semana: 0 })
  const [barberoId, setBarberoId] = useState('')
  const [estado, setEstado] = useState('pendiente')
  const [metodoPago, setMetodoPago] = useState('Efectivo')
  const [periodo, setPeriodo] = useState<'diario' | 'semanal' | 'personalizado'>('semanal')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ estado })
      if (barberoId) params.set('barbero_id', barberoId)
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/comisiones?${params}`),
        fetch('/api/comisiones/pagos'),
      ])
      const cJson = await cRes.json()
      const pJson = await pRes.json()
      setCitas(cJson.citas ?? [])
      setResumen(cJson.resumen ?? { pendiente: 0, pagado: 0, hoy: 0, semana: 0 })
      setPagos(pJson.pagos ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().from('profiles').select('id, full_name').eq('role', 'barbero').eq('is_active', true).then(({ data }) => {
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
    const hoy = new Date()
    let inicio = hoy.toISOString().slice(0, 10)
    let fin = inicio
    if (periodo === 'semanal') {
      const d = new Date(hoy)
      d.setDate(d.getDate() - d.getDay())
      inicio = d.toISOString().slice(0, 10)
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
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success('Comisiones marcadas como pagadas')
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

  const exportarCSV = () => {
    const rows = [
      ['Fecha', 'Barbero', 'Servicio', 'Cliente', 'Comisión', 'Estado'],
      ...citas.map((c) => [
        new Date(c.fecha_hora).toLocaleDateString('es-BO'),
        c.barbero?.full_name || '',
        c.servicios?.nombre || '',
        c.clientes?.nombre || '',
        String(c.comision_barbero || 0),
        c.comision_pagada ? 'Pagada' : 'Pendiente',
      ]),
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
        <Button variant="outline" onClick={exportarCSV} disabled={!citas.length}>
          <Download className="w-4 h-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pendiente', value: resumen.pendiente, color: 'text-amber-500' },
          { label: 'Hoy', value: resumen.hoy, color: 'text-white' },
          { label: 'Semana', value: resumen.semana, color: 'text-zinc-300' },
          { label: 'Pagado', value: resumen.pagado, color: 'text-green-500' },
        ].map((s) => (
          <Card key={s.label} className="bg-zinc-900 border-white/5">
            <CardContent className="p-6">
              <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">{s.label}</p>
              <p className={`text-3xl font-black mt-2 ${s.color}`}>{formatCurrency(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-zinc-900 border-white/5">
        <CardHeader><CardTitle className="text-white uppercase text-sm flex items-center gap-2"><Filter size={16} /> Filtros y pago</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <select className="h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-white" value={barberoId} onChange={(e) => setBarberoId(e.target.value)}>
            <option value="">Todos los barberos</option>
            {barberos.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
          </select>
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
          <Input placeholder="Método de pago" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className="max-w-[180px]" />
          <Button variant="primary" onClick={marcarPagadas} disabled={!barberoId || estado !== 'pendiente'}>
            <CheckCircle className="w-4 h-4 mr-2" /> Marcar pagadas
          </Button>
        </CardContent>
      </Card>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 uppercase text-[10px] tracking-widest border-b border-white/5">
              <th className="text-left py-3 px-4">Fecha</th>
              <th className="text-left py-3 px-4">Barbero</th>
              <th className="text-left py-3 px-4">Servicio</th>
              <th className="text-left py-3 px-4">Cliente</th>
              <th className="text-right py-3 px-4">Comisión</th>
              <th className="text-right py-3 px-4">Estado</th>
              <th className="text-right py-3 px-4">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-zinc-600">Cargando...</td></tr>
            ) : citas.map((c) => (
              <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-3 px-4 text-zinc-400">{new Date(c.fecha_hora).toLocaleDateString('es-BO')}</td>
                <td className="py-3 px-4 text-white font-bold">{c.barbero?.full_name}</td>
                <td className="py-3 px-4">{c.servicios?.nombre}</td>
                <td className="py-3 px-4">{c.clientes?.nombre || '—'}</td>
                <td className="py-3 px-4 text-right font-black text-amber-500">{formatCurrency(c.comision_barbero || 0)}</td>
                <td className="py-3 px-4 text-right">
                  <Badge variant={c.comision_pagada ? 'success' : 'warning'}>{c.comision_pagada ? 'Pagada' : 'Pendiente'}</Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  {!c.comision_pagada && (
                    <Button variant="outline" size="sm" onClick={() => editarComision(c.id, c.comision_barbero || 0)}>
                      <Edit className="w-3 h-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
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
    </div>
  )
}
