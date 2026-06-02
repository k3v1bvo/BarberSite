export interface SocialLinksConfig {
  facebook: string
  whatsapp: string
  tiktok: string
  instagram: string
}

const DEFAULT_PHONE = '59171234567'

function normalizeWhatsAppUrl(value: string, phoneFallback: string): string {
  if (!value) {
    const digits = phoneFallback.replace(/\D/g, '')
    return `https://wa.me/${digits}`
  }
  if (value.startsWith('http')) return value
  const digits = value.replace(/\D/g, '')
  return `https://wa.me/${digits}`
}

/** Enlaces desde variables de entorno (valores por defecto para que no queden botones vacíos) */
export function getSocialLinksFromEnv(): SocialLinksConfig {
  const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE || DEFAULT_PHONE

  return {
    facebook:
      process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK ||
      'https://www.facebook.com/',
    whatsapp: normalizeWhatsAppUrl(
      process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP || '',
      phone
    ),
    tiktok:
      process.env.NEXT_PUBLIC_SOCIAL_TIKTOK ||
      'https://www.tiktok.com/',
    instagram: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || '',
  }
}

export function mergeSocialFromConfig(
  base: SocialLinksConfig,
  rows: { clave: string; valor: string | null }[]
): SocialLinksConfig {
  const map = Object.fromEntries(rows.map((r) => [r.clave, r.valor || '']))
  const phone = map.contact_phone || process.env.NEXT_PUBLIC_CONTACT_PHONE || DEFAULT_PHONE

  return {
    facebook: map.social_facebook || base.facebook,
    whatsapp: map.social_whatsapp
      ? normalizeWhatsAppUrl(map.social_whatsapp, phone)
      : base.whatsapp,
    tiktok: map.social_tiktok || base.tiktok,
    instagram: map.social_instagram || base.instagram,
  }
}
