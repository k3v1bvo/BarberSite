'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { User, Scissors, DollarSign, Search, CheckCircle, Clock, Package, Plus, Minus, X, Store, Gift, UserPlus, Edit3, Save, Star, Tag, QrCode, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { ImageUpload } from '@/components/ui/ImageUpload'

interface Cliente {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  ci: string | null
  nivel_fidelidad?: string
  total_visitas?: number
  total_gastado?: number
}

interface Promocion {
  id: string
  nombre: string
  tipo: string
  valor: number
  activa: boolean
  icono: string
  servicio_id: string | null
  nivel_requerido: string | null
}

interface ReferralBonus {
  id: string
  monto_bono: number
  bono_otorgado: boolean
  recomendado: { nombre: string } | null
}

interface Servicio {
  id: string
  nombre: string
  precio: number
  duracion_minutos: number
}

interface Barbero {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

interface Producto {
  id: string
  nombre: string
  precio_venta: number
  precio_tienda: number | null
  stock_actual: number
  image_url: string | null
  categoria: string | null
}

interface ProductoCarrito {
  producto: Producto
  cantidad: number
  paraTienda: boolean
}

export function CajaPOS() {
  const { success: toastSuccess, error: toastError } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<ProductoCarrito[]>([])
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [referralBonuses, setReferralBonuses] = useState<ReferralBonus[]>([])
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null)
  const [qrPagoUrl, setQrPagoUrl] = useState<string | null>(null)

  const [searchCliente, setSearchCliente] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [editingCliente, setEditingCliente] = useState(false)
  const [savingCliente, setSavingCliente] = useState(false)
  const [promoSeleccionada, setPromoSeleccionada] = useState<string>('')
  const [aplicarReferido, setAplicarReferido] = useState(false)
  
  const [acompanante, setAcompanante] = useState({ nombre: '', email: '' })
  
