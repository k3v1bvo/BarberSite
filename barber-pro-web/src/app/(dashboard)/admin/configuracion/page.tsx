'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { QrCode, Save, ArrowLeft, Image as ImageIcon, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { isValidImageUrl } from '@/lib/validators'
import { ImageUpload } from '@/components/ui/ImageUpload'

const defaultAboutUs = {
  imagen_url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800",
  titulo: "La Mejor Barbería\nde la Ciudad",
  texto: "En BarberSite, combinamos técnicas tradicionales con las últimas tendencias para ofrecerte una experiencia única. Nuestro compromiso es con la excelencia en cada detalle, desde el momento en que entras hasta que sales luciendo tu mejor versión.",
  anios_experiencia: "10+",
  metricas: [
    { numero: '5000+', texto: 'Clientes Satisfechos' },
    { numero: '15+', texto: 'Barberos Expertos' },
    { numero: '4.9', texto: 'Rating Promedio' },
    { numero: '100%', texto: 'Garantía' }
  ]
}

const defaultHero = {
  url: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1920",
  titulo: "ESTILO CLÁSICO\nMODERNO",
  subtitulo: "Donde la tradición barbera se encuentra con la innovación.\nExperimenta el arte del cuidado masculino en su máxima expresión."
}

export default function AdminConfiguracionPage() {
  const [qrUrl, setQrUrl] = useState('')
  const [initialQrUrl, setInitialQrUrl] = useState('')
  const [heroConfig, setHeroConfig] = useState(defaultHero)
  const [initialHeroConfig, setInitialHeroConfig] = useState(defaultHero)
  const [aboutUsConfig, setAboutUsConfig] = useState(defaultAboutUs)
  const [initialAboutUsConfig, setInitialAboutUsConfig] = useState(defaultAboutUs)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { error: toastError, success: toastSuccess, toast: toastInfo } = useToast()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('configuraciones')
          .select('llave, valor')
          .in('llave', ['qr_pago', 'hero_bg_image', 'about_us_config'])

        if (data) {
          const qrConfig = data.find(c => c.llave === 'qr_pago')
          const heroConfigData = data.find(c => c.llave === 'hero_bg_image')
          const aboutConfig = data.find(c => c.llave === 'about_us_config')

          if (qrConfig && qrConfig.valor?.url) {
            setQrUrl(qrConfig.valor.url)
            setInitialQrUrl(qrConfig.valor.url)
          }
          if (heroConfigData && heroConfigData.valor) {
            const mergedHeroConfig = { ...defaultHero, ...(heroConfigData.valor as any) }
            setHeroConfig(mergedHeroConfig)
            setInitialHeroConfig(mergedHeroConfig)
          }
          if (aboutConfig && aboutConfig.valor) {
            setAboutUsConfig(aboutConfig.valor as typeof defaultAboutUs)
            setInitialAboutUsConfig(aboutConfig.valor as typeof defaultAboutUs)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [supabase])

  const handleSaveQr = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedUrl = qrUrl.trim()
    if (!trimmedUrl) {
      return toastError('El enlace no puede estar vacío.')
    }
    if (trimmedUrl === initialQrUrl) {
      return toastInfo('No se han hecho cambios, la URL es la misma.')
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('configuraciones')
        .upsert({
          llave: 'qr_pago',
          valor: { url: qrUrl.trim() },
          descripcion: 'URL de la imagen del QR para pagos'
        }, { onConflict: 'llave' })

      if (error) throw error
      setInitialQrUrl(trimmedUrl)
      toastSuccess('Código QR actualizado correctamente')
    } catch (err: any) {
      toastError(err.message || 'Error al guardar la configuración del QR')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveHero = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!heroConfig.url) {
      return toastError('La imagen del fondo es requerida.')
    }
    if (!heroConfig.titulo.trim() || !heroConfig.subtitulo.trim()) {
      return toastError('El título y el subtítulo no pueden estar vacíos.')
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('configuraciones')
        .upsert({
          llave: 'hero_bg_image',
          valor: heroConfig as any,
          descripcion: 'Configuración de la sección Hero'
        }, { onConflict: 'llave' })

      if (error) throw error
      setInitialHeroConfig(heroConfig)
      toastSuccess('Hero actualizado correctamente')
    } catch (err: any) {
      toastError(err.message || 'Error al guardar el hero')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAboutUs = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!aboutUsConfig.imagen_url) {
      return toastError('La imagen de Acerca de Nosotros es requerida.')
    }
    if (!aboutUsConfig.titulo.trim() || !aboutUsConfig.texto.trim()) {
      return toastError('El título y el texto no pueden estar vacíos.')
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('configuraciones')
        .upsert({
          llave: 'about_us_config',
          valor: aboutUsConfig as any,
          descripcion: 'Configuración de la sección Acerca de Nosotros'
        }, { onConflict: 'llave' })

      if (error) throw error
      setInitialAboutUsConfig(aboutUsConfig)
      toastSuccess('Sección "Acerca de Nosotros" actualizada correctamente')
    } catch (err: any) {
      toastError(err.message || 'Error al guardar la sección')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex items-center gap-6 border-b border-white/5 pb-8">
        <button onClick={() => router.back()} className="p-4 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl transition-all btn-press group">
          <ArrowLeft className="w-5 h-5 text-zinc-500 group-hover:text-amber-500" />
        </button>
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">
            Ajustes <span className="text-amber-500">Globales</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-2 text-lg">Configuraciones del sistema</p>
        </div>
      </div>

      <Card className="bg-zinc-900 border-white/5">
        <CardHeader className="border-b border-white/5 bg-zinc-900/50 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase text-white">Fondo del Inicio (Hero)</CardTitle>
              <p className="text-sm text-zinc-400">Imagen principal de la pantalla de inicio ("Estilo Clásico Moderno").</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSaveHero} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6 md:col-span-2">
                <ImageUpload
                  label="Imagen de Fondo (Recomendado 1920x1080px)"
                  defaultImage={heroConfig.url || undefined}
                  onUploadSuccess={(url) => setHeroConfig({ ...heroConfig, url })}
                  onUploadError={(err) => toastError(err)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Título principal</label>
                <textarea
                  className="w-full mt-1 p-4 border border-white/10 bg-zinc-950 rounded-2xl text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                  rows={2}
                  value={heroConfig.titulo}
                  onChange={(e) => setHeroConfig({ ...heroConfig, titulo: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Subtítulo</label>
                <textarea
                  className="w-full mt-1 p-4 border border-white/10 bg-zinc-950 rounded-2xl text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                  rows={3}
                  value={heroConfig.subtitulo}
                  onChange={(e) => setHeroConfig({ ...heroConfig, subtitulo: e.target.value })}
                />
              </div>

              {heroConfig.url ? (
                <div className="md:col-span-2 mt-4 p-4 border border-white/5 rounded-2xl bg-zinc-950 flex flex-col items-center justify-center gap-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Vista Previa en Vivo</p>
                  <div className="relative w-full max-w-3xl aspect-video rounded-xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center">
                    <div 
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url('${heroConfig.url}')` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black" />
                    </div>
                    <div className="relative z-10 text-center px-4 max-w-xl">
                      <h1 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight whitespace-pre-line text-white">
                        {heroConfig.titulo || 'TÍTULO VACÍO'}
                      </h1>
                      <p className="text-sm md:text-base text-gray-300 whitespace-pre-line">
                        {heroConfig.subtitulo || 'Subtítulo vacío...'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full h-14 shadow-lg font-black uppercase tracking-widest"
              disabled={saving}
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? 'Guardando...' : 'Guardar Hero'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-white/5">
        <CardHeader className="border-b border-white/5 bg-zinc-900/50 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase text-white">Código QR de Pagos</CardTitle>
              <p className="text-sm text-zinc-400">URL de la imagen del QR de tu cuenta bancaria o billetera móvil.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSaveQr} className="space-y-6">
            <div>
              <ImageUpload
                label="Imagen del QR de Pagos (Recomendado 500x500px)"
                defaultImage={qrUrl || undefined}
                onUploadSuccess={(url) => setQrUrl(url)}
                onUploadError={(err) => toastError(err)}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full h-14 shadow-lg font-black uppercase tracking-widest"
              disabled={saving}
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? 'Guardando...' : 'Guardar QR'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-white/5">
        <CardHeader className="border-b border-white/5 bg-zinc-900/50 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase text-white">Acerca de Nosotros</CardTitle>
              <p className="text-sm text-zinc-400">Personaliza la sección de información y métricas de la barbería.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSaveAboutUs} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6 md:col-span-2">
                <ImageUpload
                  label="Imagen Acerca de Nosotros (Recomendado 800x1000px)"
                  defaultImage={aboutUsConfig.imagen_url || undefined}
                  onUploadSuccess={(url) => setAboutUsConfig({ ...aboutUsConfig, imagen_url: url })}
                  onUploadError={(err) => toastError(err)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Título principal</label>
                <textarea
                  className="w-full mt-1 p-4 border border-white/10 bg-zinc-950 rounded-2xl text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                  rows={2}
                  value={aboutUsConfig.titulo}
                  onChange={(e) => setAboutUsConfig({ ...aboutUsConfig, titulo: e.target.value })}
                />
              </div>

              <div>
                <Input
                  label="Años de experiencia (Badge)"
                  placeholder="10+"
                  value={aboutUsConfig.anios_experiencia}
                  onChange={(e) => setAboutUsConfig({ ...aboutUsConfig, anios_experiencia: e.target.value })}
                  className="bg-zinc-950"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Texto descriptivo</label>
                <textarea
                  className="w-full mt-1 p-4 border border-white/10 bg-zinc-950 rounded-2xl text-sm font-bold text-white focus:border-amber-500/50 outline-none transition-all"
                  rows={4}
                  value={aboutUsConfig.texto}
                  onChange={(e) => setAboutUsConfig({ ...aboutUsConfig, texto: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <h3 className="text-sm font-black uppercase tracking-widest text-amber-500 mb-4">Métricas destacadas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {aboutUsConfig.metricas.map((metrica, idx) => (
                  <div key={idx} className="p-4 bg-zinc-950 rounded-2xl border border-white/5 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Métrica {idx + 1}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Número/Valor"
                        placeholder="5000+"
                        value={metrica.numero}
                        onChange={(e) => {
                          const newMetricas = [...aboutUsConfig.metricas];
                          newMetricas[idx].numero = e.target.value;
                          setAboutUsConfig({ ...aboutUsConfig, metricas: newMetricas })
                        }}
                        className="bg-zinc-900"
                      />
                      <Input
                        label="Texto descriptivo"
                        placeholder="Clientes Satisfechos"
                        value={metrica.texto}
                        onChange={(e) => {
                          const newMetricas = [...aboutUsConfig.metricas];
                          newMetricas[idx].texto = e.target.value;
                          setAboutUsConfig({ ...aboutUsConfig, metricas: newMetricas })
                        }}
                        className="bg-zinc-900"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full h-14 shadow-lg font-black uppercase tracking-widest mt-6"
              disabled={saving}
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? 'Guardando...' : 'Guardar Acerca de Nosotros'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
