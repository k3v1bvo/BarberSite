'use client'

import { ToastProvider } from '@/components/ui/Toast'
import { BrandProvider } from '@/components/providers/BrandProvider'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <BrandProvider>
      <ToastProvider>{children}</ToastProvider>
    </BrandProvider>
  )
}

