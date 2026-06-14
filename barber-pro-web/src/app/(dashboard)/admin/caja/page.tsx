'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { User, Scissors, DollarSign, Search, CheckCircle, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Cliente {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
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

export default function CajaPOSPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [barberos, setBarberos] = useState<Barbero[]>([])

  const [searchCliente, setSearchCliente] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  
  const [formData, setFormData] = useState({
    cliente_id: '',
    nombre: '',
    email: '',
    telefono: '',
    servicio_id: '',
    barbero_id: '',
    metodo_pago: 'efectivo',
    propinas: 0,
    notas: 'Venta desde Caja',
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [resClientes, resServicios, resBarberos] = await Promise.all([
          supabase.from('clientes').select('id, nombre, email, telefono').order('nombre'),
          supabase.from('servicios').select('id, nombre, precio, duracion_minutos').eq('is_active', true),
          supabase.from('profiles').select('id, full_name, email, avatar_url').eq('role', 'barbero').eq('is_active', true)
        ])

        setClientes(resClientes.data || [])
        setServicios(resServicios.data || [])
        setBarberos(resBarberos.data || [])
      } catch (err) {
        toastError('Error al cargar datos iniciales.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSelectCliente = (cliente: Cliente) => {
    setFormData(prev => ({
      ...prev,
      cliente_id: cliente.id,
      nombre: cliente.nombre,
      email: cliente.email || '',
      telefono: cliente.telefono || '',
    }))
    setSearchCliente(cliente.nombre)
    setShowDropdown(false)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchCliente(val)
    setShowDropdown(true)
    if (!val) {
      setFormData(prev => ({ ...prev, cliente_id: '', nombre: '', email: '', telefono: '' }))
    } else {
      setFormData(prev => ({ ...prev, nombre: val }))
    }
  }

  const clientesFiltrados = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchCliente.toLowerCase()) || 
    (c.email && c.email.toLowerCase().includes(searchCliente.toLowerCase())) ||
    (c.telefono && c.telefono.includes(searchCliente))
  )

  const handleSubmit = async (estado: 'en_proceso' | 'completado') => {
    if (!formData.nombre) return toastError('Ingresa o selecciona el nombre del cliente')
    if (!formData.servicio_id) return toastError('Selecciona un servicio')
    if (!formData.barbero_id) return toastError('Selecciona un barbero')

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/caja/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, estado })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al procesar')

      toastSuccess(`Cita registrada como ${estado === 'completado' ? 'Completada y Cobrada' : 'En Proceso'}`)
      
      // Limpiar Formulario
      setFormData({
        cliente_id: '', nombre: '', email: '', telefono: '',
        servicio_id: '', barbero_id: '', metodo_pago: 'efectivo', propinas: 0, notas: 'Venta desde Caja'
      })
      setSearchCliente('')
    } catch (err: any) {
      toastError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const servicioSeleccionado = servicios.find(s => s.id === formData.servicio_id)
  const totalACobrar = (servicioSeleccionado?.precio || 0) + Number(formData.propinas || 0)

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
                  placeholder="Buscar cliente existente por nombre, teléfono o correo... o escribe uno nuevo"
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
                          onClick={() => handleSelectCliente(c)}
                          className="px-4 py-2 hover:bg-zinc-800 cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <p className="font-semibold">{c.nombre}</p>
                            <p className="text-xs text-zinc-400">{c.email || 'Sin correo'} • {c.telefono || 'Sin tel'}</p>
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
                <div>
                  <Input 
                    label="Correo Electrónico (Para invitar al sistema)" 
                    type="email"
                    value={formData.email} 
                    onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                  />
                  {formData.cliente_id && !clientes.find(c => c.id === formData.cliente_id)?.email && (
                     <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                       <CheckCircle className="w-3 h-3" /> Agrega un correo para enviarle invitación.
                     </p>
                  )}
                </div>
                <Input 
                  label="Teléfono" 
                  value={formData.telefono} 
                  onChange={e => setFormData(p => ({...p, telefono: e.target.value}))} 
                />
              </div>
            </CardContent>
          </Card>

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
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-zinc-400 text-sm">Subtotal</span>
                    <span>{formatCurrency(servicioSeleccionado?.precio || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-zinc-400 text-sm">Propinas (opcional)</span>
                    <Input 
                      type="number" 
                      className="w-24 h-8 text-right bg-black" 
                      value={formData.propinas}
                      onChange={e => setFormData(p => ({...p, propinas: Number(e.target.value)}))}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
                    <span className="text-lg font-bold">Total a Cobrar</span>
                    <span className="text-2xl font-black text-amber-400">
                      {formatCurrency(totalACobrar)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-6">
                  <label className="text-sm text-zinc-400">Método de Pago</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      className={`py-2 rounded-md text-sm font-semibold transition ${formData.metodo_pago === 'efectivo' ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-white'}`}
                      onClick={() => setFormData(p => ({...p, metodo_pago: 'efectivo'}))}
                    >
                      Efectivo
                    </button>
                    <button 
                      className={`py-2 rounded-md text-sm font-semibold transition ${formData.metodo_pago === 'qr' ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-white'}`}
                      onClick={() => setFormData(p => ({...p, metodo_pago: 'qr'}))}
                    >
                      QR / Transf.
                    </button>
                  </div>
                </div>

                <div className="pt-6 space-y-3">
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    disabled={submitting || !formData.nombre || !formData.servicio_id || !formData.barbero_id}
                    onClick={() => handleSubmit('completado')}
                  >
                    <CheckCircle className="w-5 h-5 mr-2" /> Cobrar y Completar
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="w-full border-amber-500/50 text-amber-500 hover:bg-amber-500/10 h-10"
                    disabled={submitting || !formData.nombre || !formData.servicio_id || !formData.barbero_id}
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
