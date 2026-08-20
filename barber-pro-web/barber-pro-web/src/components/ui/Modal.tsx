'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  subtitle?: string
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-xl',
}: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      {/* Backdrop Click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Box */}
      <div
        className={`relative z-10 w-full ${maxWidth} max-h-[90vh] flex flex-col bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between border-b border-white/5 p-4 sm:p-6 bg-zinc-900/60 shrink-0">
            <div>
              <h3 className="text-xl sm:text-2xl font-black uppercase text-white leading-none">
                {title}
              </h3>
              {subtitle && (
                <p className="text-zinc-400 text-xs mt-1.5 font-medium">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 sm:p-3 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-colors border border-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
