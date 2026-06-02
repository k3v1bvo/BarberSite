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
  Gift,
  DollarSign,
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
  if (role === 'admin' || role === 'recepcionista') return '/agenda'
  return '/recepcion'
}

export function getAdminNavSections(agendaHref: string): NavSection[] {
  return [
    {
      title: 'Operación',
      items: [
        { label: 'Panel', href: '/admin', icon: LayoutDashboard, description: 'Resumen del día' },
        { label: 'Agenda', href: agendaHref, icon: Calendar, description: 'Citas y disponibilidad' },
        { label: 'Recepción', href: '/recepcion', icon: CalendarDays, description: 'Check-in del día' },
        { label: 'Venta / POS', href: '/reservar', icon: ShoppingBag, description: 'Nueva cita o venta' },
        { label: 'Asistencia', href: '/admin/asistencia', icon: Clock, description: 'Turnos del personal' },
        { label: 'Horarios', href: '/admin/horarios', icon: Clock, description: 'Plantillas y turnos' },
        { label: 'Lealtad', href: '/admin/lealtad', icon: Gift, description: 'Metas y recompensas' },
        { label: 'Comisiones', href: '/admin/comisiones', icon: DollarSign, description: 'Pagos a barberos' },
        { label: 'Notificaciones', href: '/notificaciones', icon: Bell, description: 'Alertas e historial' },
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
        { label: 'Usuarios', href: '/admin/usuarios', icon: Users },
        { label: 'Pedidos', href: '/admin/pedidos', icon: ClipboardList },
        { label: 'Reportes', href: '/admin/reportes', icon: BarChart3 },
        { label: 'Buscar', href: '/admin/buscar', icon: Search },
      ],
    },
  ]
}

export function flattenSections(sections: NavSection[]): NavItem[] {
  return sections.flatMap((s) => s.items)
}

export const recepcionNavItems: NavItem[] = [
  { label: 'Agenda', href: '/agenda', icon: Calendar },
  { label: 'Recepción', href: '/recepcion', icon: CalendarDays },
  { label: 'Venta / POS', href: '/reservar', icon: ShoppingBag },
  { label: 'Notificaciones', href: '/notificaciones', icon: Bell },
]

export const barberoNavItems = (agendaHref: string): NavItem[] => [
  { label: 'Mi panel', href: '/barbero', icon: LayoutDashboard },
  { label: 'Comisiones', href: '/barbero/comisiones', icon: DollarSign },
  { label: 'Mi agenda', href: agendaHref, icon: Calendar },
  { label: 'Venta / POS', href: '/reservar', icon: ShoppingBag },
  { label: 'Notificaciones', href: '/notificaciones', icon: Bell },
]

export const clienteNavItems: NavItem[] = [
  { label: 'Mis Citas', href: '/cliente', icon: Calendar },
  { label: 'Calendario', href: '/calendario', icon: CalendarDays },
  { label: 'Reservar', href: '/reservar', icon: Scissors },
  { label: 'Tienda', href: '/tienda', icon: ShoppingBag },
  { label: 'Galería', href: '/galeria', icon: Camera },
  { label: 'Notificaciones', href: '/notificaciones', icon: Bell },
]

export function isDashboardRoute(pathname: string): boolean {
  const prefixes = [
    '/admin',
    '/agenda',
    '/recepcion',
    '/reservar',
    '/barbero',
    '/cliente',
    '/calendario',
    '/notificaciones',
  ]
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  if (href.startsWith('/agenda')) {
    return pathname === href || pathname.startsWith('/agenda/')
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
