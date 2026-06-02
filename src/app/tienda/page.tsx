'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/ui/Navbar'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { ShoppingBag, X, Plus, Minus, Truck, Store, Calendar, CreditCard, Package } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  precio_venta: number
  stock_actual: number
  categoria: string | null
  image_url: string | null
}

interface CartItem extends Producto {
  cantidad: number
}

// User context interface para pre-llenar datos
interface UserData {
  usuario_registrado_id: string | null
  nombre: string
  email: string
  telefono: string
}

export default function TiendaPage() {
  const { error: toastError } = useToast()
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [catActiva, setCatActiva] = useState<string>('Todos')
  const [loading, setLoading] = useState(true)
  
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  
  const [userData, setUserData] = useState<UserData>({
    usuario_registrado_id: null,
    nombre: '',
    email: '',
    telefono: ''
  })
  const [metodoEntrega, setMetodoEntrega] = useState<'con_reserva'|'recoger'|'envio'>('recoger')
  const [submitting, setSubmitting] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // 1. Cargar Usuario
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('id, full_name, email, phone').eq('id', user.id).single()
        if (profile) {
          setUserData({
            usuario_registrado_id: profile.id,
            nombre: profile.full_name || '',
            email: profile.email || '',
            telefono: profile.phone || ''
          })
        }
      }

      // 2. Cargar Productos Activos
      const { data: prods } = await supabase
        .from('productos')
        .select('*')
        .eq('is_active', true)
        .gt('stock_actual', 0)
        .order('nombre')
      
      if (prods) {
        setProductos(prods)
        const cats = Array.from(new Set(prods.map(p => p.categoria || 'Otros')))
        setCategorias(['Todos', ...cats])
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (prod: Producto) => {
    setCart(prev => {
      const ex = prev.find(p => p.id === prod.id)
      if (ex) {
        if (ex.cantidad >= prod.stock_actual) return prev
        return prev.map(p => p.id === prod.id ? { ...p, cantidad: p.cantidad + 1 } : p)
      }
      return [...prev, { ...prod, cantidad: 1 }]
    })
    setIsCartOpen(true)
  }

  const updateCantidad = (id: string, delta: number) => {
    setCart(prev => prev.map(p => {
      if (p.id === id) {
        const nueva = p.cantidad + delta
        if (nueva > 0 && nueva <= p.stock_actual) return { ...p, cantidad: nueva }
      }
      return p
    }))
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(p => p.id !== id))
  }

  const procesarCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/pedidos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteData: userData,
          cart,
          metodo_entrega: metodoEntrega
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setOrderSuccess(true)
      setCart([])
    } catch (error: any) {
      toastError('Error: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const total = cart.reduce((acc, item) => acc + (item.precio_venta * item.cantidad), 0)
  const productosFiltrados = catActiva === 'Todos' ? productos : productos.filter(p => (p.categoria || 'Otros') === catActiva)

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      {/* Cart Drawer */}
      {isCartOpen && !isCheckoutOpen && !orderSuccess &&(
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end backdrop-blur-sm">
          <div className="bg-zinc-900 w-full max-w-md h-full flex flex-col shadow-2xl border-l border-white/5 animate-in slide-in-from-right">
            <div className="p-4 flex justify-between items-center border-b border-white/10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-500" /> Mi Carrito
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center text-zinc-500 mt-10">Tu carrito está vacío</div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="bg-white/5 border border-white/10 p-3 rounded-xl flex gap-4">
                    <div className="w-16 h-16 bg-zinc-800 rounded-lg flex-shrink-0 overflow-hidden">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-full h-full p-4 text-zinc-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.nombre}</h4>
                      <p className="text-amber-500 font-bold">{formatCurrency(item.precio_venta)}</p>
                      
                      <div className="flex items-center gap-3 mt-2">
                        <button onClick={() => updateCantidad(item.id, -1)} className="w-6 h-6 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-medium">{item.cantidad}</span>
                        <button onClick={() => updateCantidad(item.id, 1)} className="w-6 h-6 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button onClick={() => removeFromCart(item.id)} className="ml-auto text-red-400 text-sm underline">
                          Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 border-t border-white/10 bg-zinc-950">
                <div className="flex justify-between mb-4">
                  <span className="text-zinc-400">Total</span>
                  <span className="text-xl font-bold">{formatCurrency(total)}</span>
                </div>
                <Button 
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black py-6 text-lg rounded-xl shadow-amber-500/20 shadow-lg"
                >
                  Continuar Compra
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && !orderSuccess && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-amber-500">Completar Pedido</h2>
                <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={procesarCheckout} className="space-y-6">
                {/* Opciones de Entrega */}
                <div>
                  <h3 className="text-lg font-medium mb-3 border-b border-white/10 pb-2">1. Método de Entrega</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${metodoEntrega === 'recoger' ? 'border-amber-500 bg-amber-500/10' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                      <input type="radio" value="recoger" checked={metodoEntrega === 'recoger'} onChange={(e)=>setMetodoEntrega(e.target.value as any)} className="hidden" />
                      <Store className={`w-6 h-6 ${metodoEntrega==='recoger'?'text-amber-500':'text-zinc-400'}`}/>
                      <span className="font-medium text-sm">Recoger Hoy</span>
                      <span className="text-xs text-zinc-500">Pagas en caja</span>
                    </label>

                    <label className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${metodoEntrega === 'con_reserva' ? 'border-amber-500 bg-amber-500/10' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                      <input type="radio" value="con_reserva" checked={metodoEntrega === 'con_reserva'} onChange={(e)=>setMetodoEntrega(e.target.value as any)} className="hidden" />
                      <Calendar className={`w-6 h-6 ${metodoEntrega==='con_reserva'?'text-amber-500':'text-zinc-400'}`}/>
                      <span className="font-medium text-sm">Recoger con Cita</span>
                      <span className="text-xs text-zinc-500">Te lo guardamos</span>
                    </label>

                    <label className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${metodoEntrega === 'envio' ? 'border-amber-500 bg-amber-500/10' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                      <input type="radio" value="envio" checked={metodoEntrega === 'envio'} onChange={(e)=>setMetodoEntrega(e.target.value as any)} className="hidden" />
                      <Truck className={`w-6 h-6 ${metodoEntrega==='envio'?'text-amber-500':'text-zinc-400'}`}/>
                      <span className="font-medium text-sm">Delivery Seguro</span>
                      <span className="text-xs text-zinc-500">Pago en destino</span>
                    </label>
                  </div>
                </div>

                {/* Datos de Contacto */}
                <div>
                  <h3 className="text-lg font-medium mb-3 border-b border-white/10 pb-2">2. Tus Datos</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Nombre Completo *</label>
                      <input required type="text" value={userData.nombre} onChange={e=>setUserData({...userData, nombre: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-amber-500 focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">Teléfono o WhatsApp *</label>
                        <input required type="tel" value={userData.telefono} onChange={e=>setUserData({...userData, telefono: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-amber-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">Correo Electrónico (Para recibo)</label>
                        <input type="email" value={userData.email} onChange={e=>setUserData({...userData, email: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-amber-500 focus:outline-none" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 border-t border-white/10 pt-6">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <p className="text-zinc-400">Total a pagar:</p>
                      <p className="text-xs text-zinc-500">{metodoEntrega === 'envio' ? '+ Costo de envío a calcular' : 'Sin recargos extra'}</p>
                    </div>
                    <p className="text-3xl font-black text-amber-500">{formatCurrency(total)}</p>
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full bg-amber-500 hover:bg-amber-400 text-black py-6 text-lg rounded-xl shadow-amber-500/20 shadow-lg">
                    {submitting ? 'Procesando...' : (metodoEntrega === 'envio' ? 'Confirmar Pedido (Pagar al recibir)' : 'Confirmar Reserva (Pagar en local)')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {orderSuccess && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-8 text-center animate-in zoom-in">
             <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
             </div>
             <h2 className="text-2xl font-bold mb-2">¡Pedido Confirmado!</h2>
             <p className="text-zinc-400 mb-8">
               {metodoEntrega === 'envio' 
                  ? 'Hemos recibido tu pedido. Te enviaremos un correo con los detalles y te contactaremos para el envío.' 
                  : 'Hemos reservado tus productos. Te esperamos en la barbería para la entrega y el cobro.'}
             </p>
             <Button onClick={() => { setOrderSuccess(false); setIsCartOpen(false); setIsCheckoutOpen(false); router.push('/') }} className="w-full" variant="outline">
               Volver al Inicio
             </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b border-white/10 pb-6">
           <div>
             <h1 className="text-4xl md:text-5xl font-black mb-4">Tienda <span className="text-amber-500">Exclusiva</span></h1>
             <p className="text-zinc-400 text-lg max-w-xl">
               Los mejores productos para el cuidado de tu barba y cabello, seleccionados por nuestros profesionales.
             </p>
           </div>
           
           <button 
              onClick={() => setIsCartOpen(true)}
              className="mt-6 md:mt-0 relative group flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-6 py-3 transition-colors"
           >
             <ShoppingBag className="w-5 h-5 text-amber-500" />
             <span className="font-medium">Mi Carrito</span>
             {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 text-black text-xs font-bold flex items-center justify-center rounded-full border-2 border-zinc-950">
                  {cart.reduce((a,b)=>a+b.cantidad,0)}
                </span>
             )}
           </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <>
            {/* Categorías */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-4 scrollbar-hide">
              {categorias.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCatActiva(cat)}
                  className={`whitespace-nowrap px-6 py-2 rounded-full text-sm font-medium transition-colors ${catActiva === cat ? 'bg-amber-500 text-black' : 'bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid Productos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {productosFiltrados.map(prod => (
                <div key={prod.id} className="group bg-white/5 border border-white/5 rounded-2xl overflow-hidden hover:border-amber-500/50 transition-all hover:shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                  <div className="aspect-square bg-zinc-900 relative">
                     {prod.image_url ? (
                       <img src={prod.image_url} alt={prod.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center">
                         <Package className="w-16 h-16 text-zinc-700" />
                       </div>
                     )}
                     {prod.stock_actual < 5 && (
                        <span className="absolute top-3 left-3 bg-red-500/90 text-white text-xs font-bold px-2 py-1 rounded-md">
                          ¡Últimos {prod.stock_actual}!
                        </span>
                     )}
                  </div>
                  
                  <div className="p-5">
                    <div className="text-xs text-amber-500 mb-2 font-medium tracking-wider uppercase">{prod.categoria || 'Génico'}</div>
                    <h3 className="text-lg font-bold mb-1 truncate">{prod.nombre}</h3>
                    <p className="text-zinc-400 text-sm mb-4 line-clamp-2 h-10">{prod.descripcion}</p>
                    
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-2xl font-black">{formatCurrency(prod.precio_venta)}</span>
                      <button 
                        onClick={() => addToCart(prod)}
                        className="w-10 h-10 bg-white/10 hover:bg-amber-500 hover:text-black rounded-full flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {productosFiltrados.length === 0 && (
              <div className="text-center py-20 text-zinc-500">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay productos disponibles en esta categoría.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
