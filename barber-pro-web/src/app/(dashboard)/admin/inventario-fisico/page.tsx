'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { formatCurrency } from '@/lib/utils'
import { ClipboardCheck, AlertTriangle, Package, Check, ArrowUpDown, History, TrendingDown, TrendingUp, Save } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Producto {
  id: string
  nombre: string
  sku: string | null
  stock_actual: number
  stock_minimo: number
  precio_venta: number
  categoria: string | null
  is_active: boolean
}

interface ConteoItem {
  producto_id: string
  conteo: string
  ajustado: boolean
}

interface Movimiento {
  id: string
  producto_id: string
  tipo: string
  cantidad: number
  motivo: string | null
  created_at: string
  productos: { nombre: string; sku: string | null } | null
  profiles: { full_name: string } | null
}

export default function InventarioFisicoPage() {
  const { success, error: toastError } = useToast()
  const supabase = createClient()
  const [productos, setProductos] = useState<Producto[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [conteos, setConteos] = useState<Record<string, ConteoItem>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [tab, setTab] = useState<'conteo' | 'historial'>('conteo')

  const loadData = useCallback(async () => {
    const [prodRes, movRes] = await Promise.all([
      supabase.from('productos').select('*').eq('is_active', true).order('nombre'),
      fetch('/api/inventario?limit=80'),
    ])

    if (prodRes.data) setProductos(prodRes.data as Producto[])
    if (movRes.ok) setMovimientos(await movRes.json())
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const updateConteo = (productoId: string, value: string) => {
    setConteos(prev => ({
      ...prev,
      [productoId]: { producto_id: productoId, conteo: value, ajustado: false },
    }))
  }

  const ajustarProducto = async (producto: Producto) => {
    const conteoItem = conteos[producto.id]
    if (!conteoItem || conteoItem.conteo === '') return

    const conteoFisico = parseInt(conteoItem.conteo)
    if (isNaN(conteoFisico) || conteoFisico < 0) {
      toastError('Valor inválido')
      return
    }

    if (conteoFisico === producto.stock_actual) {
      setConteos(prev => ({
        ...prev,
        [producto.id]: { ...conteoItem, ajustado: true },
      }))
      return
    }

    setSaving(producto.id)
    try {
      const res = await fetch('/api/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: producto.id,
          conteo_fisico: conteoFisico,
          motivo: `Conteo físico manual`,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        const diff = result.diferencia
        success(`${producto.nombre}: ${diff > 0 ? '+' : ''}${diff} unidades ajustadas`)
        setConteos(prev => ({
          ...prev,
          [producto.id]: { ...conteoItem, ajustado: true },
        }))
        loadData()
      } else {
        const err = await res.json()
        toastError(err.error || 'Error al ajustar')
      }
    } catch {
      toastError('Error de conexión')
    }
    setSaving(null)
  }

  const stockBajo = productos.filter(p => p.stock_actual <= p.stock_minimo)
  const agotados = productos.filter(p => p.stock_actual === 0)
  const valorTotal = productos.reduce((s, p) => s + p.stock_actual * p.precio_venta, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <AdminPageHeader
        title="Conteo Físico"
        highlight="Inventario"
        description="Registra el conteo físico de productos y ajusta diferencias automáticamente."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="px-4 py-4">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Productos</p>
                <p className="text-xl font-black text-white">{productos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="px-4 py-4">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Stock Bajo</p>
                <p className="text-xl font-black text-red-400">{stockBajo.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="px-4 py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Agotados</p>
                <p className="text-xl font-black text-orange-400">{agotados.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900/80">
          <CardContent className="px-4 py-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Valor Total</p>
                <p className="text-lg font-black text-green-400">{formatCurrency(valorTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {agotados.length > 0 && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse shrink-0" />
            <div>
              <p className="text-sm font-bold text-white">⚠️ Productos agotados: {agotados.map(p => p.nombre).join(', ')}</p>
              <p className="text-xs text-zinc-400">Requieren reposición inmediata</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === 'conteo' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('conteo')}
          className="font-black uppercase tracking-wider">
          <ClipboardCheck className="w-4 h-4 mr-2" />
          Conteo Físico
        </Button>
        <Button variant={tab === 'historial' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('historial')}
          className="font-black uppercase tracking-wider">
          <History className="w-4 h-4 mr-2" />
          Historial Movimientos
        </Button>
      </div>

      {tab === 'conteo' ? (
        <Card className="border-white/5 bg-zinc-900/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Producto</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">SKU</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Stock Sistema</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Mínimo</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Conteo Físico</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Diferencia</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Estado</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {productos.map((p) => {
                    const conteoItem = conteos[p.id]
                    const conteoVal = conteoItem?.conteo ?? ''
                    const diferencia = conteoVal !== '' ? parseInt(conteoVal) - p.stock_actual : null
                    const isStockBajo = p.stock_actual <= p.stock_minimo

                    return (
                      <tr key={p.id} className={`hover:bg-white/[0.02] transition-colors ${isStockBajo ? 'bg-red-500/5' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="text-white font-bold">{p.nombre}</p>
                          <p className="text-[10px] text-zinc-500 uppercase">{p.categoria || 'Sin categoría'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-[10px] font-black text-zinc-400 bg-white/5 px-2 py-1 rounded-md">{p.sku || 'N/A'}</code>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-lg font-black ${isStockBajo ? 'text-red-400' : 'text-white'}`}>{p.stock_actual}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-500 font-bold">{p.stock_minimo}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number" min="0"
                            placeholder="—"
                            value={conteoVal}
                            onChange={(e) => updateConteo(p.id, e.target.value)}
                            disabled={conteoItem?.ajustado}
                            className="w-20 h-9 bg-zinc-950 border border-white/10 rounded-lg px-3 text-sm text-center text-white font-bold focus:border-amber-500/50 outline-none disabled:opacity-50"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {diferencia !== null && !isNaN(diferencia) ? (
                            <span className={`font-black text-sm ${
                              diferencia === 0 ? 'text-zinc-500' :
                              diferencia > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {diferencia > 0 ? '+' : ''}{diferencia}
                            </span>
                          ) : (
                            <span className="text-zinc-700">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {conteoItem?.ajustado ? (
                            <Badge variant="success" className="text-[10px] uppercase font-black">
                              <Check className="w-3 h-3 mr-1" /> OK
                            </Badge>
                          ) : isStockBajo ? (
                            <Badge variant="danger" className="text-[10px] uppercase font-black">Bajo</Badge>
                          ) : (
                            <Badge variant="default" className="text-[10px] uppercase font-black">Pendiente</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!conteoItem?.ajustado && conteoVal !== '' && (
                            <Button
                              variant="primary" size="sm"
                              disabled={saving === p.id}
                              onClick={() => ajustarProducto(p)}
                              className="text-[10px] uppercase font-black tracking-wider"
                            >
                              {saving === p.id ? (
                                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-3 h-3 mr-1" />
                                  Ajustar
                                </>
                              )}
                            </Button>
                          )}
                          {conteoItem?.ajustado && (
                            <span className="text-green-500 text-xs">✓</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {productos.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-16 text-center text-zinc-600">
                      <Package className="w-12 h-12 mx-auto opacity-20 mb-3" />
                      <p className="font-bold uppercase tracking-widest text-xs">No hay productos activos</p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Historial de movimientos */
        <Card className="border-white/5 bg-zinc-900/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Fecha</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Producto</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Tipo</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Cantidad</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Motivo</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {movimientos.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-16 text-center text-zinc-600">
                      <History className="w-12 h-12 mx-auto opacity-20 mb-3" />
                      <p className="font-bold uppercase tracking-widest text-xs">Sin movimientos registrados</p>
                    </td></tr>
                  ) : (
                    movimientos.map((m) => (
                      <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap text-xs">
                          {new Date(m.created_at).toLocaleString('es-BO')}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-bold">{m.productos?.nombre || '—'}</p>
                          {m.productos?.sku && <p className="text-[10px] text-zinc-500 font-mono">{m.productos.sku}</p>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={m.tipo === 'entrada' ? 'success' : 'danger'} className="text-[10px] uppercase font-black">
                            {m.tipo === 'entrada' ? '↑ Entrada' : '↓ Salida'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center font-black text-white">{m.cantidad}</td>
                        <td className="px-4 py-3 text-zinc-400 text-xs">{m.motivo || '—'}</td>
                        <td className="px-4 py-3 text-zinc-400 text-xs">{m.profiles?.full_name || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
