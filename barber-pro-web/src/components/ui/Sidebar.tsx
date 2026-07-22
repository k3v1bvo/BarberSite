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
import { useBrand } from '@/components/providers/BrandProvider'
import {
  getAgendaHref,
  getAdminNavSections,
  getCoordinadorNavSections,
  barberoNavItems,
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
    <div className="sidebar-tooltip-wrapper group/tip relative">
      {children}
      {show && (
        <span className="sidebar-tooltip">
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
  const { closeMobile } = useSidebar()

  const link = (
    <Link
      href={href}
      onClick={closeMobile}
      className={cn(
        'sidebar-nav-link group/link',
        collapsed && 'sidebar-nav-link--collapsed',
        active
          ? 'sidebar-nav-link--active'
          : 'sidebar-nav-link--inactive'
      )}
    >
      <Icon
        size={collapsed ? 20 : 18}
        className={cn(
          'shrink-0 transition-all duration-200',
          active ? 'text-black' : 'text-amber-500/70 group-hover/link:text-amber-400'
        )}
      />
      {!collapsed && (
        <span className="text-sm whitespace-nowrap overflow-hidden sidebar-label">
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
    return <div className="sidebar-section-divider" />
  }
  return (
    <p className="px-4 text-[10px] uppercase font-black text-zinc-600 tracking-[0.2em] mb-2 sidebar-label">
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
  const { brand } = useBrand()
  const pathname = usePathname()
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebar()
  const sidebarRef = useRef<HTMLElement>(null)
  const agendaHref = getAgendaHref(role, userId)

  const areaLabel =
    role === 'cliente'
      ? 'Tu área'
      : role === 'barbero'
        ? 'Mi trabajo'
        : role === 'coordinador'
          ? 'Coordinación'
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
          'sidebar-header',
          isCollapsed && 'sidebar-header--collapsed'
        )}>
          <Link
            href={role === 'admin' ? '/admin' : '/'}
            onClick={isMobile ? closeMobile : undefined}
            className={cn(
              'flex text-amber-500 font-black tracking-tighter transition-all duration-300',
              isCollapsed
                ? 'justify-center items-center text-base'
                : brand.mostrar_modo === 'ambos'
                  ? 'flex-col items-start gap-1'
                  : 'flex-row items-center gap-3 text-xl'
            )}
          >
            {brand.logo_url && (brand.mostrar_modo === 'logo' || brand.mostrar_modo === 'ambos') ? (
              <img
                src={brand.logo_url}
                alt={brand.nombre}
                className={cn(
                  'object-contain shrink-0 transition-all mix-blend-screen',
                  isCollapsed ? 'w-8 h-8' : brand.mostrar_modo === 'ambos' ? 'h-9 max-w-[160px]' : 'h-10 max-w-[180px]'
                )}
              />
            ) : (
              <Scissors className={cn('shrink-0 text-amber-500', isCollapsed ? 'w-6 h-6' : 'w-7 h-7')} />
            )}
            {!isCollapsed && (brand.mostrar_modo === 'ambos' || brand.mostrar_modo === 'texto' || !brand.logo_url) && (
              <span className={cn('sidebar-label font-bold text-amber-400 truncate', brand.mostrar_modo === 'ambos' ? 'text-xs tracking-wider uppercase opacity-90' : 'text-lg')}>
                {brand.nombre}
              </span>
            )}
          </Link>
          {!isCollapsed && (
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 ml-0.5 sidebar-label">
              {areaLabel}
            </p>
          )}

          {/* Mobile close button */}
          {isMobile && (
            <button
              onClick={closeMobile}
              className="absolute top-5 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className={cn(
          'sidebar-nav',
          isCollapsed && 'sidebar-nav--collapsed'
        )}>
          {role === 'admin' && (
            <NavSections
              sections={getAdminNavSections(agendaHref)}
              pathname={pathname}
              collapsed={isCollapsed}
            />
          )}

          {role === 'coordinador' && (
            <NavSections
              sections={getCoordinadorNavSections(agendaHref)}
              pathname={pathname}
              collapsed={isCollapsed}
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

          {(!role || !['admin', 'coordinador', 'barbero', 'cliente'].includes(role)) && (
            <FlatNavItems
              items={clienteNavItems}
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
          <div className="sidebar-footer">
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-400 mb-1">
                {role === 'cliente' ? 'Club de lealtad' : 'Atajos'}
              </p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                {role === 'cliente'
                  ? 'Acumula puntos por cada visita.'
                  : role === 'admin'
                    ? 'Usa el panel para el resumen; el menú lateral para cada módulo.'
                    : role === 'coordinador'
                      ? 'Caja, arqueo y contabilidad son tu flujo diario.'
                      : 'Agenda y ventas son tu flujo diario.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Desktop collapse toggle ── */}
        {!isMobile && (
          <Tooltip label={collapsed ? 'Expandir menú' : 'Contraer menú'} show={collapsed}>
            <button
              onClick={toggleCollapsed}
              className="sidebar-toggle-btn"
              aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            >
              {collapsed ? (
                <ChevronRight size={16} className="text-amber-500" />
              ) : (
                <>
                  <ChevronLeft size={16} className="text-amber-500" />
                  <span className="text-xs text-zinc-500 font-bold sidebar-label">Contraer</span>
                </>
              )}
            </button>
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
          'sidebar-desktop',
          collapsed ? 'sidebar-desktop--collapsed' : 'sidebar-desktop--expanded'
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* ══════════════════════════════════════════════
          MOBILE OVERLAY + SIDEBAR
          ══════════════════════════════════════════════ */}
      {/* Backdrop */}
      <div
        className={cn(
          'sidebar-overlay',
          mobileOpen ? 'sidebar-overlay--visible' : 'sidebar-overlay--hidden'
        )}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <aside
        className={cn(
          'sidebar-mobile',
          mobileOpen ? 'sidebar-mobile--open' : 'sidebar-mobile--closed'
        )}
      >
        {sidebarContent(true)}
      </aside>
    </>
  )
}
