'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { InduccionCard } from '@/components/induccion/InduccionCard'
import { YouTubePlayer } from '@/components/induccion/YouTubePlayer'
import { parseTimestampToSeconds, formatSecondsToTimestamp } from '@/lib/youtube'
import { useToast } from '@/components/ui/Toast'
import {
  GraduationCap, Plus, Search, CheckCircle2, Clock, Users,
  BookOpen, CheckSquare, Trash2, Edit3, Sparkles, Filter, ShieldCheck
} from 'lucide-react'

interface Servicio {
  id: string
  nombre: string
}

interface Barbero {
  id: string
  full_name: string
  avatar_url?: string
}

interface PasoPayload {
  titulo_paso: string
  descripcion: string
  timestamp_segundos: number
}

export default function AdminInduccionPage() {
  const supabase = createClient()
  const { success: toastSuccess, error: toastError } = useToast()
  const [activeTab, setActiveTab] = useState<'catalogo' | 'asignacion' | 'reporte'>('catalogo')

  // Data state
  const [inducciones, setInducciones] = useState<any[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [asignaciones, setAsignaciones] = useState<any[]>([])
  const [progresoGlobal, setProgresoGlobal] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filter & Search
  const [search, setSearch] = useState('')
  const [selectedServicioFilter, setSelectedServicioFilter] = useState('todos')

  // Modal Modal State
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingInduccionId, setEditingInduccionId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form Fields
  const [formTitulo, setFormTitulo] = useState('')
  const [formDescripcion, setFormDescripcion] = useState('')
  const [formCategoria, setFormCategoria] = useState('Servicio Técnico')
  const [formServicioId, setFormServicioId] = useState('')
  const [formYoutubeUrl, setFormYoutubeUrl] = useState('')
  const [formPdfUrl, setFormPdfUrl] = useState('')
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [formDuracionMinutos, setFormDuracionMinutos] = useState(15)
  const [formHerramientasStr, setFormHerramientasStr] = useState('')
  const [formIsPublished, setFormIsPublished] = useState(true)
  const [formPasos, setFormPasos] = useState<{ titulo_paso: string; descripcion: string; timestampStr: string }[]>([
    { titulo_paso: 'Paso 1: Diagnóstico e Higiene', descripcion: 'Evaluación del cuero cabelludo y cliente.', timestampStr: '00:00' },
    { titulo_paso: 'Paso 2: Marcado y Cierre', descripcion: 'Técnica de terminación y perfilado.', timestampStr: '05:00' }
  ])

  // Asignación tab state
  const [selectedBarberoForAsig, setSelectedBarberoForAsig] = useState<string>('')
  const [tempAsignados, setTempAsignados] = useState<string[]>([])
  const [savingAsig, setSavingAsig] = useState(false)

  // Load all initial data
  const loadAllData = useCallback(async () => {
    setLoading(true)
    try {
      const [indRes, servRes, barbRes, asigRes, progRes] = await Promise.all([
        fetch('/api/inducciones'),
        supabase.from('servicios').select('id, nombre').order('nombre'),
        supabase.from('profiles').select('id, full_name, avatar_url').eq('role', 'barbero').eq('is_active', true).order('full_name'),
        fetch('/api/inducciones/asignar'),
        fetch('/api/inducciones/progreso')
      ])

      if (indRes.ok) setInducciones(await indRes.json())
      if (servRes.data) setServicios(servRes.data)
      if (barbRes.data) {
        setBarberos(barbRes.data)
        if (!selectedBarberoForAsig && barbRes.data.length > 0) {
          setSelectedBarberoForAsig(barbRes.data[0].id)
        }
      }
      if (asigRes.ok) setAsignaciones(await asigRes.json())
      if (progRes.ok) setProgresoGlobal(await progRes.json())
    } catch (err: any) {
      toastError(err.message)
    } finally {
      setLoading(false)
    }
  }, [supabase, selectedBarberoForAsig])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // Update tempAsignados when selectedBarberoForAsig changes
  useEffect(() => {
    if (selectedBarberoForAsig && asignaciones.length >= 0) {
      const ids = asignaciones
        .filter((a: any) => a.barbero_id === selectedBarberoForAsig)
        .map((a: any) => a.induccion_id)
      setTempAsignados(ids)
    }
  }, [selectedBarberoForAsig, asignaciones])

  // Reset form
  const resetForm = () => {
    setEditingInduccionId(null)
    setFormTitulo('')
    setFormDescripcion('')
    setFormCategoria('Servicio Técnico')
    setFormServicioId('')
    setFormYoutubeUrl('')
    setFormPdfUrl('')
    setFormDuracionMinutos(15)
    setFormHerramientasStr('')
    setFormIsPublished(true)
    setFormPasos([
      { titulo_paso: 'Paso 1: Preparación', descripcion: 'Diagnóstico e higiene', timestampStr: '00:00' }
    ])
  }

  // Open modal for editing
  const handleOpenEdit = (ind: any) => {
    setEditingInduccionId(ind.id)
    setFormTitulo(ind.titulo || '')
    setFormDescripcion(ind.descripcion || '')
    setFormCategoria(ind.categoria || 'Servicio Técnico')
    setFormServicioId(ind.servicio_id || '')
    setFormYoutubeUrl(ind.youtube_url || '')
    setFormPdfUrl(ind.pdf_url || '')
    setFormDuracionMinutos(ind.duracion_minutos || 15)
    setFormHerramientasStr(Array.isArray(ind.herramientas_requeridas) ? ind.herramientas_requeridas.join(', ') : '')
    setFormIsPublished(ind.is_published !== false)

    if (Array.isArray(ind.induccion_pasos) && ind.induccion_pasos.length > 0) {
      const formattedPasos = ind.induccion_pasos.map((p: any) => ({
        titulo_paso: p.titulo_paso || '',
        descripcion: p.descripcion || '',
        timestampStr: formatSecondsToTimestamp(p.timestamp_segundos || 0)
      }))
      setFormPasos(formattedPasos)
    } else {
      setFormPasos([{ titulo_paso: 'Paso 1: Preparación', descripcion: '', timestampStr: '00:00' }])
    }

    setShowFormModal(true)
  }

  // Save Induccion
  const handleSaveInduccion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitulo.trim() || !formYoutubeUrl.trim()) {
      return toastError('El Título y la URL de YouTube son obligatorios')
    }

    setSubmitting(true)
    try {
      const herramientas = formHerramientasStr
        .split(',')
        .map(h => h.trim())
        .filter(Boolean)

      const pasosFormatted: PasoPayload[] = formPasos.map(p => ({
        titulo_paso: p.titulo_paso,
        descripcion: p.descripcion,
        timestamp_segundos: parseTimestampToSeconds(p.timestampStr)
      }))

      const payload = {
        titulo: formTitulo,
        descripcion: formDescripcion,
        categoria: formCategoria,
        servicio_id: formServicioId || null,
        youtube_url: formYoutubeUrl,
        pdf_url: formPdfUrl,
        duracion_minutos: formDuracionMinutos,
        herramientas_requeridas: herramientas,
        is_published: formIsPublished,
        pasos: pasosFormatted
      }

      let res
      if (editingInduccionId) {
        res = await fetch(`/api/inducciones/${editingInduccionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        res = await fetch('/api/inducciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      const resData = await res.json()
      if (!res.ok) throw new Error(resData.error || 'Error al guardar')

      toastSuccess(editingInduccionId ? 'Inducción actualizada correctamente ✨' : 'Nueva Inducción creada con éxito 🚀')
      setShowFormModal(false)
      resetForm()
      loadAllData()
    } catch (err: any) {
      toastError(err.message)
  // Upload PDF to Catbox.moe
  const handleUploadCatboxPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPdf(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload/catbox', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al subir PDF')

      setFormPdfUrl(data.url)
      toastSuccess('📄 PDF subido exitosamente a Catbox.moe')
    } catch (err: any) {
      toastError(err.message || 'Error al subir PDF')
    } finally {
      setUploadingPdf(false)
    }
  }

  // Delete PDF from Catbox.moe
  const handleDeleteCatboxPdf = async () => {
    if (!formPdfUrl) return
    if (!confirm('¿Deseas eliminar este archivo PDF de Catbox.moe?')) return

    try {
      const res = await fetch('/api/upload/catbox', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: formPdfUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')

      setFormPdfUrl('')
      toastSuccess('Archivo PDF eliminado de Catbox')
    } catch (err: any) {
      toastError(err.message || 'Error al eliminar PDF')
    }
  }

  // Delete Induccion
  const handleDeleteInduccion = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta inducción? Se borrarán sus pasos y asignaciones.')) return
    try {
      const res = await fetch(`/api/inducciones/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      toastSuccess('Inducción eliminada')
      loadAllData()
    } catch (err: any) {
      toastError(err.message)
    }
  }

  // Save Barbero Assignments
  const handleSaveAsignaciones = async () => {
    if (!selectedBarberoForAsig) return
    setSavingAsig(true)
    try {
      const res = await fetch('/api/inducciones/asignar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barbero_id: selectedBarberoForAsig,
          induccion_ids: tempAsignados
        })
      })

      if (!res.ok) throw new Error('Error al guardar asignaciones')
      toastSuccess('Cursos asignados correctamente al barbero 🎯')
      loadAllData()
    } catch (err: any) {
      toastError(err.message)
    } finally {
      setSavingAsig(false)
    }
  }

  // Filtered Inducciones
  const filteredInducciones = inducciones.filter(ind => {
    const matchesSearch = ind.titulo.toLowerCase().includes(search.toLowerCase()) ||
      (ind.descripcion && ind.descripcion.toLowerCase().includes(search.toLowerCase()))
    const matchesServicio = selectedServicioFilter === 'todos' || ind.servicio_id === selectedServicioFilter
    return matchesSearch && matchesServicio
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white uppercase flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <GraduationCap className="w-8 h-8" />
            </span>
            <span>Academia & <span className="text-amber-500">Inducción</span></span>
          </h1>
          <p className="text-zinc-400 font-medium mt-1.5 text-sm">
            Gestión de capacitaciones técnicas, videos de YouTube y asignaciones por barbero
          </p>
        </div>

        <Button
          onClick={() => { resetForm(); setShowFormModal(true) }}
          variant="primary"
          className="font-black bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-5 h-5 mr-1.5 stroke-[3]" /> Crear Inducción
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('catalogo')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
            activeTab === 'catalogo'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-black'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Catálogo de Cursos ({inducciones.length})
        </button>

        <button
          onClick={() => setActiveTab('asignacion')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
            activeTab === 'asignacion'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-black'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
          }`}
        >
          <CheckSquare className="w-4 h-4" /> Asignación a Barberos
        </button>

        <button
          onClick={() => setActiveTab('reporte')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
            activeTab === 'reporte'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-black'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" /> Reporte de Avance
        </button>
      </div>

      {/* TAB 1: CATÁLOGO */}
      {activeTab === 'catalogo' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-900/60 p-4 rounded-2xl border border-white/5">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar inducción por título..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-zinc-950 border-white/10 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-amber-500 shrink-0" />
              <select
                value={selectedServicioFilter}
                onChange={(e) => setSelectedServicioFilter(e.target.value)}
                className="h-10 bg-zinc-950 border border-white/10 rounded-xl px-3 text-xs text-white outline-none focus:border-amber-500 w-full sm:w-auto"
              >
                <option value="todos">Todos los Servicios</option>
                {servicios.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredInducciones.length === 0 ? (
            <div className="bg-zinc-900/50 border border-dashed border-white/10 rounded-3xl p-12 text-center">
              <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 font-bold">No hay inducciones creadas todavía</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
                Crea tu primer módulo de capacitación con video de YouTube para tu equipo.
              </p>
              <Button onClick={() => { resetForm(); setShowFormModal(true) }} size="sm" variant="primary" className="bg-amber-500 text-black font-black">
                + Crear primera inducción
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredInducciones.map((ind) => (
                <InduccionCard
                  key={ind.id}
                  induccion={ind}
                  showAdminActions
                  onEdit={() => handleOpenEdit(ind)}
                  onDelete={() => handleDeleteInduccion(ind.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ASIGNACIÓN A BARBEROS */}
      {activeTab === 'asignacion' && (
        <div className="space-y-6">
          <Card className="border-white/10 bg-zinc-900/80">
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
                <div>
                  <h3 className="font-black text-white uppercase text-base flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-500" /> Asignación Personalizada por Barbero
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Selecciona un barbero para elegir exactamente qué inducciones tendrá visibles en su panel.
                  </p>
                </div>

                <Button
                  onClick={handleSaveAsignaciones}
                  disabled={savingAsig}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-black"
                >
                  {savingAsig ? 'Guardando...' : '💾 Guardar Asignación'}
                </Button>
              </div>

              {/* Barbero Selector */}
              <div className="flex flex-wrap gap-2">
                {barberos.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBarberoForAsig(b.id)}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition border ${
                      selectedBarberoForAsig === b.id
                        ? 'bg-amber-500 text-black border-amber-500 shadow-lg font-black'
                        : 'bg-zinc-950 text-zinc-300 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    💈 {b.full_name}
                  </button>
                ))}
              </div>

              {/* Batch Actions & Counter */}
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-bold text-amber-400">
                  {tempAsignados.length} de {inducciones.length} cursos asignados a este barbero
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTempAsignados(inducciones.map(i => i.id))}
                    className="text-xs text-zinc-400 hover:text-white font-bold underline"
                  >
                    Seleccionar Todos
                  </button>
                  <span className="text-zinc-600">•</span>
                  <button
                    onClick={() => setTempAsignados([])}
                    className="text-xs text-zinc-400 hover:text-red-400 font-bold underline"
                  >
                    Desmarcar Todos
                  </button>
                </div>
              </div>

              {/* Checkboxes List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {inducciones.map(ind => {
                  const isChecked = tempAsignados.includes(ind.id)
                  return (
                    <div
                      key={ind.id}
                      onClick={() => {
                        if (isChecked) setTempAsignados(tempAsignados.filter(id => id !== ind.id))
                        else setTempAsignados([...tempAsignados, ind.id])
                      }}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                        isChecked
                          ? 'bg-amber-500/10 border-amber-500/40 text-white'
                          : 'bg-zinc-950/60 border-white/5 text-zinc-500 hover:border-white/10'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-1 accent-amber-500 w-4 h-4 rounded cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold truncate ${isChecked ? 'text-white' : 'text-zinc-400'}`}>
                          {ind.titulo}
                        </p>
                        {ind.servicios?.nombre && (
                          <span className="text-[10px] text-amber-400/80 block mt-0.5">✂️ {ind.servicios.nombre}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: REPORTE DE AVANCE */}
      {activeTab === 'reporte' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {barberos.map(b => {
              const miAsigIds = asignaciones.filter((a: any) => a.barbero_id === b.id).map((a: any) => a.induccion_id)
              const totalAsignados = miAsigIds.length > 0 ? miAsigIds.length : inducciones.length
              
              const vistasCount = progresoGlobal.filter((p: any) => p.barbero_id === b.id && p.estado === 'completado').length
              const porcentaje = totalAsignados > 0 ? Math.min(100, Math.round((vistasCount / totalAsignados) * 100)) : 0

              return (
                <Card key={b.id} className="border-white/10 bg-zinc-900/80">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-lg font-black text-amber-400">
                          💈
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{b.full_name}</h4>
                          <span className="text-[10px] text-zinc-500 font-bold uppercase">Barbero Staff</span>
                        </div>
                      </div>
                      <Badge variant={porcentaje === 100 ? 'success' : 'warning'} className="font-black">
                        {porcentaje}%
                      </Badge>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-xs text-zinc-400 mb-1 font-medium">
                        <span>Progreso de inducción</span>
                        <span>{vistasCount} de {totalAsignados} Vistas</span>
                      </div>
                      <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500 rounded-full"
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR INDUCCIÓN */}
      {showFormModal && (
        <Modal
          isOpen={showFormModal}
          onClose={() => setShowFormModal(false)}
          title={editingInduccionId ? '✏️ Editar Inducción Barbera' : '🎓 Crear Nueva Inducción Barbera'}
        >
          <form onSubmit={handleSaveInduccion} className="space-y-5 max-h-[80vh] overflow-y-auto pr-2">
            {/* Título, Categoría & Servicio */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase block mb-1">Título de la Inducción *</label>
                <Input
                  required
                  placeholder="Ej. Técnica Fade Medio & Toalla Caliente"
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  className="bg-zinc-950 border-white/10 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase block mb-1">Categoría del Curso</label>
                <select
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                  className="w-full h-10 bg-zinc-950 border border-white/10 rounded-xl px-3 text-xs text-white outline-none focus:border-amber-500"
                >
                  <option value="Servicio Técnico">✂️ Servicio Técnico (Cortes/Barba)</option>
                  <option value="Atención al Cliente">🤝 Atención al Cliente & Etiqueta</option>
                  <option value="Higiene & Limpieza">🧹 Higiene & Limpieza del Puesto</option>
                  <option value="Protocolo de Bienvenida">🚪 Protocolo de Entrada/Salida</option>
                  <option value="Mantenimiento de Herramientas">🧰 Mantenimiento de Herramientas</option>
                  <option value="Manejo de Caja & POS">💳 Manejo de Caja & POS</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase block mb-1">Servicio Específico</label>
                <select
                  value={formServicioId}
                  onChange={(e) => setFormServicioId(e.target.value)}
                  className="w-full h-10 bg-zinc-950 border border-white/10 rounded-xl px-3 text-xs text-white outline-none focus:border-amber-500"
                >
                  <option value="">Ninguno (General)</option>
                  {servicios.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* URL YouTube & Duración */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-zinc-400 uppercase block mb-1">URL de Video en YouTube *</label>
                <Input
                  required
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={formYoutubeUrl}
                  onChange={(e) => setFormYoutubeUrl(e.target.value)}
                  className="bg-zinc-950 border-white/10 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase block mb-1">Duración (Minutos)</label>
                <Input
                  type="number"
                  min="1"
                  value={formDuracionMinutos}
                  onChange={(e) => setFormDuracionMinutos(Number(e.target.value) || 15)}
                  className="bg-zinc-950 border-white/10 text-xs"
                />
              </div>
            </div>

            {/* Live YouTube Preview */}
            {formYoutubeUrl.trim() && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Vista Previa del Video</span>
                <YouTubePlayer url={formYoutubeUrl} />
              </div>
            )}

            {/* Material PDF (Catbox.moe integration) */}
            <div className="border border-white/10 rounded-xl p-4 bg-zinc-950/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-white uppercase flex items-center gap-2">
                    📄 Material o Documento PDF (Catbox.moe)
                  </label>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Sube manuales, guías o material complementario en PDF.</p>
                </div>
                {formPdfUrl && (
                  <Badge variant="success" className="text-[9px] uppercase font-black">PDF Adjunto</Badge>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="flex-1">
                  <Input
                    placeholder="https://files.catbox.moe/xxxxxx.pdf"
                    value={formPdfUrl}
                    onChange={(e) => setFormPdfUrl(e.target.value)}
                    className="bg-zinc-900 border-white/10 text-xs text-blue-400 font-mono"
                  />
                </div>

                <div className="flex gap-2 shrink-0">
                  <label className={`px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black cursor-pointer transition flex items-center gap-1.5 ${uploadingPdf ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingPdf ? '⏳ Subiendo...' : '📁 Subir PDF'}
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={handleUploadCatboxPdf}
                    />
                  </label>

                  {formPdfUrl && (
                    <button
                      type="button"
                      onClick={handleDeleteCatboxPdf}
                      className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition flex items-center gap-1"
                      title="Eliminar archivo de Catbox"
                    >
                      🗑️ Borrar de Catbox
                    </button>
                  )}
                </div>
              </div>

              {formPdfUrl && (
                <div className="flex items-center justify-between text-[11px] bg-black/40 p-2.5 rounded-lg border border-white/5">
                  <span className="text-zinc-400 truncate max-w-[280px]">📄 {formPdfUrl}</span>
                  <a
                    href={formPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 font-bold underline text-xs shrink-0"
                  >
                    Ver / Abrir PDF ↗
                  </a>
                </div>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase block mb-1">Descripción corta</label>
              <textarea
                rows={2}
                placeholder="Explica de qué trata esta capacitación y qué aprenderá el barbero..."
                value={formDescripcion}
                onChange={(e) => setFormDescripcion(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* Herramientas requeridas */}
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase block mb-1">Herramientas e Insumos (Separados por coma)</label>
              <Input
                placeholder="Ej. Tijera 6.5, Clipper Magic Clip, Shaver, Gel de afeitar"
                value={formHerramientasStr}
                onChange={(e) => setFormHerramientasStr(e.target.value)}
                className="bg-zinc-950 border-white/10 text-xs"
              />
            </div>

            {/* Pasos Detallados Builder */}
            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-amber-500">📌 Pasos del Servicio & Marcas de Tiempo</span>
                <button
                  type="button"
                  onClick={() => setFormPasos([...formPasos, { titulo_paso: `Paso ${formPasos.length + 1}`, descripcion: '', timestampStr: '00:00' }])}
                  className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
                >
                  + Agregar Paso
                </button>
              </div>

              {formPasos.map((paso, idx) => (
                <div key={idx} className="p-3 bg-zinc-950 border border-white/10 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-400">Paso #{idx + 1}</span>
                    {formPasos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormPasos(formPasos.filter((_, i) => i !== idx))}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <Input
                        placeholder="Título del paso (ej. Degradado Base 0.5)"
                        value={paso.titulo_paso}
                        onChange={(e) => {
                          const copy = [...formPasos]
                          copy[idx].titulo_paso = e.target.value
                          setFormPasos(copy)
                        }}
                        className="bg-zinc-900 border-white/10 text-xs"
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="Tiempo MM:SS (ej. 02:30)"
                        value={paso.timestampStr}
                        onChange={(e) => {
                          const copy = [...formPasos]
                          copy[idx].timestampStr = e.target.value
                          setFormPasos(copy)
                        }}
                        className="bg-zinc-900 border-white/10 text-xs font-mono text-center"
                      />
                    </div>
                  </div>

                  <textarea
                    rows={1}
                    placeholder="Detalles / Tips de precisión para este paso..."
                    value={paso.descripcion}
                    onChange={(e) => {
                      const copy = [...formPasos]
                      copy[idx].descripcion = e.target.value
                      setFormPasos(copy)
                    }}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-amber-500 resize-none"
                  />
                </div>
              ))}
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowFormModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting} size="sm" className="bg-amber-500 text-black font-black">
                {submitting ? 'Guardando...' : editingInduccionId ? 'Actualizar Inducción' : 'Guardar e Inducir'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
