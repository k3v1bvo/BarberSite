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
  role?: string
  citasCount?: number
}

interface Cliente {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  ci: string | null
  total_visitas: number
  created_at?: string | null
  codigo_tarjeta?: string | null
  referral_code?: string | null
}

interface OperarioSummary {
  nombre: string
  pendientes: number
  sincronizadas: number
}

export default function SincronizarHistorialPage() {
  const [tab, setTab] = useState<'barberos' | 'clientes'>('barberos')
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [searchFilterList, setSearchFilterList] = useState('')
  
  // States Barbero
  const [selectedBarbero, setSelectedBarbero] = useState<string>('')
  const [nombreAntiguo, setNombreAntiguo] = useState('')
  const [operadoresAntiguos, setOperadoresAntiguos] = useState<string[]>([])
  const [showOperadoresDropdown, setShowOperadoresDropdown] = useState(false)
  const [searchBarbero, setSearchBarbero] = useState('')
  const [showBarberoDropdown, setShowBarberoDropdown] = useState(false)
  
  // States Cliente
  const [clienteAntiguoId, setClienteAntiguoId] = useState('')
  const [clienteNuevoId, setClienteNuevoId] = useState('')
  const [searchClienteAntiguo, setSearchClienteAntiguo] = useState('')
  const [searchClienteNuevo, setSearchClienteNuevo] = useState('')
  const [showClienteAntiguoDropdown, setShowClienteAntiguoDropdown] = useState(false)
  const [showClienteNuevoDropdown, setShowClienteNuevoDropdown] = useState(false)

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{success: boolean, message: string} | null>(null)
  const { success, error: toastError } = useToast()
  const supabase = createClient()

  // Live Search States
  const [liveOperadores, setLiveOperadores] = useState<string[]>([])
  const [operadoresSummary, setOperadoresSummary] = useState<OperarioSummary[]>([])
  const [liveClientesAntiguos, setLiveClientesAntiguos] = useState<Cliente[]>([])
  const [liveClientesNuevos, setLiveClientesNuevos] = useState<Cliente[]>([])

  const searchOperadoresLive = useCallback(async (term: string) => {
    try {
      let query = supabase.from('citas').select('barbero_id, notas').not('notas', 'is', null)
      if (term.trim()) {
        const t = term.trim()
        query = query.or(`notas.ilike.%Barbero: %${t}%,notas.ilike.%Op: %${t}%,notas.ilike.%${t}%`)
      }
      const { data } = await query.limit(1000)
      if (data) {
        const map = new Map<string, { pendientes: number, sincronizadas: number }>()
        data.forEach(cita => {
          if (cita.notas) {
            const match = cita.notas.match(/(?:Barbero:|Op:)\s*([^|.]+)/i)
            if (match && match[1]) {
              const name = match[1].trim().toUpperCase()
              if (!term.trim() || name.includes(term.trim().toUpperCase())) {
                const current = map.get(name) || { pendientes: 0, sincronizadas: 0 }
                if (!cita.barbero_id) {
                  current.pendientes++
                } else {
                  current.sincronizadas++
                }
                map.set(name, current)
              }
            }
          }
        })
        const list: OperarioSummary[] = Array.from(map.entries()).map(([nombre, counts]) => ({
          nombre,
          pendientes: counts.pendientes,
          sincronizadas: counts.sincronizadas
        })).sort((a, b) => a.nombre.localeCompare(b.nombre))

        setLiveOperadores(list.map(o => o.nombre))
        setOperadoresSummary(list)
      }
    } catch (err) {
      console.error(err)
    }
  }, [supabase])

  const searchClientesLive = useCallback(async (term: string, target: 'antiguo' | 'nuevo') => {
    try {
      const t = term.trim()
      const normT = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const words = normT.split(/\s+/).filter((w: string) => w.length >= 2)

      let clientQuery = supabase.from('clientes').select('id, nombre, email, telefono, ci, total_visitas, created_at, codigo_tarjeta, referral_code')
      let profileQuery = supabase.from('profiles').select('id, full_name, email, phone, ci, created_at').eq('role', 'cliente')

      if (t) {
        const firstWord = words[0] || t
        clientQuery = clientQuery.or(`nombre.ilike.%${firstWord}%,ci.ilike.%${t}%,telefono.ilike.%${t}%,email.ilike.%${t}%,codigo_tarjeta.ilike.%${t}%,referral_code.ilike.%${t}%`)
        profileQuery = profileQuery.or(`full_name.ilike.%${firstWord}%,ci.ilike.%${t}%,phone.ilike.%${t}%,email.ilike.%${t}%`)
      }

      const [resC, resP] = await Promise.all([
        clientQuery.order('created_at', { ascending: false }).limit(100),
        profileQuery.order('created_at', { ascending: false }).limit(100),
      ])

      const map = new Map<string, any>()
      resC.data?.forEach(c => {
        const code = c.codigo_tarjeta || c.referral_code || (c.ci ? `REF-${c.ci.replace(/\D/g, '').slice(-4)}` : null)
        map.set(c.id, { ...c, codigo_tarjeta: code, referral_code: code })
      })
      resP.data?.forEach(p => {
        if (!map.has(p.id)) {
          const code = p.ci ? `REF-${p.ci.replace(/\D/g, '').slice(-4)}` : null
          map.set(p.id, {
            id: p.id,
            nombre: p.full_name || 'Cliente Registrado',
            email: p.email || null,
            telefono: p.phone || null,
            ci: p.ci || null,
            total_visitas: 0,
            created_at: p.created_at || new Date().toISOString(),
            codigo_tarjeta: code,
            referral_code: code,
          })
        }
      })

      let combined = Array.from(map.values())

      if (words.length > 1) {
        combined = combined.filter((item: any) => {
          const itemNorm = (item.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' ' + (item.email || '').toLowerCase()
          return words.every((w: string) => itemNorm.includes(w.toLowerCase()))
        })
      }

      combined = combined.slice(0, 50)
      if (target === 'antiguo') setLiveClientesAntiguos(combined)
      else setLiveClientesNuevos(combined)
    } catch (err) {
      console.error(err)
    }
  }, [supabase])

  const loadDatos = useCallback(async () => {
    try {
      // 1. Cargar barberos y coordinadores con conteo de citas vinculadas
      const { data: bData, error: bErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['barbero', 'coordinador'])
        .order('full_name')
      if (bErr) throw bErr

      const { data: citasBarberos } = await supabase
        .from('citas')
        .select('barbero_id')
        .not('barbero_id', 'is', null)

      const countsMap: Record<string, number> = {}
      citasBarberos?.forEach(c => {
        if (c.barbero_id) {
          countsMap[c.barbero_id] = (countsMap[c.barbero_id] || 0) + 1
        }
      })

      const barberosWithCounts = (bData || []).map(b => ({
        ...b,
        citasCount: countsMap[b.id] || 0
      }))

      setBarberos(barberosWithCounts)

      // 2. Cargar clientes y perfiles combinados para total paridad con /admin/clientes
      const [resClientes, resProfiles] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, nombre, email, telefono, ci, total_visitas, created_at, codigo_tarjeta, referral_code')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name, email, phone, ci, created_at')
          .eq('role', 'cliente')
      ])

      const clientesMap = new Map<string, any>()
      resClientes.data?.forEach(c => {
        const code = c.codigo_tarjeta || c.referral_code || (c.ci ? `REF-${c.ci.replace(/\D/g, '').slice(-4)}` : null)
        clientesMap.set(c.id, { ...c, codigo_tarjeta: code, referral_code: code })
      })

      resProfiles.data?.forEach(p => {
        if (clientesMap.has(p.id)) {
          const existing = clientesMap.get(p.id)!
          if (!existing.ci && p.ci) existing.ci = p.ci
          if (!existing.email && p.email) existing.email = p.email
          if (!existing.telefono && p.phone) existing.telefono = p.phone
          if (!existing.codigo_tarjeta && p.ci) existing.codigo_tarjeta = `REF-${p.ci.replace(/\D/g, '').slice(-4)}`
        } else {
          const code = p.ci ? `REF-${p.ci.replace(/\D/g, '').slice(-4)}` : null
          clientesMap.set(p.id, {
            id: p.id,
            nombre: p.full_name || 'Cliente Registrado',
            email: p.email || null,
            telefono: p.phone || null,
            ci: p.ci || null,
            total_visitas: 0,
            created_at: p.created_at || new Date().toISOString(),
            codigo_tarjeta: code,
            referral_code: code,
          })
        }
      })

      const cData = Array.from(clientesMap.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 100)

      if (cData) {
        setClientes(cData)
        setLiveClientesAntiguos(cData)
        setLiveClientesNuevos(cData)
      }

      // 3. Cargar primeros operarios para estado inicial
      searchOperadoresLive('')

    } catch (err) {
      console.error('Error loading data:', err)
      toastError('Error al cargar datos de sincronización')
    } finally {
      setLoading(false)
    }
  }, [supabase, toastError, searchOperadoresLive])

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

    const nameAntiguo = clientes.find(c => c.id === clienteAntiguoId)?.nombre || liveClientesAntiguos.find(c => c.id === clienteAntiguoId)?.nombre || searchClienteAntiguo || 'Cliente Antiguo'
    const nameNuevo = clientes.find(c => c.id === clienteNuevoId)?.nombre || liveClientesNuevos.find(c => c.id === clienteNuevoId)?.nombre || searchClienteNuevo || 'Cliente Nuevo'

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
      setSearchClienteAntiguo('')
      setSearchClienteNuevo('')
      setSearchBarbero('')
      setSelectedBarbero('')
      setNombreAntiguo('')
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
                      placeholder="Escribe para buscar operario... (Ej: JHOEL)"
                      value={nombreAntiguo}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase()
                        setNombreAntiguo(val)
                        setShowOperadoresDropdown(true)
                        searchOperadoresLive(val)
                      }}
                      onFocus={() => {
                        setShowOperadoresDropdown(true)
                        searchOperadoresLive(nombreAntiguo)
                      }}
                      onBlur={() => setTimeout(() => setShowOperadoresDropdown(false), 200)}
                      className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all uppercase"
                    />
                    
                    {/* Dropdown Operadores Antiguos */}
                    {showOperadoresDropdown && (
                      <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        {liveOperadores.map((op, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-amber-500/10 hover:text-amber-400 transition-colors border-b border-white/5 last:border-0"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setNombreAntiguo(op)
                              setShowOperadoresDropdown(false)
                            }}
                          >
                            <div className="font-bold uppercase text-white">{op}</div>
                            <div className="text-[10px] text-amber-500/80 mt-0.5">Operario detectado en citas pasadas</div>
                          </button>
                        ))}
                        {liveOperadores.length === 0 && (
                          <div className="px-4 py-3 text-sm text-zinc-500 text-center">
                            {nombreAntiguo ? 'Escribe o presiona Sincronizar para vincular este nombre exacto' : 'Escribe para buscar...'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1">Escribe o selecciona el nombre exacto de la nota importada.</p>
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
                    <input
                      type="text"
                      required
                      placeholder="Buscar Barbero Actual..."
                      value={searchBarbero}
                      onChange={(e) => {
                        setSearchBarbero(e.target.value)
                        setSelectedBarbero('')
                        setShowBarberoDropdown(true)
                      }}
                      onFocus={() => setShowBarberoDropdown(true)}
                      onBlur={() => setTimeout(() => setShowBarberoDropdown(false), 200)}
                      className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 text-sm font-bold text-white focus:border-green-500/50 outline-none transition-all uppercase"
                    />
                    
                    {/* Dropdown Barbero Actual */}
                    {showBarberoDropdown && (
                      <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        {barberos
                          .filter(b => b.full_name.toUpperCase().includes(searchBarbero.toUpperCase()) || b.email.toUpperCase().includes(searchBarbero.toUpperCase()))
                          .map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-green-500/10 hover:text-green-400 transition-colors border-b border-white/5 last:border-0"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setSelectedBarbero(b.id)
                                setSearchBarbero(`${b.full_name} (${b.email})`)
                                setShowBarberoDropdown(false)
                              }}
                            >
                              <div className="font-bold uppercase text-white">{b.full_name}</div>
                              <div className="text-[10px] text-zinc-500 mt-0.5">{b.email}</div>
                            </button>
                          ))}
                      </div>
                    )}
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
                    <input
                      type="text"
                      required
                      placeholder="Escribe nombre, CI o teléfono... (Ej: PEREZ)"
                      value={searchClienteAntiguo}
                      onChange={(e) => {
                        const val = e.target.value
                        setSearchClienteAntiguo(val)
                        setClienteAntiguoId('')
                        setShowClienteAntiguoDropdown(true)
                        searchClientesLive(val, 'antiguo')
                      }}
                      onFocus={() => {
                        setShowClienteAntiguoDropdown(true)
                        searchClientesLive(searchClienteAntiguo, 'antiguo')
                      }}
                      onBlur={() => setTimeout(() => setShowClienteAntiguoDropdown(false), 200)}
                      className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 text-sm font-bold text-white focus:border-red-500/50 outline-none transition-all uppercase"
                    />

                    {/* Dropdown Cliente Antiguo */}
                    {showClienteAntiguoDropdown && (
                      <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        {liveClientesAntiguos.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-red-500/10 hover:text-red-400 transition-colors border-b border-white/5 last:border-0"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setClienteAntiguoId(c.id)
                              setSearchClienteAntiguo(`${c.nombre} ${c.ci ? `(C.I. ${c.ci})` : c.telefono ? `(${c.telefono})` : ''}`)
                              setShowClienteAntiguoDropdown(false)
                            }}
                          >
                            <div className="font-bold uppercase text-white flex items-center justify-between">
                              <span>{c.nombre}</span>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full ${c.email ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                {c.email || 'Sin Correo'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-3">
                              {c.ci && <span className="text-amber-400 font-bold">CI: {c.ci}</span>}
                              {c.telefono && <span>Tel: {c.telefono}</span>}
                              <span className="font-black text-white">Visitas: {c.total_visitas || 0}</span>
                            </div>
                          </button>
                        ))}
                        {liveClientesAntiguos.length === 0 && (
                          <div className="px-4 py-3 text-sm text-zinc-500 text-center">No se encontraron clientes coincidentes</div>
                        )}
                      </div>
                    )}
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
                    <input
                      type="text"
                      required
                      placeholder="Escribe nombre, CI o teléfono..."
                      value={searchClienteNuevo}
                      onChange={(e) => {
                        const val = e.target.value
                        setSearchClienteNuevo(val)
                        setClienteNuevoId('')
                        setShowClienteNuevoDropdown(true)
                        searchClientesLive(val, 'nuevo')
                      }}
                      onFocus={() => {
                        setShowClienteNuevoDropdown(true)
                        searchClientesLive(searchClienteNuevo, 'nuevo')
                      }}
                      onBlur={() => setTimeout(() => setShowClienteNuevoDropdown(false), 200)}
                      className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 text-sm font-bold text-white focus:border-green-500/50 outline-none transition-all uppercase"
                    />

                    {/* Dropdown Cliente Nuevo */}
                    {showClienteNuevoDropdown && (
                      <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        {liveClientesNuevos.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-green-500/10 hover:text-green-400 transition-colors border-b border-white/5 last:border-0"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setClienteNuevoId(c.id)
                              setSearchClienteNuevo(`${c.nombre} ${c.ci ? `(C.I. ${c.ci})` : c.telefono ? `(${c.telefono})` : ''}`)
                              setShowClienteNuevoDropdown(false)
                            }}
                          >
                            <div className="font-bold uppercase text-white flex items-center justify-between">
                              <span>{c.nombre}</span>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full ${c.email ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                {c.email || 'Sin Correo'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-3">
                              {c.ci && <span className="text-amber-400 font-bold">CI: {c.ci}</span>}
                              {c.telefono && <span>Tel: {c.telefono}</span>}
                              <span className="font-black text-white">Visitas: {c.total_visitas || 0}</span>
                            </div>
                          </button>
                        ))}
                        {liveClientesNuevos.length === 0 && (
                          <div className="px-4 py-3 text-sm text-zinc-500 text-center">No se encontraron clientes coincidentes</div>
                        )}
                      </div>
                    )}
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

      {/* ── LISTA DE OPERARIOS DE EXCEL (TAB BARBEROS) ── */}
      {tab === 'barberos' && (
        <Card className="bg-zinc-900 border-white/5 shadow-2xl">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle className="text-lg text-white font-black uppercase flex items-center gap-2">
                  <Users className="text-amber-500 w-5 h-5" />
                  Estado de Operarios Detectados en Excel
                </CardTitle>
                <p className="text-xs text-zinc-500 mt-1">
                  Lista de operarios de las hojas de Excel y su estado de vinculación ({operadoresSummary.length} detectados).
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {operadoresSummary.length === 0 ? (
              <div className="py-12 text-center text-zinc-600 text-sm">
                Cargando operarios del sistema...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
                {operadoresSummary.map((op, idx) => (
                  <div key={idx} className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col justify-between gap-2 hover:border-amber-500/30 transition-all">
                    <div>
                      <p className="font-black text-white text-xs uppercase truncate">{op.nombre}</p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {op.pendientes > 0 ? (
                          <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            ⚠️ {op.pendientes} citas sin vincular
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            ✓ {op.sincronizadas} citas vinculadas
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNombreAntiguo(op.nombre)
                        window.scrollTo({ top: 100, behavior: 'smooth' })
                      }}
                      className="w-full h-8 text-[10px] font-black uppercase border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    >
                      {op.pendientes > 0 ? '⚡ Vincular a Barbero' : '⚡ Re-vincular Citas'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── LISTA DE BARBEROS Y COORDINADORES (TAB BARBEROS) ── */}
      {tab === 'barberos' && (
        <Card className="bg-zinc-900 border-white/5 shadow-2xl">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle className="text-lg text-white font-black uppercase flex items-center gap-2">
                  <Users className="text-amber-500 w-5 h-5" />
                  Barberos y Coordinadores Sincronizados
                </CardTitle>
                <p className="text-xs text-zinc-500 mt-1">
                  Lista de perfiles del sistema y la cantidad total de citas históricas vinculadas a cada uno ({barberos.length} perfiles).
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
              {barberos.map((b) => (
                <div key={b.id} className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col justify-between gap-2 hover:border-green-500/30 transition-all">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black text-white text-xs uppercase truncate">{b.full_name}</p>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white/5 text-zinc-400">
                        {b.role || 'Barbero'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">{b.email}</p>
                    <div className="mt-2">
                      {(b.citasCount ?? 0) > 0 ? (
                        <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg inline-block">
                          ✓ {b.citasCount} citas vinculadas
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-lg inline-block">
                          0 citas vinculadas
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedBarbero(b.id)
                      setSearchBarbero(`${b.full_name} (${b.email})`)
                      window.scrollTo({ top: 100, behavior: 'smooth' })
                    }}
                    className="w-full h-8 text-[10px] font-black uppercase border-green-500/30 text-green-400 hover:bg-green-500/10 mt-1"
                  >
                    ⚡ Seleccionar Perfil
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── LISTA Y ESTADO DE CLIENTES (TAB CLIENTES) ── */}
      {tab === 'clientes' && (
        <Card className="bg-zinc-900 border-white/5 shadow-2xl">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-lg text-white font-black uppercase flex items-center gap-2">
                  <Users className="text-amber-500 w-5 h-5" />
                  Últimos Clientes Registrados y Auto-Sync
                </CardTitle>
                <p className="text-xs text-zinc-500 mt-1">
                  Lista ordenada con los registros más recientes primero ({clientes.length} clientes en total).
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar en lista..."
                  value={searchFilterList}
                  onChange={(e) => setSearchFilterList(e.target.value)}
                  className="w-full h-10 bg-zinc-950 border border-white/10 rounded-xl pl-9 pr-3 text-xs font-bold text-white focus:border-amber-500/50 outline-none uppercase"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="divide-y divide-white/5 max-h-96 overflow-y-auto pr-1">
              {clientes
                .filter(c => 
                  !searchFilterList || 
                  c.nombre.toUpperCase().includes(searchFilterList.toUpperCase()) || 
                  c.ci?.includes(searchFilterList) || 
                  c.email?.toUpperCase().includes(searchFilterList.toUpperCase()) ||
                  c.telefono?.includes(searchFilterList)
                )
                .slice(0, 100)
                .map((c) => (
                  <div key={c.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-white/[0.02] px-2 rounded-lg transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-white text-sm uppercase">{c.nombre}</p>
                        {c.total_visitas > 0 ? (
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            🟢 Sincronizado ({c.total_visitas} visitas)
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                            ⚪ Sin historial vinculado
                          </span>
                        )}
                        {c.ci && (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            CI: {c.ci}
                          </span>
                        )}
                        {(c.codigo_tarjeta || c.referral_code) && (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                            Cód: {c.codigo_tarjeta || c.referral_code}
                          </span>
                        )}
                        {c.created_at && (
                          <span className="text-[9px] font-bold text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full">
                            {new Date(c.created_at).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 flex-wrap">
                        {c.email && <span>{c.email}</span>}
                        {c.telefono && <span>Tel: {c.telefono}</span>}
                        <span className="text-amber-500/90 font-bold">Visitas: {c.total_visitas || 0}</span>
                      </div>
                    </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/auth/autosync-cliente', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ new_user_id: c.id, ci: c.ci, email: c.email, nombre: c.nombre })
                          })
                          const d = await res.json()
                          if (d.synced) {
                            success(`✓ Se fusionaron ${d.count} historial(es) pasados para ${c.nombre}.`)
                          } else {
                            success(`No se encontraron cuentas pendientes por sincronizar para ${c.nombre}.`)
                          }
                          loadDatos()
                        } catch (err: any) {
                          toastError(err.message)
                        }
                      }}
                      className="h-8 text-[10px] font-bold border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    >
                      ⚡ Auto-Sync por CI
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setClienteAntiguoId(c.id)
                        setSearchClienteAntiguo(`${c.nombre} ${c.ci ? `(CI: ${c.ci})` : ''}`)
                        window.scrollTo({ top: 100, behavior: 'smooth' })
                      }}
                      className="h-8 text-[10px] font-bold border-red-500/30 text-red-400 hover:bg-red-500/10"
                      title="Seleccionar para transferir sus datos a otro y borrarlo"
                    >
                      🔴 Origen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setClienteNuevoId(c.id)
                        setSearchClienteNuevo(`${c.nombre} ${c.ci ? `(CI: ${c.ci})` : ''}`)
                        window.scrollTo({ top: 100, behavior: 'smooth' })
                      }}
                      className="h-8 text-[10px] font-bold border-green-500/30 text-green-400 hover:bg-green-500/10"
                      title="Seleccionar para mantener esta cuenta y recibir el historial"
                    >
                      🟢 Destino
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
