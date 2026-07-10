'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { ArrowDownCircle, ArrowLeft, FileText, Wallet, Check, Plus, Search, X, Image as ImageIcon, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ImageUpload } from '@/components/ui/ImageUpload'

interface PlanCuenta {
  id: string
  codigo: string
  detalle: string
  tipo: string
  nivel: number
  es_sancion: boolean
}

export default function EgresosPage() {
  const { success, error } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [egresos, setEgresos] = useState<any[]>([])
  
  // Categorías dinámicas desde plan_cuentas
  const [categorias, setCategorias] = useState<PlanCuenta[]>([])
  const [searchCategoria, setSearchCategoria] = useState('')
  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false)
  const [selectedCategoriaId, setSelectedCategoriaId] = useState('')
  const categoriaRef = useRef<HTMLDivElement>(null)

  // Crear nueva categoría inline
  const [showNewCategoria, setShowNewCategoria] = useState(false)
  const [newCategoriaNombre, setNewCategoriaNombre] = useState('')
  const [newCategoriaCodigo, setNewCategoriaCodigo] = useState('')
  const [savingCategoria, setSavingCategoria] = useState(false)

  const [formData, setFormData] = useState({
    concepto: '',
    proveedor: '',
    monto_neto: '',
    notas: '',
    metodo_pago: 'efectivo',
    monto_efectivo: '',
    monto_qr: '',
    comprobante_url: '',
  })

  // Categorías filtradas para autocompletado
  const categoriasFiltradas = categorias.filter(c => 
    c.detalle.toLowerCase().includes(searchCategoria.toLowerCase()) ||
    c.codigo.toLowerCase().includes(searchCategoria.toLowerCase())
  )

  useEffect(() => {
    loadAll()
  }, [])

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoriaRef.current && !categoriaRef.current.contains(e.target as Node)) {
        setShowCategoriaDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [egresosRes, categoriasRes] = await Promise.all([
        supabase.from('egresos').select('*').order('creado_en', { ascending: false }).limit(50),
        supabase.from('plan_cuentas').select('*').eq('tipo', 'EGRESO').order('codigo')
      ])

      if (egresosRes.error) throw egresosRes.error
      setEgresos(egresosRes.data || [])

      const cuentasExistentes = categoriasRes.data || []
      
      // Migrar categorías predefinidas si no existen
      const predefinidas = [
        { codigo: 'EGR-001', detalle: 'Pago Diario a Barbero' },
        { codigo: 'EGR-002', detalle: 'Compra de Insumos (Tienda)' },
        { codigo: 'EGR-003', detalle: 'Compra de Insumos (Uso Interno)' },
        { codigo: 'EGR-004', detalle: 'Servicios Básicos (Luz, Agua, Internet)' },
        { codigo: 'EGR-005', detalle: 'Alquiler' },
        { codigo: 'EGR-006', detalle: 'Publicidad / Marketing' },
        { codigo: 'EGR-007', detalle: 'Otros' },
      ]

      const existentes = cuentasExistentes.map(c => c.detalle.toLowerCase())
      const faltantes = predefinidas.filter(p => !existentes.includes(p.detalle.toLowerCase()))

      if (faltantes.length > 0) {
        const { data: inserted } = await supabase
          .from('plan_cuentas')
          .insert(faltantes.map(f => ({ codigo: f.codigo, detalle: f.detalle, tipo: 'EGRESO', nivel: 1, es_sancion: false })))
          .select('*')
        setCategorias([...cuentasExistentes, ...(inserted || [])])
      } else {
        setCategorias(cuentasExistentes)
      }
    } catch (err: any) {
      console.error(err)
      error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const loadEgresos = async () => {
    const { data } = await supabase.from('egresos').select('*').order('creado_en', { ascending: false }).limit(50)
    if (data) setEgresos(data)
  }

  const selectCategoria = (cat: PlanCuenta) => {
    setSelectedCategoriaId(cat.id)
    setSearchCategoria(cat.detalle)
    setFormData(prev => ({ ...prev, concepto: cat.detalle }))
    setShowCategoriaDropdown(false)
  }

  const crearNuevaCategoria = async () => {
    if (!newCategoriaNombre.trim()) return error('El nombre es requerido')
    setSavingCategoria(true)
    try {
      const codigo = newCategoriaCodigo.trim() || `EGR-${String(categorias.length + 1).padStart(3, '0')}`
      const { data: nueva, error: err } = await supabase
        .from('plan_cuentas')
        .insert({ codigo, detalle: newCategoriaNombre.trim(), tipo: 'EGRESO', nivel: 1, es_sancion: false })
        .select('*')
        .single()
      if (err) throw err
      setCategorias(prev => [...prev, nueva])
      selectCategoria(nueva)
      setShowNewCategoria(false)
      setNewCategoriaNombre('')
      setNewCategoriaCodigo('')
      success('Categoría creada')
    } catch (err: any) {
      error(err.message || 'Error al crear categoría')
    } finally {
      setSavingCategoria(false)
    }
  }

  const eliminarCategoria = async (catId: string, catNombre: string) => {
    if (!confirm(`¿Eliminar la categoría "${catNombre}"? Esta acción no se puede deshacer.`)) return
    try {
      const { error: err } = await supabase
        .from('plan_cuentas')
        .delete()
        .eq('id', catId)
      if (err) throw err
      setCategorias(prev => prev.filter(c => c.id !== catId))
      if (selectedCategoriaId === catId) {
        setSelectedCategoriaId('')
        setFormData(prev => ({ ...prev, concepto: '' }))
        setSearchCategoria('')
      }
      success(`Categoría "${catNombre}" eliminada 🗑️`)
    } catch (err: any) {
      error(err.message || 'Error al eliminar')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCategoriaId || !formData.concepto) {
      return error('Debes seleccionar una categoría de gasto')
    }
    if (!formData.monto_neto) {
      return error('El monto es requerido')
    }
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autorizado')
      const profileRes = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      const userName = profileRes.data?.full_name || 'Admin'

      const { error: egresoError } = await supabase.from('egresos').insert({
        concepto: formData.concepto,
        proveedor: formData.proveedor || null,
        monto_bruto: Number(formData.monto_neto),
        monto_neto: Number(formData.monto_neto),
        metodo_pago: formData.metodo_pago,
        monto_efectivo: formData.metodo_pago === 'mixto' ? Number(formData.monto_efectivo) : (formData.metodo_pago === 'efectivo' ? Number(formData.monto_neto) : 0),
        monto_qr: formData.metodo_pago === 'mixto' ? Number(formData.monto_qr) : (formData.metodo_pago === 'qr' ? Number(formData.monto_neto) : 0),
        usuario_registro: userName,
        notas: formData.notas || null,
        comprobante_url: formData.comprobante_url || null
      })
      if (egresoError) throw egresoError

      const selectedCat = categorias.find(c => c.id === selectedCategoriaId)
      const { error: txError } = await supabase.from('transactions').insert({
        libro: 'EGRESOS',
        fecha: new Date().toISOString().split('T')[0],
        ci: 'S/N',
        nombre: formData.proveedor || 'Gasto General',
        cuenta_codigo: selectedCat?.codigo || 'EGRESO',
        cuenta_detalle: formData.concepto,
        glosa: formData.notas || `Egreso por ${formData.concepto}`,
        costo: Number(formData.monto_neto),
        tipo_movimiento: 'EGRESO',
        subcategoria: 'GASTO_GENERAL',
        metodo_pago: formData.metodo_pago,
        monto_efectivo: formData.metodo_pago === 'mixto' ? Number(formData.monto_efectivo) : (formData.metodo_pago === 'efectivo' ? Number(formData.monto_neto) : 0),
        monto_qr: formData.metodo_pago === 'mixto' ? Number(formData.monto_qr) : (formData.metodo_pago === 'qr' ? Number(formData.monto_neto) : 0),
        usuario_registro: userName,
        comprobante_url: formData.comprobante_url || null
      })
      if (txError) throw txError

      success('Egreso registrado correctamente')
      setFormData({ concepto: '', proveedor: '', monto_neto: '', notas: '', metodo_pago: 'efectivo', monto_efectivo: '', monto_qr: '', comprobante_url: '' })
      setSearchCategoria('')
      setSelectedCategoriaId('')
      loadEgresos()
    } catch (err: any) {
      console.error(err)
      error('Error al registrar el egreso')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin')} className="p-3 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl transition-all btn-press group">
             <ArrowLeft className="w-5 h-5 text-zinc-500 group-hover:text-red-400" />
          </button>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white uppercase">
              Control de <span className="text-red-400">Egresos</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-1">Registra gastos, compras y pagos diarios a barberos.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulario de Egreso */}
        <div className="lg:col-span-4">
          <Card className="bg-zinc-900 border-zinc-800 shadow-2xl sticky top-6">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5 text-red-400" /> Nuevo Gasto
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* SELECTOR DE CATEGORÍAS VISUAL CON ICONOS */}
                <div className="space-y-2" ref={categoriaRef}>
                   <div className="flex items-center justify-between">
                     <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Categoría del Gasto</label>
                     <button type="button" onClick={() => setShowNewCategoria(!showNewCategoria)}
                       className="text-[10px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors">
                       <Plus size={10} /> Nueva
                     </button>
                   </div>
                   
                   {/* Barra de búsqueda */}
                   <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
                     <input 
                       className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white focus:border-red-400/50 outline-none transition-all placeholder:text-zinc-600"
                       placeholder="Buscar categoría..."
                       value={searchCategoria}
                       onChange={e => {
                         setSearchCategoria(e.target.value)
                         if (!e.target.value) { setSelectedCategoriaId(''); setFormData(prev => ({ ...prev, concepto: '' })) }
                       }}
                     />
                     {searchCategoria && (
                       <button type="button" onClick={() => { setSearchCategoria(''); setFormData(prev => ({ ...prev, concepto: '' })); setSelectedCategoriaId('') }}
                         className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                         <X size={12} />
                       </button>
                     )}
                   </div>

                   {/* Grid de categorías con iconos */}
                   <div className="grid grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                     {categoriasFiltradas.map(cat => {
                       const iconMap: Record<string, { emoji: string; color: string }> = {
                         'pago diario': { emoji: '💈', color: 'border-amber-500/30 bg-amber-500/5' },
                         'barbero': { emoji: '💈', color: 'border-amber-500/30 bg-amber-500/5' },
                         'insumos': { emoji: '🧴', color: 'border-blue-500/30 bg-blue-500/5' },
                         'tienda': { emoji: '🛍️', color: 'border-violet-500/30 bg-violet-500/5' },
                         'uso interno': { emoji: '🔧', color: 'border-cyan-500/30 bg-cyan-500/5' },
                         'servicios': { emoji: '💡', color: 'border-yellow-500/30 bg-yellow-500/5' },
                         'luz': { emoji: '💡', color: 'border-yellow-500/30 bg-yellow-500/5' },
                         'agua': { emoji: '💧', color: 'border-sky-500/30 bg-sky-500/5' },
                         'internet': { emoji: '📶', color: 'border-indigo-500/30 bg-indigo-500/5' },
                         'alquiler': { emoji: '🏠', color: 'border-orange-500/30 bg-orange-500/5' },
                         'publicidad': { emoji: '📢', color: 'border-pink-500/30 bg-pink-500/5' },
                         'marketing': { emoji: '📢', color: 'border-pink-500/30 bg-pink-500/5' },
                         'otros': { emoji: '📦', color: 'border-zinc-500/30 bg-zinc-500/5' },
                         'comida': { emoji: '🍔', color: 'border-green-500/30 bg-green-500/5' },
                         'refrigerio': { emoji: '🍔', color: 'border-green-500/30 bg-green-500/5' },
                         'transporte': { emoji: '🚕', color: 'border-lime-500/30 bg-lime-500/5' },
                         'limpieza': { emoji: '🧹', color: 'border-teal-500/30 bg-teal-500/5' },
                         'mantenimiento': { emoji: '🔧', color: 'border-cyan-500/30 bg-cyan-500/5' },
                         'impuestos': { emoji: '📋', color: 'border-red-500/30 bg-red-500/5' },
                       }
                       
                       const detalleLower = cat.detalle.toLowerCase()
                       const match = Object.entries(iconMap).find(([key]) => detalleLower.includes(key))
                       const emoji = match ? match[1].emoji : '💸'
                       const colorClass = match ? match[1].color : 'border-red-500/20 bg-red-500/5'
                       const isSelected = selectedCategoriaId === cat.id

                       return (
                          <div
                            key={cat.id}
                            className={`group relative text-left p-2.5 rounded-xl border transition-all ${
                              isSelected 
                                ? 'border-red-500 bg-red-500/10 ring-1 ring-red-500/50' 
                                : `${colorClass} hover:border-white/20 hover:scale-[1.02]`
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => selectCategoria(cat)}
                              className="w-full flex items-start gap-2"
                            >
                              <span className="text-lg mt-0.5">{emoji}</span>
                              <div className="flex-1 min-w-0 text-left">
                                <p className={`text-[11px] font-bold truncate ${isSelected ? 'text-red-400' : 'text-white'}`}>{cat.detalle}</p>
                                <p className="text-[9px] font-mono text-zinc-600 mt-0.5">{cat.codigo}</p>
                              </div>
                              {isSelected && <Check size={12} className="text-red-400 mt-1 shrink-0" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); eliminarCategoria(cat.id, cat.detalle) }}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                              title={`Eliminar "${cat.detalle}"`}
                            >
                              <X size={12} />
                            </button>
                          </div>
                       )
                     })}
                   </div>

                   {categoriasFiltradas.length === 0 && searchCategoria && (
                     <div className="text-center py-4 text-zinc-500 text-xs">
                       Sin resultados para &quot;{searchCategoria}&quot;.{' '}
                       <button type="button" onClick={() => { setShowNewCategoria(true); setNewCategoriaNombre(searchCategoria) }}
                         className="text-amber-500 font-bold hover:underline">
                         Crear nueva categoría
                       </button>
                     </div>
                   )}

                   {/* Selected indicator */}
                   {selectedCategoriaId && (
                     <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                       <Check size={12} className="text-red-400" />
                       <span className="text-[10px] font-bold text-red-300">Seleccionada: {searchCategoria}</span>
                     </div>
                   )}
                </div>

                {/* CREAR NUEVA CATEGORÍA INLINE */}
                {showNewCategoria && (
                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase text-amber-500 tracking-widest">Nueva Categoría de Egreso</p>
                      <button type="button" onClick={() => setShowNewCategoria(false)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
                    </div>
                    <input placeholder="Nombre de la categoría *" value={newCategoriaNombre} onChange={e => setNewCategoriaNombre(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500/50" />
                    <input placeholder="Código (opcional, ej: EGR-008)" value={newCategoriaCodigo} onChange={e => setNewCategoriaCodigo(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-amber-500/50" />
                    <Button type="button" onClick={crearNuevaCategoria} disabled={savingCategoria || !newCategoriaNombre.trim()}
                      className="w-full bg-amber-600 hover:bg-amber-500 text-black font-black h-10 text-xs uppercase tracking-widest">
                      <Plus size={14} className="mr-2" /> {savingCategoria ? 'Creando...' : 'Crear y Seleccionar'}
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Monto Neto (Bs)</label>
                   <div className="relative">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">Bs</span>
                     <Input type="number" step="0.01" min="0" className="pl-10 bg-black/50" placeholder="0.00"
                       value={formData.monto_neto} onChange={e => setFormData({...formData, monto_neto: e.target.value})} required />
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Método de Pago</label>
                   <select className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-400/50 outline-none transition-all"
                     value={formData.metodo_pago} onChange={e => setFormData({...formData, metodo_pago: e.target.value})}>
                     <option value="efectivo">Efectivo</option>
                     <option value="qr">Transferencia / QR</option>
                     <option value="mixto">Mixto (Efectivo y QR)</option>
                   </select>
                </div>

                {formData.metodo_pago === 'mixto' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Monto Efectivo (Bs)</label>
                      <Input type="number" step="0.01" min="0" className="bg-black/50" placeholder="0.00"
                        value={formData.monto_efectivo} onChange={e => setFormData({...formData, monto_efectivo: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Monto QR (Bs)</label>
                      <Input type="number" step="0.01" min="0" className="bg-black/50" placeholder="0.00"
                        value={formData.monto_qr} onChange={e => setFormData({...formData, monto_qr: e.target.value})} required />
                    </div>
                  </div>
                )}

                {(formData.metodo_pago === 'qr' || formData.metodo_pago === 'mixto') && (
                  <div className="p-3 bg-zinc-900 border border-white/5 rounded-xl">
                    <ImageUpload
                      label="Comprobante de Pago (Captura QR/Transferencia)"
                      defaultImage={formData.comprobante_url || undefined}
                      onUploadSuccess={(url) => setFormData({...formData, comprobante_url: url})}
                      onUploadError={(err) => error(err)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Proveedor / Destinatario (Opcional)</label>
                   <Input className="bg-black/50" placeholder="Ej: Juan Perez (Barbero) o CRE"
                     value={formData.proveedor} onChange={e => setFormData({...formData, proveedor: e.target.value})} />
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Notas Adicionales (Opcional)</label>
                   <textarea className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-400/50 outline-none transition-all resize-none h-24"
                     placeholder="Detalles adicionales del gasto..."
                     value={formData.notas} onChange={e => setFormData({...formData, notas: e.target.value})} />
                </div>

                <Button type="submit" disabled={submitting} 
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest h-12 mt-4 transition-all hover:scale-[1.02]">
                  {submitting ? 'Registrando...' : 'Registrar Salida de Dinero'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Historial de Egresos */}
        <div className="lg:col-span-8">
          <Card className="bg-zinc-900 border-zinc-800 shadow-2xl h-full">
            <CardHeader className="border-b border-white/5 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-zinc-400" /> Historial de Salidas
              </CardTitle>
              <Badge variant="default" className="text-xs">{egresos.length} registros</Badge>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                 <div className="flex justify-center py-12">
                   <div className="w-8 h-8 border-4 border-zinc-800 border-t-red-400 rounded-full animate-spin"></div>
                 </div>
              ) : egresos.length === 0 ? (
                <div className="text-center py-20 opacity-40">
                  <Wallet className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
                  <p className="font-black uppercase tracking-widest text-sm">Sin registros de egresos</p>
                  <p className="text-xs font-medium mt-1">Registra tu primer gasto para llevar el control.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {egresos.map((egreso) => (
                    <div key={egreso.id} className="flex justify-between items-center p-4 bg-black/40 border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                          <ArrowDownCircle className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{egreso.concepto}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400 font-bold uppercase">
                              {new Date(egreso.creado_en).toLocaleDateString()}
                            </span>
                            {egreso.proveedor && (
                              <span className="text-[10px] text-zinc-500 font-medium">A: {egreso.proveedor}</span>
                            )}
                            <span className="text-[10px] bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full font-bold uppercase border border-red-500/20">
                              {egreso.metodo_pago || 'efectivo'}
                            </span>
                          </div>
                          {egreso.notas && (
                            <p className="text-xs text-zinc-500 mt-1.5 italic line-clamp-1">{egreso.notas}</p>
                          )}
                          {egreso.comprobante_url && (
                            <a href={egreso.comprobante_url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-amber-500 hover:text-amber-400 font-bold mt-1 transition">
                              <ImageIcon className="w-3 h-3" /> Ver Comprobante <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-red-400">
                          -{formatCurrency(egreso.monto_neto)}
                        </p>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                          Por: {egreso.usuario_registro}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


