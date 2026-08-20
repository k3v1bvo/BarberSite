'use client'

import { Package, Clock, ShoppingBag, ArrowRight, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'

interface AdminAlertsPanelProps {
  stockBajo: number
  turnosAbiertos: number
  pedidosPendientes: number
}

export function AdminAlertsPanel({
  stockBajo,
  turnosAbiertos,
  pedidosPendientes,
}: AdminAlertsPanelProps) {
  const router = useRouter()
  const total = (stockBajo > 0 ? 1 : 0) + (turnosAbiertos > 0 ? 1 : 0) + (pedidosPendientes > 0 ? 1 : 0)

  return (
    <Card className="border-white/5 overflow-hidden">
      <CardHeader className="py-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Centro de alertas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {total === 0 ? (
          <div className="text-center py-8 text-zinc-600">
            <p className="text-[10px] font-black uppercase tracking-widest">Sin alertas activas</p>
            <p className="text-xs mt-2 text-zinc-500">Operación al día</p>
          </div>
        ) : (
          <>
            {stockBajo > 0 && (
              <AlertRow
                tone="danger"
                icon={Package}
                title="Stock bajo"
                detail={`${stockBajo} producto${stockBajo > 1 ? 's' : ''} por reponer`}
                onAction={() => router.push('/admin/productos')}
                actionLabel="Inventario"
              />
            )}
            {turnosAbiertos > 0 && (
              <AlertRow
                tone="warning"
                icon={Clock}
                title="Turnos sin cerrar"
                detail={`${turnosAbiertos} colaborador${turnosAbiertos > 1 ? 'es' : ''} con entrada activa`}
                onAction={() => router.push('/admin/asistencia')}
                actionLabel="Asistencia"
              />
            )}
            {pedidosPendientes > 0 && (
              <AlertRow
                tone="info"
                icon={ShoppingBag}
                title="Pedidos pendientes"
                detail={`${pedidosPendientes} en espera de gestión`}
                onAction={() => router.push('/admin/pedidos')}
                actionLabel="Ver pedidos"
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AlertRow({
  tone,
  icon: Icon,
  title,
  detail,
  onAction,
  actionLabel,
}: {
  tone: 'danger' | 'warning' | 'info'
  icon: typeof Package
  title: string
  detail: string
  onAction: () => void
  actionLabel: string
}) {
  const tones = {
    danger: 'bg-red-500/10 border-red-500/20 text-red-400',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  }

  return (
    <div className={cnRow(tones[tone])}>
      <div className="flex gap-3">
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="font-black text-xs uppercase tracking-widest">{title}</p>
          <p className="text-sm text-zinc-400 mt-0.5">{detail}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full mt-3 border-white/10 uppercase font-black text-[10px] tracking-widest group"
        onClick={onAction}
      >
        {actionLabel}
        <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
      </Button>
    </div>
  )
}

function cnRow(base: string) {
  return `p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.01] ${base}`
}
