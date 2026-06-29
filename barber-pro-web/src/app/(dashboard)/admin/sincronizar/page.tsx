'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { RefreshCw, Search, Users, CheckCircle2 } from 'lucide-react'

interface Barbero {
  id: string
  full_name: string
  email: string
}

interface Cliente {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  ci: string | null
  total_visitas: number
}

export default function SincronizarHistorialPage() {
  const [tab, setTab] = useState<'barberos' | 'clientes'>('barberos')
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  
  // States Barbero
  const [selectedBarbero, setSelectedBarbero] = useState<string>('')
  const [nombreAntiguo, setNombreAntiguo] = useState('')
  
  // States Cliente
  const [clienteAntiguoId, setClienteAntiguoId] = useState('')
  const [clienteNuevoId, setClienteNuevoId] = useState('')

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{success: boolean, message: string} | null>(null)
  const { success, error: toastError } = useToast()
  const supabase = createClient()

  const loadDatos = useCallback(async () => {
    try {
      const [barberosRes, clientesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').in('role', ['barbero', 'coordinador']).order('full_name'),
        supabase.from('clientes').select('id, nombre, email, telefono, ci, total_visitas').order('nombre')
      ])
      
      if (barberosRes.error) throw barberosRes.error
      if (clientesRes.error) throw clientesRes.error

      setBarberos(barberosRes.data || [])
      setClientes(clientesRes.data || [])
    } catch (err) {
      console.error('Error loading data:', err)
      toastError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [supabase, toastError])

  useEffect(() => {
    loadDatos()
  }, [loadDatos])

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedBarbero || !nombreAntiguo) {
      toastError('Por favor selecciona un barbero y escribe el nombre antiguo')
      return
    }

    if (!confirm(`¿Estás seguro de enlazar todas las citas importadas de "${nombreAntiguo}" al barbero seleccionado?`)) {
      return
    }

    setSyncing(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/sincronizar-barbero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nuevo_barbero_id: selectedBarbero,
          nombre_antiguo: nombreAntiguo.trim()
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Error al sincronizar')

      setResult({ success: true, message: data.message })
      success(data.message)
      setNombreAntiguo('')
      
    } catch (err: any) {
      setResult({ success: false, message: err.message })
      toastError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!clienteAntiguoId || !clienteNuevoId) {
      toastError('Por favor selecciona ambos clientes')
      return
    }

    if (clienteAntiguoId === clienteNuevoId) {
      toastError('No puedes seleccionar el mismo cliente en ambos campos')
      return
    }

    const nameAntiguo = clientes.find(c => c.id === clienteAntiguoId)?.nombre
    const nameNuevo = clientes.find(c => c.id === clienteNuevoId)?.nombre

    if (!confirm(`¿Estás seguro de fusionar el historial de "${nameAntiguo}" hacia "${nameNuevo}"? Esta acción no se puede deshacer y el cliente antiguo será eliminado.`)) {
      return
    }

    setSyncing(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/sincronizar-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_antiguo_id: clienteAntiguoId,
          cliente_nuevo_id: clienteNuevoId
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar')

      setResult({ success: true, message: data.message })
      success(data.message)
      setClienteAntiguoId('')
      setClienteNuevoId('')
      loadDatos() // recargar clientes
      
    } catch (err: any) {
      setResult({ success: false, message: err.message })
      toastError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <RefreshCw className="text-amber-500 w-8 h-8" />
            Sincronizar <span className="text-amber-500">Historial</span>
          </h1>
          <p className="text-zinc-500 mt-1">Enlaza las citas importadas de Excel a los perfiles reales de los barberos.</p>
        </div>
      </div>

      <div className="flex bg-zinc-900 border border-white/5 rounded-xl p-1 mb-6 max-w-sm">
        <button 
          onClick={() => { setTab('barberos'); setResult(null); }}
          className={`flex-1 py-2 text-sm font-bold uppercase rounded-lg transition-all ${tab === 'barberos' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'}`}
        >
          Barberos
        </button>
        <button 
          onClick={() => { setTab('clientes'); setResult(null); }}
          className={`flex-1 py-2 text-sm font-bold uppercase rounded-lg transition-all ${tab === 'clientes' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'}`}
        >
          Clientes
        </button>
      </div>

      <Card className="bg-zinc-900 border-white/5 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
        <CardHeader>
          <CardTitle className="text-xl text-white">
            {tab === 'barberos' ? 'Vincular Operario (Excel) a Perfil (Sistema)' : 'Fusionar Clientes Duplicados'}
          </CardTitle>
          <p className="text-sm text-zinc-400 mt-2">
            {tab === 'barberos' 
              ? 'El sistema buscará en las notas de las citas huérfanas el patrón exacto "Op: [Nombre]." y las asignará al barbero seleccionado.'
              : 'Selecciona un cliente antiguo para transferir todas sus citas, visitas y gastos al cliente nuevo, borrando al antiguo.'}
          </p>
        </CardHeader>
        <CardContent>
          {tab === 'barberos' ? (
            <form onSubmit={handleSync} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Paso 1 */}
              <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3 text-amber-500 font-black uppercase tracking-widest text-xs mb-4">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/50">1</div>
                  Operario Antiguo
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-bold uppercase">Nombre exacto en Excel</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      placeholder="Ej: JHOEL LEÓN MORUCHE"
                      value={nombreAntiguo}
                      onChange={(e) => setNombreAntiguo(e.target.value)}
                      className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all uppercase"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1">Escribe el nombre tal cual aparece en las notas importadas, respetando tildes y mayúsculas.</p>
                </div>
              </div>

              {/* Paso 2 */}
              <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3 text-green-500 font-black uppercase tracking-widest text-xs mb-4">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/50">2</div>
                  Perfil Actual
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-bold uppercase">Selecciona el Barbero</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <select
                      required
                      value={selectedBarbero}
                      onChange={(e) => setSelectedBarbero(e.target.value)}
                      className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 text-sm font-bold text-white focus:border-green-500/50 outline-none transition-all appearance-none"
                    >
                      <option value="">-- Seleccionar --</option>
                      {barberos.map(b => (
                        <option key={b.id} value={b.id}>{b.full_name} ({b.email})</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1">Este es el perfil de Supabase al que se le asignarán las citas.</p>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4 flex flex-col items-center border-t border-white/5">
              <Button
                type="submit"
                variant="primary"
                className="w-full md:w-auto min-w-[250px] h-14 text-sm font-black uppercase tracking-widest shadow-xl shadow-amber-500/20"
                disabled={syncing || !selectedBarbero || !nombreAntiguo}
              >
                {syncing ? (
                  <span className="flex items-center gap-2"><RefreshCw className="animate-spin w-4 h-4" /> Sincronizando...</span>
                ) : 'Sincronizar Historial'}
              </Button>

              {result && (
                <div className={`mt-6 flex items-center gap-3 p-4 rounded-xl border ${result.success ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  {result.success ? <CheckCircle2 className="w-5 h-5" /> : null}
                  <p className="font-bold text-sm">{result.message}</p>
                </div>
              )}
            </div>
          </form>
          ) : (
          <form onSubmit={handleSyncCliente} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Paso 1 */}
              <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3 text-red-500 font-black uppercase tracking-widest text-xs mb-4">
                  <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50">1</div>
                  Cliente a Eliminar (Antiguo)
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-bold uppercase">Seleccionar Cliente</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <select
                      required
                      value={clienteAntiguoId}
                      onChange={(e) => setClienteAntiguoId(e.target.value)}
                      className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 text-sm font-bold text-white focus:border-red-500/50 outline-none transition-all appearance-none"
                    >
                      <option value="">-- Buscar Cliente --</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre} {c.ci ? `(C.I. ${c.ci})` : c.telefono ? `(${c.telefono})` : ''} - {c.total_visitas} visitas</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1">Este cliente donará su historial y luego será borrado de la base de datos.</p>
                </div>
              </div>

              {/* Paso 2 */}
              <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3 text-green-500 font-black uppercase tracking-widest text-xs mb-4">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/50">2</div>
                  Cliente a Mantener (Nuevo)
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-bold uppercase">Seleccionar Cliente</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <select
                      required
                      value={clienteNuevoId}
                      onChange={(e) => setClienteNuevoId(e.target.value)}
                      className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 text-sm font-bold text-white focus:border-green-500/50 outline-none transition-all appearance-none"
                    >
                      <option value="">-- Buscar Cliente --</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre} {c.ci ? `(C.I. ${c.ci})` : c.telefono ? `(${c.telefono})` : ''} - {c.total_visitas} visitas</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1">Este cliente absorberá las visitas, gastos e historial de citas del antiguo.</p>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4 flex flex-col items-center border-t border-white/5">
              <Button
                type="submit"
                variant="primary"
                className="w-full md:w-auto min-w-[250px] h-14 text-sm font-black uppercase tracking-widest shadow-xl shadow-amber-500/20"
                disabled={syncing || !clienteAntiguoId || !clienteNuevoId}
              >
                {syncing ? (
                  <span className="flex items-center gap-2"><RefreshCw className="animate-spin w-4 h-4" /> Fusionando...</span>
                ) : 'Fusionar Clientes'}
              </Button>

              {result && (
                <div className={`mt-6 flex items-center gap-3 p-4 rounded-xl border ${result.success ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  {result.success ? <CheckCircle2 className="w-5 h-5" /> : null}
                  <p className="font-bold text-sm">{result.message}</p>
                </div>
              )}
            </div>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
