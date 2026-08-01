'use client'

import { useEffect, useState, useRef } from 'react'
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
  ArrowLeft,
  Copy,
  Info,
  Layers,
  HelpCircle,
  Tag
} from 'lucide-react'
import { useBrand } from '@/components/providers/BrandProvider'
import { replaceTemplateVariables } from '@/lib/notifications/templates'

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

interface VariableChip {
  tag: string
  label: string
  description: string
  example: string
}

const AVAILABLE_VARIABLES: VariableChip[] = [
  { tag: '{{nombre}}', label: 'Nombre del Cliente', description: 'Nombre completo o de pila del cliente destinatario.', example: 'Carlos Gutiérrez' },
  { tag: '{{servicio}}', label: 'Nombre del Servicio', description: 'Servicio agendado o comprado.', example: 'Corte Ejecutivo + Barba' },
  { tag: '{{fecha}}', label: 'Fecha', description: 'Fecha programada del servicio o evento.', example: '05 de Agosto, 2026' },
  { tag: '{{hora}}', label: 'Hora', description: 'Hora agendada de la cita.', example: '15:00' },
  { tag: '{{barbero}}', label: 'Nombre del Barbero', description: 'Barbero asignado para la cita.', example: 'Mateo Barreto' },
  { tag: '{{monto}}', label: 'Monto / Precio (Bs)', description: 'Precio total o costo del servicio en Bolivianos.', example: 'Bs. 50,00' },
  { tag: '{{codigo}}', label: 'Código de Cita / Pedido', description: 'Identificador único de la reserva o pedido.', example: '#d2ede6' },
  { tag: '{{barberia}}', label: 'Nombre de la Barbería', description: 'Nombre comercial oficial de la empresa.', example: 'BarberSite' },
  { tag: '{{link}}', label: 'Enlace a la Web', description: 'URL directa a la reservación o inicio de sesión.', example: 'https://barber-site-livid.vercel.app/reservar' },
]

