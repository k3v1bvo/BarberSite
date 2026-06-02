'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, Package, AlertTriangle, ArrowLeft, X, Save, Search, Filter } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Producto {
  id: string
  nombre: string
  sku: string | null
  descripcion: string | null
  stock_actual: number
  stock_minimo: number
  precio_costo: number | null
  precio_venta: number
  categoria: string | null
  is_active: boolean
}

export default function ProductosPage() {
  const { error: toastError } = useToast()
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    sku: '',
    descripcion: '',
    stock_actual: 0,
    stock_minimo: 5,
    precio_costo: 0,
    precio_venta: 0,
    categoria: '',
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadProductos()
  }, [])

  const loadProductos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: productosData } = await supabase
        .from('productos')
        .select('*')
        .order('nombre')

      setProductos(productosData as Producto[] || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingProducto) {
        const { error } = await supabase
          .from('productos')
          .update({
            nombre: formData.nombre,
            sku: formData.sku,
            descripcion: formData.descripcion,
            stock_actual: formData.stock_actual,
            stock_minimo: formData.stock_minimo,
            precio_costo: formData.precio_costo,
            precio_venta: formData.precio_venta,
            categoria: formData.categoria,
          })
          .eq('id', editingProducto.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('productos')
          .insert({
            nombre: formData.nombre,
            sku: formData.sku,
            descripcion: formData.descripcion,
            stock_actual: formData.stock_actual,
            stock_minimo: formData.stock_minimo,
            precio_costo: formData.precio_costo,
            precio_venta: formData.precio_venta,
            categoria: formData.categoria,
            is_active: true,
          })

        if (error) throw error
      }

      setShowModal(false)
      setEditingProducto(null)
      setFormData({
        nombre: '',
        sku: '',
        descripcion: '',
        stock_actual: 0,
        stock_minimo: 5,
        precio_costo: 0,
        precio_venta: 0,
        categoria: '',
      })
      loadProductos()
    } catch (error: any) {
      toastError('Error: ' + error.message)
    }
  }

  const toggleActivo = async (producto: Producto) => {
    try {
      const { error } = await supabase
        .from('productos')
        .update({ is_active: !producto.is_active })
        .eq('id', producto.id)

      if (error) throw error
      loadProductos()
    } catch (error: any) {
      toastError('Error: ' + error.message)
    }
  }

  const actualizarStock = async (producto: Producto, cantidad: number) => {
    try {
      const { error } = await supabase
        .from('productos')
        .update({ stock_actual: producto.stock_actual + cantidad })
        .eq('id', producto.id)

      if (error) throw error
      
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('inventario_movimientos').insert({
        producto_id: producto.id,
        tipo: cantidad > 0 ? 'entrada' : 'salida',
        cantidad: Math.abs(cantidad),
        motivo: cantidad > 0 ? 'Reposición manual' : 'Ajuste manual',
        usuario_id: user?.id,
      })

      loadProductos()
    } catch (error: any) {
      toastError('Error: ' + error.message)
    }
  }

  const getStockStatus = (producto: Producto) => {
    if (producto.stock_actual === 0) return { variant: 'danger' as const, text: 'AGOTADO' }
    if (producto.stock_actual <= producto.stock_minimo) return { variant: 'warning' as const, text: 'BAJO' }
    return { variant: 'success' as const, text: 'OPTIMO' }
  }

  const productosStockBajo = productos.filter(p => p.stock_actual <= p.stock_minimo && p.is_active)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Escaneando Inventario...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-8">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/admin')} className="p-4 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl transition-all btn-press group">
             <ArrowLeft className="w-5 h-5 text-zinc-500 group-hover:text-amber-500" />
          </button>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">
              Stock <span className="text-amber-500">Control</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-2 text-lg">Gestiona suministros, productos y materiales</p>
          </div>
        </div>
        <Button variant="primary" size="lg" className="shadow-lg shadow-amber-500/20 font-black uppercase tracking-widest h-14 px-8" onClick={() => setShowModal(true)}>
          <Plus className="w-5 h-5 mr-2 stroke-[3px]" />
          Registrar Producto
        </Button>
      </div>

      {/* Alerta de stock bajo - Redesigned */}
      {productosStockBajo.length > 0 && (
        <Card className="bg-red-500/10 border-red-500/20 glow-red">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                    <AlertTriangle className="w-6 h-6 animate-pulse" />
                 </div>
                 <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-tight">Atención: Reposición Necesaria</h2>
                    <p className="text-zinc-400 text-sm">{productosStockBajo.length} artículos por debajo del umbral de seguridad.</p>
                 </div>
              </div>
              <div className="flex gap-2">
                 {productosStockBajo.slice(0, 3).map(p => (
                   <Badge key={p.id} variant="danger" className="bg-red-500/20 text-red-500 border-red-500/30 uppercase font-black text-[10px] tracking-widest">
                     {p.nombre} ({p.stock_actual})
                   </Badge>
                 ))}
                 {productosStockBajo.length > 3 && (
                   <Badge variant="outline" className="text-zinc-500 font-black text-[10px] tracking-widest">+{productosStockBajo.length - 3} MÁS</Badge>
                 )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row gap-4">
         <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar por nombre, SKU o categoría..." 
              className="w-full h-14 bg-zinc-900 border border-white/5 rounded-2xl pl-12 pr-6 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
            />
         </div>
         <Button variant="secondary" size="lg" className="h-14 font-black uppercase tracking-widest border-white/10">
            <Filter className="w-4 h-4 mr-2" />
            Filtrar
         </Button>
      </div>

      {/* Inventario Table */}
      <Card className="border-white/5 bg-zinc-900 shadow-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-950/50">
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest">Articulo / Categoría</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest">Identificador SKU</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-center">Stock Disponible</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-center">Inversión Unit.</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-center">Venta Unit.</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-center">Disponibilidad</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right">Manejo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {productos.map((producto) => {
                  const status = getStockStatus(producto)
                  return (
                    <tr key={producto.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="py-6 px-6">
                         <p className="font-black text-white group-hover:text-amber-500 transition-colors uppercase tracking-tight">{producto.nombre}</p>
                         <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-0.5">{producto.categoria || 'SIN CATEGORIA'}</p>
                      </td>
                      <td className="py-6 px-6">
                         <code className="text-[10px] font-black text-zinc-400 bg-white/5 px-2 py-1 rounded-md tracking-widest uppercase">
                            {producto.sku || 'N/A'}
                         </code>
                      </td>
                      <td className="py-6 px-6 text-center">
                        <div className="flex flex-col items-center gap-2">
                           <div className="flex items-center gap-3">
                              <span className="text-xl font-black text-white">{producto.stock_actual}</span>
                              <div className="flex flex-col gap-1">
                                <button
                                  className="w-6 h-6 flex items-center justify-center bg-zinc-800 rounded hover:bg-amber-500 hover:text-black transition-all text-zinc-400"
                                  onClick={() => actualizarStock(producto, 1)}
                                >
                                  <Plus size={10} strokeWidth={4}/>
                                </button>
                                <button
                                  className="w-6 h-6 flex items-center justify-center bg-zinc-800 rounded hover:bg-red-500 hover:text-black transition-all text-zinc-400"
                                  onClick={() => actualizarStock(producto, -1)}
                                >
                                  <span className="font-black">-</span>
                                </button>
                              </div>
                           </div>
                           <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] leading-none">Mín: {producto.stock_minimo}</p>
                        </div>
                      </td>
                      <td className="py-6 px-6 text-center text-zinc-400 font-bold">
                         {formatCurrency(producto.precio_costo || 0)}
                      </td>
                      <td className="py-6 px-6 text-center">
                         <p className="text-lg font-black text-amber-500 tracking-tighter">{formatCurrency(producto.precio_venta)}</p>
                      </td>
                      <td className="py-6 px-6 text-center">
                        <Badge variant={status.variant} className="uppercase font-black text-[10px] tracking-widest px-3">
                           {status.text}
                        </Badge>
                      </td>
                      <td className="py-6 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-10 h-10 p-0 border-white/5 bg-zinc-950 hover:bg-amber-500 hover:text-black transition-all"
                            onClick={() => {
                              setEditingProducto(producto)
                              setFormData({
                                nombre: producto.nombre,
                                sku: producto.sku || '',
                                descripcion: producto.descripcion || '',
                                stock_actual: producto.stock_actual,
                                stock_minimo: producto.stock_minimo,
                                precio_costo: producto.precio_costo || 0,
                                precio_venta: producto.precio_venta,
                                categoria: producto.categoria || '',
                              })
                              setShowModal(true)
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant={producto.is_active ? 'danger' : 'success'}
                            size="sm"
                            className="w-10 h-10 p-0"
                            onClick={() => toggleActivo(producto)}
                          >
                            {producto.is_active ? <Trash2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {productos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-24 text-center">
                       <Package size={64} className="mx-auto text-zinc-800 mb-4 opacity-30" />
                       <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Aún no hay productos registrados en el inventario</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <Card className="w-full max-w-xl border-white/10 shadow-2xl bg-zinc-950 my-auto">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 p-8 bg-zinc-900/50">
              <div>
                <CardTitle className="text-2xl font-black uppercase text-white leading-none">
                   {editingProducto ? 'Editar' : 'Registrar'} <span className="text-amber-500">Producto</span>
                </CardTitle>
                <p className="text-zinc-500 text-xs mt-2 font-medium">Define las características técnicas y comerciales</p>
              </div>
              <button 
                onClick={() => { setShowModal(false); setEditingProducto(null); }} 
                className="p-3 hover:bg-white/5 rounded-2xl transition-colors border border-white/5"
              >
                <X className="w-6 h-6 text-zinc-500" />
              </button>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="md:col-span-2">
                     <Input
                        label="Nombre del Producto"
                        placeholder="Ej. Pomada Mate Premium"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        required
                        className="bg-zinc-900"
                      />
                   </div>
                   <Input
                    label="SKU / Cod. Barras"
                    placeholder="EAN-13 ..."
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="bg-zinc-900"
                  />
                  <Input
                    label="Categoría"
                    placeholder="Cera, Aftershave, etc."
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="bg-zinc-900"
                  />
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Descripción Breve</label>
                    <textarea
                      className="w-full p-4 border border-white/10 bg-zinc-900 rounded-xl text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                      rows={2}
                      placeholder="..."
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    />
                  </div>
                  <Input
                    label="Stock Inicial"
                    type="number"
                    value={formData.stock_actual}
                    onChange={(e) => setFormData({ ...formData, stock_actual: parseInt(e.target.value) })}
                    required
                    className="bg-zinc-900"
                  />
                  <Input
                    label="Stock de Seguridad (Mín)"
                    type="number"
                    value={formData.stock_minimo}
                    onChange={(e) => setFormData({ ...formData, stock_minimo: parseInt(e.target.value) })}
                    required
                    className="bg-zinc-900"
                  />
                  <Input
                    label="Inversión Unit."
                    type="number"
                    placeholder="0.00"
                    value={formData.precio_costo}
                    onChange={(e) => setFormData({ ...formData, precio_costo: parseFloat(e.target.value) })}
                    required
                    className="bg-zinc-900"
                  />
                  <Input
                    label="Precio de Venta"
                    type="number"
                    placeholder="0.00"
                    value={formData.precio_venta}
                    onChange={(e) => setFormData({ ...formData, precio_venta: parseFloat(e.target.value) })}
                    required
                    className="bg-zinc-900"
                  />
                </div>
              </CardContent>
              <div className="p-8 bg-zinc-900/30 border-t border-white/5 flex gap-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 h-14 border-white/5 text-zinc-500 hover:text-white uppercase font-black tracking-widest text-[10px]"
                  onClick={() => { setShowModal(false); setEditingProducto(null); }}
                >
                  Descartar
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  className="flex-1 h-14 shadow-lg shadow-amber-500/20 uppercase font-black tracking-widest"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingProducto ? 'Actualizar' : 'Registrar'} Inventario
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}

