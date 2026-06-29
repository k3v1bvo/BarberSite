'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Wallet, Plus, X, User, ArrowRightLeft } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface PlanCuenta {
  codigo: string
  detalle: string
  tipo: string
}

interface Transaction {
  id: string
  fecha: string
  ci: string
  nombre: string
  cuenta_codigo: string
  cuenta_detalle: string
  glosa: string
  costo: number
  tipo_movimiento: string
  es_sancion: boolean
  metodo_pago: string | null
  usuario_registro: string
  libro: string
  creado_en: string
}

export default function CajaChicaPage() {
  const supabase = createClient()
  const { success: toastSuccess, error: toastError } = useToast()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cuentas, setCuentas] = useState<PlanCuenta[]>([])
  const [barberos, setBarberos] = useState<{id: string, full_name: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const hoy = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    empleado_id: '',
    ci: '',
    nombre: '',
    cuenta_codigo: '',
    glosa: '',
    costo: '',
    tipo_movimiento: 'ADELANTO',
    metodo_pago: 'efectivo',
    libro: 'CAJA_CHICA',
    notas: '',
    mixto_efectivo: '', mixto_qr: '', mixto_tarjeta: '',
  })

  const loadData = useCallback(async () => {
    const [txRes, ctasRes] = await Promise.all([
      fetch(`/api/transactions?libro=CAJA_CHICA&limit=50`),
      fetch('/api/plan-cuentas'),
    ])
    if (txRes.ok) setTransactions(await txRes.json())
    if (ctasRes.ok) setCuentas(await ctasRes.json())
    
    const { data: bList } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['barbero', 'coordinador'])
      .eq('is_active', true)
    if (bList) setBarberos(bList)
      
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const cuenta = cuentas.find((c) => c.codigo === form.cuenta_codigo)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        libro: form.libro,
        ci: form.ci,
        nombre: form.nombre,
        cuenta_codigo: form.cuenta_codigo,
        cuenta_detalle: cuenta?.detalle || form.cuenta_codigo,
        glosa: form.glosa,
        costo: parseFloat(form.costo),
        tipo_movimiento: form.tipo_movimiento,
        metodo_pago: form.metodo_pago,
        notas: form.metodo_pago === 'mixto'
          ? `Efectivo: Bs ${form.mixto_efectivo || 0} | QR: Bs ${form.mixto_qr || 0} | Tarjeta: Bs ${form.mixto_tarjeta || 0}${form.notas ? ' | ' + form.notas : ''}`
          : form.notas || null,
        empleado_id: form.empleado_id || null,
      }),
    })
    if (res.ok) {
      toastSuccess('Movimiento registrado con éxito ✅')
      setShowForm(false)
      setForm({ empleado_id: '', ci: '', nombre: '', cuenta_codigo: '', glosa: '', costo: '', tipo_movimiento: 'ADELANTO', metodo_pago: 'efectivo', libro: 'CAJA_CHICA', notas: '', mixto_efectivo: '', mixto_qr: '', mixto_tarjeta: '' })
      loadData()
    } else {
      toastError('Error al registrar el movimiento')
    }
    setSaving(false)
  }

  const handleBarberoChange = (id: string) => {
    const b = barberos.find((x) => x.id === id)
    setForm({ ...form, empleado_id: id, nombre: b?.full_name || form.nombre })
  }

  const totalHoy = transactions.filter((t) => t.fecha === hoy).reduce((s, t) => s + Number(t.costo), 0)
  const cajaChicaCuentas = cuentas.filter((c) => c.tipo === 'ACTIVO' || c.tipo === 'PATRIMONIO' || c.tipo === 'INGRESO' || c.tipo === 'EGRESO')

  // Tipos de movimiento según el libro seleccionado
  const tiposMovimiento: Record<string, {value: string, label: string}[]> = {
    CAJA_CHICA: [
      { value: 'ADELANTO', label: 'Adelanto' },
      { value: 'APORTE_CAPITAL', label: 'Aporte de Capital' },
      { value: 'DEPOSITO_BANCO', label: 'Depósito a Banco' },
      { value: 'SANCCION', label: 'Sanción' },
      { value: 'OTRO', label: 'Otro' },
    ],
    VENTAS: [
      { value: 'VENTA', label: 'Venta' },
      { value: 'DEVOLUCION', label: 'Devolución' },
    ],
    SERVICIOS: [
      { value: 'SERVICIO', label: 'Servicio' },
      { value: 'PROPINA', label: 'Propina' },
    ],
    EGRESOS: [
      { value: 'GASTO', label: 'Gasto' },
      { value: 'COMPRA', label: 'Compra' },
      { value: 'PAGO', label: 'Pago' },
    ],
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            Caja <span className="text-amber-500">Chica</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Adelantos, aportes, depósitos, sanciones</p>
        </div>
        <div className="flex items-center gap-4">
          <Card className="border-white/5 bg-zinc-900/80">
            <CardContent className="px-4 py-3 flex items-center gap-3">
              <Wallet className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Hoy</p>
                <p className="text-lg font-black text-white">{formatCurrency(totalHoy)}</p>
              </div>
            </CardContent>
          </Card>
          <Button variant="primary" onClick={() => setShowForm(!showForm)} className="gap-2 font-black uppercase tracking-wider">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cerrar' : 'Nuevo'}
          </Button>
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <Card className="border-amber-500/30 bg-zinc-900/80 animate-in slide-in-from-top-2 duration-300">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Fila 1: Libro y Quién registra */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1 block">📚 Libro / Categoría</label>
                  <select
                    value={form.libro}
                    onChange={(e) => setForm({ ...form, libro: e.target.value, tipo_movimiento: tiposMovimiento[e.target.value]?.[0]?.value || 'OTRO' })}
                    className="w-full h-11 bg-zinc-950 border border-amber-500/30 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none appearance-none font-bold"
                  >
                    <option value="CAJA_CHICA">💰 Caja Chica</option>
                    <option value="VENTAS">🛒 Ventas</option>
                    <option value="SERVICIOS">✂️ Servicios</option>
                    <option value="EGRESOS">📤 Egresos</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1 block">👤 A quién pertenece (Empleado)</label>
                  <select
                    value={form.empleado_id} onChange={(e) => handleBarberoChange(e.target.value)}
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none appearance-none"
                  >
                    <option value="">Sin empleado (externo)</option>
                    {barberos.map((b) => (
                      <option key={b.id} value={b.id}>{b.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fila 2: CI y Nombre */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">C.I.</label>
                  <input
                    value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })}
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Nombre</label>
                  <input
                    value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Fila 3: Cuenta, Tipo, Método Pago */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Cuenta (Código — Detalle)</label>
                  <select
                    value={form.cuenta_codigo} onChange={(e) => setForm({ ...form, cuenta_codigo: e.target.value })}
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none appearance-none"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {cajaChicaCuentas.map((c) => (
                      <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.detalle}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Tipo de Movimiento</label>
                  <select
                    value={form.tipo_movimiento} onChange={(e) => setForm({ ...form, tipo_movimiento: e.target.value })}
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none appearance-none"
                  >
                    {(tiposMovimiento[form.libro] || tiposMovimiento.CAJA_CHICA).map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1 block">💳 Método de Pago</label>
                  <select
                    value={form.metodo_pago} onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}
                    className="w-full h-11 bg-zinc-950 border border-amber-500/30 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none appearance-none font-bold"
                  >
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="qr">📱 QR / Transferencia</option>
                    <option value="tarjeta">💳 Tarjeta</option>
                    <option value="mixto">🔄 Mixto</option>
                  </select>
                </div>
              </div>

              {/* Fila 4: Glosa y Monto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Glosa / Descripción</label>
                  <input
                    value={form.glosa} onChange={(e) => setForm({ ...form, glosa: e.target.value })}
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none"
                    placeholder="Descripción del movimiento"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Monto (Bs)</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })}
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Desglose Mixto */}
              {form.metodo_pago === 'mixto' && (
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-3">🔄 Desglose Mixto</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">💵 Efectivo (Bs)</label>
                      <input type="number" step="0.01" min="0" value={form.mixto_efectivo}
                        onChange={(e) => setForm({ ...form, mixto_efectivo: e.target.value })}
                        placeholder="0.00"
                        className="w-full h-11 bg-zinc-950 border border-amber-500/30 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">📱 QR / Transf. (Bs)</label>
                      <input type="number" step="0.01" min="0" value={form.mixto_qr}
                        onChange={(e) => setForm({ ...form, mixto_qr: e.target.value })}
                        placeholder="0.00"
                        className="w-full h-11 bg-zinc-950 border border-amber-500/30 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">💳 Tarjeta (Bs)</label>
                      <input type="number" step="0.01" min="0" value={form.mixto_tarjeta}
                        onChange={(e) => setForm({ ...form, mixto_tarjeta: e.target.value })}
                        placeholder="0.00"
                        className="w-full h-11 bg-zinc-950 border border-amber-500/30 rounded-xl px-4 text-sm text-white focus:border-amber-500/50 outline-none"
                      />
                    </div>
                  </div>
                  {form.costo && (parseFloat(form.mixto_efectivo || '0') + parseFloat(form.mixto_qr || '0') + parseFloat(form.mixto_tarjeta || '0')) !== parseFloat(form.costo) && (
                    <p className="text-red-400 text-xs mt-2 font-bold">
                      ⚠ La suma ({formatCurrency(parseFloat(form.mixto_efectivo || '0') + parseFloat(form.mixto_qr || '0') + parseFloat(form.mixto_tarjeta || '0'))}) no coincide con el monto total ({formatCurrency(parseFloat(form.costo))})
                    </p>
                  )}
                </div>
              )}

              {/* Acciones */}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" disabled={saving} className="font-black uppercase tracking-wider">
                  {saving ? 'Guardando...' : 'Registrar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tabla */}
      <Card className="border-white/5 bg-zinc-900/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Fecha</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Registrado por</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Nombre (A quién)</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Código — Detalle</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Glosa</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Tipo</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Pago</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-zinc-600">No hay registros aún</td></tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{tx.fecha}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-amber-500/60" />
                          <span className="text-amber-400 text-xs font-semibold">{tx.usuario_registro}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white font-bold">{tx.nombre}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-zinc-500 text-[10px] font-mono">{tx.cuenta_codigo}</span>
                          <span className="text-zinc-300 text-xs">{tx.cuenta_detalle}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {tx.es_sancion && <span className="text-red-400 mr-1">⚠</span>}
                        {tx.glosa}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={tx.es_sancion ? 'danger' : 'default'} className="text-[10px] uppercase">
                          {tx.tipo_movimiento}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={tx.metodo_pago === 'qr' ? 'info' : tx.metodo_pago === 'mixto' ? 'warning' : 'default'}
                          className="text-[10px] uppercase"
                        >
                          {tx.metodo_pago === 'efectivo' ? '💵 Efect.' : tx.metodo_pago === 'qr' ? '📱 QR' : tx.metodo_pago || '—'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-white">{formatCurrency(tx.costo)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
