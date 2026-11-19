import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | undefined

// Diccionario en memoria de respaldo si el WebView de Facebook/Instagram bloquea cookies de terceros
const memoryCookies: Record<string, string> = {}

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  if (!client) {
    try {
      client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              try {
                if (typeof document === 'undefined') return []
                return document.cookie
                  .split('; ')
                  .filter(Boolean)
                  .map((c) => {
                    const [name, ...rest] = c.split('=')
                    return { name, value: rest.join('=') }
                  })
              } catch {
                return Object.entries(memoryCookies).map(([name, value]) => ({ name, value }))
              }
            },
            setAll(cookiesToSet) {
              try {
                if (typeof document === 'undefined') return
                cookiesToSet.forEach(({ name, value, options }) => {
                  let cookieStr = `${name}=${value}`
                  if (options?.maxAge) cookieStr += `; max-age=${options.maxAge}`
                  if (options?.path) cookieStr += `; path=${options.path}`
                  if (options?.sameSite) cookieStr += `; samesite=${options.sameSite}`
                  if (options?.secure) cookieStr += '; secure'
                  document.cookie = cookieStr
                })
              } catch {
                cookiesToSet.forEach(({ name, value }) => {
                  memoryCookies[name] = value
                })
              }
            },
          },
        }
      )
    } catch (err) {
      console.warn('[Supabase Client] Inicializando cliente directo por restricción de WebView:', err)
      client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }
  }

  return client
}
