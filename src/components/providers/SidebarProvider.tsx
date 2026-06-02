'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

interface SidebarContextValue {
  /** Desktop: sidebar collapsed to icon-only mode */
  collapsed: boolean
  /** Mobile: sidebar overlay is open */
  mobileOpen: boolean
  /** Toggle desktop collapsed/expanded */
  toggleCollapsed: () => void
  /** Set collapsed state explicitly */
  setCollapsed: (v: boolean) => void
  /** Toggle mobile overlay open/close */
  toggleMobile: () => void
  /** Close the mobile overlay */
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

const STORAGE_KEY = 'barber-sidebar-collapsed'

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedRaw] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage once on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'true') setCollapsedRaw(true)
    } catch {
      // SSR or private browsing — ignore
    }
    setHydrated(true)
  }, [])

  // Persist to localStorage on change (after hydration)
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed))
    } catch {
      // ignore
    }
  }, [collapsed, hydrated])

  // Close mobile sidebar on route change (via popstate)
  useEffect(() => {
    const handleRouteChange = () => setMobileOpen(false)
    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const toggleCollapsed = useCallback(() => setCollapsedRaw((v) => !v), [])
  const setCollapsed = useCallback((v: boolean) => setCollapsedRaw(v), [])
  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        mobileOpen,
        toggleCollapsed,
        setCollapsed,
        toggleMobile,
        closeMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within <SidebarProvider>')
  return ctx
}
