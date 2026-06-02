import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Role = 'admin' | 'recepcionista' | 'barbero' | 'cliente'

export interface AuthResult {
  user: { id: string; email?: string }
  role: Role
  supabase: SupabaseClient
}

export interface AuthError {
  error: NextResponse
}

/**
 * Verifica que el usuario esté autenticado y retorna su perfil.
 * Uso: const auth = await requireAuth(supabase)
 */
export async function requireAuth(
  supabase?: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<AuthResult | AuthError> {
  const sb = supabase ?? (await createServerSupabaseClient())
  const {
    data: { user },
  } = await sb.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile?.role) {
    return { error: NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 }) }
  }

  return { user: { id: user.id, email: user.email }, role: profile.role as Role, supabase: sb }
}

/**
 * Verifica que el usuario sea administrador.
 */
export async function requireAdmin(
  supabase?: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<AuthResult | AuthError> {
  const auth = await requireAuth(supabase)
  if ('error' in auth) return auth

  if (auth.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Solo administradores' }, { status: 403 }) }
  }

  return auth
}

/**
 * Verifica que el usuario tenga uno de los roles permitidos.
 */
export async function requireRole(
  roles: Role[],
  supabase?: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<AuthResult | AuthError> {
  const auth = await requireAuth(supabase)
  if ('error' in auth) return auth

  if (!roles.includes(auth.role)) {
    return {
      error: NextResponse.json(
        { error: `Requiere rol: ${roles.join(' o ')}` },
        { status: 403 }
      ),
    }
  }

  return auth
}

/** Type guard para verificar si el resultado es un error */
export function isAuthError(result: AuthResult | AuthError): result is AuthError {
  return 'error' in result && !('user' in result)
}