  const [formData, setFormData] = useState({
    cliente_id: '',
    nombre: '',
    email: '',
    telefono: '',
    ci: '',
    servicio_id: '',
    barbero_id: '',
    metodo_pago: 'efectivo',
    propinas: 0,
    notas: 'Venta desde Caja',
    comprobante_url: '',
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [resServicios, resBarberos, resProductos, resPromos, resQr] = await Promise.all([
          supabase.from('servicios').select('id, nombre, precio, duracion_minutos').eq('is_active', true),
          supabase.from('profiles').select('id, full_name, email, avatar_url').eq('role', 'barbero').eq('is_active', true),
          supabase.from('productos').select('id, nombre, precio_venta, precio_tienda, stock_actual, image_url, categoria').eq('is_active', true).gt('stock_actual', 0).order('nombre'),
          supabase.from('promociones').select('id, nombre, tipo, valor, activa, icono, servicio_id, nivel_requerido').eq('activa', true),
          supabase.from('configuraciones').select('valor').eq('llave', 'qr_pago').maybeSingle()
        ])

        setServicios(resServicios.data || [])
        setBarberos(resBarberos.data || [])
        setProductos(resProductos.data || [])
        setPromociones(resPromos.data || [])
        
        if (resQr.data?.valor?.url) {
          setQrPagoUrl(resQr.data.valor.url)
        }
      } catch (err) {
        toastError('Error al cargar datos iniciales.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (!searchCliente || searchCliente.trim().length < 2) {
      setClientes([])
      return
    }

    const timeoutId = setTimeout(async () => {
      const q = searchCliente.trim()
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, email, telefono, ci, nivel_fidelidad, total_visitas, total_gastado')
        .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%,ci.ilike.%${q}%`)
        .limit(15)

      setClientes(data || [])
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchCliente, supabase])

  // Fetch referral bonuses when a client is selected
  const fetchClientExtras = useCallback(async (clienteId: string, cliente?: Cliente) => {
    setClienteDetalle(cliente || clientes.find(c => c.id === clienteId) || null)
    setAplicarReferido(false)
    setPromoSeleccionada('')
    try {
      const { data: refs } = await supabase
        .from('referrals')
        .select('id, monto_bono, bono_otorgado, recomendado:clientes!cliente_recomendado_id(nombre)')
        .eq('cliente_recomendante_id', clienteId)
        .eq('bono_otorgado', false)
      setReferralBonuses((refs as any) || [])
    } catch {
      setReferralBonuses([])
    }
  }, [clientes, supabase])

  const handleSaveCliente = async () => {
    if (!formData.cliente_id) return
    setSavingCliente(true)
    try {
      await supabase.from('clientes').update({
        nombre: formData.nombre,
        ci: formData.ci || null,
        telefono: formData.telefono || null,
        email: formData.email || null,
      }).eq('id', formData.cliente_id)
      toastSuccess('Cliente actualizado')
      setEditingCliente(false)
    } catch { toastError('Error al actualizar') }
    setSavingCliente(false)
  }

  const handleSelectCliente = (cliente: Cliente) => {
    setFormData(prev => ({
      ...prev,
      cliente_id: cliente.id,
      nombre: cliente.nombre,
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      ci: cliente.ci || '',
    }))
    setSearchCliente(cliente.nombre)
    setShowDropdown(false)
    setEditingCliente(false)
    fetchClientExtras(cliente.id, cliente)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchCliente(val)
    setShowDropdown(true)
    
    setFormData(prev => ({ 
      ...prev, 
      cliente_id: '', 
      nombre: val,
      ...(val === '' ? { email: '', telefono: '', ci: '' } : {})
    }))
  }

  const clientesFiltrados = clientes

  // --- Carrito de productos ---
  const agregarProducto = (producto: Producto, paraTienda = false) => {
    setCarrito(prev => {
      const existe = prev.find(p => p.producto.id === producto.id)
      if (existe) {
        if (existe.cantidad >= producto.stock_actual) {
          toastError(`Sin stock suficiente de ${producto.nombre}`)
          return prev
        }
        return prev.map(p => 
          p.producto.id === producto.id 
            ? { ...p, cantidad: p.cantidad + 1 } 
            : p
        )
      }
      return [...prev, { producto, cantidad: 1, paraTienda }]
    })
  }

  const toggleParaTienda = (productoId: string) => {
    setCarrito(prev => prev.map(p =>
      p.producto.id === productoId
        ? { ...p, paraTienda: !p.paraTienda }
        : p
    ))
  }

  const quitarProducto = (productoId: string) => {
    setCarrito(prev => {
      const item = prev.find(p => p.producto.id === productoId)
      if (item && item.cantidad > 1) {
        return prev.map(p => 
          p.producto.id === productoId 
            ? { ...p, cantidad: p.cantidad - 1 } 
            : p
        )
      }
      return prev.filter(p => p.producto.id !== productoId)
    })
  }

  const eliminarProducto = (productoId: string) => {
    setCarrito(prev => prev.filter(p => p.producto.id !== productoId))
  }

  const precioItemCarrito = (item: ProductoCarrito) =>
    item.paraTienda && item.producto.precio_tienda != null
      ? item.producto.precio_tienda
      : item.producto.precio_venta

  const totalProductos = carrito.reduce((sum, item) => sum + (precioItemCarrito(item) * item.cantidad), 0)

  const handleSubmit = async (estado: 'en_proceso' | 'completado') => {
    if (!formData.nombre) return toastError('Ingresa o selecciona el nombre del cliente')
    if (!formData.servicio_id && carrito.length === 0) return toastError('Selecciona un servicio o agrega un producto')
    if (!formData.barbero_id) return toastError('Selecciona un barbero')

    const promoActiva = promociones.find(p => p.id === promoSeleccionada)
    if (promoActiva?.tipo === '2x1' && !acompanante.nombre.trim()) {
      return toastError('Debe ingresar el nombre del acompañante para la promoción 2x1')
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/caja/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          estado,
          descuento: descuentoTotal,
          promo_id: promoSeleccionada || null,
          referral_ids: aplicarReferido ? referralBonuses.map(r => r.id) : [],
          comprobante_url: formData.comprobante_url || null,
          productos_carrito: carrito.map(item => ({
            id: item.producto.id,
            nombre: item.producto.nombre,
            precio: precioItemCarrito(item),
            cantidad: item.cantidad,
            para_tienda: item.paraTienda
          })),
          acompanante_2x1: promoActiva?.tipo === '2x1' ? acompanante : null
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al procesar')

      toastSuccess(`Cita registrada como ${estado === 'completado' ? 'Completada y Cobrada' : 'En Proceso'}`)
      
      // Limpiar Formulario
      setFormData({
        cliente_id: '', nombre: '', email: '', telefono: '', ci: '',
        servicio_id: '', barbero_id: '', metodo_pago: 'efectivo', propinas: 0, notas: 'Venta desde Caja', comprobante_url: ''
      })
      setSearchCliente('')
      setCarrito([])
      setClienteDetalle(null)
      setReferralBonuses([])
      setAplicarReferido(false)
      setPromoSeleccionada('')
      setAcompanante({ nombre: '', email: '' })
      setEditingCliente(false)

      // Recargar productos para reflejar stock actualizado
      const { data: newProductos } = await supabase
        .from('productos')
        .select('id, nombre, precio_venta, precio_tienda, stock_actual, image_url, categoria')
        .eq('is_active', true)
        .gt('stock_actual', 0)
        .order('nombre')
      setProductos(newProductos || [])
    } catch (err: any) {
      toastError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const servicioSeleccionado = servicios.find(s => s.id === formData.servicio_id)
  const subtotalServicio = servicioSeleccionado?.precio || 0
  const hayItemsTienda = carrito.some(i => i.paraTienda)
  const todosParaTienda = carrito.length > 0 && carrito.every(i => i.paraTienda) && !formData.servicio_id
  const totalTienda = carrito.filter(i => i.paraTienda).reduce((s, i) => s + (precioItemCarrito(i) * i.cantidad), 0)
  const totalClienteProductos = carrito.filter(i => !i.paraTienda).reduce((s, i) => s + (precioItemCarrito(i) * i.cantidad), 0)

  // Discount calculations
  const promoActiva = promociones.find(p => p.id === promoSeleccionada)
  const descuentoPromo = promoActiva
    ? promoActiva.tipo === 'descuento_porcentaje'
      ? (subtotalServicio * promoActiva.valor) / 100
      : promoActiva.tipo === 'descuento_fijo'
        ? promoActiva.valor
        : promoActiva.tipo === 'servicio_gratis'
          ? subtotalServicio
          : 0
    : 0
  const totalBonoReferido = aplicarReferido
    ? referralBonuses.reduce((s, r) => s + Number(r.monto_bono), 0)
    : 0
  const descuentoTotal = descuentoPromo + totalBonoReferido
  const totalACobrar = Math.max(0, subtotalServicio + totalProductos + Number(formData.propinas || 0) - descuentoTotal)

  if (loading) {
    return <div className="p-8 text-center text-zinc-400">Cargando Caja...</div>
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
            Punto de Venta / Caja
          </h1>
          <p className="text-zinc-400">Atiende a clientes que llegan a pie, asigna y cobra al instante.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LADO IZQUIERDO: SELECCIÓN DE DATOS */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* CLIENTE */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <User className="w-5 h-5 text-amber-500" /> 1. Datos del Cliente
              </h2>
              
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Input
                  className="pl-9 bg-black/50"
                  placeholder="Buscar por nombre, carnet, teléfono o correo..."
                  value={searchCliente}
                  onChange={handleSearchChange}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                />
                
                {showDropdown && searchCliente && (
                  <div className="absolute z-10 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {clientesFiltrados.length > 0 ? (
                      clientesFiltrados.map(c => (
                        <div 
                          key={c.id} 
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleSelectCliente(c)
                          }}
                          className="px-4 py-2 hover:bg-zinc-800 cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <p className="font-semibold">{c.nombre}</p>
                            <p className="text-xs text-zinc-400">{c.ci ? `C.I. ${c.ci} · ` : ''}{c.email || 'Sin correo'} · {c.telefono || 'Sin tel'}</p>
                          </div>
                          <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded-full">Seleccionar</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-zinc-400 text-sm">
                        No encontrado. Se creará como nuevo cliente.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Input 
                  label="Nombre Completo" 
                  value={formData.nombre} 
                  onChange={e => setFormData(p => ({...p, nombre: e.target.value}))} 
                  required
                />
                <Input 
                  label="Carnet / CI" 
                  value={formData.ci} 
                  onChange={e => setFormData(p => ({...p, ci: e.target.value}))} 
                />
                <div className="space-y-1">
                  <Input 
                    label="Correo Electrónico (Para invitar al sistema)" 
                    type="email"
                    value={formData.email} 
                    onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                  />
                  {!formData.cliente_id ? (
                     <p className="text-[11px] text-zinc-400 leading-tight">
                       Opcional. Si lo agregas, el cliente recibirá un correo para crear su cuenta y ver sus puntos/citas.
                     </p>
                  ) : clientes.find(c => c.id === formData.cliente_id)?.email ? (
                     <p className="text-[11px] text-emerald-500/80 leading-tight flex items-center gap-1">
                       <CheckCircle className="w-3 h-3" /> Este cliente ya tiene cuenta en el sistema.
                     </p>
                  ) : (
                     <p className="text-[11px] text-amber-500/90 leading-tight flex items-center gap-1">
                       <CheckCircle className="w-3 h-3" /> Aún no tiene correo. ¡Agrégalo ahora para enviarle una invitación automática!
                     </p>
                  )}
                </div>
                <Input 
                  label="Teléfono" 
                  value={formData.telefono} 
                  onChange={e => setFormData(p => ({...p, telefono: e.target.value}))} 
                />
              </div>

              {/* Botón Editar Cliente */}
              {formData.cliente_id && (
                <div className="flex items-center gap-2 pt-2">
                  {editingCliente ? (
                    <>
                      <Button size="sm" variant="primary" onClick={handleSaveCliente} disabled={savingCliente} className="gap-1 text-xs">
                        <Save className="w-3 h-3" /> {savingCliente ? 'Guardando...' : 'Guardar Cambios'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingCliente(false)} className="text-xs">Cancelar</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditingCliente(true)} className="gap-1 text-xs text-amber-500 border-amber-500/30">
                      <Edit3 className="w-3 h-3" /> Editar datos del cliente
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* INFO CLIENTE: Lealtad + Referidos + Promociones */}
          {clienteDetalle && formData.cliente_id && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Nivel de Fidelidad */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                    clienteDetalle.nivel_fidelidad === 'ORO' ? 'bg-yellow-500/20 border border-yellow-500/30' :
                    clienteDetalle.nivel_fidelidad === 'PLATA' ? 'bg-zinc-400/20 border border-zinc-400/30' :
                    'bg-amber-700/20 border border-amber-700/30'
                  }`}>
                    <Star className={`w-5 h-5 ${
                      clienteDetalle.nivel_fidelidad === 'ORO' ? 'text-yellow-400' :
                      clienteDetalle.nivel_fidelidad === 'PLATA' ? 'text-zinc-300' :
                      'text-amber-600'
                    }`} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nivel</p>
                    <p className="text-sm font-black text-white">{clienteDetalle.nivel_fidelidad || 'BRONCE'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Visitas */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Visitas</p>
                    <p className="text-sm font-black text-white">{clienteDetalle.total_visitas || 0} visitas</p>
                    <p className="text-[10px] text-zinc-500">Gastado: {formatCurrency(clienteDetalle.total_gastado || 0)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Referidos pendientes */}
              <Card className={`bg-zinc-900 ${referralBonuses.length > 0 ? 'border-green-500/30' : 'border-zinc-800'}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    referralBonuses.length > 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-zinc-800 border border-zinc-700'
                  }`}>
                    <Gift className={`w-5 h-5 ${referralBonuses.length > 0 ? 'text-green-400' : 'text-zinc-600'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Bonos Referidos</p>
                    {referralBonuses.length > 0 ? (
                      <>
                        <p className="text-sm font-black text-green-400">
                          {formatCurrency(referralBonuses.reduce((s, r) => s + Number(r.monto_bono), 0))} disponible
                        </p>
                        <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={aplicarReferido}
                            onChange={(e) => setAplicarReferido(e.target.checked)}
                            className="accent-green-500"
                          />
                          <span className="text-[10px] text-green-400 font-bold uppercase">Aplicar como descuento</span>
                        </label>
                      </>
                    ) : (
                      <p className="text-sm text-zinc-500">Sin bonos</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* PROMOCIONES */}
          {formData.cliente_id && promociones.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-amber-500" /> Aplicar Promoción
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setPromoSeleccionada('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      !promoSeleccionada ? 'bg-zinc-700 text-white' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    Sin promo
                  </button>
                  {promociones.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPromoSeleccionada(p.id === promoSeleccionada ? '' : p.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        promoSeleccionada === p.id ? 'bg-amber-500 text-black' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {p.icono} {p.nombre} {p.tipo === 'descuento_porcentaje' ? `(-${p.valor}%)` : p.tipo === 'descuento_fijo' ? `(-${formatCurrency(p.valor)})` : ''}
                    </button>
                  ))}
                </div>

                {promociones.find(p => p.id === promoSeleccionada)?.tipo === '2x1' && (
                  <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <h4 className="text-amber-500 font-black text-xs uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" />
                      Datos del Acompañante 2x1 (Requerido)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <Input
                        placeholder="Nombre completo *"
                        value={acompanante.nombre}
                        onChange={(e) => setAcompanante({ ...acompanante, nombre: e.target.value })}
                        className="bg-black/50 border-white/10 text-sm h-9"
                      />
                      <Input
                        placeholder="Correo (opcional, para invitación)"
                        type="email"
                        value={acompanante.email}
                        onChange={(e) => setAcompanante({ ...acompanante, email: e.target.value })}
                        className="bg-black/50 border-white/10 text-sm h-9"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* SERVICIO */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Scissors className="w-5 h-5 text-amber-500" /> 2. Selección de Servicio
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {servicios.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setFormData({ ...formData, servicio_id: s.id })}
                    className={`p-3 border rounded-xl cursor-pointer transition ${
                      formData.servicio_id === s.id
                        ? 'border-amber-400 bg-amber-500/10'
                        : 'border-white/10 hover:border-amber-400/40 bg-black/20'
                    }`}
                  >
                    <h3 className="font-semibold text-sm line-clamp-1">{s.nombre}</h3>
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-xs text-zinc-400">{s.duracion_minutos} min</p>
                      <p className="font-bold text-amber-400">{formatCurrency(s.precio)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* BARBERO */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-500" /> 3. Asignar Barbero
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {barberos.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => setFormData({ ...formData, barbero_id: b.id })}
                    className={`flex flex-col items-center gap-2 p-3 border rounded-xl cursor-pointer transition ${
                      formData.barbero_id === b.id
                        ? 'border-amber-400 bg-amber-500/10'
                        : 'border-white/10 hover:border-amber-400/40 bg-black/20'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center shrink-0">
                      {b.avatar_url ? (
                        <img src={b.avatar_url} alt={b.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold">{b.full_name.charAt(0)}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-xs text-center line-clamp-1">{b.full_name}</h3>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* PRODUCTOS */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Package className="w-5 h-5 text-violet-500" /> Productos (Opcional)
                </h2>
                {carrito.length > 0 && (
                  <span className="text-xs bg-violet-500/20 text-violet-400 px-3 py-1 rounded-full font-semibold">
                    {carrito.reduce((s, i) => s + i.cantidad, 0)} en carrito
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 mb-4">
                ¿El cliente quiere llevarse un producto? Agrégalo aquí y se sumará al cobro total.
              </p>
              
              {productos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {productos.map((p) => {
                    const enCarrito = carrito.find(c => c.producto.id === p.id)
                    return (
                      <div
                        key={p.id}
                        className={`p-3 border rounded-xl transition relative ${
                          enCarrito
                            ? 'border-violet-400 bg-violet-500/10'
                            : 'border-white/10 hover:border-violet-400/40 bg-black/20'
                        }`}
                      >
                        {p.image_url && (
                          <div className="w-full h-16 rounded-lg overflow-hidden mb-2 bg-zinc-800">
                            <img src={p.image_url} alt={p.nombre} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <h3 className="font-semibold text-xs line-clamp-2 min-h-[2rem]">{p.nombre}</h3>
                        <div className="mt-1 space-y-0.5">
                          <div className="flex justify-between items-center">
                            <p className="text-[10px] text-zinc-500">Stock: {p.stock_actual}</p>
                            <p className="font-bold text-violet-400 text-sm">{formatCurrency(p.precio_venta)}</p>
                          </div>
                          {p.precio_tienda != null && (
                            <div className="flex justify-between items-center">
                              <p className="text-[9px] text-violet-500/60">Precio tienda:</p>
                              <p className="text-[11px] font-bold text-violet-300">{formatCurrency(p.precio_tienda)}</p>
                            </div>
                          )}
                        </div>
                        
                        {enCarrito ? (
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-center justify-between bg-black/40 rounded-lg px-2 py-1">
                              <button 
                                onClick={() => quitarProducto(p.id)}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 transition text-white"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-bold text-white">{enCarrito.cantidad}</span>
                              <button 
                                onClick={() => agregarProducto(p)}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-violet-600 hover:bg-violet-500 transition text-white"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            {p.precio_tienda != null && (
                              <button
                                onClick={() => toggleParaTienda(p.id)}
                                className={`w-full py-1 text-[10px] font-bold uppercase tracking-wide rounded-lg transition flex items-center justify-center gap-1 ${
                                  enCarrito.paraTienda
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}
                              >
                                ⚡ {enCarrito.paraTienda ? `Tienda: ${formatCurrency(p.precio_tienda)}` : 'Precio normal'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => agregarProducto(p)}
                            className="w-full mt-2 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-violet-600 transition text-zinc-300 hover:text-white flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Agregar
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 text-center py-4">No hay productos disponibles con stock.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* LADO DERECHO: TICKET Y PAGO */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-zinc-900 border-amber-500/30 sticky top-6">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" /> Resumen y Pago
              </h2>
              
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Cliente</span>
                  <span className="font-medium truncate max-w-[150px]">{formData.nombre || 'No seleccionado'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Servicio</span>
                  <span className="font-medium text-right">{servicioSeleccionado?.nombre || 'No seleccionado'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Barbero</span>
                  <span className="font-medium text-right">{barberos.find(b => b.id === formData.barbero_id)?.full_name || 'No seleccionado'}</span>
                </div>
                
                <div className="pt-4 border-t border-zinc-800">
                  {/* Subtotal servicio */}
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-zinc-400 text-sm">Servicio</span>
                    <span>{formatCurrency(subtotalServicio)}</span>
                  </div>

                  {/* Productos en carrito */}
                  {carrito.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Productos</span>
                      {carrito.map(item => (
                        <div key={item.producto.id} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <button 
                              onClick={() => eliminarProducto(item.producto.id)}
                              className="w-4 h-4 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 transition shrink-0"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                            <div className="min-w-0">
                              <span className="text-zinc-300 truncate text-xs block">{item.cantidad}x {item.producto.nombre}</span>
                              {item.paraTienda && (
                                <span className="text-[9px] font-bold text-violet-400 uppercase tracking-wide">⚡ precio tienda</span>
                              )}
                            </div>
                          </div>
                          <span className="text-violet-400 font-medium shrink-0 ml-2">{formatCurrency(precioItemCarrito(item) * item.cantidad)}</span>
                        </div>

                      ))}
                      <div className="flex justify-between items-center text-sm pt-1 border-t border-zinc-800/50">
                        <span className="text-zinc-400 text-xs">Subtotal Productos</span>
                        <span className="text-violet-400 font-semibold">{formatCurrency(totalProductos)}</span>
                      </div>
                      {hayItemsTienda && (
                        <div className="mt-2 p-2.5 bg-violet-500/10 rounded-lg border border-violet-500/20">
                          <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-1.5">
                              <Store className="w-3.5 h-3.5 text-violet-400" />
                              <span className="text-violet-300 text-xs font-semibold">Uso Tienda</span>
                            </div>
                            <span className="text-violet-400 font-bold">{formatCurrency(totalTienda)}</span>
                          </div>
                          <p className="text-[9px] text-violet-500/70 mt-1 leading-tight">
                            Se descuenta de la caja del día (no es pago del cliente)
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-zinc-400 text-sm">Propinas (opcional)</span>
                    <Input 
                      type="number" 
                      className="w-24 h-8 text-right bg-black" 
                      value={formData.propinas}
                      onChange={e => setFormData(p => ({...p, propinas: Number(e.target.value)}))}
                    />
                  </div>
                  
                  {hayItemsTienda && (
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-zinc-500 text-xs">Descuento Caja (tienda)</span>
                      <span className="text-red-400 font-semibold">-{formatCurrency(totalTienda)}</span>
                    </div>
                  )}

                  {descuentoPromo > 0 && (
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-amber-500 text-xs flex items-center gap-1">
                        <Tag className="w-3 h-3" /> {promoActiva?.icono} {promoActiva?.nombre}
                      </span>
                      <span className="text-amber-400 font-semibold">-{formatCurrency(descuentoPromo)}</span>
                    </div>
                  )}

                  {totalBonoReferido > 0 && (
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-green-500 text-xs flex items-center gap-1">
                        <Gift className="w-3 h-3" /> Bono Referidos
                      </span>
                      <span className="text-green-400 font-semibold">-{formatCurrency(totalBonoReferido)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
                    <span className="text-lg font-bold">{todosParaTienda ? 'Total Uso Tienda' : 'Total a Cobrar'}</span>
                    <span className="text-2xl font-black text-amber-400">
                      {formatCurrency(todosParaTienda ? totalTienda : totalACobrar)}
                    </span>
                  </div>
                  {todosParaTienda && (
                    <p className="text-[10px] text-violet-400 mt-1 text-center font-semibold">
                      ⚡ Todo es uso interno — se descuenta de la caja
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-6">
                  {todosParaTienda ? (
                    <div className="p-3 bg-violet-600/10 border border-violet-500/30 rounded-xl text-center">
                      <Store className="w-5 h-5 mx-auto text-violet-400 mb-1" />
                      <p className="text-xs text-violet-300 font-bold uppercase tracking-wider">Descuento de Caja</p>
                      <p className="text-[10px] text-violet-500 mt-0.5">No requiere pago en efectivo ni QR</p>
                    </div>
                  ) : (
                    <>
                      <label className="text-sm text-zinc-400">Método de Pago</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['efectivo', 'qr', 'mixto'] as const).map((m) => (
                          <button
                            key={m}
                            className={`py-2 rounded-md text-xs font-semibold transition ${formData.metodo_pago === m ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-white'}`}
                            onClick={() => setFormData(p => ({...p, metodo_pago: m}))}
                          >
                            {m === 'efectivo' ? '💵 Efectivo' : m === 'qr' ? '📱 QR' : '🔄 Mixto'}
                          </button>
                        ))}
                      </div>
                      {formData.metodo_pago === 'mixto' && (
                        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2 mt-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">🔄 Desglose</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold uppercase text-zinc-500 block mb-0.5">Efectivo</label>
                              <input type="number" step="0.01" min="0" placeholder="0" id="mixto-efectivo"
                                className="w-full h-9 bg-zinc-950 border border-amber-500/30 rounded-lg px-2 text-sm text-white outline-none"
                                onChange={(e) => setFormData(p => ({...p, notas: `Efectivo: Bs ${e.target.value} | QR: Bs ${(document.querySelector('[data-mixto-qr]') as HTMLInputElement)?.value || 0}`}))}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold uppercase text-zinc-500 block mb-0.5">QR</label>
                              <input type="number" step="0.01" min="0" placeholder="0" data-mixto-qr
                                className="w-full h-9 bg-zinc-950 border border-amber-500/30 rounded-lg px-2 text-sm text-white outline-none"
                                onChange={(e) => setFormData(p => ({...p, notas: `Efectivo: Bs ${(document.getElementById('mixto-efectivo') as HTMLInputElement)?.value || 0} | QR: Bs ${e.target.value}`}))}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {(formData.metodo_pago === 'qr' || formData.metodo_pago === 'mixto') && (
                        <div className="mt-4 p-3 bg-zinc-900 border border-white/5 rounded-xl space-y-4">
                          <div className="flex flex-col items-center justify-center p-4 bg-black/40 rounded-lg border border-white/5">
                            <p className="text-xs text-zinc-400 mb-3 text-center">Escanea este código para pagar</p>
                            {qrPagoUrl ? (
                              <div className="space-y-3 flex flex-col items-center">
                                <img src={qrPagoUrl} alt="QR de Pago" className="w-48 h-48 object-contain rounded-md bg-white p-2" />
                                <a 
                                  href={qrPagoUrl} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-xs flex items-center gap-1 text-amber-500 hover:text-amber-400 transition"
                                >
                                  <QrCode className="w-4 h-4" /> Ampliar / Descargar
                                </a>
                              </div>
                            ) : (
                              <div className="w-48 h-48 bg-zinc-800 rounded-md flex flex-col items-center justify-center border border-dashed border-zinc-600 text-zinc-500 p-4 text-center">
                                <QrCode className="w-8 h-8 mb-2 opacity-50" />
                                <span className="text-xs">El administrador debe subir el QR en Configuración</span>
                              </div>
                            )}
                          </div>

                          <ImageUpload
                            label="Comprobante de Pago QR (Captura)"
                            defaultImage={formData.comprobante_url || undefined}
                            onUploadSuccess={(url) => setFormData({ ...formData, comprobante_url: url })}
                            onUploadError={(err) => toastError(err)}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="pt-6 space-y-3">
                  {(!formData.nombre || (!formData.servicio_id && carrito.length === 0) || !formData.barbero_id) && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                      <p className="text-[11px] text-red-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Completar para cobrar:
                      </p>
                      <ul className="text-[11px] text-red-300/80 list-disc list-inside space-y-0.5 ml-1">
                        {!formData.nombre && <li>Falta seleccionar el Cliente</li>}
                        {(!formData.servicio_id && carrito.length === 0) && <li>Falta seleccionar Servicio o Producto</li>}
                        {!formData.barbero_id && <li>Falta asignar un Barbero</li>}
                      </ul>
                    </div>
                  )}

                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    disabled={submitting || !formData.nombre || (!formData.servicio_id && carrito.length === 0) || !formData.barbero_id}
                    onClick={() => handleSubmit('completado')}
                  >
                    <CheckCircle className="w-5 h-5 mr-2" /> Cobrar y Completar
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="w-full border-amber-500/50 text-amber-500 hover:bg-amber-500/10 h-10"
                    disabled={submitting || !formData.nombre || (!formData.servicio_id && carrito.length === 0) || !formData.barbero_id}
                    onClick={() => handleSubmit('en_proceso')}
                  >
                    <Clock className="w-4 h-4 mr-2" /> Iniciar Servicio (Paga después)
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
