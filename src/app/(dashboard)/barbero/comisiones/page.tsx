'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { DollarSign, Clock, CheckCircle, History } from 'lucide-react'

export default function BarberoComisionesPage() {
  const [citas, setCitas] = useState<any[]>([])
  const [pagos, setPagos] = useState<any[]>([])
  const [resumen, setResumen] = useState({ pendiente: 0, pagado: 0, hoy: 0, semana: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/comisiones?estado=pendiente'),
      fetch('/api/comisiones/pagos'),
    ]).then(async ([cRes, pRes]) => {
      const cJson = await cRes.json()
      const pJson = await pRes.json()
      setCitas(cJson.citas ?? [])
      setResumen(cJson.resumen ?? { pendiente: 0, pagado: 0, hoy: 0, semana: 0 })
      setPagos(pJson.pagos ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-4xl font-black text-white uppercase">Mis <span className="text-amber-500">Comisiones</span></h1>
        <p className="text-zinc-500 mt-2">Detalle diario, semanal e historial de pagos</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pendiente', value: resumen.pendiente, icon: Clock },
          { label: 'Hoy', value: resumen.hoy, icon: DollarSign },
          { label: 'Semana', value: resumen.semana, icon: DollarSign },
          { label: 'Pagado', value: resumen.pagado, icon: CheckCircle },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="bg-zinc-900 border-white/5">
            <CardContent className="p-6">
              <Icon className="w-5 h-5 text-amber-500 mb-2" />
              <p className="text-[10px] font-black uppercase text-zinc-600">{label}</p>
              <p className="text-2xl font-black text-white mt-1">{formatCurrency(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-zinc-900 border-white/5">
        <CardHeader><CardTitle className="text-white uppercase text-sm">Comisiones pendientes por servicio</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {citas.length === 0 ? (
            <p className="text-zinc-600 text-sm py-8 text-center">No tienes comisiones pendientes</p>
          ) : citas.map((c) => (
            <div key={c.id} className="flex justify-between items-center py-3 border-b border-white/5">
              <div>
                <p className="font-bold text-white">{c.servicios?.nombre}</p>
                <p className="text-xs text-zinc-500">{new Date(c.fecha_hora).toLocaleDateString('es-BO')} — {c.clientes?.nombre || 'Cliente'}</p>
              </div>
              <p className="font-black text-amber-500">{formatCurrency(c.comision_barbero || 0)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {pagos.length > 0 && (
        <Card className="bg-zinc-900 border-white/5">
          <CardHeader><CardTitle className="text-white uppercase text-sm flex items-center gap-2"><History size={16} /> Pagos recibidos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pagos.map((p: any) => (
              <div key={p.id} className="flex justify-between py-2 border-b border-white/5 text-sm">
                <span className="text-zinc-400">{p.periodo_tipo} — {new Date(p.pagado_at).toLocaleDateString('es-BO')}</span>
                <Badge variant="success">{formatCurrency(p.monto_total)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
