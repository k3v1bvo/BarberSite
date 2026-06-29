'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { ArrowDownCircle, ArrowLeft, Calendar, FileText, User, Wallet, Check, Trash2, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function EgresosPage() {
  const { success, error } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [egresos, setEgresos] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    concepto: '',
    proveedor: '',
    monto_neto: '',
    notas: '',
  })
  
  const conceptosPredefinidos = [
    'Pago Diario a Barbero',
    'Compra de Insumos (Tienda)',
    'Compra de Insumos (Uso Interno)',
    'Servicios Básicos (Luz, Agua, Internet)',
    'Alquiler',
    'Publicidad / Marketing',
    'Otros'
  ]

  useEffect(() => {
    loadEgresos()
  }, [])

  const loadEgresos = async () => {
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('egresos')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(50)

      if (err) throw err
      setEgresos(data || [])
    } catch (err: any) {
      console.error(err)
      error('Error al cargar egresos')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.concepto || !formData.monto_neto) {
      return error('El concepto y el monto son requeridos')
    }

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const profileRes = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      const userName = profileRes.data?.full_name || 'Admin'

      // 1. Insert into egresos
      const { error: egresoError } = await supabase
        .from('egresos')
        .insert({
          concepto: formData.concepto,
          proveedor: formData.proveedor || null,
          monto_bruto: Number(formData.monto_neto), // Asumimos monto bruto = neto por ahora
          monto_neto: Number(formData.monto_neto),
          usuario_registro: userName,
          notas: formData.notas || null
        })

      if (egresoError) throw egresoError

      // 2. Insert into transactions (Para reportes y caja)
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          libro: 'EGRESOS',
          fecha: new Date().toISOString().split('T')[0],
          ci: 'S/N',
          nombre: formData.proveedor || 'Gasto General',
          cuenta_codigo: 'EGRESO',
          cuenta_detalle: formData.concepto,
          glosa: formData.notas || `Egreso por ${formData.concepto}`,
          costo: Number(formData.monto_neto),
          tipo_movimiento: 'EGRESO',
          metodo_pago: 'efectivo', // Por defecto efectivo de caja
          usuario_registro: userName
        })

      if (txError) throw txError

      success('Egreso registrado correctamente')
      setFormData({ concepto: '', proveedor: '', monto_neto: '', notas: '' })
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
                
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Concepto del Gasto</label>
                   <select 
                     className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-400/50 outline-none transition-all"
                     value={formData.concepto}
                     onChange={e => setFormData({...formData, concepto: e.target.value})}
                     required
                   >
                     <option value="" disabled>Selecciona una categoría...</option>
                     {conceptosPredefinidos.map(c => (
                       <option key={c} value={c}>{c}</option>
                     ))}
                   </select>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Monto Neto (Bs)</label>
                   <div className="relative">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">Bs</span>
                     <Input 
                       type="number"
                       step="0.01"
                       min="0"
                       className="pl-10 bg-black/50"
                       placeholder="0.00"
                       value={formData.monto_neto}
                       onChange={e => setFormData({...formData, monto_neto: e.target.value})}
                       required
                     />
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Proveedor / Destinatario (Opcional)</label>
                   <Input 
                     className="bg-black/50"
                     placeholder="Ej: Juan Perez (Barbero) o CRE"
                     value={formData.proveedor}
                     onChange={e => setFormData({...formData, proveedor: e.target.value})}
                   />
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Notas Adicionales (Opcional)</label>
                   <textarea 
                     className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-400/50 outline-none transition-all resize-none h-24"
                     placeholder="Detalles adicionales del gasto..."
                     value={formData.notas}
                     onChange={e => setFormData({...formData, notas: e.target.value})}
                   />
                </div>

                <Button 
                  type="submit" 
                  disabled={submitting} 
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest h-12 mt-4 transition-all hover:scale-[1.02]"
                >
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
                          </div>
                          {egreso.notas && (
                            <p className="text-xs text-zinc-500 mt-1.5 italic line-clamp-1">{egreso.notas}</p>
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
