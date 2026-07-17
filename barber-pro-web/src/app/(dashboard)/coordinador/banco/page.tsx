'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { Landmark, Plus, X, ArrowUpRight, ArrowDownLeft, User, Building, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Transaction {
  id: string; fecha: string; ci: string; nombre: string
  glosa: string; costo: number; tipo_movimiento: string; creado_en: string
  libro: string; metodo_pago?: string; monto_qr?: number; subcategoria?: string; comprobante_url?: string | null
}

interface Profile {
  id: string
  full_name: string
  role: string
}

export default function BancoPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showSaldoModal, setShowSaldoModal] = useState(false)
  const [nuevoSaldoReal, setNuevoSaldoReal] = useState('')
  const [ajusteMotivo, setAjusteMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const supabase = createClient()

  // Estado del formulario de nuevo movimiento
  const [form, setForm] = useState({
    tipo_movimiento: 'DEPOSITO', // DEPOSITO o RETIRO
    destinatario_tipo: 'proveedor', // 'barbero' o 'proveedor'
    barbero_id: '',
    ci: '',
    nombre: '',
    glosa: '',
    costo: '',
    subcategoria: 'GASTO_GENERAL',
    comprobante_url: ''
  })

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile) setUserRole(profile.role)
    }

    const [txRes, profRes] = await Promise.all([
      fetch('/api/transactions?libro=BANCO&limit=100'),
      supabase.from('profiles').select('id, full_name, role').in('role', ['barbero', 'admin', 'coordinador']).eq('is_active', true).order('full_name')
    ])

    if (txRes.ok) {
      setTransactions(await txRes.json())
    }
    if (profRes.data) {
      setProfiles(profRes.data)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const getMontoBanco = (t: any) => {
    if (t.monto_qr && Number(t.monto_qr) > 0) return Number(t.monto_qr)
    if (t.metodo_pago === 'mixto') return Number(t.monto_qr || 0)
    if (t.metodo_pago === 'qr' || t.metodo_pago === 'tarjeta' || t.libro === 'BANCO') return Number(t.costo || 0)
    if (t.libro === 'SERVICIOS' || t.libro === 'VENTAS') return Number(t.monto_qr || 0)
    return Number(t.costo || 0)
  }

  const isRetiroBanco = (t: any) => {
    return t.tipo_movimiento === 'RETIRO' || t.tipo_movimiento === 'EGRESO' || t.libro === 'EGRESOS' || String(t.cuenta_codigo || '').startsWith('EGR')
  }

  const totalBalance = transactions.reduce((s, t) => {
    const monto = getMontoBanco(t)
    return isRetiroBanco(t) ? s - monto : s + monto
  }, 0)

  // Cálculo en tiempo real de diferencia del modal de ajuste
  const saldoDeseadoNum = parseFloat(nuevoSaldoReal)
  const diferenciaAjuste = !isNaN(saldoDeseadoNum) ? saldoDeseadoNum - totalBalance : 0

  const handleAjusteSaldo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (userRole !== 'admin') return
    if (isNaN(saldoDeseadoNum)) return
    if (Math.abs(diferenciaAjuste) < 0.01) {
      setShowSaldoModal(false)
      return
    }

    if (!ajusteMotivo.trim()) {
      alert('Por favor indica el motivo o razón del ajuste bancario.')
      return
    }

    setSaving(true)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        libro: 'BANCO',
        ci: '000000',
        nombre: 'SISTEMA — AJUSTE CONCILIACIÓN',
        cuenta_codigo: '1.1.1.4.1',
        cuenta_detalle: 'Caja de ahorro M.N. BANCO GANADERO (AJUSTE REAL)',
        glosa: `${ajusteMotivo.trim()} (Ajuste a ${formatCurrency(saldoDeseadoNum)})`,
        costo: Math.abs(diferenciaAjuste),
        tipo_movimiento: diferenciaAjuste > 0 ? 'DEPOSITO' : 'RETIRO',
        metodo_pago: 'qr',
        subcategoria: 'AJUSTE_CONCILIACION'
      }),
    })
    if (res.ok) {
      setShowSaldoModal(false)
      setNuevoSaldoReal('')
      setAjusteMotivo('')
      loadData()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(`Error al registrar el ajuste de saldo: ${err.error || res.statusText}`)
    }
    setSaving(false)
  }

  const handleBarberoSelect = (barberoId: string) => {
    const prof = profiles.find(p => p.id === barberoId)
    if (prof) {
      setForm(prev => ({
        ...prev,
        barbero_id: barberoId,
        nombre: prof.full_name,
        ci: 'PERSONAL'
      }))
    } else {
      setForm(prev => ({ ...prev, barbero_id: '', nombre: '', ci: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const isRetiro = form.tipo_movimiento === 'RETIRO'
    const barberoSelected = profiles.find(p => p.id === form.barbero_id)
    const glosaFinal = form.destinatario_tipo === 'barbero' && barberoSelected
      ? `${form.subcategoria}: ${form.glosa || 'Movimiento con personal'} — Barbero: ${barberoSelected.full_name}`
      : form.glosa

    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        libro: 'BANCO',
        ci: form.ci || '0000000',
        nombre: form.nombre || 'Movimiento Bancario',
        cuenta_codigo: isRetiro ? 'EGR-BANCO' : 'ING-BANCO',
        cuenta_detalle: isRetiro ? 'Egreso pagado desde Banco (QR/Transf)' : 'Ingreso recibido en Banco (QR/Transf)',
        glosa: glosaFinal,
        costo: parseFloat(form.costo) || 0,
        tipo_movimiento: form.tipo_movimiento,
        metodo_pago: 'qr',
        subcategoria: form.subcategoria,
        empleado_id: form.destinatario_tipo === 'barbero' ? form.barbero_id : null,
        comprobante_url: form.comprobante_url || null
      }),
    })

    if (res.ok) {
      setShowForm(false)
      setForm({
        tipo_movimiento: 'DEPOSITO',
        destinatario_tipo: 'proveedor',
        barbero_id: '',
        ci: '',
        nombre: '',
        glosa: '',
        costo: '',
        subcategoria: 'GASTO_GENERAL',
        comprobante_url: ''
      })
      loadData()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(`Error al guardar el movimiento: ${err.error || res.statusText}`)
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            Libro de <span className="text-blue-500">Banco</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">
            Depósitos, transferencias QR y retiros — Banco Ganadero
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Card className="border-blue-500/30 bg-zinc-900/80 shadow-lg shadow-blue-500/5">
            <CardContent className="px-5 py-3 flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <Landmark className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Saldo en Banco</p>
                <p className={`text-xl font-black ${totalBalance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {formatCurrency(totalBalance)}
                </p>
              </div>
            </CardContent>
          </Card>

          {userRole === 'admin' && (
            <Button
              variant="outline"
              onClick={() => {
                setNuevoSaldoReal('')
                setAjusteMotivo('')
                setShowSaldoModal(true)
              }}
              className="gap-2 font-bold text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 shadow-lg shadow-amber-500/5"
            >
              ⚙️ Ajustar Saldo
            </Button>
          )}

          <Button
            variant="primary"
            onClick={() => setShowForm(!showForm)}
            className="gap-2 font-black uppercase tracking-wider shadow-lg shadow-blue-500/20"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cerrar Formulario' : 'Nuevo Movimiento'}
          </Button>
        </div>
      </div>

      {/* MODAL / FORMULARIO AJUSTAR SALDO REAL (ULTIMA OPCION CON REQUISITOS CLAROS) */}
      {showSaldoModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    Conciliación Bancaria / Ajuste
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Herramienta administrativa de última instancia para cuadrar saldos con el Banco real.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowSaldoModal(false)} className="text-zinc-500 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Saldo actual vs cálculo en vivo */}
            <div className="grid grid-cols-2 gap-3 bg-zinc-950 p-4 rounded-xl border border-white/5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Saldo Actual en Sistema</span>
                <span className="text-base font-black text-blue-400">{formatCurrency(totalBalance)}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Diferencia Calculada</span>
                <span className={`text-base font-black ${isNaN(saldoDeseadoNum) ? 'text-zinc-500' : diferenciaAjuste > 0 ? 'text-emerald-400' : diferenciaAjuste < 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                  {isNaN(saldoDeseadoNum) ? '—' : `${diferenciaAjuste > 0 ? '+' : ''}${formatCurrency(diferenciaAjuste)}`}
                </span>
              </div>
            </div>

            <form onSubmit={handleAjusteSaldo} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-white uppercase tracking-wider mb-1 block">
                  1. ¿Cuánto tienes realmente en el Banco Ganadero? (Bs.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej: 15400.00"
                  value={nuevoSaldoReal}
                  onChange={(e) => setNuevoSaldoReal(e.target.value)}
                  className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-base font-bold text-white focus:border-blue-500/50 outline-none"
                  required
                />
              </div>

              {/* Mensaje visual descriptivo según suma o resta */}
              {!isNaN(saldoDeseadoNum) && Math.abs(diferenciaAjuste) >= 0.01 && (
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 font-medium ${
                  diferenciaAjuste > 0 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}>
                  {diferenciaAjuste > 0 ? (
                    <span>➕ <strong>Ingreso por ajuste:</strong> Se sumarán <strong>{formatCurrency(diferenciaAjuste)}</strong> al saldo del Banco.</span>
                  ) : (
                    <span>➖ <strong>Egreso por ajuste:</strong> Se restarán <strong>{formatCurrency(Math.abs(diferenciaAjuste))}</strong> del saldo del Banco.</span>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-white uppercase tracking-wider mb-1 block">
                  2. ¿Por qué razón se realiza este ajuste? (Obligatorio)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Ajuste de centavos, comisiones bancarias acumuladas del mes pasado, o saldo inicial post-corte."
                  value={ajusteMotivo}
                  onChange={(e) => setAjusteMotivo(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-blue-500/50 outline-none resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <Button type="button" variant="outline" onClick={() => setShowSaldoModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={saving || isNaN(saldoDeseadoNum) || Math.abs(diferenciaAjuste) < 0.01}>
                  {saving ? 'Aplicando...' : 'Confirmar y Conciliar Saldo'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FORMULARIO MEJORADO PARA NUEVO MOVIMIENTO EN BANCO */}
      {showForm && (
        <Card className="border-blue-500/40 bg-zinc-900/95 shadow-2xl animate-in slide-in-from-top-3 duration-300 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/10 via-transparent to-transparent px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wide">
                  Registrar Movimiento Bancario (QR / Transferencia)
                </h3>
                <p className="text-xs text-zinc-400">
                  Ingresos o salidas de dinero procesadas a través del Banco Ganadero
                </p>
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Paso 1: Tipo de Movimiento (Ingreso vs Egreso) */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tipo_movimiento: 'DEPOSITO', subcategoria: 'INGRESO_GENERAL' }))}
                  className={`flex items-center justify-center gap-3 h-14 rounded-xl border font-black uppercase text-sm tracking-wide transition-all ${
                    form.tipo_movimiento === 'DEPOSITO'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10'
                      : 'bg-zinc-950/60 border-white/10 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <ArrowUpRight className="w-5 h-5" />
                  <span>Ingreso / Depósito al Banco</span>
                </button>

                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tipo_movimiento: 'RETIRO', subcategoria: 'GASTO_GENERAL' }))}
                  className={`flex items-center justify-center gap-3 h-14 rounded-xl border font-black uppercase text-sm tracking-wide transition-all ${
                    form.tipo_movimiento === 'RETIRO'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/10'
                      : 'bg-zinc-950/60 border-white/10 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <ArrowDownLeft className="w-5 h-5" />
                  <span>Egreso / Pago desde Banco</span>
                </button>
              </div>

              {/* Paso 2: Destinatario (Barbero vs Proveedor) */}
              <div className="space-y-3 bg-zinc-950/80 p-4 rounded-xl border border-white/5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                  ¿A quién se realiza o de quién proviene este movimiento?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-white">
                    <input
                      type="radio"
                      name="destinatario_tipo"
                      checked={form.destinatario_tipo === 'barbero'}
                      onChange={() => {
                        setForm(f => ({
                          ...f,
                          destinatario_tipo: 'barbero',
                          barbero_id: profiles[0]?.id || '',
                          nombre: profiles[0]?.full_name || '',
                          ci: 'PERSONAL',
                          subcategoria: f.tipo_movimiento === 'DEPOSITO' ? 'PAGO_DEUDA_PERSONAL' : 'ANTICIPO_PERSONAL'
                        }))
                      }}
                      className="accent-blue-500 w-4 h-4"
                    />
                    <User className="w-4 h-4 text-blue-400" />
                    <span>Barbero / Personal del Equipo</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-white">
                    <input
                      type="radio"
                      name="destinatario_tipo"
                      checked={form.destinatario_tipo === 'proveedor'}
                      onChange={() => {
                        setForm(f => ({
                          ...f,
                          destinatario_tipo: 'proveedor',
                          barbero_id: '',
                          nombre: '',
                          ci: '',
                          subcategoria: f.tipo_movimiento === 'DEPOSITO' ? 'INGRESO_GENERAL' : 'GASTO_GENERAL'
                        }))
                      }}
                      className="accent-blue-500 w-4 h-4"
                    />
                    <Building className="w-4 h-4 text-emerald-400" />
                    <span>Proveedor / Cliente / Gasto Externo</span>
                  </label>
                </div>

                {/* Si seleccionó Barbero, mostramos selector limpio de perfiles */}
                {form.destinatario_tipo === 'barbero' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                        Selecciona el Barbero o Miembro
                      </label>
                      <select
                        value={form.barbero_id}
                        onChange={(e) => handleBarberoSelect(e.target.value)}
                        className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-blue-500/50 outline-none"
                      >
                        <option value="">— Seleccionar personal —</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.full_name} ({p.role.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                        Concepto / Subcategoría con Personal
                      </label>
                      <select
                        value={form.subcategoria}
                        onChange={(e) => setForm({ ...form, subcategoria: e.target.value })}
                        className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-blue-500/50 outline-none"
                      >
                        {form.tipo_movimiento === 'DEPOSITO' ? (
                          <>
                            <option value="PAGO_DEUDA_PERSONAL">Pago / Devolución de Préstamo (QR)</option>
                            <option value="APORTE_PERSONAL">Aporte de Personal / Anticipo devuelto</option>
                            <option value="OTRO_INGRESO_PERSONAL">Otro Ingreso del Personal</option>
                          </>
                        ) : (
                          <>
                            <option value="ANTICIPO_PERSONAL">Anticipo / Préstamo de Sueldo (QR)</option>
                            <option value="PAGO_COMISION_QR">Pago de Comisiones / Sueldo por QR</option>
                            <option value="BONO_PREMIO_PERSONAL">Bono / Premio o Incentivo (QR)</option>
                            <option value="OTRO_EGRESO_PERSONAL">Otro Egreso al Personal</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                ) : (
                  /* Si seleccionó Proveedor / Externo, mostramos inputs libres con subcategorías externas */
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                        Nombre / Proveedor / Cliente
                      </label>
                      <input
                        placeholder="Ej: Insumos Barber S.R.L. / Propietario Local"
                        value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-blue-500/50 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                        C.I. / NIT / Ref (Opcional)
                      </label>
                      <input
                        placeholder="Ej: 1234567 / QR-REF"
                        value={form.ci}
                        onChange={(e) => setForm({ ...form, ci: e.target.value })}
                        className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-blue-500/50 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                        Categoría Externa
                      </label>
                      <select
                        value={form.subcategoria}
                        onChange={(e) => setForm({ ...form, subcategoria: e.target.value })}
                        className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-blue-500/50 outline-none"
                      >
                        {form.tipo_movimiento === 'DEPOSITO' ? (
                          <>
                            <option value="INGRESO_GENERAL">Ingreso General al Banco</option>
                            <option value="APORTE_CAPITAL">Aporte de Capital / Socios</option>
                            <option value="VENTA_DIRECTA_QR">Venta Directa no POS (QR)</option>
                            <option value="OTRO_INGRESO">Otro Ingreso Bancario</option>
                          </>
                        ) : (
                          <>
                            <option value="GASTO_GENERAL">Gasto / Egreso General</option>
                            <option value="ALQUILER_LOCAL">Pago de Alquiler / Mantenimiento</option>
                            <option value="SERVICIOS_BASICOS">Servicios Básicos (Luz/Agua/Internet)</option>
                            <option value="COMPRA_INSUMOS">Compra de Insumos / Productos</option>
                            <option value="IMPUESTOS_TRIBUTOS">Impuestos / Tasas Bancarias</option>
                            <option value="OTRO_EGRESO">Otro Egreso Bancario</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Paso 3: Detalle / Glosa y Monto */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                    Glosa / Descripción Detallada
                  </label>
                  <input
                    placeholder="Ej: Pago por transferencia del adelanto quincenal correspondiente a julio..."
                    value={form.glosa}
                    onChange={(e) => setForm({ ...form, glosa: e.target.value })}
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-white focus:border-blue-500/50 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                    Monto Total en Banco (Bs.)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={form.costo}
                      onChange={(e) => setForm({ ...form, costo: e.target.value })}
                      className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl pl-4 pr-10 text-base font-black text-white focus:border-blue-500/50 outline-none"
                      required
                    />
                    <span className="absolute right-3 top-3 text-xs font-bold text-zinc-500">Bs.</span>
                  </div>
                </div>
              </div>

              {/* Paso 4: Comprobante URL */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                  Enlace al Comprobante / Voucher (Opcional)
                </label>
                <input
                  placeholder="https://..."
                  value={form.comprobante_url}
                  onChange={(e) => setForm({ ...form, comprobante_url: e.target.value })}
                  className="w-full h-10 bg-zinc-950 border border-white/10 rounded-xl px-4 text-xs text-zinc-300 focus:border-blue-500/50 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving || !form.costo || parseFloat(form.costo) <= 0}
                  className="px-8 font-black uppercase tracking-wider"
                >
                  {saving ? 'Guardando en Banco...' : 'Confirmar y Registrar Movimiento'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tabla Principal de Movimientos en Banco */}
      <Card className="border-white/5 bg-zinc-900/50 overflow-hidden shadow-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left bg-zinc-950/40">
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Fecha</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Origen / Categoría</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Beneficiario / Proveedor</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Detalle / Glosa</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Monto en Banco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center text-zinc-600 font-medium">
                      No hay movimientos bancarios o en QR registrados hasta la fecha
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx: any) => {
                    const retiro = isRetiroBanco(tx)
                    const monto = getMontoBanco(tx)
                    const isAjuste = tx.subcategoria === 'AJUSTE_CONCILIACION' || tx.glosa?.includes('Conciliación Bancaria')

                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.03] transition-colors group">
                        <td className="px-5 py-4 text-zinc-400 whitespace-nowrap text-xs font-medium">{tx.fecha}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              isAjuste
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : retiro
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : tx.libro === 'SERVICIOS'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : tx.libro === 'VENTAS'
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}>
                              {isAjuste
                                ? '⚙️ CONCILIACIÓN'
                                : tx.libro === 'SERVICIOS'
                                ? '💈 SERVICIO (QR)'
                                : tx.libro === 'VENTAS'
                                ? '📦 VENTA (QR)'
                                : retiro
                                ? '➖ EGRESO / RETIRO'
                                : '➕ DEPÓSITO BANCARIO'}
                            </span>
                            {tx.subcategoria && tx.subcategoria !== 'SERVICIO' && tx.subcategoria !== 'PRODUCTO_VENTA' && (
                              <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">
                                {tx.subcategoria.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-white font-bold text-sm">
                          {tx.nombre || '—'}
                          {tx.ci && tx.ci !== '0000000' && tx.ci !== 'PERSONAL' && (
                            <span className="block text-[11px] font-normal text-zinc-500">Ref/CI: {tx.ci}</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-zinc-300 text-xs max-w-md">
                          <p className="line-clamp-2">{tx.glosa}</p>
                          {tx.comprobante_url && (
                            <a
                              href={tx.comprobante_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-bold mt-1"
                            >
                              <FileText className="w-3 h-3" /> Ver comprobante adjunto
                            </a>
                          )}
                        </td>
                        <td className={`px-5 py-4 text-right font-black text-base whitespace-nowrap ${
                          retiro ? 'text-rose-400' : 'text-blue-400'
                        }`}>
                          {retiro ? '-' : '+'}{formatCurrency(monto)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
