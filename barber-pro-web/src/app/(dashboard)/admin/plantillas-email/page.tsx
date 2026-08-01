'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'
import {
  Mail,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit3,
  Users,
  Megaphone,
  Save,
  RefreshCw,
  Gift,
  Calendar,
  Clock,
  UserCheck,
  ShieldCheck,
  Zap,
  ArrowLeft
} from 'lucide-react'
import { useBrand } from '@/components/providers/BrandProvider'

interface SystemTemplate {
  id: string
  name: string
  category: 'operacion' | 'marketing' | 'auth'
  subject: string
  description: string
  variables: string[]
  sampleData: Record<string, string>
  customSubject?: string
  customMessage?: string
}

const INITIAL_TEMPLATES: SystemTemplate[] = [
  {
    id: 'reserva_confirmacion_cliente',
    name: '✂️ Confirmación de Cita / Reserva',
    category: 'operacion',
    subject: '✂️ Tu cita está confirmada',
    description: 'Enviado automáticamente cuando un cliente agenda una cita en línea o desde la caja.',
    variables: ['{{nombre}}', '{{servicio}}', '{{fecha}}', '{{hora}}', '{{barbero}}'],
    sampleData: {
      nombre: 'Carlos Gutiérrez',
      servicio: 'Corte Ejecutivo + Barba',
      fecha: '2026-08-05',
      hora: '15:00',
      barbero: 'Mateo Barreto'
    }
  },
  {
    id: 'registro_bienvenida_nuevo',
    name: '🎉 Bienvenida a Cliente Nuevo',
    category: 'auth',
    subject: '🎉 ¡Bienvenido a nuestra barbería!',
    description: 'Enviado cuando un cliente crea una cuenta por primera vez en el sitio web.',
    variables: ['{{nombre}}', '{{email}}', '{{link}}'],
    sampleData: {
      nombre: 'Jorge Mendoza',
      email: 'jorge.mendoza@gmail.com',
      link: 'https://barber-site-livid.vercel.app/reservar'
    }
  },
  {
    id: 'recordatorio_cita',
    name: '⏰ Recordatorio de Cita (2 Horas Antes)',
    category: 'operacion',
    subject: '⏰ Recordatorio: Tu cita es hoy',
    description: 'Enviado automáticamente unas horas antes de la cita para evitar inasistencias.',
    variables: ['{{nombre}}', '{{servicio}}', '{{fecha}}', '{{hora}}', '{{barbero}}'],
    sampleData: {
      nombre: 'Andrés Morales',
      servicio: 'Perfilado de Barba',
      fecha: 'Hoy',
      hora: '18:30',
      barbero: 'Nicolás Quispe'
    }
  },
  {
    id: 'reserva_cancelada',
    name: '❌ Notificación de Cita Cancelada',
    category: 'operacion',
    subject: '❌ Tu cita ha sido cancelada',
    description: 'Enviado cuando una cita es anulada por el barbero, cliente o administración.',
    variables: ['{{nombre}}', '{{servicio}}', '{{fecha}}', '{{hora}}', '{{motivo}}'],
    sampleData: {
      nombre: 'Gabriel Suárez',
      servicio: 'Corte Clásico',
      fecha: '2026-08-02',
      hora: '11:00',
      motivo: 'Reorganización de horario en barbería'
    }
  },
  {
    id: 'invitacion_referido',
    name: '🎁 Invitación por Programa de Referidos',
    category: 'marketing',
    subject: '🎁 ¡Un amigo te ha regalado un beneficio especial!',
    description: 'Enviado cuando un cliente existente invita a un amigo compartiendo su código.',
    variables: ['{{clienteNombre}}', '{{acompananteNombre}}', '{{link}}'],
    sampleData: {
      clienteNombre: 'Mario Siles',
      acompananteNombre: 'Fernando Paz',
      link: 'https://barber-site-livid.vercel.app/login'
    }
  },
  {
    id: 'invitacion_2x1',
    name: '👥 Beneficio Martes 2x1 (Parejas)',
    category: 'marketing',
    subject: '✂️ ¡Pagan 1 y entran 2 los Martes!',
    description: 'Enviado al acompañante registrado durante las reservas de la promoción Martes 2x1.',
    variables: ['{{nombre}}', '{{clienteNombre}}', '{{fecha}}'],
    sampleData: {
      nombre: 'Lucas Roca',
      clienteNombre: 'Rodrigo Vargas',
      fecha: 'Martes 04/08/2026'
    }
  },
  {
    id: 'solicitar_recuperacion',
    name: '🔐 Restablecer Contraseña (OTP / Enlace)',
    category: 'auth',
    subject: '🔐 Código para restablecer tu contraseña',
    description: 'Enviado al solicitar recuperar contraseña o código de acceso seguro.',
    variables: ['{{nombre}}', '{{codigo}}', '{{link}}'],
    sampleData: {
      nombre: 'Daniel Flores',
      codigo: '784920',
      link: 'https://barber-site-livid.vercel.app/login'
    }
  },
  {
    id: 'promocion_masiva',
    name: '📣 Correo Promocional / Anuncio Especial',
    category: 'marketing',
    subject: '📣 Novedades y Descuentos Especiales para ti',
    description: 'Plantilla base para envíos de marketing masivo y promociones a clientes.',
    variables: ['{{nombre}}', '{{asuntoCustom}}', '{{mensajeCustom}}', '{{link}}'],
    sampleData: {
      nombre: 'Estimado Cliente',
      asuntoCustom: '¡Super Descuento del 20% este Fin de Semana!',
      mensajeCustom: 'Presenta este correo en recepción y recibe un 20% de descuento en todos nuestros productos de perfilado.',
      link: 'https://barber-site-livid.vercel.app/reservar'
    }
  }
]

