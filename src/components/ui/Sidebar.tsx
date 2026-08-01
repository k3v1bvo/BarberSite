'use client'

import { useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { usePathname } from 'next/navigation'
import {
  Scissors,
  Home,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/providers/SidebarProvider'
import {
  getAgendaHref,
  getAdminNavSections,
  barberoNavItems,
  recepcionNavItems,
  clienteNavItems,
  isNavItemActive,
  type NavSection,
} from '@/lib/navigation/dashboard-nav'

/* ——————————————————————————————————————————————
   Types
   —————————————————————————————————————————————— */
interface SidebarProps {
  role?: string
  userId?: string
}

/* ——————————————————————————————————————————————
   Tooltip wrapper (visible only when collapsed)
   —————————————————————————————————————————————— */
function Tooltip({
  label,
  children,
  show,
}: {
  label: string
  children: React.ReactNode
  show: boolean
}) {
  return (
    <div className="group/tip relative">
      {children}
      {show && (
        <span className="absolute left-16 top-1/2 -translate-y-1/2 px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white text-xs font-bold whitespace-nowrap pointer-events-none z-50">
          {label}
        </span>
      )}
    </div>
  )
}

/* ——————————————————————————————————————————————
   Nav Link (supports collapsed icon-only mode)
   —————————————————————————————————————————————— */
function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
  collapsed: boolean
}) {
  const link = (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 active:scale-95',
        collapsed && 'justify-center',
        active
          ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
          : 'text-zinc-400 hover:text-white hover:bg-white/5'
      )}
    >
      <Icon
        size={collapsed ? 20 : 18}
        className={cn(
          'shrink-0 transition-all duration-200',
          active ? 'text-black' : 'text-amber-500/70 hover:text-amber-400'
        )}
      />
      {!collapsed && (
        <span className="text-sm whitespace-nowrap overflow-hidden">
          {label}
        </span>
      )}
    </Link>
  )

  if (collapsed) {
    return <Tooltip label={label} show>{link}</Tooltip>
  }

  return link
}

/* ——————————————————————————————————————————————
   Section heading (hidden when collapsed)
   —————————————————————————————————————————————— */
function SectionTitle({ title, collapsed }: { title: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="h-px bg-white/5 my-2 mx-2" />
  }
  return (
    <p className="px-4 text-[10px] uppercase font-black text-zinc-600 tracking-[0.2em] mb-2">
      {title}
    </p>
  )
}

/* ——————————————————————————————————————————————
   Nav sections renderer
   —————————————————————————————————————————————— */
