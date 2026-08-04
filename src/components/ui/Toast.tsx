'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'
import clsx from 'clsx'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const add = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => remove(id), 4500)
    },
    [remove]
  )

  const value: ToastContextValue = {
    toast: add,
    success: (m) => add(m, 'success'),
    error: (m) => add(m, 'error'),
  }

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-24 lg:bottom-6 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const Icon = icons[t.type]
          return (
            <div
              key={t.id}
              className={clsx(
                'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md animate-in slide-in-from-right duration-300',
                t.type === 'success' && 'bg-emerald-950/90 border-emerald-500/30 text-emerald-100',
                t.type === 'error' && 'bg-red-950/90 border-red-500/30 text-red-100',
                t.type === 'info' && 'bg-zinc-900/95 border-white/10 text-white'
              )}
            >
              <Icon className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium flex-1">{t.message}</p>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de ToastProvider')
  }
  return ctx
}
