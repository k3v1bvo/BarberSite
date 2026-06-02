'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, LayoutDashboard } from 'lucide-react'
const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Panel',
  '/admin/usuarios': 'Usuarios',
  '/admin/servicios': 'Servicios',
  '/admin/productos': 'Inventario',
  '/admin/pedidos': 'Pedidos',
  '/admin/portafolio': 'Portafolio',
  '/admin/reportes': 'Reportes',
  '/admin/asistencia': 'Asistencia',
  '/admin/buscar': 'Buscar',
  '/agenda': 'Agenda',
  '/recepcion': 'Recepción',
  '/reservar': 'Venta / POS',
  '/barbero': 'Mi panel',
  '/cliente': 'Mis citas',
  '/calendario': 'Calendario',
  '/notificaciones': 'Notificaciones',
}

function resolveTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/agenda/')) return 'Agenda barbero'
  const match = Object.keys(PAGE_TITLES)
    .filter((k) => k !== '/admin')
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname.startsWith(k))
  return match ? PAGE_TITLES[match] : 'Dashboard'
}

export function DashboardBreadcrumb() {
  const pathname = usePathname()
  const title = resolveTitle(pathname)
  const showAdminHome = pathname.startsWith('/admin') && pathname !== '/admin'

  return (
    <div className="flex items-center gap-2 text-sm min-w-0">
      {showAdminHome ? (
        <>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-amber-500 font-bold transition-colors shrink-0"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden xl:inline">Panel</span>
          </Link>
          <ChevronRight className="w-4 h-4 text-zinc-700 shrink-0" />
        </>
      ) : null}
      <span className="font-black uppercase tracking-wider truncate text-white">{title}</span>
    </div>
  )
}
