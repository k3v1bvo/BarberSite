'use client'

import { ToastProvider } from '@/components/ui/Toast'
import { BrandProvider } from '@/components/providers/BrandProvider'
import { InAppBrowserBanner } from '@/components/ui/InAppBrowserBanner'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <BrandProvider>
      <ToastProvider>
        <InAppBrowserBanner />
        {children}
      </ToastProvider>
    </BrandProvider>
  )
}

