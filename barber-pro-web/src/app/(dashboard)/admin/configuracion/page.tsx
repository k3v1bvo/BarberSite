'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { QrCode, Save, ArrowLeft, Image as ImageIcon, Info, Sparkles, Tag, Gift, ToggleLeft, ToggleRight, Megaphone, X, Eye, EyeOff, Clock, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { isValidImageUrl } from '@/lib/validators'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { useBrand, defaultBrandConfig } from '@/components/providers/BrandProvider'

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
  const { brand, updateBrand } = useBrand()
  const [brandConfig, setBrandConfig] = useState(defaultBrandConfig)
  const [initialBrandConfig, setInitialBrandConfig] = useState(defaultBrandConfig)
  const [qrUrl, setQrUrl] = useState('')
  const [initialQrUrl, setInitialQrUrl] = useState('')
  const [heroConfig, setHeroConfig] = useState(defaultHero)
  const [initialHeroConfig, setInitialHeroConfig] = useState(defaultHero)
  const [aboutUsConfig, setAboutUsConfig] = useState(defaultAboutUs)
  const [initialAboutUsConfig, setInitialAboutUsConfig] = useState(defaultAboutUs)
  const [montoBonoReferido, setMontoBonoReferido] = useState('10')
  const [bannerPromo, setBannerPromo] = useState({
    imagen_url: '',
    titulo: '',
    descripcion: '',
    activo: false,
    link_url: '',
    fecha_fin: '',
    promocion_id: '',
  })
  const [promocionesList, setPromocionesList] = useState<any[]>([])
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
          .in('llave', ['qr_pago', 'hero_bg_image', 'about_us_config', 'brand_config', 'monto_bono_referido', 'banner_promo_cliente'])

        if (data) {
          const brandData = data.find(c => c.llave === 'brand_config')
          const qrConfig = data.find(c => c.llave === 'qr_pago')
          const heroConfigData = data.find(c => c.llave === 'hero_bg_image')
          const aboutConfig = data.find(c => c.llave === 'about_us_config')
          const refConfig = data.find(c => c.llave === 'monto_bono_referido')

          if (refConfig && refConfig.valor) {
            const val = typeof refConfig.valor === 'object' ? (refConfig.valor as any).monto : refConfig.valor
            if (val !== undefined && val !== null) setMontoBonoReferido(String(val))
          }

          if (brandData && brandData.valor) {
            const mergedBrand = { ...defaultBrandConfig, ...(brandData.valor as any) }
            setBrandConfig(mergedBrand)
            setInitialBrandConfig(mergedBrand)
          }
          if (qrConfig && qrConfig.valor?.url) {
            setQrUrl(qrConfig.valor.url)
            setInitialQrUrl(qrConfig.valor.url)
          }
          if (heroConfigData && heroConfigData.valor) {
            const mergedHeroConfig = { ...defaultHero, ...(heroConfigData.valor as any) }
            setHeroConfig(mergedHeroConfig)
            setInitialHeroConfig(mergedHeroConfig)
          }
          const bannerData = data.find(c => c.llave === 'banner_promo_cliente')
          if (bannerData && bannerData.valor) {
            setBannerPromo({
              imagen_url: '',
              titulo: '',
              descripcion: '',
              activo: false,
              link_url: '',
              fecha_fin: '',
              promocion_id: '',
              ...(bannerData.valor as any)
            })
          }

          // Cargar lista de promociones para vincular
          try {
            const { data: promosData } = await supabase
              .from('promociones')
              .select('id, nombre, descripcion, fecha_inicio, fecha_fin, activa, icono')
              .eq('activa', true)
              .order('created_at', { ascending: false })
            if (promosData) setPromocionesList(promosData)
          } catch (pErr) {
            console.error('Error cargando promociones:', pErr)
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

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!brandConfig.nombre.trim()) {
      return toastError('El nombre comercial no puede estar vacío.')
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('configuraciones')
        .upsert({
          llave: 'brand_config',
          valor: brandConfig as any,
          descripcion: 'Identidad de marca: logo PNG y nombre comercial'
        }, { onConflict: 'llave' })

      if (error) throw error
      setInitialBrandConfig(brandConfig)
      updateBrand(brandConfig)
      toastSuccess('Identidad de marca actualizada correctamente')
    } catch (err: any) {
      toastError(err.message || 'Error al guardar la identidad de marca')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveQr = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedUrl = qrUrl.trim()
    if (!trimmedUrl) {
      return toastError('Por favor selecciona o sube una imagen para el QR.')
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('configuraciones')
        .upsert({
          llave: 'qr_pago',
          valor: { url: trimmedUrl },
          descripcion: 'URL de la imagen del QR para pagos'
        }, { onConflict: 'llave' })

      if (error) throw error
      setInitialQrUrl(trimmedUrl)
      toastSuccess('Código QR Oficial guardado correctamente')
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

  const handleSaveReferido = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(montoBonoReferido)
    if (isNaN(val) || val < 0) {
      return toastError('Ingresa un monto de bono válido mayor o igual a 0.')
    }

    setSaving(true)
    try {
      const res = await fetch('/api/referidos/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: val })
      })

      if (!res.ok) {
        // Fallback directo a Supabase
        const { error } = await supabase
          .from('configuraciones')
          .upsert({
            llave: 'monto_bono_referido',
            valor: { monto: val },
            descripcion: 'Monto de bono por referido en Bolivianos (Bs.)'
          }, { onConflict: 'llave' })

        if (error) throw error
      }

      toastSuccess(`Monto de bono por referido actualizado a Bs. ${val} correctamente ✅`)
    } catch (err: any) {
      toastError(err.message || 'Error al guardar configuración de referidos')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (bannerPromo.activo && !bannerPromo.imagen_url) {
      return toastError('Para activar el banner debes subir una imagen.')
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('configuraciones')
        .upsert({
          llave: 'banner_promo_cliente',
          valor: bannerPromo as any,
          descripcion: 'Banner promocional visible al cliente al iniciar sesión'
        }, { onConflict: 'llave' })
      if (error) throw error
      toastSuccess(bannerPromo.activo ? '📢 Banner promocional activado y guardado' : 'Banner guardado (desactivado)')
    } catch (err: any) {
      toastError(err.message || 'Error al guardar el banner')
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

      <Card className="bg-zinc-900 border-white/5 shadow-xl">
        <CardHeader className="border-b border-white/5 bg-zinc-900/50 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase text-white">Identidad de Marca (General & Correos)</CardTitle>
              <p className="text-sm text-zinc-400">Personaliza el nombre del negocio y sube tu logo en PNG transparente.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSaveBrand} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nombre Comercial del Negocio</label>
                <Input
                  className="mt-1 bg-zinc-950 border-white/10 text-white font-bold h-12 rounded-xl focus:border-amber-500"
                  placeholder="Ej. BarberSite"
                  value={brandConfig.nombre}
                  onChange={(e) => setBrandConfig({ ...brandConfig, nombre: e.target.value })}
                />
                <p className="text-xs text-amber-400/90 font-medium mt-1.5 ml-1 flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-500 shrink-0" />
                  Se utilizará automáticamente en todo el sistema: títulos de pestaña, cabecera web, facturas, tickets del POS y reportes PDF/CSV exportados.
                </p>
              </div>

              <div className="md:col-span-2 space-y-2">
                <ImageUpload
                  label="Logo Transparente de la Marca (PNG Recomendado)"
                  defaultImage={brandConfig.logo_url || undefined}
                  onUploadSuccess={(url) => setBrandConfig({ ...brandConfig, logo_url: url })}
                  onUploadError={(err) => toastError(err)}
                />
                {brandConfig.logo_url && (
                  <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-white/5">
                    <span className="text-xs text-zinc-400 font-medium truncate max-w-xs">{brandConfig.logo_url}</span>
                    <button
                      type="button"
                      onClick={() => setBrandConfig({ ...brandConfig, logo_url: '' })}
                      className="text-xs text-rose-400 hover:text-rose-300 font-bold ml-4"
                    >
                      Quitar logo
                    </button>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Modo de visualización en la cabecera superior</label>
                <select
                  className="w-full mt-1 p-3.5 border border-white/10 bg-zinc-950 rounded-xl text-sm font-bold text-white focus:border-amber-500 outline-none transition-all"
                  value={brandConfig.mostrar_modo}
                  onChange={(e) => setBrandConfig({ ...brandConfig, mostrar_modo: e.target.value as any })}
                >
                  <option value="ambos">Mostrar Logo + Nombre Comercial (Recomendado)</option>
                  <option value="logo">Mostrar Solo Logo en la cabecera</option>
                  <option value="texto">Mostrar Solo Texto en la cabecera</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/5">
              <Button
                type="submit"
                disabled={saving}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black px-8 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar Identidad de Marca'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* PROGRAMA DE REFERIDOS - MONTO DE BONO */}
      <Card className="bg-zinc-900 border-white/5 shadow-xl">
        <CardHeader className="border-b border-white/5 bg-zinc-900/50 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase text-white">Programa de Referidos (Monto de Bono)</CardTitle>
              <p className="text-sm text-zinc-400">Configura la recompensa que recibe un cliente cuando su invitado realiza su primer servicio.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSaveReferido} className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Monto de Recompensa en Bolivianos (Bs.)</label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  className="bg-zinc-950 border-white/10 text-emerald-400 font-bold text-lg h-12 rounded-xl focus:border-emerald-500 pl-10"
                  value={montoBonoReferido}
                  onChange={(e) => setMontoBonoReferido(e.target.value)}
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">Bs.</span>
              </div>
              <p className="text-xs text-zinc-400 font-medium mt-2 ml-1">
                Actualmente configurado en <strong className="text-emerald-400">Bs. {montoBonoReferido}</strong>. Puedes ajustarlo en cualquier momento aquí sin necesidad de código.
              </p>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/5">
              <Button
                type="submit"
                disabled={saving}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar Monto de Bono'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ══════════ BANNER PROMOCIONAL MENSUAL ══════════ */}
      <Card className={`bg-zinc-900 shadow-xl transition-all ${bannerPromo.activo ? 'border-emerald-500/40 shadow-emerald-500/10' : 'border-white/5'}`}>
        <CardHeader className="border-b border-white/5 bg-zinc-900/50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bannerPromo.activo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                <Megaphone className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-black uppercase text-white">📢 Banner Promocional (Clientes)</CardTitle>
                <p className="text-sm text-zinc-400">Imagen que verán los clientes al iniciar sesión. Ideal para promos del mes.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBannerPromo({ ...bannerPromo, activo: !bannerPromo.activo })}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all border ${
                bannerPromo.activo
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              {bannerPromo.activo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {bannerPromo.activo ? 'Activo' : 'Inactivo'}
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSaveBanner} className="space-y-6">
            <ImageUpload
              label="Imagen del Banner Promocional (Recomendado: 1080x600px o similar horizontal)"
              defaultImage={bannerPromo.imagen_url || undefined}
              onUploadSuccess={(url) => setBannerPromo({ ...bannerPromo, imagen_url: url })}
              onUploadError={(err) => toastError(err)}
            />

            {/* Selector de Promoción de Lealtad (Opcional) */}
            {promocionesList.length > 0 && (
              <div className="p-4 bg-zinc-950 border border-white/5 rounded-2xl space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center justify-between">
                  <span>Vincular con Promoción de Lealtad (Opcional)</span>
                  {bannerPromo.promocion_id && (
                    <span className="text-amber-500 font-bold text-[10px]">✨ Vinculada a promoción existente</span>
                  )}
                </label>
                <select
                  className="w-full bg-zinc-900 border border-white/10 text-white font-bold h-12 rounded-xl px-3 text-sm focus:border-amber-500 outline-none transition-all cursor-pointer"
                  value={bannerPromo.promocion_id || ''}
                  onChange={(e) => {
                    const promoId = e.target.value
                    if (!promoId) {
                      setBannerPromo({ ...bannerPromo, promocion_id: '' })
                      return
                    }
                    const selectedPromo = promocionesList.find((p: any) => p.id === promoId)
                    if (selectedPromo) {
                      setBannerPromo({
                        ...bannerPromo,
                        promocion_id: selectedPromo.id,
                        titulo: selectedPromo.nombre || bannerPromo.titulo,
                        descripcion: selectedPromo.descripcion || bannerPromo.descripcion,
                        fecha_fin: selectedPromo.fecha_fin || bannerPromo.fecha_fin,
                      })
                      toastSuccess(`Datos cargados desde la promoción: ${selectedPromo.nombre}`)
                    }
                  }}
                >
                  <option value="">— Ninguna (Crear afiche personalizado) —</option>
                  {promocionesList.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.icono || '🎁'} {p.nombre} {p.fecha_fin ? `(Válido hasta: ${p.fecha_fin})` : '(Sin fecha límite)'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500">
                  Si seleccionas una promoción, se autorellenará el título, la descripción y la fecha fin de vigencia.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Título del Banner (opcional)</label>
                <Input
                  className="mt-1 bg-zinc-950 border-white/10 text-white font-bold h-12 rounded-xl focus:border-amber-500"
                  placeholder="Ej: 🔥 Promociones de Septiembre"
                  value={bannerPromo.titulo}
                  onChange={(e) => setBannerPromo({ ...bannerPromo, titulo: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1 flex items-center justify-between">
                  <span>Válido Hasta (Fecha Límite)</span>
                  {bannerPromo.fecha_fin && (
                    <span className={`text-[10px] font-black uppercase ${
                      new Date().toISOString().split('T')[0] > bannerPromo.fecha_fin
                        ? 'text-red-400'
                        : 'text-emerald-400'
                    }`}>
                      {new Date().toISOString().split('T')[0] > bannerPromo.fecha_fin ? '⚠️ Expirada' : '✅ Vigente'}
                    </span>
                  )}
                </label>
                <Input
                  type="date"
                  className="mt-1 bg-zinc-950 border-white/10 text-white font-bold h-12 rounded-xl focus:border-amber-500"
                  value={bannerPromo.fecha_fin || ''}
                  onChange={(e) => setBannerPromo({ ...bannerPromo, fecha_fin: e.target.value })}
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  El banner aparecerá a los clientes en cada visita hasta esta fecha. Al pasar el día, dejará de mostrarse automáticamente.
                </p>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Link al tocar el banner (opcional)</label>
              <Input
                className="mt-1 bg-zinc-950 border-white/10 text-white font-bold h-12 rounded-xl focus:border-amber-500"
                placeholder="Ej: /reservar"
                value={bannerPromo.link_url}
                onChange={(e) => setBannerPromo({ ...bannerPromo, link_url: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Descripción corta (opcional)</label>
              <textarea
                className="mt-1 w-full bg-zinc-950 border border-white/10 text-white font-bold rounded-xl p-3 text-sm min-h-[80px] focus:border-amber-500 outline-none transition-all resize-none"
                placeholder="Ej: 2x1 todos los martes, 20% en barba los jueves..."
                value={bannerPromo.descripcion}
                onChange={(e) => setBannerPromo({ ...bannerPromo, descripcion: e.target.value })}
              />
            </div>

            {/* Preview */}
            {bannerPromo.imagen_url && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Vista Previa (así lo verán los clientes)</p>
                <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl max-w-md mx-auto">
                  <img src={bannerPromo.imagen_url} alt="Preview banner" className="w-full h-auto object-cover" />
                  {(bannerPromo.titulo || bannerPromo.descripcion || bannerPromo.fecha_fin) && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-5 pt-12">
                      {bannerPromo.fecha_fin && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/25 text-amber-400 text-[10px] font-black mb-1.5 border border-amber-500/40">
                          <Clock className="w-3 h-3" />
                          <span>Válido hasta: {bannerPromo.fecha_fin}</span>
                        </div>
                      )}
                      {bannerPromo.titulo && <h3 className="text-white font-black text-lg leading-tight">{bannerPromo.titulo}</h3>}
                      {bannerPromo.descripcion && <p className="text-white/70 text-xs mt-1 leading-relaxed">{bannerPromo.descripcion}</p>}
                    </div>
                  )}
                  <button type="button" className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                  {!bannerPromo.activo && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="bg-zinc-800 text-zinc-400 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest">Banner Desactivado</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-white/5">
              <Button
                type="submit"
                disabled={saving}
                className={`font-black px-8 py-3 rounded-xl transition-all shadow-lg ${
                  bannerPromo.activo
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                    : 'bg-zinc-700 hover:bg-zinc-600 text-white shadow-none'
                }`}
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : bannerPromo.activo ? 'Guardar y Activar Banner' : 'Guardar Banner (Inactivo)'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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

      <Card className="bg-zinc-900 border-amber-500/20 shadow-xl">
        <CardHeader className="border-b border-white/5 bg-zinc-900/50 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase text-white">QR Oficial de la Barbería (Caja POS y Cobros)</CardTitle>
              <p className="text-sm text-zinc-400">Sube aquí la imagen del QR oficial del local. Este es el QR que se mostrará en la Caja POS al cobrar los servicios y productos a los clientes.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSaveQr} className="space-y-6">
            <div>
              <ImageUpload
                label="Imagen del QR Oficial de la Barbería (Recomendado 500x500px)"
                defaultImage={qrUrl || undefined}
                onUploadSuccess={(url) => setQrUrl(url)}
                onUploadError={(err) => toastError(err)}
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Enlace / URL Directa de la Imagen QR (Opcional)</label>
              <Input
                type="url"
                placeholder="https://..."
                value={qrUrl}
                onChange={(e) => setQrUrl(e.target.value)}
                className="mt-1 bg-zinc-950 border-white/10 text-white font-mono text-xs"
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
