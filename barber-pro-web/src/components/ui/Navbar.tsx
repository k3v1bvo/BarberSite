'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LogOut,
  User,
  Scissors,
  Home,
  ShoppingBag,
  Calendar,
  CalendarDays,
  MoreHorizontal,
  Menu,
  UserCog,
  GraduationCap,
  Wallet,
  BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { CampanaNotificaciones } from './CampanaNotificaciones'
import { OrdenLlegadaBarberos } from './OrdenLlegadaBarberos'
import { DashboardBreadcrumb } from './DashboardBreadcrumb'
import { useSidebar } from '@/components/providers/SidebarProvider'
import { useBrand } from '@/components/providers/BrandProvider'
import {
  getAgendaHref,
  getAdminNavSections,
  getCoordinadorNavSections,
  flattenSections,
  barberoNavItems,
  clienteNavItems,
  isDashboardRoute,
  isNavItemActive,
} from '@/lib/navigation/dashboard-nav'

interface UserProfile {
  id: string
  full_name: string
  email: string
  role: string
  avatar_url?: string
}

export function Navbar() {
  const { brand } = useBrand()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { toggleMobile } = useSidebar()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, avatar_url')
          .eq('id', authUser.id)
          .single()

        setUser(profile as UserProfile)
      }
      setLoading(false)
    }

    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: 'Administrador',
      coordinador: 'Coordinación',
      barbero: 'Barbero',
      cliente: 'Cliente'
    }
    return roles[role] || role
  }

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'
  }

  const agendaHref = getAgendaHref(user?.role, user?.id)
  const inDashboard = isDashboardRoute(pathname)

  const mobileNavItems = (() => {
    if (!user) return []
    if (user.role === 'cliente') {
      return [
        { label: 'Reservar', href: '/reservar', icon: Scissors, isPrimary: true },
        { label: 'Mis Citas', href: '/cliente', icon: Calendar },
        { label: 'Tienda', href: '/tienda', icon: ShoppingBag },
        { label: 'Perfil', href: '/perfil', icon: UserCog },
        { label: 'Menú', href: '#menu', icon: Menu, isMenuTrigger: true },
      ]
    }
    if (user.role === 'barbero') {
      return [
        { label: 'Inicio', href: '/barbero', icon: Home },
        { label: 'Cursos', href: '/barbero/induccion', icon: GraduationCap },
        { label: 'Calendario', href: agendaHref, icon: CalendarDays, isPrimary: true },
        { label: 'Perfil', href: '/perfil', icon: UserCog },
        { label: 'Menú', href: '#menu', icon: Menu, isMenuTrigger: true },
      ]
    }
    if (user.role === 'coordinador') {
      const all = flattenSections(getCoordinadorNavSections(agendaHref))
      const pick = (href: string) => all.find((i) => i.href === href)
      return [
        pick('/coordinador') || { label: 'Panel', href: '/coordinador', icon: Home },
        pick(agendaHref) || { label: 'Agenda', href: agendaHref, icon: Calendar },
        { label: 'POS / Caja', href: '/coordinador/caja', icon: ShoppingBag, isPrimary: true },
        pick('/coordinador/caja-chica') || { label: 'Caja Chica', href: '/coordinador/caja-chica', icon: Wallet },
        { label: 'Menú', href: '#menu', icon: Menu, isMenuTrigger: true },
      ]
    }
    if (user.role === 'admin') {
      const all = flattenSections(getAdminNavSections(agendaHref))
      const pick = (href: string) => all.find((i) => i.href === href)
      return [
        pick('/admin') || { label: 'Panel', href: '/admin', icon: Home },
        pick(agendaHref) || { label: 'Agenda', href: agendaHref, icon: Calendar },
        { label: 'POS / Caja', href: '/admin/caja', icon: ShoppingBag, isPrimary: true },
        pick('/admin/reportes') || { label: 'Reportes', href: '/admin/reportes', icon: BarChart3 },
        { label: 'Menú', href: '#menu', icon: Menu, isMenuTrigger: true },
      ]
    }
    return clienteNavItems
  })()

  if (loading) {
    return (
      <header className="h-16 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md flex items-center px-6 sticky top-0 z-40">
         <div className="flex items-center gap-3 text-amber-500 font-black tracking-tighter animate-pulse">
            {brand.logo_url && (brand.mostrar_modo === 'logo' || brand.mostrar_modo === 'ambos') ? (
              <img src={brand.logo_url} alt={brand.nombre} className="h-7 max-w-[120px] object-contain mix-blend-screen" />
            ) : (
              <Scissors className="w-6 h-6" />
            )}
            {(brand.mostrar_modo === 'ambos' || brand.mostrar_modo === 'texto' || !brand.logo_url) && (
              <span>{brand.nombre}</span>
            )}
         </div>
      </header>
    )
  }

  return (
    <>
      {/* --- DESKTOP TOP HEADER --- */}
      <header className="hidden lg:flex h-16 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {user && inDashboard ? (
            <DashboardBreadcrumb />
          ) : (
            <>
              <Link
                href="/"
                className="flex items-center gap-2 text-amber-500 font-black text-lg tracking-tighter hover:scale-105 transition-transform shrink-0"
              >
                {brand.logo_url && (brand.mostrar_modo === 'logo' || brand.mostrar_modo === 'ambos') ? (
                  <img src={brand.logo_url} alt={brand.nombre} className="h-10 lg:h-11 max-w-[180px] object-contain mix-blend-screen" />
                ) : (
                  <Scissors className="w-5 h-5 glow-amber" />
                )}
                {(brand.mostrar_modo === 'ambos' || brand.mostrar_modo === 'texto' || !brand.logo_url) && (
                  <span>{brand.nombre}</span>
                )}
              </Link>
              {!user && (
                <nav className="flex items-center gap-6 text-zinc-400 font-medium ml-4">
                  <Link href="/servicios" className="hover:text-amber-400 transition-colors">
                    Servicios
                  </Link>
                  <Link href="/galeria" className="hover:text-amber-400 transition-colors">
                    Galería
                  </Link>
                  <Link href="/tienda" className="hover:text-amber-400 transition-colors">
                    Tienda
                  </Link>
                  <Link href="/reservar" className="hover:text-amber-400 transition-colors">
                    Reservar
                  </Link>
                </nav>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {['barbero', 'admin', 'coordinador'].includes(user.role) && <OrdenLlegadaBarberos />}
              <CampanaNotificaciones userId={user.id || ''} userRole={user.role} />
              
              <div className="h-8 w-px bg-white/10 mx-2" />

              <div className="flex items-center gap-3 pl-2">
                <div className="text-right">
                  <p className="text-sm font-bold text-white leading-tight">{user.full_name}</p>
                  <p className="text-[10px] uppercase font-black text-amber-500/80 tracking-widest">{getRoleLabel(user.role)}</p>
                </div>
                <button 
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-amber-400 font-black hover:border-amber-500/50 transition-colors overflow-hidden"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(user.full_name)
                  )}
                </button>
              </div>

              {/* Account Dropdown (Simplified) */}
              {menuOpen && (
                <div className="absolute top-16 right-8 w-52 bg-zinc-900 border border-white/10 p-2 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 z-50">
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <p className="text-xs font-bold text-white leading-tight">{user.full_name}</p>
                    <p className="text-[10px] uppercase font-black text-amber-500 tracking-widest">{getRoleLabel(user.role)}</p>
                  </div>
                  <Link
                    href="/perfil"
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors font-bold text-xs"
                  >
                    <UserCog size={16} className="text-amber-500" /> Mi Perfil
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors font-bold text-xs"
                  >
                    <LogOut size={16} /> Cerrar Sesión
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="px-6 py-2 text-zinc-300 hover:text-white font-bold transition-colors">Login</Link>
              <Link href="/register" className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-full transition-all shadow-lg shadow-amber-500/10 active:scale-95">Registro</Link>
            </div>
          )}
        </div>
      </header>

      {/* --- MOBILE TOP BAR --- */}
      <header className="lg:hidden h-16 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-40">
        {/* Hamburger + Logo */}
        <div className="flex items-center gap-3">
          {user && (
            <button
              onClick={toggleMobile}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 hover:text-amber-400 hover:border-amber-500/30 transition-all active:scale-90"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
          )}
          <Link href="/" className="flex items-center gap-2 text-amber-500 font-black tracking-tighter">
            {brand.logo_url && (brand.mostrar_modo === 'logo' || brand.mostrar_modo === 'ambos') ? (
              <img src={brand.logo_url} alt={brand.nombre} className="h-9 max-w-[150px] object-contain mix-blend-screen" />
            ) : (
              <Scissors className="w-6 h-6 glow-amber" />
            )}
            {(brand.mostrar_modo === 'ambos' || brand.mostrar_modo === 'texto' || !brand.logo_url) && (
              <span>{brand.nombre}</span>
            )}
          </Link>
        </div>

        {user ? (
          <div className="flex items-center gap-2 relative">
            <CampanaNotificaciones userId={user.id || ''} userRole={user.role} />
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 rounded-full bg-zinc-800 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black hover:border-amber-400 transition-colors overflow-hidden shrink-0 ml-1 active:scale-95"
              aria-label="Perfil y Cerrar Sesión"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                getInitials(user.full_name)
              )}
            </button>
            
            {/* Dropdown flotante en móvil */}
            {menuOpen && (
              <div className="absolute top-12 right-0 w-52 bg-zinc-900 border border-white/10 p-2 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 z-50">
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <p className="text-xs font-bold text-white leading-tight">{user.full_name}</p>
                  <p className="text-[10px] uppercase font-black text-amber-500 tracking-widest">{getRoleLabel(user.role)}</p>
                </div>
                <Link
                  href="/perfil"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors font-bold text-xs"
                >
                  <UserCog size={16} className="text-amber-500" /> Mi Perfil
                </Link>
                <button 
                  onClick={() => {
                    setMenuOpen(false)
                    handleLogout()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors font-bold text-xs"
                >
                  <LogOut size={16} /> Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        ) : (
           <div className="w-10"></div>
        )}
      </header>

      {/* --- MOBILE BOTTOM NAV (UX Essential) --- */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 h-16 bg-zinc-950/90 border border-white/10 shadow-2xl shadow-black/80 rounded-2xl flex items-center justify-around z-50 backdrop-blur-xl px-2">
        {user ? (
          mobileNavItems.map((item: any) => {
            const isActive = !item.isMenuTrigger && isNavItemActive(pathname, item.href)
            
            if (item.isMenuTrigger) {
              return (
                <button
                  key="menu-trigger"
                  type="button"
                  onClick={toggleMobile}
                  className="flex flex-col items-center justify-center min-w-[3.2rem] py-1 px-1 rounded-xl transition-all active:scale-90 text-zinc-400 hover:text-amber-400"
                >
                  <item.icon size={20} />
                  <span className="text-[9px] uppercase font-black mt-0.5 tracking-tighter truncate max-w-[4rem]">
                    {item.label}
                  </span>
                </button>
              )
            }

            if (item.isPrimary) {
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center px-3 py-1.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-500/25 border',
                    isActive
                      ? 'bg-amber-400 text-black border-amber-300 font-black scale-105'
                      : 'bg-amber-500/90 text-black border-amber-400/50 font-bold hover:bg-amber-500'
                  )}
                >
                  <item.icon size={18} className="stroke-[2.5]" />
                  <span className="text-[9px] uppercase font-black tracking-tighter truncate max-w-[4.5rem]">
                    {item.label}
                  </span>
                </Link>
              )
            }

            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center justify-center min-w-[3.2rem] py-1 px-1 rounded-xl transition-all active:scale-90',
                  isActive ? 'text-amber-500 font-black' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {isActive && (
                  <span className="absolute -top-2.5 w-6 h-1 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                )}
                <item.icon size={20} className={cn(isActive && 'glow-amber')} />
                <span className="text-[9px] uppercase font-black mt-0.5 tracking-tighter truncate max-w-[4rem]">
                  {item.label}
                </span>
              </Link>
            )
          })
        ) : (
          <>
            <Link href="/" className="flex flex-col items-center justify-center text-amber-500"><Home size={20} /><span className="text-[9px] uppercase font-black mt-0.5">Inicio</span></Link>
            <Link href="/servicios" className="flex flex-col items-center justify-center text-zinc-500 hover:text-amber-400"><Scissors size={20} /><span className="text-[9px] uppercase font-black mt-0.5">Servicios</span></Link>
            <Link href="/tienda" className="flex flex-col items-center justify-center text-zinc-500 hover:text-amber-400"><ShoppingBag size={20} /><span className="text-[9px] uppercase font-black mt-0.5">Tienda</span></Link>
            <Link href="/login" className="flex flex-col items-center justify-center text-zinc-500 hover:text-amber-400"><User size={20} /><span className="text-[9px] uppercase font-black mt-0.5">Ingresar</span></Link>
          </>
        )}
      </nav>
    </>
  )
}