const INITIAL_TEMPLATES: SystemTemplate[] = [
  {
    id: 'reserva_confirmacion_cliente',
    name: '✂️ Confirmación de Cita / Reserva',
    category: 'operacion',
    subject: '✂️ Tu cita en {{barberia}} está confirmada para el {{fecha}}',
    description: 'Enviado automáticamente cuando un cliente agenda una cita en línea o desde la caja.',
    variables: ['{{nombre}}', '{{servicio}}', '{{fecha}}', '{{hora}}', '{{barbero}}', '{{barberia}}'],
    sampleData: {
      nombre: 'Carlos Gutiérrez',
      servicio: 'Corte Ejecutivo + Barba',
      fecha: '2026-08-05',
      hora: '15:00',
      barbero: 'Mateo Barreto',
      barberia: 'BarberSite'
    }
  },
  {
    id: 'registro_bienvenida_nuevo',
    name: '🎉 Bienvenida a Cliente Nuevo',
    category: 'auth',
    subject: '🎉 ¡Bienvenido {{nombre}} a {{barberia}}!',
    description: 'Enviado cuando un cliente crea una cuenta por primera vez en el sitio web.',
    variables: ['{{nombre}}', '{{barberia}}', '{{link}}'],
    sampleData: {
      nombre: 'Jorge Mendoza',
      barberia: 'BarberSite',
      link: 'https://barber-site-livid.vercel.app/reservar'
    }
  },
  {
    id: 'recordatorio_cita',
    name: '⏰ Recordatorio de Cita (2 Horas Antes)',
    category: 'operacion',
    subject: '⏰ Recordatorio: {{nombre}}, tu cita es hoy a las {{hora}}',
    description: 'Enviado automáticamente unas horas antes de la cita para evitar inasistencias.',
    variables: ['{{nombre}}', '{{servicio}}', '{{fecha}}', '{{hora}}', '{{barbero}}', '{{barberia}}'],
    sampleData: {
      nombre: 'Andrés Morales',
      servicio: 'Perfilado de Barba',
      fecha: 'Hoy',
      hora: '18:30',
      barbero: 'Nicolás Quispe',
      barberia: 'BarberSite'
    }
  },
  {
    id: 'reserva_cancelada',
    name: '❌ Notificación de Cita Cancelada',
    category: 'operacion',
    subject: '❌ {{nombre}}, tu cita en {{barberia}} ha sido cancelada',
    description: 'Enviado cuando una cita es anulada por el barbero, cliente o administración.',
    variables: ['{{nombre}}', '{{servicio}}', '{{fecha}}', '{{hora}}', '{{barberia}}'],
    sampleData: {
      nombre: 'Gabriel Suárez',
      servicio: 'Corte Clásico',
      fecha: '2026-08-02',
      hora: '11:00',
      barberia: 'BarberSite'
    }
  },
  {
    id: 'invitacion_referido',
    name: '🎁 Invitación por Programa de Referidos',
    category: 'marketing',
    subject: '🎁 ¡{{nombre}}, un amigo te regaló un beneficio en {{barberia}}!',
    description: 'Enviado cuando un cliente existente invita a un amigo compartiendo su código.',
    variables: ['{{nombre}}', '{{barberia}}', '{{link}}'],
    sampleData: {
      nombre: 'Fernando Paz',
      barberia: 'BarberSite',
      link: 'https://barber-site-livid.vercel.app/login'
    }
  },
  {
    id: 'cumpleanos_registro',
    name: '🎂 Confirmación de Fecha de Cumpleaños Registrada',
    category: 'marketing',
    subject: '🎂 ¡Fecha de Cumpleaños Registrada en {{barberia}}!',
    description: 'Enviado al guardar o confirmar la fecha de cumpleaños del cliente.',
    variables: ['{{nombre}}', '{{fecha}}', '{{barberia}}', '{{link}}'],
    sampleData: {
      nombre: 'Ricardo Silva',
      fecha: '12 de Agosto',
      barberia: 'BarberSite',
      link: 'https://barber-site-livid.vercel.app/reservar'
    }
  },
  {
    id: 'cumpleanos_semana_antes',
    name: '🎂 Notificación 1 Semana Antes de Cumpleaños',
    category: 'marketing',
    subject: '🎂 ¡Se acerca tu Cumpleaños {{nombre}}! Tu regalo en {{barberia}} te espera',
    description: 'Enviado automáticamente 7 días antes del cumpleaños del cliente para ofrecer su beneficio exclusivo.',
    variables: ['{{nombre}}', '{{fecha}}', '{{barberia}}', '{{link}}'],
    sampleData: {
      nombre: 'Ricardo Silva',
      fecha: '12 de Agosto',
      barberia: 'BarberSite',
      link: 'https://barber-site-livid.vercel.app/reservar'
    }
  },
  {
    id: 'invitacion_2x1',
    name: '👥 Beneficio Martes 2x1 (Parejas)',
    category: 'marketing',
    subject: '✂️ ¡Pagan 1 y entran 2 los Martes en {{barberia}}!',
    description: 'Enviado al acompañante registrado durante las reservas de la promoción Martes 2x1.',
    variables: ['{{nombre}}', '{{fecha}}', '{{barberia}}'],
    sampleData: {
      nombre: 'Lucas Roca',
      fecha: 'Martes 04/08/2026',
      barberia: 'BarberSite'
    }
  },
  {
    id: 'solicitar_recuperacion',
    name: '🔐 Restablecer Contraseña (OTP / Enlace)',
    category: 'auth',
    subject: '🔐 Código para restablecer tu contraseña en {{barberia}}',
    description: 'Enviado al solicitar recuperar contraseña o código de acceso seguro.',
    variables: ['{{nombre}}', '{{codigo}}', '{{barberia}}'],
    sampleData: {
      nombre: 'Daniel Flores',
      codigo: '784920',
      barberia: 'BarberSite'
    }
  },
  {
    id: 'promocion_masiva',
    name: '📣 Correo Promocional / Anuncio Especial',
    category: 'marketing',
    subject: '📣 {{nombre}}, ¡Novedades y Descuentos Especiales en {{barberia}}!',
    description: 'Plantilla base para envíos de marketing masivo y promociones a clientes.',
    variables: ['{{nombre}}', '{{servicio}}', '{{barberia}}', '{{link}}'],
    sampleData: {
      nombre: 'Estimado Cliente',
      servicio: 'Corte + Barba',
      barberia: 'BarberSite',
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
  
  // Focused Field tracking for quick variable injection
  const [activeField, setActiveField] = useState<'subject' | 'message' | 'bSubject' | 'bMessage'>('message')
  const subjectInputRef = useRef<HTMLInputElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const bSubjectRef = useRef<HTMLInputElement>(null)
  const bMessageRef = useRef<HTMLTextAreaElement>(null)

  // Test Email state
  const [testEmailTo, setTestEmailTo] = useState('')
  const [testSending, setTestSending] = useState(false)

  // Marketing Broadcast state
  const [bAsunto, setBAsunto] = useState('💈 ¡Hola {{nombre}}, tenemos una Promoción Especial en {{barberia}}!')
  const [bMensaje, setBMensaje] = useState('¡Hola {{nombre}}!\n\nQueremos premiar tu preferencia en {{barberia}} con un 15% de descuento en tu próximo servicio de {{servicio}} si agendás esta semana.\n\n¡Te esperamos con el mejor ambiente y café de cortesía!')
  const [bLink, setBLink] = useState('https://barber-site-livid.vercel.app/reservar')
  const [bAudiencia, setBAudiencia] = useState<'todos' | 'vip'>('todos')
  const [bCustomEmail, setBCustomEmail] = useState('')
  const [bSending, setBSending] = useState(false)
  const [bResult, setBResult] = useState<any>(null)

  const [saving, setSaving] = useState(false)
  const { success: toastSuccess, error: toastError, toast: toastInfo } = useToast()
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

  // Insert tag into currently active field
  const handleInsertTag = (tag: string) => {
    if (activeTab === 'plantillas') {
      if (activeField === 'subject') {
        setCustomSubject(prev => `${prev} ${tag}`)
      } else {
        setCustomMessage(prev => `${prev} ${tag}`)
      }
    } else if (activeTab === 'marketing') {
      if (activeField === 'bSubject') {
        setBAsunto(prev => `${prev} ${tag}`)
      } else {
        setBMensaje(prev => `${prev} ${tag}`)
      }
    }
    toastInfo(`Etiqueta ${tag} insertada`)
  }

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
        toastSuccess(`¡Correo de prueba enviado a ${testEmailTo}!`)
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

  // Previsualización Parseada con Datos de Muestra
  const getParsedSubjectPreview = (rawSubject: string, sampleData: Record<string, string>) => {
    return replaceTemplateVariables(rawSubject, { ...sampleData, barberia: brand.nombre || 'BarberSite' })
  }

  const getParsedMessagePreview = (rawMessage: string, sampleData: Record<string, string>) => {
    return replaceTemplateVariables(rawMessage, { ...sampleData, barberia: brand.nombre || 'BarberSite' })
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-3 hover:bg-white/5 border border-white/10 bg-zinc-900 rounded-2xl transition-all active:scale-95">
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white uppercase">
              Plantillas & <span className="text-amber-500">Correos Gmail</span>
            </h1>
            <p className="text-zinc-500 font-medium text-xs sm:text-sm mt-1">
              Personaliza mensajes, notificaciones automáticas y campañas de marketing por correo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-2xl text-xs font-bold text-emerald-400 shadow-lg shadow-emerald-500/5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>barbersiteadmin@gmail.com · Servidor SMTP Activo</span>
        </div>
      </div>

      {/* Selector de Pestañas Principales */}
      <div className="flex gap-2 border-b border-white/10 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('plantillas')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 rounded-t-xl ${
            activeTab === 'plantillas' ? 'text-amber-500 border-b-2 border-amber-500 bg-amber-500/5' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Mail className="w-4 h-4" />
          Editor de Plantillas Notificación ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('marketing')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 rounded-t-xl ${
            activeTab === 'marketing' ? 'text-amber-500 border-b-2 border-amber-500 bg-amber-500/5' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Envíos Masivos / Promociones
        </button>
        <button
          onClick={() => setActiveTab('prueba')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 rounded-t-xl ${
            activeTab === 'prueba' ? 'text-amber-500 border-b-2 border-amber-500 bg-amber-500/5' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          Prueba SMTP Gmail
        </button>
      </div>

      {/* --- BANNER INTERACTIVO DE ETIQUETAS DINÁMICAS (VARIABLES DISPONIBLES) --- */}
      <Card className="bg-zinc-950 border-amber-500/20 shadow-xl overflow-hidden">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                Etiquetas Dinámicas (Haz clic en una etiqueta para insertarla en el mensaje)
              </h3>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium hidden md:inline">
              Se reemplazarán automáticamente por los datos reales del cliente en cada correo
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {AVAILABLE_VARIABLES.map(v => (
              <button
                key={v.tag}
                type="button"
                onClick={() => handleInsertTag(v.tag)}
                title={`${v.label}: ej. "${v.example}" — ${v.description}`}
                className="group relative flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/40 rounded-xl text-xs font-mono font-bold text-amber-400 transition-all active:scale-95"
              >
                <span>{v.tag}</span>
                <span className="text-[10px] text-zinc-400 font-sans font-medium group-hover:text-amber-200">({v.label})</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

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
                      ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30 shadow-lg shadow-amber-500/5'
                      : 'bg-zinc-900 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className={`font-bold text-sm ${isSel ? 'text-amber-400' : 'text-white'}`}>{t.name}</p>
                    <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider bg-zinc-800 text-zinc-400 shrink-0">
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
                    ref={subjectInputRef}
                    onFocus={() => setActiveField('subject')}
                    value={customSubject}
                    onChange={e => setCustomSubject(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 font-bold text-white text-sm focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">
                    Mensaje Personalizado / Cuerpo del Correo
                  </label>
                  <textarea
                    ref={messageInputRef}
                    onFocus={() => setActiveField('message')}
                    rows={4}
                    value={customMessage}
                    onChange={e => setCustomMessage(e.target.value)}
                    placeholder="Escribe el mensaje o nota que deseas enviar al cliente. Puedes usar etiquetas como {{nombre}}, {{servicio}}, {{fecha}}, etc..."
                    className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:border-amber-500/50 outline-none leading-relaxed"
                  />
                </div>

                {/* Previsualización en Vivo de Correo Gmail */}
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-amber-500" /> Vista Previa en Vivo (Recibido en Gmail)
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">De: {brand.nombre || 'BarberSite'} &lt;barbersiteadmin@gmail.com&gt;</span>
                  </div>

                  <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-amber-400">
                      Asunto: {getParsedSubjectPreview(customSubject, selectedTemplate.sampleData)}
                    </p>
                    <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 text-xs space-y-3 text-zinc-300">
                      <p className="font-bold text-white text-sm">
                        ¡Hola {selectedTemplate.sampleData.nombre || 'Cliente'}!
                      </p>
                      
                      {customMessage ? (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs whitespace-pre-line leading-relaxed">
                          {getParsedMessagePreview(customMessage, selectedTemplate.sampleData)}
                        </div>
                      ) : (
                        <p className="text-zinc-400 text-xs">
                          (Este correo incluirá los detalles automáticos del servicio y enlaces de acción)
                        </p>
                      )}

                      <div className="p-3 bg-zinc-900 rounded-lg font-mono text-[11px] space-y-1 text-zinc-400 border border-white/5">
                        {Object.entries(selectedTemplate.sampleData).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="uppercase text-[9px] text-zinc-500">{k}:</span>
                            <span className="text-white font-bold">{v}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 text-center">
                        <span className="inline-block bg-amber-500 text-black font-black text-[10px] uppercase px-5 py-2.5 rounded-full shadow-lg shadow-amber-500/20">
                          Ver Detalles en {brand.nombre || 'BarberSite'} →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveTemplate}
                    disabled={saving}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider px-6 py-3 rounded-xl shadow-lg shadow-amber-500/20"
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
                <p className="text-xs text-zinc-400 mt-0.5">Redacta y envía un anuncio promocional directo a la bandeja de entrada de tus clientes.</p>
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
                  Prueba Individual (Opcional - enviar solo a este correo)
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
                  ref={bSubjectRef}
                  onFocus={() => setActiveField('bSubject')}
                  value={bAsunto}
                  onChange={e => setBAsunto(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 font-bold text-white text-sm focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">
                  Mensaje de la Promoción
                </label>
                <textarea
                  ref={bMessageRef}
                  onFocus={() => setActiveField('bMessage')}
                  rows={6}
                  value={bMensaje}
                  onChange={e => setBMensaje(e.target.value)}
                  className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:border-amber-500/50 outline-none leading-relaxed"
                />
                <p className="text-[10px] text-amber-400/90 mt-1.5 font-mono flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-500 shrink-0" />
                  Puedes hacer clic en cualquier etiqueta arriba (ej: {"{{nombre}}"}, {"{{barberia}}"}) e insertarla en el mensaje.
                </p>
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

              {/* Previsualización en Vivo de la Campaña */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-amber-500" /> Vista Previa con Datos Reales
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">De: {brand.nombre || 'BarberSite'} &lt;barbersiteadmin@gmail.com&gt;</span>
                </div>

                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-amber-400">
                    Asunto: {getParsedSubjectPreview(bAsunto, { nombre: 'Carlos Gutiérrez', servicio: 'Corte + Barba' })}
                  </p>
                  <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 text-xs text-zinc-200 whitespace-pre-line leading-relaxed">
                    {getParsedMessagePreview(bMensaje, { nombre: 'Carlos Gutiérrez', servicio: 'Corte + Barba' })}
                  </div>
                  <div className="pt-2 text-center">
                    <span className="inline-block bg-amber-500 text-black font-black text-[10px] uppercase px-5 py-2.5 rounded-full shadow-lg shadow-amber-500/20">
                      Ver Promoción / Agendar Cita →
                    </span>
                  </div>
                </div>
              </div>

              {bResult && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Campaña Ejecutada Con Éxito
                  </p>
                  <p>Correos entregados: <strong>{bResult.enviados}</strong> de {bResult.total}</p>
                </div>
              )}

              <div className="flex justify-end pt-3">
                <Button
                  type="submit"
                  disabled={bSending}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider px-6 py-3 rounded-xl shadow-lg shadow-amber-500/20"
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
                <p className="text-xs text-zinc-400 mt-0.5">Envía un correo de prueba instantáneo para verificar la llegada a la bandeja de entrada.</p>
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

              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-400 space-y-1.5">
                <p className="font-bold text-zinc-300">Detalles de conexión Gmail SMTP:</p>
                <p className="font-mono text-[11px] text-amber-400">Servidor: smtp.gmail.com (Puerto 587)</p>
                <p className="font-mono text-[11px] text-amber-400">Remitente: barbersiteadmin@gmail.com</p>
              </div>

              <Button
                type="submit"
                disabled={testSending}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider py-3 rounded-xl shadow-lg shadow-amber-500/20"
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
