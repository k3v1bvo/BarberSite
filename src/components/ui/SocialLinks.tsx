'use client'

import { Facebook, Instagram, MessageCircle } from 'lucide-react'
import type { SocialLinksConfig } from '@/lib/social'

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
    </svg>
  )
}

interface SocialLinksProps {
  links: SocialLinksConfig
  size?: 'md' | 'lg'
  className?: string
}

const itemClass =
  'group flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-all duration-300 hover:scale-110 hover:border-amber-500/50 hover:bg-amber-500 hover:text-black hover:shadow-lg hover:shadow-amber-500/25'

export function SocialLinks({ links, size = 'md', className = '' }: SocialLinksProps) {
  const dim = size === 'lg' ? 'w-14 h-14' : 'w-12 h-12'
  const icon = size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'

  const items = [
    {
      key: 'facebook',
      href: links.facebook,
      label: 'Facebook',
      icon: <Facebook className={icon} />,
      show: true,
    },
    {
      key: 'whatsapp',
      href: links.whatsapp,
      label: 'WhatsApp',
      icon: <MessageCircle className={icon} />,
      show: true,
    },
    {
      key: 'tiktok',
      href: links.tiktok,
      label: 'TikTok',
      icon: <TikTokIcon className={icon} />,
      show: true,
    },
    {
      key: 'instagram',
      href: links.instagram,
      label: 'Instagram',
      icon: <Instagram className={icon} />,
      show: Boolean(links.instagram),
    },
  ]

  return (
    <div className={className}>
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-3">
        Síguenos
      </p>
      <div className="flex flex-wrap gap-3">
        {items
          .filter((i) => i.show && i.href)
          .map((item) => (
            <a
              key={item.key}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.label}
              title={item.label}
              className={`${itemClass} ${dim}`}
            >
              {item.icon}
            </a>
          ))}
      </div>
    </div>
  )
}
