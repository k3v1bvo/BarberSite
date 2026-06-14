'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Scissors,
  Clock,
  Phone,
  MapPin,
  Star,
  Calendar,
  ChevronRight,
  Mail,
  LogOut,
  LayoutDashboard,
  Loader2,
  ShoppingBag,
  Camera,
  Users,
  Package,
  Instagram,
  Globe
} from 'lucide-react'
import { SocialLinks } from '@/components/ui/SocialLinks'
import { WhatsappFloat } from '@/components/ui/WhatsappFloat'
import { useSocialLinks } from '@/components/ui/useSocialLinks'

interface UserProfile {
  full_name: string
  email: string
  role: string
  avatar_url?: string
}

interface Servicio {
  id: string
  nombre: string
  descripcion: string
  precio: number
  duracion_minutos: number
}

interface Producto {
  id: string
  nombre: string
  precio_venta: number
  image_url: string | null
}

interface PortafolioItem {
  id: string
  image_url: string
  categoria: string
  descripcion: string
}

interface EquipoHome {
  id: string
  nombre: string
  especialidad: string
  imagen_url: string
  descripcion?: string
  redes_sociales?: any
}

export default function HomePage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [portafolio, setPortafolio] = useState<PortafolioItem[]>([])
  const [equipo, setEquipo] = useState<EquipoHome[]>([])
  const [testimonios, setTestimonios] = useState<any[]>([])
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

  const [heroConfigState, setHeroConfigState] = useState(defaultHero)
  const [aboutUsConfig, setAboutUsConfig] = useState(defaultAboutUs)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const router = useRouter()
  const supabase = createClient()
  const socialLinks = useSocialLinks()
  const contactPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE || '59171234567'

  useEffect(() => {
    const checkUserAndData = async () => {
      // 1. Verificar usuario
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, role, avatar_url')
          .eq('id', authUser.id)
          .single()

        if (profile) {
          setUser(profile as UserProfile)
        }
      }

      // 2. Cargar servicios
      const { data: serviciosData } = await supabase
        .from('servicios')
        .select('*')
        .eq('is_active', true)
        .order('nombre')

      if (serviciosData) {
        setServicios(serviciosData)
      }

      // 3. Cargar Productos Destacados
      const { data: prodsData } = await supabase
        .from('productos')
        .select('id, nombre, precio_venta, image_url')
        .eq('is_active', true)
        .gt('stock_actual', 0)
        .limit(4)

      if (prodsData) {
        setProductos(prodsData)
      }

      const { data: portafolioData } = await supabase
        .from('portafolio')
        .select('id, image_url, categoria, descripcion')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(12)

      if (portafolioData) {
        setPortafolio(portafolioData)
      }

      // Cargar barberos activos para mostrarlos en el equipo
      const { data: barberosData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('role', 'barbero')
        .eq('is_active', true)

      const { data: equipoData } = await supabase
        .from('equipo_home')
        .select('id, nombre, especialidad, imagen_url, profile_id, descripcion, redes_sociales')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      const mergedEquipo = barberosData?.map(prof => {
        const equipoConfig = equipoData?.find(e => e.profile_id === prof.id || e.nombre === prof.full_name)
        return {
          id: prof.id,
          nombre: prof.full_name || 'Barbero',
          especialidad: equipoConfig?.especialidad || 'Barbero Especialista',
          imagen_url: equipoConfig?.imagen_url || prof.avatar_url || '',
          descripcion: equipoConfig?.descripcion,
          redes_sociales: equipoConfig?.redes_sociales
        }
      }) || []

      setEquipo(mergedEquipo)

      // 6. Cargar configuración global
      const { data: configData } = await supabase
        .from('configuraciones')
        .select('llave, valor')
        .in('llave', ['hero_bg_image', 'about_us_config'])

      if (configData) {
        const heroConfig = configData.find(c => c.llave === 'hero_bg_image')
        const aboutConfig = configData.find(c => c.llave === 'about_us_config')

        if (heroConfig && heroConfig.valor) {
          setHeroConfigState(heroConfig.valor as typeof defaultHero)
        }
        if (aboutConfig && aboutConfig.valor) {
          setAboutUsConfig(aboutConfig.valor as typeof defaultAboutUs)
        }
      }

      // 7. Cargar Testimonios
      const { data: testimoniosData } = await supabase
        .from('reviews')
        .select(`
          id, estrellas, comentario,
          cliente:cliente_id(full_name),
          barbero:barbero_id(full_name)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(6)

      if (testimoniosData) {
        setTestimonios(testimoniosData)
      }

      setLoading(false)
    }

    checkUserAndData()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.refresh()
  }

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: 'Administrador',
      coordinador: 'Coordinador/a',
      barbero: 'Barbero',
      cliente: 'Cliente'
    }
    return roles[role] || role
  }

  const getPanelUrl = (role: string) => {
    switch (role) {
      case 'admin': return '/admin'
      case 'barbero': return '/barbero'
      case 'coordinador': return '/coordinador'
      case 'cliente': return '/cliente'  // ✅ AGREGADO
      default: return '/'
    }
  }

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <Scissors className="w-8 h-8 text-amber-400" />
              <span className="text-2xl font-bold tracking-wider">BarberSite</span>
            </div>

            {/* Usuario logueado o botones de auth */}
            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-4">
                  {/* Panel según rol */}
                  <Link
                    href={getPanelUrl(user.role)}
                    className="hidden sm:flex items-center gap-2 px-4 py-2 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 rounded-lg transition"
                  >
                    <LayoutDashboard size={18} />
                    <span>Panel {getRoleLabel(user.role)}</span>
                  </Link>

                  {/* Info usuario */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-amber-400 font-bold">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        getInitials(user.full_name || 'U')
                      )}
                    </div>
                    <div className="hidden lg:block">
                      <p className="text-white font-medium text-sm">{user.full_name}</p>
                      <p className="text-zinc-400 text-xs">{getRoleLabel(user.role)}</p>
                    </div>
                  </div>

                  {/* Botón cerrar sesión */}
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition"
                  >
                    <LogOut size={18} />
                    <span className="hidden sm:inline">Salir</span>
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-6 py-2 border border-amber-400 text-amber-400 rounded-full hover:bg-amber-400 hover:text-black transition uppercase text-sm tracking-widest"
                  >
                    Login
                  </Link>
                  <Link
                    href="/reservar"
                    className="px-6 py-2 bg-amber-400 text-black rounded-full hover:bg-amber-300 transition uppercase text-sm font-bold tracking-widest"
                  >
                    Reservar
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
          style={{ backgroundImage: `url('${heroConfigState.url}')` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black" />
        </div>

        <div className="relative z-10 text-center max-w-4xl px-4">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
          </div>

          <h1 className="text-6xl md:text-8xl font-bold mb-6 tracking-tight whitespace-pre-line">
            {heroConfigState.titulo}
          </h1>

          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto whitespace-pre-line">
            {heroConfigState.subtitulo}
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            {user ? (
              <Link
                href={getPanelUrl(user.role)}
                className="inline-flex items-center justify-center gap-2 bg-amber-400 text-black px-8 py-4 rounded-full font-bold hover:bg-amber-300 transition transform hover:scale-105 uppercase tracking-widest"
              >
                <Calendar className="w-5 h-5" />
                Ir al Panel
              </Link>
            ) : (
              <Link
                href="/reservar"
                className="inline-flex items-center justify-center gap-2 bg-amber-400 text-black px-8 py-4 rounded-full font-bold hover:bg-amber-300 transition transform hover:scale-105 uppercase tracking-widest"
              >
                <Calendar className="w-5 h-5" />
                Reservar Cita
              </Link>
            )}
            <Link
              href="/tienda"
              className="inline-flex items-center justify-center gap-2 border border-white text-white px-8 py-4 rounded-full hover:bg-white hover:text-black transition uppercase tracking-widest"
            >
              <ShoppingBag className="w-5 h-5" />
              Explorar Tienda
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronRight className="w-8 h-8 text-white/50 rotate-90" />
        </div>
      </section>

      {/* Info Bar */}
      <div className="bg-amber-400 text-black py-4">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center gap-8 text-sm font-bold uppercase tracking-widest">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Lun-Sáb: 9:00 - 21:00
          </span>
          <span className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            +591 71234567
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Edif. Antezana, C. Sucre, Cbba
          </span>
        </div>
      </div>

      {/* Servicios */}
      <section id="servicios" className="py-24 bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-amber-400 uppercase tracking-widest text-sm font-bold mb-4">Nuestros Servicios</p>
            <h2 className="text-5xl font-bold">Cortes & Estilos</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {servicios?.map((servicio) => (
              <div
                key={servicio.id}
                className="group bg-black border border-white/10 rounded-2xl overflow-hidden hover:border-amber-400/50 transition-all duration-300"
              >
                <div className="h-1 bg-amber-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                <div className="p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-amber-400/10 rounded-xl flex items-center justify-center">
                      <Scissors className="w-6 h-6 text-amber-400" />
                    </div>
                    <h3 className="text-xl font-bold">{servicio.nombre}</h3>
                  </div>

                  <p className="text-gray-400 mb-4 min-h-12">
                    {servicio.descripcion || 'Servicio premium de barbería'}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div>
                      <p className="text-3xl font-bold text-amber-400">{formatCurrency(servicio.precio)}</p>
                      <p className="text-sm text-gray-500">{servicio.duracion_minutos} min</p>
                    </div>
                    {user ? (
                      <Link
                        href={getPanelUrl(user.role)}
                        className="px-4 py-2 bg-white text-black rounded-full text-sm font-bold hover:bg-amber-400 transition"
                      >
                        Ir al Panel
                      </Link>
                    ) : (
                      <Link
                        href="/register"
                        className="px-4 py-2 bg-white text-black rounded-full text-sm font-bold hover:bg-amber-400 transition"
                      >
                        Reservar
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(!servicios || servicios.length === 0) && (
            <div className="text-center py-16">
              <Scissors className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No hay servicios disponibles</p>
              <Link href="/login" className="text-amber-400 hover:underline">
                Inicia sesión para gestionar servicios →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Galería / Portafolio */}
      <section id="galeria" className="py-24 bg-zinc-950 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-amber-400 uppercase tracking-widest text-sm font-bold mb-4">Nuestro trabajo</p>
            <h2 className="text-5xl font-bold mb-4">Galería</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Estilos recientes de nuestro equipo. Las fotos se actualizan desde el panel de portafolio.
            </p>
          </div>

          {portafolio.length > 0 ? (
            <>
              <div className="relative aspect-[16/9] max-h-[520px] rounded-2xl overflow-hidden border border-white/10 group">
                <img
                  src={portafolio[carouselIndex]?.image_url}
                  alt={portafolio[carouselIndex]?.descripcion || 'Trabajo de barbería'}
                  className="w-full h-full object-cover transition-opacity duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end gap-4">
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                      {portafolio[carouselIndex]?.categoria}
                    </span>
                    <p className="text-white font-medium mt-1 max-w-lg">
                      {portafolio[carouselIndex]?.descripcion || 'Estilo Barber Pro'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCarouselIndex((i) => (i - 1 + portafolio.length) % portafolio.length)
                      }
                      className="w-10 h-10 rounded-full bg-black/50 border border-white/20 hover:bg-amber-500 hover:text-black transition-colors font-bold"
                      aria-label="Anterior"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => setCarouselIndex((i) => (i + 1) % portafolio.length)}
                      className="w-10 h-10 rounded-full bg-black/50 border border-white/20 hover:bg-amber-500 hover:text-black transition-colors font-bold"
                      aria-label="Siguiente"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {portafolio.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCarouselIndex(idx)}
                    className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === carouselIndex ? 'border-amber-500 scale-105' : 'border-white/10 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>

              <div className="text-center mt-8">
                <Link
                  href="/galeria"
                  className="inline-flex items-center gap-2 text-amber-400 font-bold hover:text-amber-300 transition"
                >
                  Ver galería completa
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-3xl bg-zinc-900/50">
              <Camera className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">Galería en preparación</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Ve al panel de Portafolio para agregar las primeras imágenes a la galería del Home.
              </p>
              {user && (
                <Link
                  href="/admin/portafolio"
                  className="inline-flex items-center justify-center px-6 py-3 bg-white text-black font-bold uppercase tracking-widest text-sm rounded-full hover:bg-amber-400 transition-colors"
                >
                  Ir al Portafolio
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Acerca de */}
      <section id="acerca" className="py-24 bg-black">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden">
                <img
                  src={aboutUsConfig.imagen_url}
                  alt="Barbería"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-amber-400 rounded-2xl flex items-center justify-center">
                <div className="text-center">
                  <p className="text-4xl font-bold text-black">{aboutUsConfig.anios_experiencia}</p>
                  <p className="text-sm text-black/70 uppercase tracking-widest">Años</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-amber-400 uppercase tracking-widest text-sm font-bold mb-4">Acerca de Nosotros</p>
              <h2 className="text-5xl font-bold mb-6 whitespace-pre-line">{aboutUsConfig.titulo}</h2>
              <p className="text-gray-400 mb-6 text-lg whitespace-pre-line">
                {aboutUsConfig.texto}
              </p>

              <div className="grid grid-cols-2 gap-6 mb-8">
                {aboutUsConfig.metricas.map((item, i) => (
                  <div key={i} className="text-center p-4 bg-zinc-900 rounded-xl">
                    <p className="text-3xl font-bold text-amber-400">{item.numero}</p>
                    <p className="text-sm text-gray-400">{item.texto}</p>
                  </div>
                ))}
              </div>

              {user ? (
                <Link
                  href={getPanelUrl(user.role)}
                  className="inline-flex items-center gap-2 bg-amber-400 text-black px-8 py-4 rounded-full font-bold hover:bg-amber-300 transition"
                >
                  Ir al Panel
                  <ChevronRight className="w-5 h-5" />
                </Link>
              ) : (
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 bg-amber-400 text-black px-8 py-4 rounded-full font-bold hover:bg-amber-300 transition"
                >
                  Agenda Tu Cita
                  <ChevronRight className="w-5 h-5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tienda Pro Destacados */}
      {productos.length > 0 && (
        <section id="tienda" className="py-24 bg-black border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
              <p className="text-amber-400 uppercase tracking-widest text-sm font-bold mb-4">Productos Premium</p>
              <h2 className="text-5xl font-bold">Tienda</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {productos.map((producto) => (
                <div key={producto.id} className="bg-zinc-900/50 rounded-2xl overflow-hidden border border-white/5 group hover:border-amber-500/30 transition-all">
                  <div className="aspect-square bg-zinc-800 relative overflow-hidden">
                    {producto.image_url ? (
                      <img
                        src={producto.image_url}
                        alt={producto.nombre}
                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-16 h-16 text-zinc-700" />
                      </div>
                    )}
                  </div>
                  <div className="p-6 text-center">
                    <h3 className="text-lg font-bold mb-2 line-clamp-1">{producto.nombre}</h3>
                    <p className="text-amber-500 font-black text-xl mb-4">{formatCurrency(producto.precio_venta)}</p>
                    <Link href="/tienda" className="inline-block w-full py-2 bg-white/5 hover:bg-amber-500 hover:text-black rounded-lg text-sm font-bold uppercase tracking-widest transition-colors border border-white/10 hover:border-amber-500">
                      Ver Detalles
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 text-center">
              <Link
                href="/tienda"
                className="inline-flex items-center justify-center gap-2 bg-transparent border-2 border-amber-500 text-amber-500 px-8 py-4 rounded-full font-bold hover:bg-amber-500 hover:text-black transition uppercase tracking-widest"
              >
                <ShoppingBag className="w-5 h-5" />
                Catálogo Completo
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Equipo */}
      <section id="equipo" className="py-24 bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-amber-400 uppercase tracking-widest text-sm font-bold mb-4">Nuestro Equipo</p>
            <h2 className="text-5xl font-bold">Barberos Expertos</h2>
          </div>

          {equipo.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {equipo.map((barbero) => (
              <div key={barbero.id} className="group text-center">
                <div className="relative inline-block mb-6">
                  <div className="w-64 h-64 rounded-full overflow-hidden mx-auto">
                    {barbero.imagen_url ? (
                      <img
                        src={barbero.imagen_url}
                        alt={barbero.nombre}
                        className="w-full h-full object-cover blur-[3px] grayscale opacity-70 group-hover:blur-[0px] group-hover:grayscale-0 group-hover:opacity-100 transform group-hover:scale-110 transition-all duration-500"
                        onError={(e) => {
                           (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(barbero.nombre)}&background=f59e0b&color=000&size=256`;
                        }}
                      />
                    ) : (
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(barbero.nombre)}&background=f59e0b&color=000&size=256`}
                        alt={barbero.nombre}
                        className="w-full h-full object-cover blur-[3px] grayscale opacity-70 group-hover:blur-[0px] group-hover:grayscale-0 group-hover:opacity-100 transform group-hover:scale-110 transition-all duration-500"
                      />
                    )}
                  </div>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-amber-400 text-black px-4 py-1 rounded-full text-sm font-bold truncate max-w-[200px]">
                    {barbero.especialidad}
                  </div>
                </div>
                  <h3 className="text-xl font-bold mb-2">{barbero.nombre}</h3>
                  {barbero.descripcion && (
                    <p className="text-gray-400 text-sm mb-4 max-w-xs mx-auto line-clamp-3">
                      {barbero.descripcion}
                    </p>
                  )}
                  <div className="flex justify-center gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  {barbero.redes_sociales && (barbero.redes_sociales.instagram || barbero.redes_sociales.web) && (
                    <div className="flex justify-center gap-3">
                      {barbero.redes_sociales.instagram && (
                        <a href={barbero.redes_sociales.instagram} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-amber-400 hover:bg-zinc-700 transition">
                          <Instagram className="w-4 h-4" />
                        </a>
                      )}
                      {barbero.redes_sociales.web && (
                        <a href={barbero.redes_sociales.web} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-amber-400 hover:bg-zinc-700 transition">
                          <Globe className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-3xl bg-black/50">
              <Users className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">Conoce al equipo</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Ve al panel de Equipo para agregar los perfiles de los barberos.
              </p>
              {user && (
                <Link
                  href="/admin/equipo"
                  className="inline-flex items-center justify-center px-6 py-3 bg-white text-black font-bold uppercase tracking-widest text-sm rounded-full hover:bg-amber-400 transition-colors"
                >
                  Ir al panel de Equipo
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Testimonios */}
      <section className="py-24 bg-black">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-amber-400 uppercase tracking-widest text-sm font-bold mb-4">Testimonios</p>
            <h2 className="text-5xl font-bold">Lo Que Dicen</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {(testimonios.length > 0 ? testimonios : [
              {
                id: 'static-1',
                estrellas: 5,
                comentario: '¡Excelente servicio! Muy profesionales y el ambiente es increíble. Definitivamente volveré.',
                cliente: { full_name: 'Carlos Mendoza' }
              },
              {
                id: 'static-2',
                estrellas: 5,
                comentario: 'El mejor corte que he tenido en años. La atención al detalle es insuperable.',
                cliente: { full_name: 'Luis Vargas' }
              },
              {
                id: 'static-3',
                estrellas: 5,
                comentario: 'Puntualidad, buen trato y un resultado impecable. 100% recomendados.',
                cliente: { full_name: 'Andrés Castro' }
              }
            ]).map((testimonio) => (
              <div key={testimonio.id} className="bg-zinc-900 p-8 rounded-2xl relative">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonio.estrellas }).map((_, j) => (
                    <Star key={j} className="w-5 h-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                {testimonio.comentario && testimonio.comentario.trim() !== '' ? (
                  <p className="text-gray-300 mb-6 italic">"{testimonio.comentario}"</p>
                ) : (
                  <div className="mb-6 h-6"></div>
                )}
                <p className="font-bold text-amber-400">{testimonio.cliente?.full_name || 'Cliente'}</p>
                {testimonio.barbero && (
                  <p className="text-xs text-zinc-500 font-bold uppercase mt-1">
                    Atendido por: {testimonio.barbero.full_name}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" className="py-24 bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <p className="text-amber-400 uppercase tracking-widest text-sm font-bold mb-4">Contacto</p>
              <h2 className="text-5xl font-bold mb-6">Visítanos</h2>
              <p className="text-gray-400 mb-8 text-lg">
                Estamos ubicados en un lugar privilegiado. ¡Te esperamos!
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center shrink-0">
                    <MapPin className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1">Dirección</h3>
                    <p className="text-gray-400">Edif. Antezana, calle Sucre, Cochabamba</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1">Teléfono</h3>
                    <a
                      href={`tel:+${contactPhone.replace(/\D/g, '')}`}
                      className="text-gray-400 hover:text-amber-400 transition"
                    >
                      +{contactPhone.replace(/(\d{3})(\d+)/, '$1 $2')}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1">Horario</h3>
                    <p className="text-gray-400">Lunes a Sábado: 9:00 - 21:00<br />Domingo: Cerrado</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center shrink-0">
                    <Mail className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1">Email</h3>
                    <p className="text-gray-400">info@BarberSite.com</p>
                  </div>
                </div>
              </div>

              <SocialLinks links={socialLinks} size="lg" className="mt-8" />
            </div>

            {/* Mapa */}
            <div className="bg-zinc-800 rounded-2xl overflow-hidden h-[500px]">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3807.3821644859213!2d-66.1548148237828!3d-17.393438064360744!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x93e3730afb6974d5%3A0xf6413d9e8b60ca50!2sBarber%20Site!5e0!3m2!1ses-419!2sbo!4v1771741041111!5m2!1ses-419!2sbo"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Info Bar Bottom */}
      <div className="bg-amber-400 text-black py-4">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center gap-8 text-sm font-bold uppercase tracking-widest">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Lun-Sáb: 9:00 - 21:00
          </span>
          <span className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            +591 71234567
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Edif. Antezana, C. Sucre, Cbba
          </span>
        </div>
      </div>

      <WhatsappFloat href={socialLinks.whatsapp} />

      {/* Footer */}
      <footer className="bg-black border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <Scissors className="w-8 h-8 text-amber-400" />
              <span className="text-xl font-bold tracking-wider">BarberSite</span>
            </div>

            <div className="flex flex-col items-center gap-6">
              <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-400">
                <a href="#servicios" className="hover:text-amber-400 transition">Servicios</a>
                <a href="#galeria" className="hover:text-amber-400 transition">Galería</a>
                <a href="#acerca" className="hover:text-amber-400 transition">Nosotros</a>
                <a href="#tienda" className="hover:text-amber-400 transition">Tienda</a>
                <a href="#equipo" className="hover:text-amber-400 transition">Equipo</a>
                <a href="#contacto" className="hover:text-amber-400 transition">Contacto</a>
              </div>
              <SocialLinks links={socialLinks} className="flex flex-col items-center" />
            </div>

            <p className="text-gray-500 text-sm text-center md:text-right">
              © 2026 BarberSite. Todos los derechos reservados. Cochabamba, Bolivia. -k3v1bvo Studios, designed by k3v1bvo-
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}