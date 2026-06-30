import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  ShoppingBag,
  Scissors,
  Package,
  Users,
  Camera,
  BarChart3,
  Search,
  Clock,
  ClipboardList,
  Bell,
  Wallet,
  MessageSquare,
  Receipt,
  Landmark,
  Scale,
  ArrowDownCircle,
  AlertTriangle,
  Coins,
  UserPlus,
  Shield,
  ClipboardCheck,
  Gift,
  Settings,
  Cake,
  Images,
  Sliders,
  RefreshCw,
  Users2,
  UserCog,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  description?: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export function getAgendaHref(role?: string, userId?: string): string {
  if (role === 'barbero' && userId) return `/agenda/${userId}`
  if (role === 'admin' || role === 'coordinador') return '/agenda'
  return '/coordinador'
}

export function getAdminNavSections(agendaHref: string): NavSection[] {
  return [
    {
      title: 'Operación',
      items: [
        { label: 'Panel', href: '/admin', icon: LayoutDashboard, description: 'Resumen del día' },
        { label: 'Agenda', href: agendaHref, icon: Calendar, description: 'Citas y disponibilidad' },
        { label: 'Caja / POS', href: '/admin/caja', icon: ShoppingBag, description: 'Nueva cita o venta rápida' },
        { label: 'Asistencia', href: '/admin/asistencia', icon: Clock, description: 'Turnos del personal' },
        { label: 'Horarios', href: '/admin/horarios', icon: Clock, description: 'Plantillas y asignación' },
        { label: 'Notificaciones', href: '/notificaciones', icon: Bell, description: 'Alertas e historial' },
      ],
    },
    {
      title: 'Contabilidad',
      items: [
        { label: 'Caja Chica', href: '/coordinador/caja-chica', icon: Wallet, description: 'Adelantos, sanciones, depósitos' },
        { label: 'Ventas / Servicios', href: '/coordinador/ventas', icon: Receipt, description: 'Pagos por cortes y productos' },
        { label: 'Banco', href: '/coordinador/banco', icon: Landmark, description: 'Depósitos y retiros' },
        { label: 'Arqueo de Caja', href: '/coordinador/arqueo', icon: Scale, description: 'Cierre diario' },
        { label: 'Egresos', href: '/coordinador/egresos', icon: ArrowDownCircle, description: 'Gastos con/sin factura' },
      ],
    },
    {
      title: 'Catálogo',
      items: [
        { label: 'Servicios', href: '/admin/servicios', icon: Scissors },
        { label: 'Inventario', href: '/admin/productos', icon: Package },
        { label: 'Portafolio', href: '/admin/portafolio', icon: Camera },
        { label: 'Equipo', href: '/admin/equipo', icon: Users, description: 'Barberos en el Home' },
      ],
    },
    {
      title: 'Administración',
      items: [
        { label: 'Clientes', href: '/admin/clientes', icon: Users2, description: 'Directorio y movimientos' },
        { label: 'Usuarios', href: '/admin/usuarios', icon: Users },
        { label: 'Sanciones', href: '/coordinador/sanciones', icon: AlertTriangle },
        { label: 'Bonos', href: '/coordinador/bonos', icon: Gift },
        { label: 'Cumpleaños', href: '/coordinador/cumpleanos', icon: Cake },
        { label: 'Comisiones', href: '/admin/comisiones', icon: Coins },
        { label: 'Lealtad', href: '/admin/lealtad', icon: Gift, description: 'Programa de recompensas' },
        { label: 'Referidos', href: '/coordinador/referidos', icon: UserPlus, description: 'Bonos por recomendación' },
        { label: 'Conteo Inventario', href: '/admin/inventario-fisico', icon: ClipboardCheck, description: 'Conteo físico y ajustes' },
        { label: 'Auditoría', href: '/admin/auditoria', icon: Shield, description: 'Registro de cambios' },
        { label: 'Pedidos', href: '/admin/pedidos', icon: ClipboardList },
        { label: 'Reportes', href: '/admin/reportes', icon: BarChart3 },
        { label: 'Reseñas', href: '/admin/resenas', icon: MessageSquare, description: 'Moderación de testimonios' },
        { label: 'Configuración', href: '/admin/configuracion', icon: Settings, description: 'Ajustes globales' },
        { label: 'Reglas Laborales', href: '/admin/reglas-laborales', icon: Sliders, description: 'Comisiones, sanciones y bonos' },
        { label: 'Galería', href: '/admin/galeria', icon: Images, description: 'Todas las imágenes del sistema' },
        { label: 'Buscar', href: '/admin/buscar', icon: Search },
        { label: 'Sincronizar Historial', href: '/admin/sincronizar', icon: RefreshCw, description: 'Asignar citas antiguas' },
        { label: 'Mi Perfil', href: '/perfil', icon: UserCog, description: 'Editar datos personales' },
      ],
    },
  ]
}