export default function PlantillasEmailPage() {
  const { brand } = useBrand()
  const [activeTab, setActiveTab] = useState<'plantillas' | 'marketing' | 'prueba'>('plantillas')
  const [templates, setTemplates] = useState<SystemTemplate[]>(INITIAL_TEMPLATES)
  const [selectedTemplate, setSelectedTemplate] = useState<SystemTemplate>(INITIAL_TEMPLATES[0])
  const [customSubject, setCustomSubject] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  
  // Test Email state
  const [testEmailTo, setTestEmailTo] = useState('')
  const [testSending, setTestSending] = useState(false)

  // Marketing Broadcast state
  const [bAsunto, setBAsunto] = useState('💈 ¡Promoción Especial de Temporada!')
  const [bMensaje, setBMensaje] = useState('Hola {{nombre}},\n\nQueremos premiar tu preferencia con un 15% de descuento en tu próximo servicio si agendás esta semana.\n\n¡Te esperamos con el mejor ambiente y café de cortesía!')
  const [bLink, setBLink] = useState('https://barber-site-livid.vercel.app/reservar')
  const [bAudiencia, setBAudiencia] = useState<'todos' | 'vip'>('todos')
  const [bCustomEmail, setBCustomEmail] = useState('')
  const [bSending, setBSending] = useState(false)
  const [bResult, setBResult] = useState<any>(null)

  const [saving, setSaving] = useState(false)
  const { success: toastSuccess, error: toastError } = useToast()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const loadCustomTemplates = async () => {
      try {
        const { data } = await supabase
          .from('configuraciones')
          .select('valor')
          .eq('llave', 'email_templates_custom')
          .maybeSingle()

        if (data && data.valor) {
          const overrides = data.valor as Record<string, { customSubject?: string; customMessage?: string }>
          setTemplates(prev => prev.map(t => {
            if (overrides[t.id]) {
              return {
                ...t,
                customSubject: overrides[t.id].customSubject || t.subject,
                customMessage: overrides[t.id].customMessage || ''
              }
            }
            return t
          }))
        }
      } catch (err) {
        console.error(err)
      }
    }
    loadCustomTemplates()
  }, [supabase])

  useEffect(() => {
    setCustomSubject(selectedTemplate.customSubject || selectedTemplate.subject)
    setCustomMessage(selectedTemplate.customMessage || '')
  }, [selectedTemplate])

  const handleSaveTemplate = async () => {
    setSaving(true)
    try {
      const { data: current } = await supabase
        .from('configuraciones')
        .select('valor')
        .eq('llave', 'email_templates_custom')
        .maybeSingle()

      const currentVal = (current?.valor as Record<string, any>) || {}
      const updatedVal = {
        ...currentVal,
        [selectedTemplate.id]: {
          customSubject,
          customMessage
        }
      }

      const { error } = await supabase
        .from('configuraciones')
        .upsert({
          llave: 'email_templates_custom',
          valor: updatedVal,
          descripcion: 'Personalización de asuntos y textos para plantillas de correo Gmail'
        }, { onConflict: 'llave' })

      if (error) throw error

      setTemplates(prev => prev.map(t => t.id === selectedTemplate.id ? { ...t, customSubject, customMessage } : t))
      setSelectedTemplate(prev => ({ ...prev, customSubject, customMessage }))
      toastSuccess('Plantilla de correo guardada correctamente')
    } catch (err: any) {
      toastError(err.message || 'Error al guardar la plantilla')
    } finally {
      setSaving(false)
    }
  }

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testEmailTo || !testEmailTo.includes('@')) {
      return toastError('Ingresa un correo electrónico válido destinatario.')
    }
    setTestSending(true)
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmailTo.trim(), rol: 'Admin Test' })
      })
      const result = await res.json()
      if (result.success) {
        toastSuccess(`¡Correo enviado con éxito a ${testEmailTo}! Revisa la bandeja de entrada.`)
        setTestEmailTo('')
      } else {
        toastError(result.error || 'Error al enviar el correo')
      }
    } catch (err: any) {
      toastError(err.message || 'Error de conexión con el servidor')
    } finally {
      setTestSending(false)
    }
  }

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bAsunto.trim() || !bMensaje.trim()) {
      return toastError('Asunto y mensaje son obligatorios.')
    }
    setBSending(true)
    setBResult(null)
    try {
      const res = await fetch('/api/admin/broadcast-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asunto: bAsunto,
          mensaje: bMensaje,
          link: bLink,
          audiencia: bAudiencia,
          customEmail: bCustomEmail ? bCustomEmail.trim() : undefined
        })
      })
      const result = await res.json()
      if (result.success) {
        setBResult(result)
        toastSuccess(result.message || 'Campaña enviada con éxito')
      } else {
        toastError(result.error || 'Error al enviar campaña masiva')
      }
    } catch (err: any) {
      toastError(err.message || 'Error al conectar con la API de envíos')
    } finally {
      setBSending(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-3 hover:bg-white/5 border border-white/5 bg-zinc-900 rounded-2xl transition-all">
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white uppercase">
              Plantillas & <span className="text-amber-500">Correos Gmail</span>
            </h1>
            <p className="text-zinc-500 font-medium text-sm mt-1">
              Servidor SMTP Gmail, plantillas de notificaciones y envíos masivos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>barbersiteadmin@gmail.com · Conectado</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('plantillas')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'plantillas' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Mail className="w-4 h-4" />
          Editor de Plantillas ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('marketing')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'marketing' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Envíos Masivos / Promociones
        </button>
        <button
          onClick={() => setActiveTab('prueba')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'prueba' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          Prueba SMTP Gmail
        </button>
      </div>

      {/* CONTENIDO PESTAÑA 1: PLANTILLAS */}
      {activeTab === 'plantillas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Lado izquierdo: Lista de plantillas */}
          <div className="lg:col-span-5 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Plantillas del Sistema</h2>
            {templates.map(t => {
              const isSel = selectedTemplate.id === t.id
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSel
                      ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
                      : 'bg-zinc-900 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className={`font-bold text-sm ${isSel ? 'text-amber-400' : 'text-white'}`}>{t.name}</p>
                    <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider bg-zinc-800 text-zinc-400">
                      {t.category}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2">{t.description}</p>
                </div>
              )
            })}
          </div>

          {/* Lado derecho: Editor de la plantilla seleccionada */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="border-b border-zinc-800 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-black text-amber-500">{selectedTemplate.name}</CardTitle>
                    <p className="text-xs text-zinc-400 mt-0.5">{selectedTemplate.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">
                    Asunto del Correo (Subject line)
                  </label>
                  <Input
                    value={customSubject}
                    onChange={e => setCustomSubject(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 font-bold text-white text-sm"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">
                    Etiquetas Dinámicas Disponibles (Variables)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTemplate.variables.map(v => (
                      <span key={v} className="text-[10px] px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-amber-400 font-mono font-bold">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">
                    Mensaje Personalizado o Nota Adicional (Opcional)
                  </label>
                  <textarea
                    rows={4}
                    value={customMessage}
                    onChange={e => setCustomMessage(e.target.value)}
                    placeholder="Escribe un mensaje adicional para personalizar esta plantilla..."
                    className="w-full p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:border-amber-500/50 outline-none"
                  />
                </div>

                {/* Previsualización en Vivo de Correo Gmail */}
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-amber-500" /> Vista Previa en Gmail
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">De: {brand.nombre} &lt;barbersiteadmin@gmail.com&gt;</span>
                  </div>

                  <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-amber-400">Asunto: {customSubject}</p>
                    <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 text-xs space-y-2 text-zinc-300">
                      <p className="font-bold text-white">¡Hola {selectedTemplate.sampleData.nombre || selectedTemplate.sampleData.clienteNombre || 'Cliente'}!</p>
                      <p className="text-zinc-400">Este es un ejemplo en tiempo real de cómo se estructurará el mensaje enviado desde Gmail a tus clientes.</p>
                      {customMessage && (
                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 font-semibold my-2">
                          📌 {customMessage}
                        </div>
                      )}
                      <div className="p-3 bg-zinc-900 rounded-lg font-mono text-[11px] space-y-1 text-zinc-400">
                        {Object.entries(selectedTemplate.sampleData).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="uppercase text-[9px] text-zinc-500">{k}:</span>
                            <span className="text-white font-bold">{v}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 text-center">
                        <span className="inline-block bg-amber-500 text-black font-black text-[10px] uppercase px-4 py-2 rounded-full shadow-md">
                          Ver Detalles en BarberSite →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveTemplate}
                    disabled={saving}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Guardando...' : 'Guardar Personalización'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA 2: MARKETING & BROADCAST */}
      {activeTab === 'marketing' && (
        <Card className="bg-zinc-900 border-zinc-800 max-w-3xl mx-auto">
          <CardHeader className="border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-500">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-black text-white uppercase">Campaña de Envíos Masivos / Promociones</CardTitle>
                <p className="text-xs text-zinc-400 mt-0.5">Envía un anuncio o promoción especial a todos tus clientes por correo Gmail.</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleSendBroadcast} className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">
                  Audiencia Destino
                </label>
                <select
                  value={bAudiencia}
                  onChange={e => setBAudiencia(e.target.value as any)}
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-bold text-white focus:border-amber-500 outline-none"
                >
                  <option value="todos">👥 Todos los Clientes Registrados</option>
                  <option value="vip">👑 Clientes VIP (Nivel ORO y PLATA)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">
                  Prueba Individual (Opcional - solo enviar a este email)
                </label>
                <Input
                  placeholder="ejemplo@gmail.com (dejar en blanco para enviar a toda la audiencia)"
                  value={bCustomEmail}
                  onChange={e => setBCustomEmail(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">
                  Asunto del Correo
                </label>
                <Input
                  value={bAsunto}
                  onChange={e => setBAsunto(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 font-bold text-white text-sm"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">
                  Mensaje de la Promoción
                </label>
                <textarea
                  rows={5}
                  value={bMensaje}
                  onChange={e => setBMensaje(e.target.value)}
                  className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:border-amber-500/50 outline-none leading-relaxed"
                />
                <p className="text-[10px] text-zinc-500 mt-1 font-mono">Puedes incluir {"{{nombre}}"} para dirigirte al cliente por su nombre de pila.</p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">
                  Enlace del Botón de Acción (URL)
                </label>
                <Input
                  value={bLink}
                  onChange={e => setBLink(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 font-mono text-xs text-amber-400"
                />
              </div>

              {bResult && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Campaña Ejecutada
                  </p>
                  <p>Correos enviados exitosamente: <strong>{bResult.enviados}</strong> de {bResult.total}</p>
                </div>
              )}

              <div className="flex justify-end pt-3">
                <Button
                  type="submit"
                  disabled={bSending}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider px-6 py-3"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {bSending ? 'Enviando campaña...' : '🚀 Enviar Promoción por Gmail'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* CONTENIDO PESTAÑA 3: PRUEBA SMTP */}
      {activeTab === 'prueba' && (
        <Card className="bg-zinc-900 border-zinc-800 max-w-xl mx-auto">
          <CardHeader className="border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-black text-white uppercase">Prueba de Conexión SMTP Gmail</CardTitle>
                <p className="text-xs text-zinc-400 mt-0.5">Envía un correo de prueba en tiempo real para verificar la entrega.</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-5">
            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">
                  Correo Electrónico Destino
                </label>
                <Input
                  type="email"
                  placeholder="tu.correo@gmail.com"
                  value={testEmailTo}
                  onChange={e => setTestEmailTo(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 font-bold text-white text-sm"
                />
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-400 space-y-1">
                <p className="font-bold text-zinc-300">Servidor configurado:</p>
                <p className="font-mono text-[11px] text-amber-400">SMTP: smtp.gmail.com (Puerto 587)</p>
                <p className="font-mono text-[11px] text-amber-400">Cuenta: barbersiteadmin@gmail.com</p>
              </div>

              <Button
                type="submit"
                disabled={testSending}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider py-3"
              >
                <Send className="w-4 h-4 mr-2" />
                {testSending ? 'Enviando...' : 'Enviar Correo de Prueba Ahora'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
