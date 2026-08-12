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

function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.02 0 1.513.769 1.513 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.62 0 12.017 0z" />
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
    {
      key: 'pinterest',
      href: links.pinterest,
      label: 'Pinterest',
      icon: <PinterestIcon className={icon} />,
      show: Boolean(links.pinterest),
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