function NavSections({
  sections,
  pathname,
  collapsed,
}: {
  sections: NavSection[]
  pathname: string
  collapsed: boolean
}) {
  return (
    <>
      {sections.map((section) => (
        <div key={section.title} className={cn('mb-4', collapsed && 'mb-2')}>
          <SectionTitle title={section.title} collapsed={collapsed} />
          <div className={cn('space-y-0.5', collapsed && 'space-y-1')}>
            {section.items.map((item) => (
              <NavLink
                key={item.href + item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isNavItemActive(pathname, item.href)}
                collapsed={collapsed}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

/* ——————————————————————————————————————————————
   Flat items renderer (for non-admin roles)
   —————————————————————————————————————————————— */
function FlatNavItems({
  items,
  pathname,
  collapsed,
  agendaHref,
}: {
  items: { href: string; label: string; icon: LucideIcon }[]
  pathname: string
  collapsed: boolean
  agendaHref?: string
}) {
  return (
    <div className={cn('space-y-0.5', collapsed && 'space-y-1')}>
      {items.map((item) => {
        const href = agendaHref && item.href === '/agenda' ? agendaHref : item.href
        return (
          <NavLink
            key={href + item.label}
            href={href}
            label={item.label}
            icon={item.icon}
            active={isNavItemActive(pathname, href)}
            collapsed={collapsed}
          />
        )
      })}
    </div>
  )
}

/* ——————————————————————————————————————————————
   MAIN SIDEBAR COMPONENT
   —————————————————————————————————————————————— */
export function Sidebar({ role, userId }: SidebarProps) {
  const pathname = usePathname()
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebar()
  const sidebarRef = useRef<HTMLElement>(null)
  const agendaHref = getAgendaHref(role, userId)

  const areaLabel =
    role === 'cliente'
      ? 'Tu área'
      : role === 'barbero'
        ? 'Mi trabajo'
        : role === 'recepcionista'
          ? 'Recepción'
          : 'Administración'

  // Close mobile sidebar on pathname change
  useEffect(() => {
    closeMobile()
  }, [pathname, closeMobile])

  // Close mobile on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) closeMobile()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [mobileOpen, closeMobile])

  /* ——— Shared sidebar inner content ——— */
  const sidebarContent = (isMobile: boolean) => {
    const isCollapsed = isMobile ? false : collapsed

    return (
      <>
        {/* ── Header ── */}
        <div className={cn(
          'flex flex-col gap-2 mb-6',
          isCollapsed && 'items-center justify-center'
        )}>
          <Link
            href={role === 'admin' ? '/admin' : '/'}
            className={cn(
              'flex items-center text-amber-500 font-black tracking-tighter transition-all duration-300 hover:scale-105',
              isCollapsed ? 'justify-center text-base' : 'gap-3 text-xl'
            )}
          >
            <img src="/logo.png" alt="Barber Pro" className={cn('shrink-0 object-contain', isCollapsed ? 'w-6 h-6' : 'w-7 h-7')} />
            {!isCollapsed && <span>BARBER PRO</span>}
          </Link>
          {!isCollapsed && (
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest ml-1">
              {areaLabel}
            </p>
          )}

          {/* Mobile close button */}
          {isMobile && (
            <div
              className="absolute top-5 right-4 w-8 h-8"
              aria-label="Cerrar menú"
            >
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto">
          {role === 'admin' && (
            <NavSections
              sections={getAdminNavSections(agendaHref)}
              pathname={pathname}
              collapsed={isCollapsed}
            />
          )}

          {role === 'recepcionista' && (
            <FlatNavItems
              items={recepcionNavItems}
              pathname={pathname}
              collapsed={isCollapsed}
              agendaHref={agendaHref}
            />
          )}

          {role === 'barbero' && (
            <FlatNavItems
              items={barberoNavItems(agendaHref)}
              pathname={pathname}
              collapsed={isCollapsed}
            />
          )}

          {role === 'cliente' && (
            <FlatNavItems
              items={clienteNavItems}
              pathname={pathname}
              collapsed={isCollapsed}
            />
          )}

          {(!role || !['admin', 'recepcionista', 'barbero', 'cliente'].includes(role)) && (
            <FlatNavItems
              items={recepcionNavItems}
              pathname={pathname}
              collapsed={isCollapsed}
            />
          )}

          {/* ── Public site link ── */}
          <div className="pt-4 mt-4 border-t border-white/5">
            <NavLink
              href="/"
              label="Sitio público"
              icon={Home}
              active={false}
              collapsed={isCollapsed}
            />
          </div>
        </nav>

        {/* ── Footer card (hidden when collapsed) ── */}
        {!isCollapsed && (
          <div className="border-t border-white/5 pt-4">
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-400 mb-1">
                {role === 'cliente' ? 'Club de lealtad' : 'Atajos'}
              </p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                {role === 'cliente'
                  ? 'Acumula puntos por cada visita.'
                  : role === 'admin'
                    ? 'Usa el panel para el resumen; el menú lateral para cada módulo.'
                    : 'Agenda y recepción son tu flujo diario.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Desktop collapse toggle ── */}
        {!isMobile && (
          <Tooltip label={collapsed ? 'Expandir menú' : 'Contraer menú'} show={collapsed}>
            <div
              className="w-full flex items-center justify-center gap-2 mt-4 px-4 py-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-400 hover:text-white active:scale-95 cursor-pointer"
              aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            >
              {collapsed ? (
                <ChevronRight size={16} className="text-amber-500" />
              ) : (
                <>
                  <ChevronLeft size={16} className="text-amber-500" />
                  <span className="text-xs text-zinc-500 font-bold">Contraer</span>
                </>
              )}
            </div>
          </Tooltip>
        )}
      </>
    )
  }

  return (
    <>
      {/* ══════════════════════════════════════════════
          DESKTOP SIDEBAR
          ══════════════════════════════════════════════ */}
      <aside
        ref={sidebarRef}
        className={cn(
          'hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-zinc-950 border-r border-white/5 z-30 transition-all duration-300',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        <div className="flex flex-col h-full p-4">
          {sidebarContent(false)}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════
          MOBILE OVERLAY + SIDEBAR
          ══════════════════════════════════════════════ */}
      {/* Backdrop */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-20 transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <aside
        className={cn(
          'lg:hidden fixed left-0 top-0 h-screen w-64 bg-zinc-950 border-r border-white/5 z-40 transition-transform duration-300 flex flex-col p-4',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent(true)}
      </aside>
    </>
  )
}
