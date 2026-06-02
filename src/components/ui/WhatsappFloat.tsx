'use client'

import { MessageCircle } from 'lucide-react'

interface WhatsappFloatProps {
  href: string
}

export function WhatsappFloat({ href }: WhatsappFloatProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir por WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/40 transition-all duration-300 hover:scale-110 hover:shadow-xl animate-in fade-in slide-in-from-bottom-4"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  )
}