export function getCoordinadorNavSections(agendaHref: string): NavSection[] {
  return [
    {
      title: 'Operación',
      items: [
        { label: 'Panel', href: '/coordinador', icon: LayoutDashboard, description: 'Resumen del día' },
        { label: 'Agenda', href: agendaHref, icon: Calendar, description: 'Citas y disponibilidad' },
        { label: 'Caja / POS', href: '/admin/caja', icon: ShoppingBag, description: 'Nueva cita o venta rápida' },
        { label: 'Asistencia', href: '/admin/asistencia', icon: Clock, description: 'Turnos del personal' },
        { label: 'Notificaciones', href: '/notificaciones', icon: Bell, description: 'Alertas e historial' },
      ],
    },
    {
      title: 'Contabilidad',
      items: [
        { label: 'Caja Chica', href: '/coordinador/caja-chica', icon: Wallet, description: 'Adelantos, sanciones, depósitos' },
        { label: 'Ventas / Servicios', href: '/coordinador/ventas', icon: Receipt, description: 'Pagos por cortes y productos' },
        { label: 'Banco', href: '/coordinador/banco', icon: Landmark, description: 'Depósitos y retiros' },
        { label: 'Arqueo de Caja', href: '/coordinador/arqueo', icon: Scale, description: 'Cierre diario' },
        { label: 'Egresos', href: '/coordinador/egresos', icon: ArrowDownCircle, description: 'Gastos con/sin factura' },
      ],
    },
    {
      title: 'Control',
      items: [
        { label: 'Inventario', href: '/admin/productos', icon: Package, description: 'Stock y productos' },
        { label: 'Conteo Físico', href: '/admin/inventario-fisico', icon: ClipboardCheck, description: 'Conteo y ajustes' },
        { label: 'Sanciones', href: '/coordinador/sanciones', icon: AlertTriangle, description: 'Registro y historial' },
        { label: 'Bonos', href: '/coordinador/bonos', icon: Gift, description: 'Premios a barberos' },
        { label: 'Cumpleaños', href: '/coordinador/cumpleanos', icon: Cake, description: 'Verificar cumpleañeros del día' },
        { label: 'Comisiones', href: '/admin/comisiones', icon: Coins, description: 'Cálculo y pagos' },
        { label: 'Lealtad', href: '/admin/lealtad', icon: Gift, description: 'Programa de recompensas' },
        { label: 'Referidos', href: '/coordinador/referidos', icon: UserPlus, description: 'Bonos por recomendación' },
        { label: 'Reportes', href: '/admin/reportes', icon: BarChart3, description: 'Análisis y datos' },
        { label: 'Reseñas', href: '/admin/resenas', icon: MessageSquare, description: 'Moderación de testimonios' },
        { label: 'Configuración', href: '/admin/configuracion', icon: Settings, description: 'Ajustes globales y QR' },
        { label: 'Reglas Laborales', href: '/admin/reglas-laborales', icon: Sliders, description: 'Comisiones, sanciones y bonos' },
        { label: 'Galería del Sistema', href: '/admin/galeria', icon: Images, description: 'Imágenes subidas' },
        { label: 'Equipo Home', href: '/admin/equipo', icon: Users, description: 'Miembros web' },
        { label: 'Clientes', href: '/admin/clientes', icon: Users2, description: 'Directorio y movimientos' },
        { label: 'Buscar', href: '/admin/buscar', icon: Search, description: 'Búsqueda global' },
        { label: 'Sincronizar Historial', href: '/admin/sincronizar', icon: RefreshCw, description: 'Asignar citas antiguas' },
        { label: 'Mi Perfil', href: '/perfil', icon: UserCog, description: 'Editar datos personales' },
      ],
    },
  ]
}

export function flattenSections(sections: NavSection[]): NavItem[] {
  return sections.flatMap((s) => s.items)
}

export const barberoNavItems = (agendaHref: string): NavItem[] => [
  { label: 'Mi panel', href: '/barbero', icon: LayoutDashboard },
  { label: 'Mi agenda', href: agendaHref, icon: Calendar },
  { label: 'Venta / POS', href: '/barbero/pos', icon: ShoppingBag },
  { label: 'Notificaciones', href: '/notificaciones', icon: Bell },
  { label: 'Mi Perfil', href: '/perfil', icon: UserCog },
]

export const clienteNavItems: NavItem[] = [
  { label: 'Mis Citas', href: '/cliente', icon: Calendar },
  { label: 'Reservar', href: '/reservar', icon: Scissors },
  { label: 'Tienda', href: '/tienda', icon: ShoppingBag },
  { label: 'Notificaciones', href: '/notificaciones', icon: Bell },
  { label: 'Mi Perfil', href: '/perfil', icon: UserCog },
]

export function isDashboardRoute(pathname: string): boolean {
  const prefixes = [
    '/admin',
    '/agenda',
    '/coordinador',
    '/reservar',
    '/barbero',
    '/cliente',
    '/calendario',
    '/notificaciones',
    '/perfil',
  ]
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  if (href === '/coordinador') return pathname === '/coordinador'
  if (href.startsWith('/agenda')) {
    return pathname === href || pathname.startsWith('/agenda/')
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
