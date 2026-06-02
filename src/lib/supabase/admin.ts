import { createClient, SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | null = null

/** Cliente con service role (solo servidor). Opcional si no hay clave en .env */
export function createAdminSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return adminClient
}

/** Preferir admin; si no, usar el cliente pasado */
export function getNotificationDbClient(fallback: SupabaseClient): SupabaseClient {
  return createAdminSupabaseClient() ?? fallback
}
