'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getSocialLinksFromEnv,
  mergeSocialFromConfig,
  type SocialLinksConfig,
} from '@/lib/social'

export function useSocialLinks(): SocialLinksConfig {
  const [links, setLinks] = useState<SocialLinksConfig>(getSocialLinksFromEnv())

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('configuracion')
          .select('clave, valor')
          .in('clave', [
            'social_facebook',
            'social_whatsapp',
            'social_tiktok',
            'social_instagram',
            'contact_phone',
          ])

        if (data?.length) {
          setLinks(mergeSocialFromConfig(getSocialLinksFromEnv(), data))
        }
      } catch {
        /* usa env por defecto */
      }
    }
    load()
  }, [])

  return links
}
